//! WASAPI音频渲染器

use crate::audio_config::AudioConfig;
use crate::dither::{DitherType, Ditherer};
use parking_lot::Mutex;
use ringbuf::HeapCons;
use ringbuf::consumer::Consumer;
use ringbuf::traits::Observer;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::time::Duration as StdDuration;
use wasapi::*;

use crate::audio_format::AudioFormat;
use crate::thread_message::ThreadMessage;

// Windows HRESULT 错误码常量
const S_OK: i32 = 0;
const S_FALSE: i32 = 1;
const RPC_E_CHANGED_MODE: i32 = 0x80010106u32 as i32;

pub struct WasapiRenderer {
    stream_thread: Option<std::thread::JoinHandle<()>>,
}

impl WasapiRenderer {
    pub fn new() -> Self {
        Self {
            stream_thread: None,
        }
    }

    pub fn start(
        &mut self,
        consumer: Arc<Mutex<HeapCons<f32>>>,
        volume: Arc<Mutex<f32>>,
        is_playing: Arc<AtomicBool>,
        is_paused: Arc<AtomicBool>,
        device_format: AudioFormat,
        error_sender: Sender<ThreadMessage>,
        message_receiver: Receiver<ThreadMessage>,
        dither_type: DitherType,
        config: &AudioConfig,
    ) -> Result<(), String> {
        let channels = device_format.channels as usize;
        let sample_rate = device_format.sample_rate;
        let buffer_durations = config.get_wasapi_buffer_durations();

        let stream_thread = std::thread::spawn(move || {
            if let Err(e) = run_render_loop(
                consumer,
                volume,
                is_playing,
                is_paused,
                device_format,
                channels,
                sample_rate,
                message_receiver,
                dither_type,
                buffer_durations,
            ) {
                eprintln!("❌ 渲染线程错误: {}", e);
                let _ = error_sender.send(ThreadMessage::Error(e));
            }
        });

        self.stream_thread = Some(stream_thread);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(thread) = self.stream_thread.take() {
            let _ = thread.join();
        }
    }
}

fn run_render_loop(
    consumer: Arc<Mutex<HeapCons<f32>>>,
    volume: Arc<Mutex<f32>>,
    is_playing: Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
    device_format: AudioFormat,
    channels: usize,
    sample_rate: u32,
    message_receiver: Receiver<ThreadMessage>,
    dither_type: DitherType,
    buffer_durations: Vec<i64>,
) -> Result<(), String> {
    // 初始化COM
    let hr = initialize_mta();
    if hr.is_err() {
        let hr_code = hr.0;
        if hr_code != RPC_E_CHANGED_MODE && hr_code != S_FALSE && hr_code != S_OK {
            return Err(format!("初始化COM失败: 0x{:08X}", hr_code as u32));
        }
    }

    // 获取音频设备
    let device =
        get_default_device(&Direction::Render).map_err(|e| format!("获取默认设备失败: {:?}", e))?;

    let mut audio_client = device
        .get_iaudioclient()
        .map_err(|e| format!("创建AudioClient失败: {:?}", e))?;

    // 创建WaveFormat
    let channelmask = make_channelmasks(device_format.channels as usize)
        .first()
        .copied()
        .unwrap_or(0x3);

    let wave_format = WaveFormat::new(
        device_format.bits_per_sample as usize,
        device_format.bits_per_sample as usize,
        &device_format.sample_type,
        device_format.sample_rate as usize,
        device_format.channels as usize,
        Some(channelmask),
    );

    // 初始化独占模式
    // 尝试使用更小的缓冲区以降低延迟
    // 从最低延迟开始尝试，如果失败则逐步增加
    let mut audio_client_result = None;
    let mut actual_buffer_duration = 0i64;

    for &duration in &buffer_durations {
        let stream_mode = StreamMode::PollingExclusive {
            buffer_duration_hns: duration,
            period_hns: duration,
        };

        match audio_client.initialize_client(&wave_format, &Direction::Render, &stream_mode) {
            Ok(()) => {
                actual_buffer_duration = duration;
                audio_client_result = Some(());
                println!("   ✅ 使用缓冲区大小: {:.1}ms", duration as f64 / 10000.0);
                break;
            }
            Err(e) => {
                if duration == buffer_durations[buffer_durations.len() - 1] {
                    // 最后一次尝试也失败了
                    return Err(format!("初始化AudioClient失败: {:?}", e));
                }
                println!(
                    "   ⚠️ {:.1}ms缓冲区不支持，尝试更大的缓冲区",
                    duration as f64 / 10000.0
                );
            }
        }
    }

    if audio_client_result.is_none() {
        return Err("无法找到支持的缓冲区大小".to_string());
    }

    let buffer_frame_count = audio_client
        .get_buffer_size()
        .map_err(|e| format!("获取缓冲区大小失败: {:?}", e))?;

    let render_client = audio_client
        .get_audiorenderclient()
        .map_err(|e| format!("获取渲染客户端失败: {:?}", e))?;

    audio_client
        .start_stream()
        .map_err(|e| format!("启动音频流失败: {:?}", e))?;

    println!("✅ WASAPI独占流已启动");
    println!(
        "   设备: {} Hz, {} 声道, 缓冲 {} 帧 ({:.2}ms)",
        device_format.sample_rate,
        device_format.channels,
        buffer_frame_count,
        buffer_frame_count as f64 / sample_rate as f64 * 1000.0
    );

    // 计算最优的轮询间隔
    // 使用缓冲区时长的1/3到1/2，避免欠载和过度轮询
    let buffer_duration_ms = actual_buffer_duration as f64 / 10000.0;
    let poll_interval_ms = (buffer_duration_ms / 3.0).max(1.0).min(10.0) as u64;

    let mut callback_counter = 0u64;
    let is_float = matches!(device_format.sample_type, SampleType::Float);
    let mut stream_running = true;

    // 如果输出格式是Int16，创建抖动器以提高音质
    let mut ditherer = if !is_float {
        Some(Ditherer::new(dither_type, channels))
    } else {
        None
    };

    let dither_name = match dither_type {
        DitherType::None => "无",
        DitherType::Rectangular => "RPDF",
        DitherType::Triangular => "TPDF",
        DitherType::NoiseShaped => "噪声整形",
    };

    println!(
        "   音频处理: {} 位 {:?}{}",
        device_format.bits_per_sample,
        device_format.sample_type,
        if ditherer.is_some() {
            &format!(" ({}抖动)", dither_name)
        } else {
            ""
        }
    );

    // 渲染循环
    loop {
        // 检查来自解码器的消息
        while let Ok(message) = message_receiver.try_recv() {
            match message {
                ThreadMessage::SeekRequest(position) => {
                    println!("🔄 渲染器: 收到跳转请求 {:.2}秒,清空缓冲区", position);

                    // 清空环形缓冲区
                    let mut consumer_guard = consumer.lock();
                    let cleared_count = consumer_guard.occupied_len();

                    // 清空所有待播放的样本
                    while consumer_guard.try_pop().is_some() {}

                    drop(consumer_guard);

                    println!("✅ 渲染器: 已清空 {} 个样本", cleared_count);

                    // 重置抖动器状态，避免跳转时的伪影
                    if let Some(ref mut dither) = ditherer {
                        dither.reset();
                    }
                }
                _ => {} // 忽略其他消息
            }
        }

        if !is_playing.load(Ordering::SeqCst) {
            break;
        }

        // 检查暂停状态
        let paused = is_paused.load(Ordering::SeqCst);

        if paused && stream_running {
            // 暂停：停止流，但不清空缓冲区
            let _ = audio_client.stop_stream();
            stream_running = false;
            println!("⏸️ WASAPI流已暂停");
            std::thread::sleep(StdDuration::from_millis(50));
            continue;
        } else if !paused && !stream_running {
            // 恢复：重启流
            audio_client
                .start_stream()
                .map_err(|e| format!("重启音频流失败: {:?}", e))?;
            stream_running = true;
            println!("▶️ WASAPI流已恢复");
        }

        if !stream_running {
            std::thread::sleep(StdDuration::from_millis(50));
            continue;
        }

        let frames_available = match audio_client.get_available_space_in_frames() {
            Ok(frames) => frames,
            Err(e) => {
                eprintln!("❌ 渲染: 获取可用空间失败: {:?}", e);
                std::thread::sleep(StdDuration::from_millis(poll_interval_ms));
                continue;
            }
        };

        if frames_available > 0 {
            callback_counter += 1;

            let mut consumer_guard = consumer.lock();
            let vol = *volume.lock();
            let buffer_len = consumer_guard.occupied_len();

            let samples_needed = frames_available as usize * channels;
            let mut audio_data: Vec<f32> = Vec::with_capacity(samples_needed);
            let mut underrun = false;

            for _ in 0..samples_needed {
                if let Some(sample) = consumer_guard.try_pop() {
                    audio_data.push(sample * vol);
                } else {
                    audio_data.push(0.0);
                    underrun = true;
                }
            }

            drop(consumer_guard);

            // 根据设备格式转换数据
            let byte_data: Vec<u8> = if is_float {
                // Float32格式: 直接转换为字节
                audio_data
                    .iter()
                    .flat_map(|&sample| sample.to_le_bytes())
                    .collect()
            } else {
                // Int16格式: 使用抖动器进行高质量转换
                if let Some(ref mut dither) = ditherer {
                    let i16_samples = dither.convert_batch(&audio_data, channels);
                    i16_samples
                        .iter()
                        .flat_map(|&sample| sample.to_le_bytes())
                        .collect()
                } else {
                    // 回退方案
                    audio_data
                        .iter()
                        .flat_map(|&sample| {
                            let sample_i16 = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
                            sample_i16.to_le_bytes()
                        })
                        .collect()
                }
            };

            if let Err(e) =
                render_client.write_to_device(frames_available as usize, &byte_data, None)
            {
                eprintln!("❌ 渲染: 写入设备失败: {:?}", e);
            }

            if callback_counter % 5000 == 0 && callback_counter > 0 {
                println!(
                    "🔊 音频回调 #{}: 缓冲区 {} 样本",
                    callback_counter, buffer_len
                );
            }

            if underrun && callback_counter % 1000 == 0 {
                eprintln!("⚠️ 音频回调 #{}: 缓冲区欠载", callback_counter);
            }
        }

        std::thread::sleep(StdDuration::from_millis(poll_interval_ms));
    }

    let _ = audio_client.stop_stream();
    Ok(())
}
