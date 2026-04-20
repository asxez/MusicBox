//! WASAPI音频引擎核心实现

use crate::core::AudioConfig;
use crate::equalizer::AudioEqualizer;
use crate::equalizer::ParametricEqualizer;
use parking_lot::Mutex;
use rodio::{Decoder, Source};
use std::fs::File;
use std::io::{Cursor, Read, Seek};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::time::Duration as StdDuration;
use wasapi::*;

use ringbuf::traits::{Observer, Split};
use ringbuf::{HeapProd, HeapRb};

use crate::core::AudioFormat;
use crate::decoder;
use crate::utils::PlaybackTracker;
use crate::renderer::WasapiRenderer;
use crate::utils::ThreadMessage;

/// 组合 Read 和 Seek traits 的 trait，用于动态分发
trait ReadSeek: Read + Seek + Send + Sync {}

/// 自动为所有实现了 Read + Seek + Send + Sync 的类型实现 ReadSeek
impl<T: Read + Seek + Send + Sync> ReadSeek for T {}

// Windows HRESULT 错误码常量
const S_FALSE: i32 = 1;
const RPC_E_CHANGED_MODE: i32 = 0x80010106u32 as i32;

/// 均衡器模式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EqualizerMode {
    /// 图形均衡器（10段固定频率）
    Graphic,
    /// 参量均衡器（可自定义频段）
    Parametric,
}

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
    config: AudioConfig,
    // 均衡器
    equalizer: Arc<Mutex<Option<AudioEqualizer>>>,
    parametric_equalizer: Arc<Mutex<Option<ParametricEqualizer>>>,
    equalizer_mode: Arc<Mutex<EqualizerMode>>,
}

impl AudioEngine {
    pub fn new() -> Result<Self, String> {
        Self::with_config(AudioConfig::default())
    }

    pub fn with_config(config: AudioConfig) -> Result<Self, String> {
        // 使用配置的缓冲区大小
        let buffer_size = config.get_ring_buffer_size(48000, 2);
        println!("🎵 创建音频引擎，配置: {:?}", config);

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
            config,
            equalizer: Arc::new(Mutex::new(None)),
            parametric_equalizer: Arc::new(Mutex::new(None)),
            equalizer_mode: Arc::new(Mutex::new(EqualizerMode::Graphic)),
        })
    }

    pub fn initialize(&mut self) -> Result<(), String> {
        let mode_str = match self.config.share_mode {
            crate::core::ShareMode::Shared => "共享模式",
            crate::core::ShareMode::Exclusive => "独占模式",
        };
        println!("🎵 AudioEngine: 初始化WASAPI音频引擎（{}）", mode_str);
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

        let supported_format = self.query_format(&mut audio_client, &mix_format)?;

        println!("   {}支持的格式:", mode_str);
        println!("     采样率: {} Hz", supported_format.sample_rate);
        println!("     声道数: {}", supported_format.channels);
        println!("     位深度: {} bits", supported_format.bits_per_sample);
        println!("     样本类型: {:?}", supported_format.sample_type);

        self.device_sample_rate = supported_format.sample_rate;
        self.device_channels = supported_format.channels;
        self.device_format = Some(supported_format);
        self.initialized = true;

        // 创建图形均衡器实例
        let equalizer = AudioEqualizer::new(self.device_sample_rate, self.device_channels);
        *self.equalizer.lock() = Some(equalizer);
        println!("🎛️ AudioEngine: 图形均衡器已初始化");

        // 创建参量均衡器实例
        let parametric_equalizer =
            ParametricEqualizer::new(self.device_sample_rate, self.device_channels);
        *self.parametric_equalizer.lock() = Some(parametric_equalizer);
        println!("🎚️ AudioEngine: 参量均衡器已初始化");

        println!(
            "✅ AudioEngine: WASAPI{}初始化成功，耗时: {:?}",
            mode_str,
            start.elapsed()
        );

        Ok(())
    }

    fn query_format(
        &self,
        audio_client: &mut AudioClient,
        mix_format: &WaveFormat,
    ) -> Result<AudioFormat, String> {
        use crate::core::ShareMode;

        match self.config.share_mode {
            ShareMode::Shared => {
                // 共享模式：使用系统混合格式
                println!("   ✅ 使用系统混合格式（共享模式）");
                Ok(AudioFormat::new(
                    mix_format.get_samplespersec(),
                    mix_format.get_nchannels(),
                    mix_format.get_bitspersample(),
                    if mix_format.get_bitspersample() == 32 {
                        SampleType::Float
                    } else {
                        SampleType::Int
                    },
                ))
            }
            ShareMode::Exclusive => {
                // 独占模式：查询设备支持的格式
                self.query_exclusive_format(audio_client, mix_format)
            }
        }
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

        // 对于 M4A 文件，加载到内存中以避免 seek 问题
        let is_m4a = file_path.to_lowercase().ends_with(".m4a");
        let source_for_duration: Decoder<Box<dyn ReadSeek>> = if is_m4a {
            println!("🎵 AudioEngine: M4A 文件，加载到内存中");
            let mut file = File::open(file_path).map_err(|e| format!("打开文件失败: {}", e))?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            let cursor: Box<dyn ReadSeek> = Box::new(Cursor::new(buffer));
            Decoder::new(cursor).map_err(|e| format!("解码失败: {:?}", e))?
        } else {
            let file = File::open(file_path).map_err(|e| format!("打开文件失败: {}", e))?;
            let boxed: Box<dyn ReadSeek> = Box::new(file);
            Decoder::new(boxed).map_err(|e| format!("解码失败: {:?}", e))?
        };

        let duration = source_for_duration
            .total_duration()
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0);

        let sample_rate = source_for_duration.sample_rate();
        let channels = source_for_duration.channels();

        println!("   时长: {:.2}秒", duration);
        println!("   源采样率: {} Hz", sample_rate);
        println!("   源声道数: {}", channels);

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
        if self.current_file.is_none() {
            return Err("未加载音频文件".to_string());
        }

        // 如果已暂停，立即恢复
        if self.is_paused.load(Ordering::SeqCst) {
            self.is_paused.store(false, Ordering::SeqCst);
            self.tracker.lock().start();
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
            self.config.dither_type,
            &self.config,
            self.equalizer.clone(),
            self.parametric_equalizer.clone(),
            self.equalizer_mode.clone(),
        )?;

        self.tracker.lock().start();
        Ok(())
    }

    pub fn pause(&mut self) -> Result<(), String> {
        self.is_paused.store(true, Ordering::SeqCst);
        self.tracker.lock().pause();
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        self.is_playing.store(false, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);
        self.tracker.lock().reset();

        if let Some(thread) = self.decoder_thread.take() {
            let _ = thread.join();
        }

        self.renderer.stop();
        self.seek_sender = None;
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

    pub fn poll_events(&mut self) -> Option<String> {
        if let Some(ref receiver) = self.error_receiver {
            if let Ok(message) = receiver.try_recv() {
                match message {
                    ThreadMessage::DecoderFinished => {
                        self.is_playing.store(false, Ordering::SeqCst);
                        return Some("finished".to_string());
                    }
                    ThreadMessage::Error(err) => {
                        eprintln!("❌ AudioEngine: 收到错误: {}", err);
                        self.is_playing.store(false, Ordering::SeqCst);
                        return Some(format!("error:{}", err));
                    }
                    _ => {}
                }
            }
        }
        None
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
        let resampling_quality = self.config.resampling_quality;

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
                    resampling_quality,
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

    // ==================== 均衡器方法 ====================

    /// 获取均衡器的克隆引用
    pub fn get_equalizer(&self) -> Arc<Mutex<Option<AudioEqualizer>>> {
        self.equalizer.clone()
    }

    /// 启用/禁用均衡器
    pub fn set_equalizer_enabled(&self, enabled: bool) {
        if let Some(ref mut eq) = *self.equalizer.lock() {
            eq.set_enabled(enabled);
        }
    }

    /// 获取均衡器启用状态
    pub fn is_equalizer_enabled(&self) -> bool {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.is_enabled()
        } else {
            false
        }
    }

    /// 设置前置增益
    pub fn set_equalizer_preamp(&self, gain: f32) {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.set_preamp(gain);
        }
    }

    /// 获取前置增益
    pub fn get_equalizer_preamp(&self) -> f32 {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.get_preamp()
        } else {
            0.0
        }
    }

    /// 设置单个频段增益
    pub fn set_equalizer_band_gain(&mut self, band: usize, gain: f32) {
        if let Some(ref mut eq) = *self.equalizer.lock() {
            eq.set_band_gain(band, gain);
        }
    }

    /// 获取单个频段增益
    pub fn get_equalizer_band_gain(&self, band: usize) -> f32 {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.get_band_gain(band)
        } else {
            0.0
        }
    }

    /// 设置所有频段增益
    pub fn set_equalizer_all_gains(&mut self, gains: &[f32; 10]) {
        if let Some(ref mut eq) = *self.equalizer.lock() {
            eq.set_all_gains(gains);
        }
    }

    /// 获取所有频段增益
    pub fn get_equalizer_all_gains(&self) -> [f32; 10] {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.get_all_gains()
        } else {
            [0.0; 10]
        }
    }

    /// 设置单个频段Q值
    pub fn set_equalizer_band_q(&mut self, band: usize, q: f32) {
        if let Some(ref mut eq) = *self.equalizer.lock() {
            eq.set_band_q(band, q);
        }
    }

    /// 获取单个频段Q值
    pub fn get_equalizer_band_q(&self, band: usize) -> f32 {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.get_band_q(band)
        } else {
            1.0
        }
    }

    /// 应用预设
    pub fn apply_equalizer_preset(&mut self, name: &str) -> bool {
        if let Some(ref mut eq) = *self.equalizer.lock() {
            eq.apply_preset(name)
        } else {
            false
        }
    }

    /// 重置均衡器
    pub fn reset_equalizer(&mut self) {
        if let Some(ref mut eq) = *self.equalizer.lock() {
            eq.reset();
        }
    }

    /// 获取频率响应曲线数据
    pub fn get_equalizer_frequency_response(&self) -> Vec<(f32, f32)> {
        if let Some(ref eq) = *self.equalizer.lock() {
            eq.get_frequency_response()
        } else {
            Vec::new()
        }
    }

    // ==================== 均衡器模式切换 ====================

    /// 设置均衡器模式（图形/参量）
    pub fn set_equalizer_mode(&self, mode: EqualizerMode) {
        *self.equalizer_mode.lock() = mode;
        println!("🎛️ AudioEngine: 均衡器模式切换为 {:?}", mode);
    }

    /// 获取当前均衡器模式
    pub fn get_equalizer_mode(&self) -> EqualizerMode {
        *self.equalizer_mode.lock()
    }

    /// 获取均衡器模式的克隆（用于renderer）
    pub fn get_equalizer_mode_arc(&self) -> Arc<Mutex<EqualizerMode>> {
        self.equalizer_mode.clone()
    }

    /// 获取参量均衡器的克隆（用于renderer）
    pub fn get_parametric_equalizer(&self) -> Arc<Mutex<Option<ParametricEqualizer>>> {
        self.parametric_equalizer.clone()
    }

    // ==================== 参量均衡器接口 ====================

    /// 添加参量频段
    pub fn parametric_add_band(
        &mut self,
        frequency: f64,
        gain: f64,
        q: f64,
        filter_type: &str,
    ) -> Option<usize> {
        use crate::equalizer::ParamFilterType;

        let filter_type = ParamFilterType::from_str(filter_type)?;

        if let Some(ref mut peq) = *self.parametric_equalizer.lock() {
            let id = peq.add_band(frequency, gain, q, filter_type);
            if id != usize::MAX { Some(id) } else { None }
        } else {
            None
        }
    }

    /// 移除参量频段
    pub fn parametric_remove_band(&mut self, band_id: usize) -> bool {
        if let Some(ref mut peq) = *self.parametric_equalizer.lock() {
            peq.remove_band(band_id)
        } else {
            false
        }
    }

    /// 更新参量频段
    pub fn parametric_update_band(
        &mut self,
        band_id: usize,
        frequency: Option<f64>,
        gain: Option<f64>,
        q: Option<f64>,
        filter_type: Option<&str>,
        enabled: Option<bool>,
    ) -> bool {
        use crate::equalizer::ParamFilterType;

        let filter_type_enum = if let Some(ft) = filter_type {
            ParamFilterType::from_str(ft)
        } else {
            None
        };

        if let Some(ref mut peq) = *self.parametric_equalizer.lock() {
            peq.update_band(band_id, frequency, gain, q, filter_type_enum, enabled)
        } else {
            false
        }
    }

    /// 获取所有参量频段配置
    pub fn parametric_get_bands(&self) -> Vec<(usize, f64, f64, f64, String, bool)> {
        if let Some(ref peq) = *self.parametric_equalizer.lock() {
            peq.get_bands()
                .iter()
                .map(|band| {
                    (
                        band.id,
                        band.frequency,
                        band.gain,
                        band.q,
                        band.filter_type.as_str().to_string(),
                        band.enabled,
                    )
                })
                .collect()
        } else {
            Vec::new()
        }
    }

    /// 获取单个参量频段配置
    pub fn parametric_get_band(
        &self,
        band_id: usize,
    ) -> Option<(usize, f64, f64, f64, String, bool)> {
        if let Some(ref peq) = *self.parametric_equalizer.lock() {
            peq.get_band(band_id).map(|band| {
                (
                    band.id,
                    band.frequency,
                    band.gain,
                    band.q,
                    band.filter_type.as_str().to_string(),
                    band.enabled,
                )
            })
        } else {
            None
        }
    }

    /// 设置参量均衡器前置增益
    pub fn parametric_set_preamp(&self, gain: f32) {
        if let Some(ref peq) = *self.parametric_equalizer.lock() {
            peq.set_preamp(gain);
        }
    }

    /// 获取参量均衡器前置增益
    pub fn parametric_get_preamp(&self) -> f32 {
        if let Some(ref peq) = *self.parametric_equalizer.lock() {
            peq.get_preamp()
        } else {
            0.0
        }
    }

    /// 重置参量均衡器
    pub fn parametric_reset(&mut self) {
        if let Some(ref mut peq) = *self.parametric_equalizer.lock() {
            peq.reset();
        }
    }

    /// 清除所有参量频段
    pub fn parametric_clear_bands(&mut self) {
        if let Some(ref mut peq) = *self.parametric_equalizer.lock() {
            peq.clear_bands();
        }
    }

    /// 启用/禁用参量均衡器
    pub fn parametric_set_enabled(&self, enabled: bool) {
        if let Some(ref peq) = *self.parametric_equalizer.lock() {
            peq.set_enabled(enabled);
        }
    }

    /// 检查参量均衡器是否启用
    pub fn parametric_is_enabled(&self) -> bool {
        if let Some(ref peq) = *self.parametric_equalizer.lock() {
            peq.is_enabled()
        } else {
            false
        }
    }

    // ==================== 音频模式切换 ====================

    /// 设置音频模式（共享/独占）
    /// 注意：需要重新初始化才能生效
    pub fn set_share_mode(&mut self, mode: crate::core::ShareMode) {
        self.config.set_share_mode(mode);
        println!("🔧 AudioEngine: 音频模式已设置为 {:?}", mode);
    }

    /// 获取当前音频模式
    pub fn get_share_mode(&self) -> crate::core::ShareMode {
        self.config.get_share_mode()
    }

    /// 切换音频模式并重新初始化
    pub fn switch_share_mode(
        &mut self,
        mode: crate::core::ShareMode,
    ) -> Result<(), String> {
        println!("🔄 AudioEngine: 切换音频模式到 {:?}", mode);

        // 停止当前播放
        self.stop()?;

        // 设置新模式
        self.set_share_mode(mode);

        // 重新初始化
        self.initialized = false;
        self.initialize()?;

        println!("✅ AudioEngine: 音频模式切换完成");
        Ok(())
    }
}
