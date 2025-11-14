//! WASAPI音频引擎核心实现

use parking_lot::Mutex;
use rodio::{Decoder, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;
use std::time::{Duration as StdDuration, Instant};

// 导入wasapi用于WASAPI独占模式
use wasapi::*;

// Windows HRESULT 错误码常量
const S_OK: i32 = 0;
const S_FALSE: i32 = 1;
const RPC_E_CHANGED_MODE: i32 = 0x80010106u32 as i32; // COM已在不同模式下初始化

// 导入ringbuf用于音频缓冲区
use ringbuf::consumer::Consumer;
use ringbuf::producer::Producer;
use ringbuf::traits::{Observer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};

// 导入rubato用于重采样
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

/// 播放状态跟踪器
struct PlaybackTracker {
    /// 累计播放时间（秒）
    accumulated_time: f64,
    /// 最后一次开始播放的时间点
    last_play_time: Option<Instant>,
}

impl PlaybackTracker {
    fn new() -> Self {
        Self {
            accumulated_time: 0.0,
            last_play_time: None,
        }
    }

    /// 开始播放
    fn start(&mut self) {
        self.last_play_time = Some(Instant::now());
        println!(
            "🕐 PlaybackTracker: 开始计时，累计时间: {:.2}秒",
            self.accumulated_time
        );
    }

    /// 暂停播放
    fn pause(&mut self) {
        if let Some(start_time) = self.last_play_time.take() {
            let elapsed = start_time.elapsed().as_secs_f64();
            self.accumulated_time += elapsed;
            println!(
                "⏸️ PlaybackTracker: 暂停，本次播放: {:.2}秒，累计: {:.2}秒",
                elapsed, self.accumulated_time
            );
        }
    }

    /// 获取当前播放位置
    fn get_position(&self) -> f64 {
        let current_segment = if let Some(start_time) = self.last_play_time {
            start_time.elapsed().as_secs_f64()
        } else {
            0.0
        };
        self.accumulated_time + current_segment
    }

    /// 重置位置
    fn reset(&mut self) {
        self.accumulated_time = 0.0;
        self.last_play_time = None;
        println!("🔄 PlaybackTracker: 重置位置");
    }

    /// 设置位置（用于seek）
    fn set_position(&mut self, position: f64) {
        self.accumulated_time = position;
        self.last_play_time = None;
        println!(
            "⏭️ PlaybackTracker: 设置位置到 {:.2}秒（计时器已停止，等待start()）",
            position
        );
    }
}

/// 音频格式信息
#[derive(Debug, Clone)]
struct AudioFormat {
    sample_rate: u32,
    channels: u16,
    bits_per_sample: u16,
    sample_type: SampleType,
}

/// 线程间错误消息
enum ThreadMessage {
    Error(String),
    DecoderFinished,
}

/// 音频引擎状态
pub struct AudioEngine {
    /// 音频流线程句柄
    stream_thread: Option<std::thread::JoinHandle<()>>,
    /// 解码线程句柄
    decoder_thread: Option<std::thread::JoinHandle<()>>,
    /// 设备采样率
    device_sample_rate: u32,
    /// 设备声道数
    device_channels: u16,
    /// 设备格式
    device_format: Option<AudioFormat>,
    /// 当前文件路径
    current_file: Option<String>,
    /// 源文件采样率
    source_sample_rate: Option<u32>,
    /// 源文件声道数
    source_channels: Option<u16>,
    /// 音频总时长（秒）
    duration: f64,
    /// 是否正在播放
    is_playing: Arc<AtomicBool>,
    /// 是否暂停
    is_paused: Arc<AtomicBool>,
    /// 播放位置跟踪器
    tracker: Arc<Mutex<PlaybackTracker>>,
    /// 音量 (0.0 - 1.0)
    volume: Arc<Mutex<f32>>,
    /// 音频缓冲区大小
    buffer_size: usize,
    /// 错误消息接收器
    error_receiver: Option<Receiver<ThreadMessage>>,
    /// 是否已初始化
    initialized: bool,
}

impl AudioEngine {
    /// 创建新的音频引擎
    pub fn new() -> Result<Self, String> {
        // 音频缓冲区大小（10秒的缓冲，48000 Hz * 2声道 * 10秒）
        let buffer_size = 48000 * 2 * 10;

        Ok(Self {
            stream_thread: None,
            decoder_thread: None,
            device_sample_rate: 48000,
            device_channels: 2,
            device_format: None,
            current_file: None,
            source_sample_rate: None,
            source_channels: None,
            duration: 0.0,
            is_playing: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
            tracker: Arc::new(Mutex::new(PlaybackTracker::new())),
            volume: Arc::new(Mutex::new(0.7)),
            buffer_size,
            error_receiver: None,
            initialized: false,
        })
    }

    /// 初始化音频设备
    pub fn initialize(&mut self) -> Result<(), String> {
        println!("🎵 AudioEngine: 初始化WASAPI音频引擎（独占模式）");
        let start = std::time::Instant::now();

        // 初始化COM库（在主线程）
        let hr = initialize_mta();
        if hr.is_err() {
            let hr_code = hr.0;
            if hr_code != RPC_E_CHANGED_MODE && hr_code != S_FALSE {
                println!(
                    "⚠️ AudioEngine: COM初始化返回: 0x{:08X}（可能已初始化，继续执行）",
                    hr_code as u32
                );
            }
        }

        // 获取默认音频输出设备
        let device = get_default_device(&Direction::Render)
            .map_err(|e| format!("获取默认设备失败: {:?}", e))?;

        let device_name = device
            .get_friendlyname()
            .map_err(|e| format!("获取设备名称失败: {:?}", e))?;
        println!("   输出设备: {}", device_name);

        // 创建AudioClient
        let mut audio_client = device
            .get_iaudioclient()
            .map_err(|e| format!("创建AudioClient失败: {:?}", e))?;

        // 获取设备混合格式（共享模式的默认格式）
        let mix_format = audio_client
            .get_mixformat()
            .map_err(|e| format!("获取设备格式失败: {:?}", e))?;

        println!("   设备混合格式:");
        println!("     采样率: {} Hz", mix_format.get_samplespersec());
        println!("     声道数: {}", mix_format.get_nchannels());
        println!("     位深度: {} bits", mix_format.get_bitspersample());

        // 查询设备支持的独占模式格式
        let supported_format = self.query_exclusive_format(&mut audio_client, &mix_format)?;

        println!("   独占模式支持的格式:");
        println!("     采样率: {} Hz", supported_format.sample_rate);
        println!("     声道数: {}", supported_format.channels);
        println!("     位深度: {} bits", supported_format.bits_per_sample);
        println!("     样本类型: {:?}", supported_format.sample_type);

        // 保存配置信息
        self.device_sample_rate = supported_format.sample_rate;
        self.device_channels = supported_format.channels;
        self.device_format = Some(supported_format);
        self.initialized = true;

        println!(
            "✅ AudioEngine: WASAPI独占模式初始化成功，耗时: {:?}",
            start.elapsed()
        );

        Ok(())
    }

    /// 查询设备支持的独占模式格式
    fn query_exclusive_format(
        &self,
        audio_client: &mut AudioClient,
        mix_format: &WaveFormat,
    ) -> Result<AudioFormat, String> {
        let sample_rate = mix_format.get_samplespersec();
        let channels = mix_format.get_nchannels();

        // 尝试 Float32 格式
        let channelmask = make_channelmasks(channels as usize)
            .first()
            .copied()
            .unwrap_or(0x3);

        let float_format = WaveFormat::new(
            32,
            32,
            &SampleType::Float,
            sample_rate as usize,
            channels as usize,
            Some(channelmask),
        );

        // 检查是否支持 Float32
        match audio_client.is_supported(&float_format, &ShareMode::Exclusive) {
            Ok(Some(_)) | Ok(None) => {
                println!("   ✅ 设备支持 Float32 独占模式");
                return Ok(AudioFormat {
                    sample_rate,
                    channels,
                    bits_per_sample: 32,
                    sample_type: SampleType::Float,
                });
            }
            Err(e) => {
                println!("   ⚠️ Float32 不支持: {:?}", e);
            }
        }

        // 尝试 Int16 格式
        let int16_format = WaveFormat::new(
            16,
            16,
            &SampleType::Int,
            sample_rate as usize,
            channels as usize,
            Some(channelmask),
        );

        match audio_client.is_supported(&int16_format, &ShareMode::Exclusive) {
            Ok(Some(_)) | Ok(None) => {
                println!("   ✅ 设备支持 Int16 独占模式");
                return Ok(AudioFormat {
                    sample_rate,
                    channels,
                    bits_per_sample: 16,
                    sample_type: SampleType::Int,
                });
            }
            Err(e) => {
                println!("   ⚠️ Int16 不支持: {:?}", e);
            }
        }

        // 如果都不支持，尝试使用混合格式的参数
        println!("   ⚠️ 使用混合格式参数作为回退");
        Ok(AudioFormat {
            sample_rate,
            channels,
            bits_per_sample: mix_format.get_bitspersample(),
            sample_type: if mix_format.get_bitspersample() == 32 {
                SampleType::Float
            } else {
                SampleType::Int
            },
        })
    }

    /// 加载音频文件
    pub fn load_track(&mut self, file_path: &str) -> Result<f64, String> {
        println!("🎵 AudioEngine: 加载音频文件: {}", file_path);
        let start = std::time::Instant::now();

        // 停止当前播放
        self.stop()?;

        // 打开文件获取时长
        let file_for_duration =
            File::open(file_path).map_err(|e| format!("打开文件失败: {}", e))?;

        // 创建解码器获取时长和音频参数
        let source_for_duration = Decoder::new(BufReader::new(file_for_duration))
            .map_err(|e| format!("解码失败: {}", e))?;

        let duration = source_for_duration
            .total_duration()
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0);

        let sample_rate = source_for_duration.sample_rate();
        let channels = source_for_duration.channels();

        println!("   时长: {:.2}秒", duration);
        println!("   源采样率: {} Hz", sample_rate);
        println!("   源声道数: {}", channels);
        println!("   设备采样率: {} Hz", self.device_sample_rate);
        println!("   设备声道数: {}", self.device_channels);

        // 检查是否需要重采样或声道转换
        let needs_resampling = sample_rate != self.device_sample_rate;
        let needs_channel_conversion = channels != self.device_channels;

        if needs_resampling {
            println!(
                "   ⚙️ 需要重采样: {} Hz -> {} Hz",
                sample_rate, self.device_sample_rate
            );
        }
        if needs_channel_conversion {
            println!(
                "   ⚙️ 需要声道转换: {} -> {}",
                channels, self.device_channels
            );
        }

        // 保存文件路径和格式信息
        self.current_file = Some(file_path.to_string());
        self.source_sample_rate = Some(sample_rate);
        self.source_channels = Some(channels);
        self.duration = duration;
        self.tracker.lock().reset();

        println!(
            "✅ AudioEngine: 音频文件加载成功，耗时: {:?}",
            start.elapsed()
        );
        Ok(duration)
    }

    /// 开始播放
    pub fn play(&mut self) -> Result<(), String> {
        let start_time = std::time::Instant::now();
        println!("🎵 AudioEngine::play() 开始");

        if self.current_file.is_none() {
            return Err("未加载音频文件".to_string());
        }

        // 如果已暂停，恢复播放
        if self.is_paused.load(Ordering::SeqCst) {
            self.is_playing.store(true, Ordering::SeqCst);
            self.is_paused.store(false, Ordering::SeqCst);
            self.tracker.lock().start();
            println!("✅ AudioEngine::play() 恢复播放");
            return Ok(());
        }

        // 创建新的 ringbuf（每次播放都重新创建，确保资源干净）
        println!("🔧 创建音频缓冲区，大小: {} 样本", self.buffer_size);
        let ring_buffer = HeapRb::<f32>::new(self.buffer_size);
        let (producer, consumer) = ring_buffer.split();
        let consumer = Arc::new(Mutex::new(consumer));

        // 创建错误通道
        let (error_sender, error_receiver) = channel();
        self.error_receiver = Some(error_receiver);

        // 设置播放标志
        self.is_playing.store(true, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);

        // 启动解码线程（带重采样）
        self.start_decoder_thread_with_resampling(producer, error_sender.clone())?;

        // 创建音频流
        self.create_stream(consumer, error_sender)?;

        // 开始跟踪播放时间
        self.tracker.lock().start();

        println!(
            "✅ AudioEngine::play() 播放已启动，耗时: {:?}",
            start_time.elapsed()
        );

        // 启动播放完成监控线程
        self.start_playback_monitor();

        Ok(())
    }

    /// 暂停播放
    pub fn pause(&mut self) -> Result<(), String> {
        println!("🎵 AudioEngine: 暂停播放");

        // 注意：不要设置 is_playing = false，否则会导致线程退出
        // 只设置 is_paused = true，让线程进入等待状态
        self.is_paused.store(true, Ordering::SeqCst);

        // 暂停时记录已播放时间
        self.tracker.lock().pause();

        println!(
            "✅ AudioEngine: 已暂停，当前位置: {:.2}秒",
            self.get_position()
        );
        Ok(())
    }

    /// 停止播放
    pub fn stop(&mut self) -> Result<(), String> {
        println!("🎵 AudioEngine: 停止播放");

        self.is_playing.store(false, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);
        self.tracker.lock().reset();

        // 等待解码线程结束
        if let Some(thread) = self.decoder_thread.take() {
            let _ = thread.join();
            println!("   解码线程已结束");
        }

        // 等待流线程结束
        if let Some(thread) = self.stream_thread.take() {
            let _ = thread.join();
            println!("   渲染线程已结束");
        }

        // 注意：不需要清空缓冲区，因为每次播放都会创建新的 ringbuf
        println!("✅ AudioEngine: 已停止");
        Ok(())
    }

    /// 跳转到指定位置
    pub fn seek(&mut self, position: f64) -> Result<(), String> {
        println!("🎵 AudioEngine: 跳转到 {:.2}秒", position);
        //todo
        Ok(())
    }

    /// 设置音量
    pub fn set_volume(&mut self, volume: f32) {
        let clamped_volume = volume.clamp(0.0, 1.0);

        // 更新内部音量字段（音频流回调会读取这个值）
        *self.volume.lock() = clamped_volume;

        println!("🎵 AudioEngine: 音量设置为 {:.2}", clamped_volume);
    }

    /// 获取当前播放位置（秒）
    pub fn get_position(&self) -> f64 {
        let position = self.tracker.lock().get_position().min(self.duration);

        // 每5秒打印一次位置（用于调试）
        static LAST_LOG_TIME: std::sync::Mutex<Option<Instant>> = std::sync::Mutex::new(None);
        let mut last_time = LAST_LOG_TIME.lock().unwrap();
        let should_log = if let Some(last) = *last_time {
            last.elapsed() > StdDuration::from_secs(5)
        } else {
            true
        };

        if should_log {
            println!(
                "📍 当前播放位置: {:.2}秒 / {:.2}秒",
                position, self.duration
            );
            *last_time = Some(Instant::now());
        }

        position
    }

    /// 获取音频时长
    pub fn get_duration(&self) -> f64 {
        self.duration
    }

    /// 检查是否正在播放
    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }

    /// 创建WASAPI独占模式音频输出流
    fn create_stream(
        &mut self,
        consumer: Arc<Mutex<HeapCons<f32>>>,
        error_sender: Sender<ThreadMessage>,
    ) -> Result<(), String> {
        println!("🔊 AudioEngine: 创建WASAPI独占模式音频流（轮询模式）");

        let volume = self.volume.clone();
        let is_playing = self.is_playing.clone();
        let is_paused = self.is_paused.clone();
        let device_format = self.device_format.clone().ok_or("设备格式未初始化")?;
        let channels = device_format.channels as usize;
        let sample_rate = device_format.sample_rate;

        // 在独立线程中创建AudioClient和RenderClient
        let stream_thread = std::thread::spawn(move || {
            println!("🔊 音频渲染线程: 开始运行");

            // 在渲染线程中初始化COM
            let hr = initialize_mta();
            if hr.is_err() {
                let hr_code = hr.0;
                if hr_code != RPC_E_CHANGED_MODE && hr_code != S_FALSE && hr_code != S_OK {
                    let err_msg = format!("初始化COM失败: 0x{:08X}", hr_code as u32);
                    eprintln!("❌ 渲染线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    return;
                }
            }

            // 获取默认音频输出设备
            let device = match get_default_device(&Direction::Render) {
                Ok(d) => d,
                Err(e) => {
                    let err_msg = format!("获取默认设备失败: {:?}", e);
                    eprintln!("❌ 渲染线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    return;
                }
            };

            // 创建AudioClient
            let mut audio_client = match device.get_iaudioclient() {
                Ok(c) => c,
                Err(e) => {
                    let err_msg = format!("创建AudioClient失败: {:?}", e);
                    eprintln!("❌ 渲染线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    return;
                }
            };

            // 创建WaveFormat（使用查询到的支持格式）
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

            println!(
                "   使用格式: {} Hz, {} 声道, {} bits, {:?}",
                device_format.sample_rate,
                device_format.channels,
                device_format.bits_per_sample,
                device_format.sample_type
            );

            // 使用独占模式初始化AudioClient（轮询模式）
            let desired_period = 10_000_000; // 10ms周期
            let stream_mode = StreamMode::PollingExclusive {
                buffer_duration_hns: desired_period,
                period_hns: desired_period,
            };

            if let Err(e) =
                audio_client.initialize_client(&wave_format, &Direction::Render, &stream_mode)
            {
                let err_msg = format!("初始化AudioClient失败: {:?}", e);
                eprintln!("❌ 渲染线程: {}", err_msg);
                let _ = error_sender.send(ThreadMessage::Error(err_msg));
                return;
            }

            println!("   ✅ 渲染线程: WASAPI独占模式已激活");

            // 获取缓冲区大小
            let buffer_frame_count = match audio_client.get_buffer_size() {
                Ok(size) => size,
                Err(e) => {
                    let err_msg = format!("获取缓冲区大小失败: {:?}", e);
                    eprintln!("❌ 渲染线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    return;
                }
            };

            println!("   缓冲区大小: {} 帧", buffer_frame_count);

            // 获取渲染客户端
            let render_client = match audio_client.get_audiorenderclient() {
                Ok(c) => c,
                Err(e) => {
                    let err_msg = format!("获取渲染客户端失败: {:?}", e);
                    eprintln!("❌ 渲染线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    return;
                }
            };

            // 启动音频流
            if let Err(e) = audio_client.start_stream() {
                let err_msg = format!("启动音频流失败: {:?}", e);
                eprintln!("❌ 渲染线程: {}", err_msg);
                let _ = error_sender.send(ThreadMessage::Error(err_msg));
                return;
            }

            println!("   ✅ 渲染线程: 音频流已启动");

            // 计算轮询间隔
            let poll_interval_ms =
                (buffer_frame_count as f64 / sample_rate as f64 * 1000.0 / 2.0) as u64;
            let poll_interval_ms = poll_interval_ms.max(5).min(20); // 5-20ms
            println!("   轮询间隔: {} ms", poll_interval_ms);

            let mut callback_counter = 0u64;
            let is_float = matches!(device_format.sample_type, SampleType::Float);

            // 渲染循环
            let mut paused_logged = false;
            loop {
                if !is_playing.load(Ordering::SeqCst) {
                    println!("⏹️ 渲染线程: 收到停止信号");
                    break;
                }

                // 获取可用的缓冲区空间
                let frames_available = match audio_client.get_available_space_in_frames() {
                    Ok(frames) => frames,
                    Err(e) => {
                        eprintln!("❌ 渲染线程: 获取可用空间失败: {:?}", e);
                        std::thread::sleep(StdDuration::from_millis(poll_interval_ms));
                        continue;
                    }
                };

                if frames_available > 0 {
                    // 检查是否暂停
                    if is_paused.load(Ordering::SeqCst) {
                        // 暂停时写入静音数据，保持流活跃
                        if !paused_logged {
                            println!("⏸️ 渲染线程: 进入暂停状态，写入静音");
                            paused_logged = true;
                        }

                        let samples_needed = frames_available as usize * channels;

                        // 根据设备格式生成静音数据
                        let byte_data: Vec<u8> = if is_float {
                            // Float32 格式的静音（0.0）
                            vec![0u8; samples_needed * 4]
                        } else {
                            // Int16 格式的静音（0）
                            vec![0u8; samples_needed * 2]
                        };

                        // 写入静音到设备
                        if let Err(e) = render_client.write_to_device(
                            frames_available as usize,
                            &byte_data,
                            None,
                        ) {
                            eprintln!("❌ 渲染线程: 写入静音失败: {:?}", e);
                        }

                        std::thread::sleep(StdDuration::from_millis(poll_interval_ms));
                        continue;
                    }

                    // 恢复播放时重置日志标志
                    if paused_logged {
                        println!("▶️ 渲染线程: 恢复播放");
                        paused_logged = false;
                    }

                    callback_counter += 1;

                    let mut consumer = consumer.lock();
                    let vol = *volume.lock();
                    let buffer_len_before = consumer.occupied_len();

                    let samples_needed = frames_available as usize * channels;
                    let mut samples_read = 0;
                    let mut underrun_occurred = false;

                    // 准备音频数据（f32格式）
                    let mut audio_data: Vec<f32> = Vec::with_capacity(samples_needed);
                    for _ in 0..samples_needed {
                        if let Some(audio_sample) = consumer.try_pop() {
                            audio_data.push(audio_sample * vol);
                            samples_read += 1;
                        } else {
                            audio_data.push(0.0);
                            underrun_occurred = true;
                        }
                    }

                    drop(consumer);

                    // 根据设备格式转换数据
                    let byte_data: Vec<u8> = if is_float {
                        // Float32 格式
                        audio_data
                            .iter()
                            .flat_map(|&sample| sample.to_le_bytes())
                            .collect()
                    } else {
                        // Int16 格式
                        audio_data
                            .iter()
                            .flat_map(|&sample| {
                                let sample_i16 = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
                                sample_i16.to_le_bytes()
                            })
                            .collect()
                    };

                    // 写入设备
                    if let Err(e) =
                        render_client.write_to_device(frames_available as usize, &byte_data, None)
                    {
                        eprintln!("❌ 渲染线程: 写入设备失败: {:?}", e);
                    }

                    // 前10次回调打印详细日志
                    if callback_counter < 10 {
                        println!(
                            "🔊 音频回调 #{}: 帧数 {}, 样本 {}, 读取 {}, 缓冲区 {}, 音量 {:.2}",
                            callback_counter,
                            frames_available,
                            samples_needed,
                            samples_read,
                            buffer_len_before,
                            vol
                        );
                    }

                    // 每1000次回调打印一次统计
                    if callback_counter % 1000 == 0 && callback_counter > 0 {
                        println!(
                            "🔊 音频回调 #{}: 缓冲区 {} 样本, 读取 {}/{}, 音量 {:.2}",
                            callback_counter, buffer_len_before, samples_read, samples_needed, vol
                        );
                    }

                    // 检测缓冲区欠载
                    if underrun_occurred && callback_counter % 100 == 0 {
                        eprintln!(
                            "⚠️ 音频回调 #{}: 缓冲区欠载！需要 {} 样本, 仅读取 {} 样本",
                            callback_counter, samples_needed, samples_read
                        );
                    }
                }

                // 轮询间隔
                std::thread::sleep(StdDuration::from_millis(poll_interval_ms));
            }

            // 停止音频流
            let _ = audio_client.stop_stream();
            println!("🔊 渲染线程: 结束");
        });

        self.stream_thread = Some(stream_thread);
        println!("✅ AudioEngine: WASAPI独占模式音频流创建成功");

        Ok(())
    }

    /// 启动解码线程（带重采样）
    fn start_decoder_thread_with_resampling(
        &mut self,
        mut producer: HeapProd<f32>,
        error_sender: Sender<ThreadMessage>,
    ) -> Result<(), String> {
        println!("🔄 AudioEngine: 启动解码线程（带重采样）");

        let file_path = self.current_file.clone().ok_or("未加载音频文件")?;
        let is_playing = self.is_playing.clone();
        let is_paused = self.is_paused.clone();
        let device_sample_rate = self.device_sample_rate;
        let device_channels = self.device_channels;
        let source_sample_rate = self.source_sample_rate.ok_or("源采样率未设置")?;
        let source_channels = self.source_channels.ok_or("源声道数未设置")?;

        let decoder_thread = std::thread::spawn(move || {
            println!("🔄 解码线程: 开始运行");
            println!("   文件路径: {}", file_path);
            println!(
                "   源格式: {} Hz, {} 声道",
                source_sample_rate, source_channels
            );
            println!(
                "   目标格式: {} Hz, {} 声道",
                device_sample_rate, device_channels
            );

            // 打开文件并创建解码器
            let file = match File::open(&file_path) {
                Ok(f) => {
                    println!("✅ 解码线程: 文件打开成功");
                    f
                }
                Err(e) => {
                    let err_msg = format!("打开文件失败: {}", e);
                    eprintln!("❌ 解码线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let source = match Decoder::new(BufReader::new(file)) {
                Ok(s) => {
                    println!("✅ 解码线程: Decoder创建成功");
                    s
                }
                Err(e) => {
                    let err_msg = format!("解码失败: {}", e);
                    eprintln!("❌ 解码线程: {}", err_msg);
                    let _ = error_sender.send(ThreadMessage::Error(err_msg));
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            // 检查是否需要重采样
            let needs_resampling = source_sample_rate != device_sample_rate;
            let needs_channel_conversion = source_channels != device_channels;

            if needs_resampling || needs_channel_conversion {
                println!("🔧 解码线程: 需要格式转换");
                if needs_resampling {
                    println!(
                        "   重采样: {} Hz -> {} Hz",
                        source_sample_rate, device_sample_rate
                    );
                }
                if needs_channel_conversion {
                    println!("   声道转换: {} -> {}", source_channels, device_channels);
                }

                // 使用重采样处理
                if let Err(e) = Self::decode_with_resampling(
                    source,
                    &mut producer,
                    &is_playing,
                    &is_paused,
                    source_sample_rate,
                    source_channels,
                    device_sample_rate,
                    device_channels,
                ) {
                    eprintln!("❌ 解码线程: 重采样失败: {}", e);
                    let _ = error_sender.send(ThreadMessage::Error(e));
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            } else {
                println!("✅ 解码线程: 格式匹配，直接解码");
                // 直接解码，无需重采样
                if let Err(e) = Self::decode_direct(
                    source,
                    &mut producer,
                    &is_playing,
                    &is_paused,
                    source_channels,
                ) {
                    eprintln!("❌ 解码线程: 解码失败: {}", e);
                    let _ = error_sender.send(ThreadMessage::Error(e));
                    is_playing.store(false, Ordering::SeqCst);
                    return;
                }
            }

            println!("🎵 解码线程: 完成");
            let _ = error_sender.send(ThreadMessage::DecoderFinished);
        });

        self.decoder_thread = Some(decoder_thread);
        Ok(())
    }

    /// 直接解码（无需重采样）
    fn decode_direct(
        source: Decoder<BufReader<File>>,
        producer: &mut HeapProd<f32>,
        is_playing: &Arc<AtomicBool>,
        is_paused: &Arc<AtomicBool>,
        _channels: u16,
    ) -> Result<(), String> {
        let mut sample_count = 0u64;
        let mut last_log_time = Instant::now();

        for sample in source {
            // 检查是否停止
            if !is_playing.load(Ordering::SeqCst) {
                println!("⏹️ 解码线程: 收到停止信号");
                break;
            }

            // 如果暂停，等待恢复
            while is_paused.load(Ordering::SeqCst) {
                if !is_playing.load(Ordering::SeqCst) {
                    println!("⏹️ 解码线程: 暂停期间收到停止信号");
                    return Ok(());
                }
                std::thread::sleep(StdDuration::from_millis(50));
            }

            sample_count += 1;

            // 将i16样本转换为f32（归一化到[-1.0, 1.0]）
            let sample_f32 = sample as f32 / 32768.0;

            // 写入缓冲区
            let mut retry_count = 0;
            while producer.try_push(sample_f32).is_err() {
                if !is_playing.load(Ordering::SeqCst) {
                    return Ok(());
                }
                // 再次检查暂停状态
                while is_paused.load(Ordering::SeqCst) {
                    if !is_playing.load(Ordering::SeqCst) {
                        return Ok(());
                    }
                    std::thread::sleep(StdDuration::from_millis(50));
                }
                retry_count += 1;
                if retry_count % 100 == 0 {
                    println!("⏸️ 解码线程: 缓冲区满，等待... (重试{}次)", retry_count);
                }
                std::thread::sleep(StdDuration::from_millis(10));
            }

            // 每5秒打印一次统计
            if last_log_time.elapsed() > StdDuration::from_secs(5) {
                println!("📊 解码线程: 已处理 {} 样本", sample_count);
                last_log_time = Instant::now();
            }
        }

        println!("✅ 解码线程: 直接解码完成，总样本数: {}", sample_count);
        Ok(())
    }

    /// 带重采样的解码
    fn decode_with_resampling(
        source: Decoder<BufReader<File>>,
        producer: &mut HeapProd<f32>,
        is_playing: &Arc<AtomicBool>,
        is_paused: &Arc<AtomicBool>,
        source_sample_rate: u32,
        source_channels: u16,
        device_sample_rate: u32,
        device_channels: u16,
    ) -> Result<(), String> {
        println!("🔧 创建重采样器...");

        // 创建高质量重采样器
        let resample_ratio = device_sample_rate as f64 / source_sample_rate as f64;
        let chunk_size = 1024; // 每次处理的帧数（每帧包含所有声道的样本）

        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let mut resampler = SincFixedIn::<f32>::new(
            resample_ratio,
            2.0,
            params,
            chunk_size,
            source_channels as usize,
        )
        .map_err(|e| format!("创建重采样器失败: {:?}", e))?;

        println!("✅ 重采样器创建成功");
        println!("   重采样比率: {:.4}", resample_ratio);
        println!("   块大小: {} 帧", chunk_size);
        println!("   源声道数: {}", source_channels);

        // 为每个声道创建独立的缓冲区
        let mut input_buffer: Vec<Vec<f32>> =
            vec![Vec::with_capacity(chunk_size); source_channels as usize];
        let mut interleaved_samples: Vec<f32> =
            Vec::with_capacity(chunk_size * source_channels as usize);
        let mut total_input_samples = 0u64;
        let mut total_output_samples = 0u64;
        let mut last_log_time = Instant::now();
        let mut chunk_count = 0u64;

        // 收集交错样本
        for sample in source {
            // 检查是否停止
            if !is_playing.load(Ordering::SeqCst) {
                println!("⏹️ 解码线程: 收到停止信号");
                break;
            }

            // 如果暂停，等待恢复
            while is_paused.load(Ordering::SeqCst) {
                if !is_playing.load(Ordering::SeqCst) {
                    println!("⏹️ 解码线程: 暂停期间收到停止信号");
                    return Ok(());
                }
                std::thread::sleep(StdDuration::from_millis(50));
            }

            total_input_samples += 1;
            let sample_f32 = sample as f32 / 32768.0;
            interleaved_samples.push(sample_f32);

            // 当收集到足够的样本时（chunk_size 帧 * 声道数），进行重采样
            let samples_per_chunk = chunk_size * source_channels as usize;
            if interleaved_samples.len() >= samples_per_chunk {
                chunk_count += 1;

                // 将交错样本转换为分离声道格式
                // 交错格式: [L0, R0, L1, R1, L2, R2, ...]
                // 分离格式: [[L0, L1, L2, ...], [R0, R1, R2, ...]]
                for channel_buf in &mut input_buffer {
                    channel_buf.clear();
                }

                for frame_idx in 0..chunk_size {
                    for channel_idx in 0..source_channels as usize {
                        let sample_idx = frame_idx * source_channels as usize + channel_idx;
                        if sample_idx < interleaved_samples.len() {
                            input_buffer[channel_idx].push(interleaved_samples[sample_idx]);
                        }
                    }
                }

                // 验证所有声道的缓冲区长度
                let buffer_lengths: Vec<usize> = input_buffer.iter().map(|b| b.len()).collect();
                if buffer_lengths.iter().any(|&len| len != chunk_size) {
                    eprintln!("⚠️ 警告: 声道缓冲区长度不一致: {:?}", buffer_lengths);
                    // 确保所有声道都有相同长度
                    for channel_buf in &mut input_buffer {
                        channel_buf.resize(chunk_size, 0.0);
                    }
                }

                if chunk_count <= 3 {
                    println!(
                        "🔍 调试 - 块 #{}: 交错样本数 {}, 声道缓冲区长度 {:?}",
                        chunk_count,
                        interleaved_samples.len(),
                        buffer_lengths
                    );
                }

                // 重采样
                let waves_in: Vec<&[f32]> = input_buffer.iter().map(|v| v.as_slice()).collect();

                match resampler.process(&waves_in, None) {
                    Ok(waves_out) => {
                        // 处理声道转换并写入输出
                        let output_frames = waves_out[0].len();

                        if chunk_count <= 3 {
                            println!("   输出帧数: {}", output_frames);
                        }

                        for frame_idx in 0..output_frames {
                            // 声道转换
                            let samples = Self::convert_channels(
                                &waves_out,
                                frame_idx,
                                source_channels,
                                device_channels,
                            );

                            // 写入缓冲区
                            for sample in samples {
                                let mut retry_count = 0;
                                while producer.try_push(sample).is_err() {
                                    if !is_playing.load(Ordering::SeqCst) {
                                        return Ok(());
                                    }
                                    // 检查暂停状态
                                    while is_paused.load(Ordering::SeqCst) {
                                        if !is_playing.load(Ordering::SeqCst) {
                                            return Ok(());
                                        }
                                        std::thread::sleep(StdDuration::from_millis(50));
                                    }
                                    retry_count += 1;
                                    if retry_count % 100 == 0 {
                                        println!("⏸️ 解码线程: 缓冲区满，等待...");
                                    }
                                    std::thread::sleep(StdDuration::from_millis(10));
                                }
                                total_output_samples += 1;
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("❌ 重采样失败: {:?}", e);
                        eprintln!("   声道缓冲区长度: {:?}", buffer_lengths);
                        return Err(format!("重采样失败: {:?}", e));
                    }
                }

                // 清空交错样本缓冲区
                interleaved_samples.clear();
            }

            // 每5秒打印一次统计
            if last_log_time.elapsed() > StdDuration::from_secs(5) {
                println!(
                    "📊 解码线程: 已处理 {} 块, 输入 {} 样本, 输出 {} 样本",
                    chunk_count, total_input_samples, total_output_samples
                );
                last_log_time = Instant::now();
            }
        }

        // 处理剩余的样本
        if !interleaved_samples.is_empty() && is_playing.load(Ordering::SeqCst) {
            let remaining_frames = interleaved_samples.len() / source_channels as usize;
            println!(
                "🔧 处理剩余样本: {} 个交错样本 ({} 帧)",
                interleaved_samples.len(),
                remaining_frames
            );

            if remaining_frames > 0 {
                // 将交错样本转换为分离声道格式
                for channel_buf in &mut input_buffer {
                    channel_buf.clear();
                }

                for frame_idx in 0..remaining_frames {
                    for channel_idx in 0..source_channels as usize {
                        let sample_idx = frame_idx * source_channels as usize + channel_idx;
                        if sample_idx < interleaved_samples.len() {
                            input_buffer[channel_idx].push(interleaved_samples[sample_idx]);
                        }
                    }
                }

                // 填充到chunk_size（用静音填充）
                for channel_buf in &mut input_buffer {
                    channel_buf.resize(chunk_size, 0.0);
                }

                let buffer_lengths: Vec<usize> = input_buffer.iter().map(|b| b.len()).collect();
                println!("   填充后声道缓冲区长度: {:?}", buffer_lengths);

                let waves_in: Vec<&[f32]> = input_buffer.iter().map(|v| v.as_slice()).collect();

                if let Ok(waves_out) = resampler.process(&waves_in, None) {
                    // 只处理有效的输出帧（对应实际输入的帧数）
                    let valid_output_frames =
                        (remaining_frames as f64 * resample_ratio).ceil() as usize;
                    let output_frames = waves_out[0].len().min(valid_output_frames);

                    println!(
                        "   剩余样本输出帧数: {} (总共 {}, 有效 {})",
                        output_frames,
                        waves_out[0].len(),
                        valid_output_frames
                    );

                    for frame_idx in 0..output_frames {
                        let samples = Self::convert_channels(
                            &waves_out,
                            frame_idx,
                            source_channels,
                            device_channels,
                        );

                        for sample in samples {
                            let mut retry_count = 0;
                            while producer.try_push(sample).is_err() {
                                if !is_playing.load(Ordering::SeqCst) {
                                    return Ok(());
                                }
                                // 检查暂停状态
                                while is_paused.load(Ordering::SeqCst) {
                                    if !is_playing.load(Ordering::SeqCst) {
                                        return Ok(());
                                    }
                                    std::thread::sleep(StdDuration::from_millis(50));
                                }
                                retry_count += 1;
                                if retry_count % 100 == 0 {
                                    println!("⏸️ 解码线程: 缓冲区满，等待...");
                                }
                                std::thread::sleep(StdDuration::from_millis(10));
                            }
                            total_output_samples += 1;
                        }
                    }
                }
            }
        }

        println!("✅ 解码线程: 重采样完成");
        println!("   处理块数: {}", chunk_count);
        println!("   输入样本: {}", total_input_samples);
        println!("   输出样本: {}", total_output_samples);
        println!(
            "   理论输出样本: {:.0}",
            total_input_samples as f64 * resample_ratio
        );
        Ok(())
    }

    /// 声道转换
    fn convert_channels(
        waves: &[Vec<f32>],
        frame_idx: usize,
        source_channels: u16,
        device_channels: u16,
    ) -> Vec<f32> {
        match (source_channels, device_channels) {
            (1, 2) => {
                // 单声道 -> 立体声：复制到两个声道
                let mono = waves[0][frame_idx];
                vec![mono, mono]
            }
            (2, 1) => {
                // 立体声 -> 单声道：平均
                let left = waves[0][frame_idx];
                let right = waves[1][frame_idx];
                vec![(left + right) / 2.0]
            }
            (n, m) if n == m => {
                // 声道数相同：直接复制
                waves.iter().map(|ch| ch[frame_idx]).collect()
            }
            _ => {
                // 其他情况：简单处理，取前N个声道或填充0
                let mut result = Vec::with_capacity(device_channels as usize);
                for i in 0..device_channels as usize {
                    if i < source_channels as usize {
                        result.push(waves[i][frame_idx]);
                    } else {
                        result.push(0.0);
                    }
                }
                result
            }
        }
    }

    /// 启动播放完成监控线程
    fn start_playback_monitor(&self) {
        let is_playing = self.is_playing.clone();
        let tracker = self.tracker.clone();
        let duration = self.duration;

        std::thread::spawn(move || {
            while is_playing.load(Ordering::SeqCst) {
                let current_pos = tracker.lock().get_position();

                // 检查是否播放完毕（基于时间）
                // 注意：由于解码线程会在完成时发送 DecoderFinished 消息并设置 is_playing 为 false
                // 这里主要作为备用检查
                if current_pos >= duration {
                    println!("🎵 AudioEngine: 播放完毕（时间到达）");
                    is_playing.store(false, Ordering::SeqCst);
                    tracker.lock().pause();
                    break;
                }

                std::thread::sleep(StdDuration::from_millis(500));
            }
        });
    }
}
