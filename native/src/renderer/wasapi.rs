//! WASAPI音频渲染器

use crate::core::AudioConfig;
use crate::core::EqualizerMode;
use crate::equalizer::AudioEqualizer;
use crate::equalizer::ParametricEqualizer;
use crate::renderer::{DitherType, Ditherer};
use parking_lot::Mutex;
use ringbuf::HeapCons;
use ringbuf::consumer::Consumer;
use ringbuf::traits::Observer;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU32, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::time::Duration as StdDuration;
use wasapi::*;

use windows::Win32::Foundation::{E_INVALIDARG, HANDLE};
use windows::Win32::Media::Audio::{
    AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED, AUDCLNT_E_DEVICE_IN_USE, AUDCLNT_E_ENDPOINT_CREATE_FAILED,
    AUDCLNT_E_EXCLUSIVE_MODE_NOT_ALLOWED, AUDCLNT_E_UNSUPPORTED_FORMAT,
};
use windows::Win32::System::Threading::{
    AVRT_PRIORITY_HIGH, AvRevertMmThreadCharacteristics, AvSetMmThreadCharacteristicsW,
    AvSetMmThreadPriority,
};
use windows::core::PCWSTR;

use crate::core::AudioFormat;
use crate::utils::ThreadMessage;

// Windows HRESULT 错误码常量
const S_OK: i32 = 0;
const S_FALSE: i32 = 1;
const RPC_E_CHANGED_MODE: i32 = 0x80010106u32 as i32;
const SHARED_POLL_INTERVAL_MS: u64 = 5;
const PAUSED_SLEEP_MS: u64 = 5;
const EXCLUSIVE_POLL_MAX_MS: f64 = 5.0;
const STATS_FLUSH_CALLBACKS: u64 = 256;
const EVENT_WAIT_TIMEOUT_MS: u32 = 20;

struct MmcssGuard {
    handle: Option<HANDLE>,
}

impl MmcssGuard {
    fn enter() -> Self {
        let mut last_error = None;

        for task_name in ["Pro Audio", "Audio"] {
            match register_mmcss_task(task_name) {
                Ok(handle) => {
                    println!("   ✅ WASAPI渲染线程已启用MMCSS任务: {}", task_name);
                    return Self {
                        handle: Some(handle),
                    };
                }
                Err(error) => {
                    last_error = Some(format!("{:?}", error));
                }
            }
        }

        println!(
            "   ⚠️ 未能启用MMCSS音频线程优先级，继续使用普通线程优先级: {}",
            last_error.unwrap_or_else(|| "未知错误".to_string())
        );
        Self { handle: None }
    }
}

impl Drop for MmcssGuard {
    fn drop(&mut self) {
        if let Some(handle) = self.handle.take() {
            if let Err(error) = unsafe { AvRevertMmThreadCharacteristics(handle) } {
                eprintln!("⚠️ 释放MMCSS线程任务失败: {:?}", error);
            }
        }
    }
}

fn register_mmcss_task(task_name: &str) -> windows::core::Result<HANDLE> {
    let task_name_wide: Vec<u16> = task_name.encode_utf16().chain(std::iter::once(0)).collect();
    let mut task_index = 0u32;

    let handle =
        unsafe { AvSetMmThreadCharacteristicsW(PCWSTR(task_name_wide.as_ptr()), &mut task_index) }?;

    if let Err(error) = unsafe { AvSetMmThreadPriority(handle, AVRT_PRIORITY_HIGH) } {
        let _ = unsafe { AvRevertMmThreadCharacteristics(handle) };
        return Err(error);
    }

    Ok(handle)
}

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

    fn merge_from(&mut self, pending: &mut Self) {
        self.callbacks += pending.callbacks;
        self.underruns += pending.underruns;
        self.frames_written += pending.frames_written;
        self.samples_written += pending.samples_written;
        self.render_errors += pending.render_errors;
        self.seek_clears += pending.seek_clears;

        if pending.buffer_min_samples != usize::MAX {
            self.buffer_min_samples = self.buffer_min_samples.min(pending.buffer_min_samples);
        }
        self.buffer_max_samples = self.buffer_max_samples.max(pending.buffer_max_samples);

        *pending = Self::default();
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
        consumer: HeapCons<f32>,
        volume: Arc<AtomicU32>,
        is_playing: Arc<AtomicBool>,
        is_paused: Arc<AtomicBool>,
        device_format: AudioFormat,
        error_sender: Sender<ThreadMessage>,
        message_receiver: Receiver<ThreadMessage>,
        dither_type: DitherType,
        config: &AudioConfig,
        equalizer: Arc<Mutex<Option<AudioEqualizer>>>,
        parametric_equalizer: Arc<Mutex<Option<ParametricEqualizer>>>,
        equalizer_mode: Arc<AtomicU8>,
        equalizer_enabled: Arc<AtomicBool>,
        parametric_equalizer_enabled: Arc<AtomicBool>,
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
                equalizer_enabled,
                parametric_equalizer_enabled,
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
    mut consumer: HeapCons<f32>,
    volume: Arc<AtomicU32>,
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
    equalizer_mode: Arc<AtomicU8>,
    equalizer_enabled: Arc<AtomicBool>,
    parametric_equalizer_enabled: Arc<AtomicBool>,
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
    let _mmcss_guard = MmcssGuard::enter();

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
                let stream_mode = StreamMode::EventsExclusive { period_hns: period };

                match audio_client.initialize_client(&wave_format, &Direction::Render, &stream_mode)
                {
                    Ok(()) => {
                        actual_buffer_duration = period;
                        audio_client_result = Some(());
                        println!(
                            "   ✅ 事件驱动独占模式已打开: period {:.2}ms",
                            period as f64 / 10_000.0,
                        );
                        break;
                    }
                    Err(e) => {
                        let error_message = describe_wasapi_error("初始化独占模式失败", &e);
                        println!(
                            "   ⚠️ event period {:.2}ms 不可用: {}",
                            period as f64 / 10_000.0,
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

                                let retry_mode = StreamMode::EventsExclusive {
                                    period_hns: aligned_period,
                                };
                                match audio_client.initialize_client(
                                    &wave_format,
                                    &Direction::Render,
                                    &retry_mode,
                                ) {
                                    Ok(()) => {
                                        actual_buffer_duration = aligned_period;
                                        audio_client_result = Some(());
                                        println!(
                                            "   ✅ 事件驱动独占模式已按驱动对齐要求打开: period {:.2}ms",
                                            aligned_period as f64 / 10_000.0
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
            let stream_mode = StreamMode::EventsShared {
                autoconvert: true,
                buffer_duration_hns: 0,
            };

            match audio_client.initialize_client(&wave_format, &Direction::Render, &stream_mode) {
                Ok(()) => {
                    audio_client_result = Some(());
                    println!("   ✅ 事件驱动共享模式已初始化（使用系统默认缓冲区）");
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

    let event_handle = audio_client
        .set_get_eventhandle()
        .map_err(|e| format!("创建WASAPI事件句柄失败: {:?}", e))?;

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

    let poll_interval_ms = calculate_fallback_poll_interval_ms(share_mode, actual_buffer_duration);

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
        device_format.bits_per_sample, device_format.sample_type, dither_label
    );

    let mut audio_data = Vec::new();
    let mut byte_data = Vec::new();
    let mut pending_stats = RenderStats::default();

    // 渲染循环
    loop {
        // 检查来自解码器的消息
        while let Ok(message) = message_receiver.try_recv() {
            match message {
                ThreadMessage::SeekRequest {
                    command,
                    ack_sender,
                } => {
                    println!(
                        "🔄 渲染器: 收到跳转请求 {:.2}秒 (seek #{}), 清空缓冲区",
                        command.position, command.generation
                    );

                    let cleared_count = consumer.clear();

                    println!("✅ 渲染器: 已清空 {} 个样本", cleared_count);
                    pending_stats.seek_clears += 1;

                    // 重置抖动器状态，避免跳转时的伪影
                    if let Some(ref mut dither) = ditherer {
                        dither.reset();
                    }

                    let _ = ack_sender.send(());
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
            std::thread::sleep(StdDuration::from_millis(PAUSED_SLEEP_MS));
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
            std::thread::sleep(StdDuration::from_millis(PAUSED_SLEEP_MS));
            continue;
        }

        match event_handle.wait_for_event(EVENT_WAIT_TIMEOUT_MS) {
            Ok(()) => {}
            Err(_) => {
                std::thread::sleep(StdDuration::from_millis(poll_interval_ms));
            }
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

            let vol = f32::from_bits(volume.load(Ordering::Relaxed));
            let buffer_len = consumer.occupied_len();

            let samples_needed = frames_available as usize * channels;
            audio_data.resize(samples_needed, 0.0);
            let samples_read = consumer.pop_slice(&mut audio_data);
            let underrun = samples_read < samples_needed;
            if underrun {
                audio_data[samples_read..].fill(0.0);
            }

            // 应用均衡器处理（根据模式选择）
            let mode = EqualizerMode::from_atomic_value(equalizer_mode.load(Ordering::Relaxed));
            match mode {
                EqualizerMode::Graphic => {
                    // 图形均衡器
                    if equalizer_enabled.load(Ordering::Relaxed)
                        && let Some(mut eq_guard) = equalizer.try_lock()
                    {
                        if let Some(ref mut eq) = *eq_guard {
                            eq.process_interleaved(&mut audio_data);
                        }
                    }
                }
                EqualizerMode::Parametric => {
                    // 参量均衡器
                    if parametric_equalizer_enabled.load(Ordering::Relaxed)
                        && let Some(mut peq_guard) = parametric_equalizer.try_lock()
                    {
                        if let Some(ref mut peq) = *peq_guard {
                            peq.process_interleaved(&mut audio_data);
                        }
                    }
                }
            }

            // 应用音量
            for sample in &mut audio_data {
                *sample *= vol;
            }

            let audio_bytes = encode_samples_for_device(
                &mut audio_data,
                &device_format,
                channels,
                ditherer.as_mut(),
                &mut byte_data,
            )?;

            if audio_bytes.len() != frames_available as usize * device_format.block_align as usize {
                pending_stats.render_errors += 1;
                flush_render_stats(&stats, &mut pending_stats);
                return Err(format!(
                    "渲染数据大小不匹配: {} bytes，期望 {} bytes",
                    audio_bytes.len(),
                    frames_available as usize * device_format.block_align as usize
                ));
            }

            if let Err(e) =
                render_client.write_to_device(frames_available as usize, audio_bytes, None)
            {
                eprintln!("❌ 渲染: 写入设备失败: {:?}", e);
                pending_stats.render_errors += 1;
            }

            {
                pending_stats.callbacks += 1;
                pending_stats.frames_written += frames_available as u64;
                pending_stats.samples_written += audio_data.len() as u64;
                pending_stats.buffer_min_samples = pending_stats.buffer_min_samples.min(buffer_len);
                pending_stats.buffer_max_samples = pending_stats.buffer_max_samples.max(buffer_len);
                if underrun {
                    pending_stats.underruns += 1;
                }
            }

            if pending_stats.callbacks >= STATS_FLUSH_CALLBACKS {
                flush_render_stats(&stats, &mut pending_stats);
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
    }

    flush_render_stats(&stats, &mut pending_stats);
    let _ = audio_client.stop_stream();
    Ok(())
}

fn calculate_fallback_poll_interval_ms(
    share_mode: crate::core::ShareMode,
    actual_buffer_duration: i64,
) -> u64 {
    if share_mode == crate::core::ShareMode::Exclusive && actual_buffer_duration > 0 {
        let buffer_duration_ms = actual_buffer_duration as f64 / 10000.0;
        (buffer_duration_ms / 2.0)
            .max(1.0)
            .min(EXCLUSIVE_POLL_MAX_MS) as u64
    } else {
        SHARED_POLL_INTERVAL_MS
    }
}

fn flush_render_stats(stats: &Arc<Mutex<RenderStats>>, pending: &mut RenderStats) {
    if pending.callbacks == 0
        && pending.underruns == 0
        && pending.frames_written == 0
        && pending.samples_written == 0
        && pending.buffer_min_samples == usize::MAX
        && pending.buffer_max_samples == 0
        && pending.render_errors == 0
        && pending.seek_clears == 0
    {
        return;
    }

    stats.lock().merge_from(pending);
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
        Err(e) => println!(
            "   ⚠️ WASAPI raw stream属性不可用，继续使用独占模式: {:?}",
            e
        ),
    }
}

fn encode_samples_for_device<'a>(
    samples: &'a mut [f32],
    format: &AudioFormat,
    channels: usize,
    ditherer: Option<&mut Ditherer>,
    bytes: &'a mut Vec<u8>,
) -> Result<&'a [u8], String> {
    let bytes_per_sample = format.block_align as usize / channels;
    if bytes_per_sample == 0 || format.block_align as usize % channels != 0 {
        return Err(format!(
            "设备格式块对齐无效: block_align={}, channels={}",
            format.block_align, channels
        ));
    }

    match format.sample_type {
        SampleType::Float if can_write_float_samples_direct(bytes_per_sample) => {
            clamp_float_samples_in_place(samples);
            Ok(f32_slice_as_bytes(samples))
        }
        SampleType::Float => {
            reserve_encoded_sample_bytes(samples.len(), bytes_per_sample, bytes);
            encode_float_samples(samples, bytes_per_sample, bytes)?;
            Ok(bytes.as_slice())
        }
        SampleType::Int => {
            reserve_encoded_sample_bytes(samples.len(), bytes_per_sample, bytes);
            encode_pcm_samples(
                samples,
                channels,
                bytes_per_sample,
                format.valid_bits_per_sample,
                ditherer,
                bytes,
            )?;
            Ok(bytes.as_slice())
        }
    }
}

fn can_write_float_samples_direct(bytes_per_sample: usize) -> bool {
    bytes_per_sample == std::mem::size_of::<f32>() && cfg!(target_endian = "little")
}

fn reserve_encoded_sample_bytes(sample_count: usize, bytes_per_sample: usize, bytes: &mut Vec<u8>) {
    bytes.clear();
    let bytes_needed = sample_count * bytes_per_sample;
    if bytes.capacity() < bytes_needed {
        bytes.reserve(bytes_needed);
    }
}

fn clamp_float_samples_in_place(samples: &mut [f32]) {
    for sample in samples {
        *sample = sample.clamp(-1.0, 1.0);
    }
}

fn f32_slice_as_bytes(samples: &[f32]) -> &[u8] {
    debug_assert!(cfg!(target_endian = "little"));
    unsafe {
        std::slice::from_raw_parts(
            samples.as_ptr().cast::<u8>(),
            std::mem::size_of_val(samples),
        )
    }
}

fn encode_float_samples(
    samples: &[f32],
    bytes_per_sample: usize,
    bytes: &mut Vec<u8>,
) -> Result<(), String> {
    match bytes_per_sample {
        4 => {
            for &sample in samples {
                bytes.extend_from_slice(&sample.clamp(-1.0, 1.0).to_le_bytes());
            }
            Ok(())
        }
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

fn encode_pcm_samples(
    samples: &[f32],
    channels: usize,
    bytes_per_sample: usize,
    valid_bits: u16,
    mut ditherer: Option<&mut Ditherer>,
    bytes: &mut Vec<u8>,
) -> Result<(), String> {
    match (bytes_per_sample, valid_bits) {
        (4, 24) => {
            for (index, &sample) in samples.iter().enumerate() {
                let pcm = quantize_sample(sample, index, channels, 24, ditherer.as_deref_mut());
                bytes.extend_from_slice(&(pcm << 8).to_le_bytes());
            }
            Ok(())
        }
        (4, 32) => {
            for (index, &sample) in samples.iter().enumerate() {
                let pcm = quantize_sample(sample, index, channels, 31, ditherer.as_deref_mut());
                bytes.extend_from_slice(&pcm.to_le_bytes());
            }
            Ok(())
        }
        (3, 24) => {
            for (index, &sample) in samples.iter().enumerate() {
                let pcm = quantize_sample(sample, index, channels, 24, ditherer.as_deref_mut());
                bytes.extend_from_slice(&pcm.to_le_bytes()[..3]);
            }
            Ok(())
        }
        _ => {
            for (index, &sample) in samples.iter().enumerate() {
                let pcm =
                    quantize_sample(sample, index, channels, valid_bits, ditherer.as_deref_mut());
                write_pcm_sample(bytes, pcm, bytes_per_sample, valid_bits)?;
            }
            Ok(())
        }
    }
}

fn quantize_sample(
    sample: f32,
    index: usize,
    channels: usize,
    valid_bits: u16,
    ditherer: Option<&mut Ditherer>,
) -> i32 {
    if let Some(dither) = ditherer {
        dither.float_to_pcm(sample, index % channels, valid_bits)
    } else {
        sample_to_pcm_without_dither(sample, valid_bits)
    }
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
            AUDCLNT_E_EXCLUSIVE_MODE_NOT_ALLOWED => "Windows声音设置不允许应用程序独占控制该设备",
            AUDCLNT_E_ENDPOINT_CREATE_FAILED => "创建音频端点失败",
            _ => "Windows WASAPI错误",
        };
        format!(
            "{prefix}: {reason} (HRESULT 0x{:08X})",
            werr.code().0 as u32
        )
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
