//! WASAPI音频渲染器

use crate::core::AudioConfig;
use crate::core::EqualizerMode;
use crate::renderer::{DitherType, Ditherer};
use crate::equalizer::AudioEqualizer;
use crate::equalizer::ParametricEqualizer;
use parking_lot::Mutex;
use ringbuf::HeapCons;
use ringbuf::consumer::Consumer;
use ringbuf::traits::Observer;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::time::Duration as StdDuration;
use wasapi::*;

use windows::Win32::Foundation::E_INVALIDARG;
use windows::Win32::Media::Audio::{
    AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED, AUDCLNT_E_DEVICE_IN_USE,
    AUDCLNT_E_ENDPOINT_CREATE_FAILED, AUDCLNT_E_EXCLUSIVE_MODE_NOT_ALLOWED,
    AUDCLNT_E_UNSUPPORTED_FORMAT,
};

use crate::core::AudioFormat;
use crate::utils::ThreadMessage;

// Windows HRESULT 错误码常量
const S_OK: i32 = 0;
const S_FALSE: i32 = 1;
const RPC_E_CHANGED_MODE: i32 = 0x80010106u32 as i32;

#[derive(Debug, Clone)]
pub struct RenderStats {
    pub callbacks: u64,
    pub underruns: u64,
    pub frames_written: u64,
    pub samples_written: u64,
    pub buffer_min_samples: usize,
    pub buffer_max_samples: usize,
    pub render_errors: u64,
    pub seek_clears: u64,
}

impl Default for RenderStats {
    fn default() -> Self {
        Self {
            callbacks: 0,
            underruns: 0,
            frames_written: 0,
            samples_written: 0,
            buffer_min_samples: usize::MAX,
            buffer_max_samples: 0,
            render_errors: 0,
            seek_clears: 0,
        }
    }
}

impl RenderStats {
    pub fn snapshot(&self) -> Self {
        let mut snapshot = self.clone();
        if snapshot.buffer_min_samples == usize::MAX {
            snapshot.buffer_min_samples = 0;
        }
        snapshot
    }
}

pub struct WasapiRenderer {
    stream_thread: Option<std::thread::JoinHandle<()>>,
    stats: Arc<Mutex<RenderStats>>,
}

impl WasapiRenderer {
    pub fn new() -> Self {
        Self {
            stream_thread: None,
            stats: Arc::new(Mutex::new(RenderStats::default())),
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
        equalizer: Arc<Mutex<Option<AudioEqualizer>>>,
        parametric_equalizer: Arc<Mutex<Option<ParametricEqualizer>>>,
        equalizer_mode: Arc<Mutex<EqualizerMode>>,
    ) -> Result<(), String> {
        let channels = device_format.channels as usize;
        let sample_rate = device_format.sample_rate;
        let buffer_durations = config.get_wasapi_buffer_durations();
        let share_mode = config.share_mode;
        let stats = self.stats.clone();

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
                share_mode,
                equalizer,
                parametric_equalizer,
                equalizer_mode,
                stats.clone(),
            ) {
                eprintln!("❌ 渲染线程错误: {}", e);
                stats.lock().render_errors += 1;
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

    pub fn get_stats(&self) -> RenderStats {
        self.stats.lock().snapshot()
    }

    pub fn reset_stats(&self) {
        *self.stats.lock() = RenderStats::default();
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
    share_mode: crate::core::ShareMode,
    equalizer: Arc<Mutex<Option<AudioEqualizer>>>,
    parametric_equalizer: Arc<Mutex<Option<ParametricEqualizer>>>,
    equalizer_mode: Arc<Mutex<EqualizerMode>>,
    stats: Arc<Mutex<RenderStats>>,
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

    let wave_format = device_format.wave_format.clone();

    // 初始化音频客户端（根据模式选择不同的初始化方式）
    let mut audio_client_result = None;
    let mut actual_buffer_duration = 0i64;

    use crate::core::ShareMode;
    match share_mode {
        ShareMode::Exclusive => {
            let (default_period, min_period) = audio_client
                .get_device_period()
                .map_err(|e| format!("获取设备周期失败: {:?}", e))?;

            println!(
                "   WASAPI独占周期: 默认 {:.2}ms, 最小 {:.2}ms",
                default_period as f64 / 10_000.0,
                min_period as f64 / 10_000.0
            );

            enable_raw_media_stream(&audio_client);

            let periods = build_exclusive_period_candidates(
                &audio_client,
                &wave_format,
                &buffer_durations,
                default_period,
            )?;

            let mut last_error = None;
            for period in periods {
                let buffer_duration = period * 16;
                let stream_mode = StreamMode::PollingExclusive {
                    buffer_duration_hns: buffer_duration,
                    period_hns: period,
                };

                match audio_client.initialize_client(&wave_format, &Direction::Render, &stream_mode)
                {
                    Ok(()) => {
                        actual_buffer_duration = buffer_duration;
                        audio_client_result = Some(());
                        println!(
                            "   ✅ 独占模式已打开: period {:.2}ms, buffer {:.2}ms",
                            period as f64 / 10_000.0,
                            buffer_duration as f64 / 10_000.0
                        );
                        break;
                    }
                    Err(e) => {
                        let error_message = describe_wasapi_error("初始化独占模式失败", &e);
                        println!(
                            "   ⚠️ period {:.2}ms / buffer {:.2}ms 不可用: {}",
                            period as f64 / 10_000.0,
                            buffer_duration as f64 / 10_000.0,
                            error_message
                        );
                        last_error = Some(error_message);

                        if is_buffer_alignment_error(&e) {
                            if let Ok(buffer_frames) = audio_client.get_buffer_size() {
                                let aligned_period = calculate_period_100ns(
                                    buffer_frames as i64,
                                    wave_format.get_samplespersec() as i64,
                                );
                                println!(
                                    "   🔧 驱动要求缓冲区对齐，重试 period {:.2}ms",
                                    aligned_period as f64 / 10_000.0
                                );
                                audio_client = device
                                    .get_iaudioclient()
                                    .map_err(|err| format!("重新创建AudioClient失败: {:?}", err))?;
                                enable_raw_media_stream(&audio_client);

                                let retry_mode = StreamMode::PollingExclusive {
                                    period_hns: aligned_period,
                                    buffer_duration_hns: 16 * aligned_period,
                                };
                                match audio_client.initialize_client(
                                    &wave_format,
                                    &Direction::Render,
                                    &retry_mode,
                                ) {
                                    Ok(()) => {
                                        actual_buffer_duration = 16 * aligned_period;
                                        audio_client_result = Some(());
                                        println!(
                                            "   ✅ 独占模式已按驱动对齐要求打开: period {:.2}ms, buffer {:.2}ms",
                                            aligned_period as f64 / 10_000.0,
                                            (16 * aligned_period) as f64 / 10_000.0
                                        );
                                        break;
                                    }
                                    Err(retry_error) => {
                                        last_error = Some(describe_wasapi_error(
                                            "对齐后初始化独占模式失败",
                                            &retry_error,
                                        ));
                                    }
                                }
                            }
                        }

                        audio_client = device
                            .get_iaudioclient()
                            .map_err(|err| format!("重新创建AudioClient失败: {:?}", err))?;
                        enable_raw_media_stream(&audio_client);
                    }
                }
            }

            if audio_client_result.is_none() {
                return Err(last_error.unwrap_or_else(|| {
                    "初始化独占模式失败: 设备未接受任何独占缓冲区设置".to_string()
                }));
            }

            if audio_client.get_sharemode() != Some(wasapi::ShareMode::Exclusive) {
                return Err("WASAPI客户端未以独占模式启动，拒绝回退到共享混音器".to_string());
            }
        }
        ShareMode::Shared => {
            // 共享模式：使用系统默认缓冲区，启用自动格式转换
            let stream_mode = StreamMode::PollingShared {
                autoconvert: true,
                buffer_duration_hns: 0, // 0 表示使用系统默认缓冲区
            };

            match audio_client.initialize_client(&wave_format, &Direction::Render, &stream_mode) {
                Ok(()) => {
                    audio_client_result = Some(());
                    println!("   ✅ 共享模式已初始化（使用系统默认缓冲区）");
                }
                Err(e) => {
                    return Err(format!("初始化共享模式失败: {:?}", e));
                }
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

    let mode_str = match share_mode {
        ShareMode::Exclusive => "独占",
        ShareMode::Shared => "共享",
    };

    println!("✅ WASAPI{}流已启动", mode_str);
    println!(
        "   设备: {} Hz, {} 声道, {} / {} bits, 缓冲 {} 帧 ({:.2}ms)",
        device_format.sample_rate,
        device_format.channels,
        device_format.valid_bits_per_sample,
        device_format.bits_per_sample,
        buffer_frame_count,
        buffer_frame_count as f64 / sample_rate as f64 * 1000.0
    );

    // 计算最优的轮询间隔
    let poll_interval_ms = if share_mode == ShareMode::Exclusive && actual_buffer_duration > 0 {
        // 独占模式：使用缓冲区时长的1/3到1/2
        let buffer_duration_ms = actual_buffer_duration as f64 / 10000.0;
        (buffer_duration_ms / 3.0).max(1.0).min(10.0) as u64
    } else {
        // 共享模式：使用固定的轮询间隔
        5u64
    };

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

    let dither_label = if ditherer.is_some() {
        format!(" ({}抖动)", dither_name)
    } else {
        String::new()
    };

    println!(
        "   音频处理: {} 位 {:?}{}",
        device_format.bits_per_sample,
        device_format.sample_type,
        dither_label
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
                    stats.lock().seek_clears += 1;

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
            std::thread::sleep(StdDuration::from_millis(20));
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
            std::thread::sleep(StdDuration::from_millis(20));
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
                    audio_data.push(sample);
                } else {
                    audio_data.push(0.0);
                    underrun = true;
                }
            }

            drop(consumer_guard);

            // 应用均衡器处理（根据模式选择）
            let mode = *equalizer_mode.lock();
            match mode {
                EqualizerMode::Graphic => {
                    // 图形均衡器
                    if let Some(ref mut eq) = *equalizer.lock() {
                        eq.process_interleaved(&mut audio_data);
                    }
                }
                EqualizerMode::Parametric => {
                    // 参量均衡器
                    if let Some(ref mut peq) = *parametric_equalizer.lock() {
                        peq.process_interleaved(&mut audio_data);
                    }
                }
            }

            // 应用音量
            for sample in &mut audio_data {
                *sample *= vol;
            }

            let byte_data = encode_samples_for_device(
                &audio_data,
                &device_format,
                channels,
                ditherer.as_mut(),
            )?;

            if byte_data.len()
                != frames_available as usize * device_format.block_align as usize
            {
                stats.lock().render_errors += 1;
                return Err(format!(
                    "渲染数据大小不匹配: {} bytes，期望 {} bytes",
                    byte_data.len(),
                    frames_available as usize * device_format.block_align as usize
                ));
            }

            if let Err(e) =
                render_client.write_to_device(frames_available as usize, &byte_data, None)
            {
                eprintln!("❌ 渲染: 写入设备失败: {:?}", e);
                stats.lock().render_errors += 1;
            }

            {
                let mut stats_guard = stats.lock();
                stats_guard.callbacks += 1;
                stats_guard.frames_written += frames_available as u64;
                stats_guard.samples_written += audio_data.len() as u64;
                stats_guard.buffer_min_samples = stats_guard.buffer_min_samples.min(buffer_len);
                stats_guard.buffer_max_samples = stats_guard.buffer_max_samples.max(buffer_len);
                if underrun {
                    stats_guard.underruns += 1;
                }
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

fn build_exclusive_period_candidates(
    audio_client: &AudioClient,
    wave_format: &WaveFormat,
    requested_durations: &[i64],
    default_period: i64,
) -> Result<Vec<i64>, String> {
    let mut candidates = Vec::new();
    let requested = if requested_durations.is_empty() {
        vec![default_period]
    } else {
        requested_durations.to_vec()
    };

    for duration in requested {
        let aligned = audio_client
            .calculate_aligned_period_near(duration, Some(128), wave_format)
            .map_err(|e| format!("计算独占缓冲区周期失败: {:?}", e))?;
        if !candidates.contains(&aligned) {
            candidates.push(aligned);
        }
    }

    let default_aligned = audio_client
        .calculate_aligned_period_near(default_period, Some(128), wave_format)
        .map_err(|e| format!("计算默认独占周期失败: {:?}", e))?;
    if !candidates.contains(&default_aligned) {
        candidates.push(default_aligned);
    }

    Ok(candidates)
}

fn enable_raw_media_stream(audio_client: &AudioClient) {
    match audio_client.set_properties(
        AudioClientProperties::new()
            .set_category(StreamCategory::Media)
            .set_option(StreamOption::Raw),
    ) {
        Ok(()) => println!("   ✅ 已请求WASAPI raw stream，减少系统音效处理"),
        Err(e) => println!("   ⚠️ WASAPI raw stream属性不可用，继续使用独占模式: {:?}", e),
    }
}

fn encode_samples_for_device(
    samples: &[f32],
    format: &AudioFormat,
    channels: usize,
    mut ditherer: Option<&mut Ditherer>,
) -> Result<Vec<u8>, String> {
    let bytes_per_sample = format.block_align as usize / channels;
    if bytes_per_sample == 0 || format.block_align as usize % channels != 0 {
        return Err(format!(
            "设备格式块对齐无效: block_align={}, channels={}",
            format.block_align, channels
        ));
    }

    match format.sample_type {
        SampleType::Float => encode_float_samples(samples, bytes_per_sample),
        SampleType::Int => {
            let mut bytes = Vec::with_capacity(samples.len() * bytes_per_sample);
            for (index, &sample) in samples.iter().enumerate() {
                let channel = index % channels;
                let pcm = if let Some(ref mut dither) = ditherer {
                    dither.float_to_pcm(sample, channel, format.valid_bits_per_sample)
                } else {
                    sample_to_pcm_without_dither(sample, format.valid_bits_per_sample)
                };
                write_pcm_sample(&mut bytes, pcm, bytes_per_sample, format.valid_bits_per_sample)?;
            }
            Ok(bytes)
        }
    }
}

fn encode_float_samples(samples: &[f32], bytes_per_sample: usize) -> Result<Vec<u8>, String> {
    match bytes_per_sample {
        4 => Ok(samples
            .iter()
            .flat_map(|&sample| sample.clamp(-1.0, 1.0).to_le_bytes())
            .collect()),
        unsupported => Err(format!("不支持的浮点WASAPI样本宽度: {} bytes", unsupported)),
    }
}

fn sample_to_pcm_without_dither(sample: f32, valid_bits: u16) -> i32 {
    let valid_bits = valid_bits.clamp(1, 31);
    let max_value = ((1i64 << (valid_bits - 1)) - 1) as f32;
    let min_value = (-(1i64 << (valid_bits - 1))) as f32;
    (sample.clamp(-1.0, 1.0) * max_value)
        .round()
        .clamp(min_value, max_value) as i32
}

fn write_pcm_sample(
    bytes: &mut Vec<u8>,
    sample: i32,
    bytes_per_sample: usize,
    valid_bits: u16,
) -> Result<(), String> {
    match bytes_per_sample {
        1 => bytes.push(sample as i8 as u8),
        2 => bytes.extend_from_slice(&(sample as i16).to_le_bytes()),
        3 => {
            let shifted = if valid_bits < 24 {
                sample << (24 - valid_bits)
            } else {
                sample
            };
            let sample_bytes = shifted.to_le_bytes();
            bytes.extend_from_slice(&sample_bytes[..3]);
        }
        4 => {
            let shifted = if valid_bits < 32 {
                sample << (32 - valid_bits)
            } else {
                sample
            };
            bytes.extend_from_slice(&shifted.to_le_bytes());
        }
        unsupported => return Err(format!("不支持的PCM样本宽度: {} bytes", unsupported)),
    }

    Ok(())
}

fn describe_wasapi_error(prefix: &str, error: &WasapiError) -> String {
    if let WasapiError::Windows(werr) = error {
        let reason = match werr.code() {
            E_INVALIDARG => "参数无效",
            AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED => "缓冲区大小未按驱动要求对齐",
            AUDCLNT_E_DEVICE_IN_USE => "设备已被其他独占流占用",
            AUDCLNT_E_UNSUPPORTED_FORMAT => "设备不支持该独占格式",
            AUDCLNT_E_EXCLUSIVE_MODE_NOT_ALLOWED => {
                "Windows声音设置不允许应用程序独占控制该设备"
            }
            AUDCLNT_E_ENDPOINT_CREATE_FAILED => "创建音频端点失败",
            _ => "Windows WASAPI错误",
        };
        format!("{prefix}: {reason} (HRESULT 0x{:08X})", werr.code().0 as u32)
    } else {
        format!("{prefix}: {:?}", error)
    }
}

fn is_buffer_alignment_error(error: &WasapiError) -> bool {
    matches!(
        error,
        WasapiError::Windows(werr) if werr.code() == AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED
    )
}
