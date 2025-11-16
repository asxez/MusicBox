//! WASAPI音频引擎核心实现

use parking_lot::Mutex;
use rodio::{Decoder, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::time::Duration as StdDuration;
use wasapi::*;

use ringbuf::traits::{Observer, Split};
use ringbuf::{HeapProd, HeapRb};

use crate::audio_format::AudioFormat;
use crate::decoder;
use crate::playback_tracker::PlaybackTracker;
use crate::renderer::WasapiRenderer;
use crate::thread_message::ThreadMessage;

// Windows HRESULT 错误码常量
const S_FALSE: i32 = 1;
const RPC_E_CHANGED_MODE: i32 = 0x80010106u32 as i32;

/// 音频引擎状态
pub struct AudioEngine {
    renderer: WasapiRenderer,
    decoder_thread: Option<std::thread::JoinHandle<()>>,
    device_sample_rate: u32,
    device_channels: u16,
    device_format: Option<AudioFormat>,
    current_file: Option<String>,
    source_sample_rate: Option<u32>,
    source_channels: Option<u16>,
    duration: f64,
    is_playing: Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
    tracker: Arc<Mutex<PlaybackTracker>>,
    volume: Arc<Mutex<f32>>,
    buffer_size: usize,
    error_receiver: Option<Receiver<ThreadMessage>>,
    seek_sender: Option<Sender<f64>>,
    initialized: bool,
}

impl AudioEngine {
    pub fn new() -> Result<Self, String> {
        let buffer_size = 48000 * 2 * 1; // 1秒缓冲

        Ok(Self {
            renderer: WasapiRenderer::new(),
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
            seek_sender: None,
            initialized: false,
        })
    }

    pub fn initialize(&mut self) -> Result<(), String> {
        println!("🎵 AudioEngine: 初始化WASAPI音频引擎（独占模式）");
        let start = std::time::Instant::now();

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

        let device = get_default_device(&Direction::Render)
            .map_err(|e| format!("获取默认设备失败: {:?}", e))?;

        let device_name = device
            .get_friendlyname()
            .map_err(|e| format!("获取设备名称失败: {:?}", e))?;
        println!("   输出设备: {}", device_name);

        let mut audio_client = device
            .get_iaudioclient()
            .map_err(|e| format!("创建AudioClient失败: {:?}", e))?;

        let mix_format = audio_client
            .get_mixformat()
            .map_err(|e| format!("获取设备格式失败: {:?}", e))?;

        println!("   设备混合格式:");
        println!("     采样率: {} Hz", mix_format.get_samplespersec());
        println!("     声道数: {}", mix_format.get_nchannels());
        println!("     位深度: {} bits", mix_format.get_bitspersample());

        let supported_format = self.query_exclusive_format(&mut audio_client, &mix_format)?;

        println!("   独占模式支持的格式:");
        println!("     采样率: {} Hz", supported_format.sample_rate);
        println!("     声道数: {}", supported_format.channels);
        println!("     位深度: {} bits", supported_format.bits_per_sample);
        println!("     样本类型: {:?}", supported_format.sample_type);

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

    fn query_exclusive_format(
        &self,
        audio_client: &mut AudioClient,
        mix_format: &WaveFormat,
    ) -> Result<AudioFormat, String> {
        let sample_rate = mix_format.get_samplespersec();
        let channels = mix_format.get_nchannels();
        let channelmask = make_channelmasks(channels as usize)
            .first()
            .copied()
            .unwrap_or(0x3);

        // 尝试 Float32
        let float_format = WaveFormat::new(
            32,
            32,
            &SampleType::Float,
            sample_rate as usize,
            channels as usize,
            Some(channelmask),
        );

        match audio_client.is_supported(&float_format, &ShareMode::Exclusive) {
            Ok(Some(_)) | Ok(None) => {
                println!("   ✅ 设备支持 Float32 独占模式");
                return Ok(AudioFormat::new(
                    sample_rate,
                    channels,
                    32,
                    SampleType::Float,
                ));
            }
            Err(e) => {
                println!("   ⚠️ Float32 不支持: {:?}", e);
            }
        }

        // 尝试 Int16
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
                return Ok(AudioFormat::new(sample_rate, channels, 16, SampleType::Int));
            }
            Err(e) => {
                println!("   ⚠️ Int16 不支持: {:?}", e);
            }
        }

        println!("   ⚠️ 使用混合格式参数作为回退");
        Ok(AudioFormat::new(
            sample_rate,
            channels,
            mix_format.get_bitspersample(),
            if mix_format.get_bitspersample() == 32 {
                SampleType::Float
            } else {
                SampleType::Int
            },
        ))
    }

    pub fn load_track(&mut self, file_path: &str) -> Result<f64, String> {
        println!("🎵 AudioEngine: 加载音频文件: {}", file_path);
        let start = std::time::Instant::now();

        self.stop()?;

        let file_for_duration =
            File::open(file_path).map_err(|e| format!("打开文件失败: {}", e))?;

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

    pub fn play(&mut self) -> Result<(), String> {
        let start_time = std::time::Instant::now();
        println!("🎵 AudioEngine::play() 开始");

        if self.current_file.is_none() {
            return Err("未加载音频文件".to_string());
        }

        // 如果已暂停，立即恢复
        if self.is_paused.load(Ordering::SeqCst) {
            self.is_paused.store(false, Ordering::SeqCst);
            self.tracker.lock().start();
            println!("✅ AudioEngine::play() 恢复播放（立即生效）");
            return Ok(());
        }

        // 创建新的缓冲区
        println!("🔧 创建音频缓冲区，大小: {} 样本", self.buffer_size);
        let ring_buffer = HeapRb::<f32>::new(self.buffer_size);
        let (producer, consumer) = ring_buffer.split();
        let consumer = Arc::new(Mutex::new(consumer));

        // 创建消息通道(用于解码器->渲染器的通信)
        let (error_sender, error_receiver) = channel();
        let (render_msg_sender, render_msg_receiver) = channel();
        self.error_receiver = Some(error_receiver);

        self.is_playing.store(true, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);

        // 启动解码线程(传递render_msg_sender用于发送跳转消息)
        self.start_decoder_thread(producer, error_sender.clone(), render_msg_sender)?;

        // 等待缓冲区预填充
        println!("🔧 等待缓冲区预填充...");
        let buffer_threshold = (self.buffer_size / 5).max(4800);
        let mut wait_count = 0;
        loop {
            let buffered = consumer.lock().occupied_len();
            if buffered >= buffer_threshold {
                println!(
                    "✅ 缓冲区已填充 {} 样本（阈值: {}），开始播放",
                    buffered, buffer_threshold
                );
                break;
            }

            if !self.is_playing.load(Ordering::SeqCst) {
                return Err("播放被中断".to_string());
            }

            wait_count += 1;
            if wait_count > 100 {
                println!("⚠️ 缓冲区预填充超时，当前: {} 样本，继续播放", buffered);
                break;
            }

            std::thread::sleep(StdDuration::from_millis(10));
        }

        // 启动渲染器(传递render_msg_receiver用于接收跳转消息)
        let device_format = self.device_format.clone().ok_or("设备格式未初始化")?;
        self.renderer.start(
            consumer,
            self.volume.clone(),
            self.is_playing.clone(),
            self.is_paused.clone(),
            device_format,
            error_sender,
            render_msg_receiver,
        )?;

        self.tracker.lock().start();

        println!(
            "✅ AudioEngine::play() 播放已启动，耗时: {:?}",
            start_time.elapsed()
        );

        Ok(())
    }

    pub fn pause(&mut self) -> Result<(), String> {
        println!("🎵 AudioEngine: 暂停播放");
        self.is_paused.store(true, Ordering::SeqCst);
        self.tracker.lock().pause();

        println!(
            "✅ AudioEngine: 已暂停，当前位置: {:.2}秒",
            self.get_position()
        );
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        println!("🎵 AudioEngine: 停止播放");

        self.is_playing.store(false, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);
        self.tracker.lock().reset();

        if let Some(thread) = self.decoder_thread.take() {
            let _ = thread.join();
        }

        self.renderer.stop();
        self.seek_sender = None;

        println!("✅ AudioEngine: 已停止");
        Ok(())
    }

    pub fn seek(&mut self, position: f64) -> Result<(), String> {
        println!("🎵 AudioEngine: 跳转到 {:.2}秒", position);

        if self.current_file.is_none() {
            return Err("未加载音频文件".to_string());
        }

        let clamped_position = position.max(0.0).min(self.duration);

        if let Some(ref seek_sender) = self.seek_sender {
            seek_sender
                .send(clamped_position)
                .map_err(|e| format!("发送跳转请求失败: {}", e))?;

            self.tracker.lock().set_position(clamped_position);

            println!("✅ AudioEngine: 已请求跳转到 {:.2}秒", clamped_position);
        } else {
            return Err("跳转功能未就绪".to_string());
        }

        Ok(())
    }

    pub fn set_volume(&mut self, volume: f32) {
        let clamped_volume = volume.clamp(0.0, 1.0);
        *self.volume.lock() = clamped_volume;
        println!("🎵 AudioEngine: 音量设置为 {:.2}", clamped_volume);
    }

    pub fn get_position(&self) -> f64 {
        self.tracker.lock().get_position().min(self.duration)
    }

    pub fn get_duration(&self) -> f64 {
        self.duration
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }

    fn start_decoder_thread(
        &mut self,
        mut producer: HeapProd<f32>,
        error_sender: Sender<ThreadMessage>,
        render_msg_sender: Sender<ThreadMessage>,
    ) -> Result<(), String> {
        let file_path = self.current_file.clone().ok_or("未加载音频文件")?;
        let is_playing = self.is_playing.clone();
        let is_paused = self.is_paused.clone();
        let device_sample_rate = self.device_sample_rate;
        let device_channels = self.device_channels;
        let source_sample_rate = self.source_sample_rate.ok_or("源采样率未设置")?;
        let source_channels = self.source_channels.ok_or("源声道数未设置")?;

        // 创建跳转通道
        let (seek_sender, seek_receiver) = channel();
        self.seek_sender = Some(seek_sender);

        let decoder_thread = std::thread::spawn(move || {
            let needs_resampling = source_sample_rate != device_sample_rate;
            let needs_channel_conversion = source_channels != device_channels;

            let result = if needs_resampling || needs_channel_conversion {
                println!(
                    "🔧 解码: {} Hz {} 声道 -> {} Hz {} 声道",
                    source_sample_rate, source_channels, device_sample_rate, device_channels
                );

                decoder::decode_with_resampling(
                    file_path,
                    &mut producer,
                    &is_playing,
                    &is_paused,
                    &seek_receiver,
                    &render_msg_sender,
                    source_sample_rate,
                    source_channels,
                    device_sample_rate,
                    device_channels,
                )
            } else {
                decoder::decode_direct(
                    file_path,
                    &mut producer,
                    &is_playing,
                    &is_paused,
                    &seek_receiver,
                    &render_msg_sender,
                    source_sample_rate,
                    source_channels,
                )
            };

            if let Err(e) = result {
                eprintln!("❌ 解码错误: {}", e);
                let _ = error_sender.send(ThreadMessage::Error(e));
                is_playing.store(false, Ordering::SeqCst);
                return;
            }

            let _ = error_sender.send(ThreadMessage::DecoderFinished);
        });

        self.decoder_thread = Some(decoder_thread);
        Ok(())
    }
}
