//! 参量均衡器
//!
//! 支持自定义频段数量、频率、增益、Q值和滤波器类型

use biquad::*;
use parking_lot::RwLock;
use std::sync::Arc;

/// 参量滤波器类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParamFilterType {
    /// 峰值滤波器（参数均衡）- 用于提升/衰减特定频率
    Peak,
    /// 低频搁架滤波器 - 影响低于指定频率的所有频率
    LowShelf,
    /// 高频搁架滤波器 - 影响高于指定频率的所有频率
    HighShelf,
    /// 低通滤波器 - 只允许低于指定频率的信号通过
    LowPass,
    /// 高通滤波器 - 只允许高于指定频率的信号通过
    HighPass,
    /// 带通滤波器 - 只允许特定频率范围的信号通过
    BandPass,
    /// 陷波滤波器 - 去除特定频率（用于去除噪声）
    Notch,
}

impl ParamFilterType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ParamFilterType::Peak => "peak",
            ParamFilterType::LowShelf => "lowshelf",
            ParamFilterType::HighShelf => "highshelf",
            ParamFilterType::LowPass => "lowpass",
            ParamFilterType::HighPass => "highpass",
            ParamFilterType::BandPass => "bandpass",
            ParamFilterType::Notch => "notch",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "peak" | "peaking" => Some(ParamFilterType::Peak),
            "lowshelf" | "low_shelf" => Some(ParamFilterType::LowShelf),
            "highshelf" | "high_shelf" => Some(ParamFilterType::HighShelf),
            "lowpass" | "low_pass" => Some(ParamFilterType::LowPass),
            "highpass" | "high_pass" => Some(ParamFilterType::HighPass),
            "bandpass" | "band_pass" => Some(ParamFilterType::BandPass),
            "notch" => Some(ParamFilterType::Notch),
            _ => None,
        }
    }
}

/// 单个参量频段配置
#[derive(Debug, Clone)]
pub struct ParamBand {
    /// 频段ID（用于前端标识）
    pub id: usize,
    /// 中心频率（Hz）
    pub frequency: f64,
    /// 增益（dB）
    pub gain: f64,
    /// Q值（品质因数）
    pub q: f64,
    /// 滤波器类型
    pub filter_type: ParamFilterType,
    /// 是否启用此频段
    pub enabled: bool,
}

impl ParamBand {
    pub fn new(id: usize, frequency: f64, gain: f64, q: f64, filter_type: ParamFilterType) -> Self {
        Self {
            id,
            frequency: frequency.clamp(20.0, 20000.0),
            gain: gain.clamp(-20.0, 20.0),
            q: q.clamp(0.1, 10.0),
            filter_type,
            enabled: true,
        }
    }

    /// 创建默认的峰值滤波器频段
    pub fn default_peak(id: usize, frequency: f64) -> Self {
        Self::new(id, frequency, 0.0, 1.0, ParamFilterType::Peak)
    }
}

/// 参量滤波器实例（包含biquad滤波器和多声道状态）
struct ParamFilter {
    config: ParamBand,
    // 每个声道一个DirectForm1实现
    filters: Vec<DirectForm1<f32>>,
}

impl ParamFilter {
    fn new(config: ParamBand, sample_rate: f64, channels: usize) -> Self {
        let mut filters = Vec::with_capacity(channels);

        for _ in 0..channels {
            let filter = Self::create_biquad(&config, sample_rate);
            filters.push(filter);
        }

        Self { config, filters }
    }

    /// 根据配置创建biquad滤波器
    fn create_biquad(config: &ParamBand, sample_rate: f64) -> DirectForm1<f32> {
        let fs = (sample_rate as f32).hz();
        let f0 = (config.frequency as f32).hz();

        // 将dB增益转换为线性增益
        // let gain_linear = 10.0_f64.powf(config.gain / 20.0) as f32;

        match config.filter_type {
            ParamFilterType::Peak => {
                // 峰值滤波器
                let coeffs = Coefficients::<f32>::from_params(
                    Type::PeakingEQ(config.gain as f32),
                    fs,
                    f0,
                    config.q as f32,
                )
                .unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
            ParamFilterType::LowShelf => {
                // 低频搁架
                let coeffs = Coefficients::<f32>::from_params(
                    Type::LowShelf(config.gain as f32),
                    fs,
                    f0,
                    config.q as f32,
                )
                .unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
            ParamFilterType::HighShelf => {
                // 高频搁架
                let coeffs = Coefficients::<f32>::from_params(
                    Type::HighShelf(config.gain as f32),
                    fs,
                    f0,
                    config.q as f32,
                )
                .unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
            ParamFilterType::LowPass => {
                // 低通滤波器
                let coeffs =
                    Coefficients::<f32>::from_params(Type::LowPass, fs, f0, config.q as f32)
                        .unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
            ParamFilterType::HighPass => {
                // 高通滤波器
                let coeffs =
                    Coefficients::<f32>::from_params(Type::HighPass, fs, f0, config.q as f32)
                        .unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
            ParamFilterType::BandPass => {
                // 带通滤波器
                let coeffs =
                    Coefficients::<f32>::from_params(Type::BandPass, fs, f0, config.q as f32)
                        .unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
            ParamFilterType::Notch => {
                // 陷波滤波器
                let coeffs =
                    Coefficients::<f32>::from_params(Type::Notch, fs, f0, config.q as f32).unwrap();
                DirectForm1::<f32>::new(coeffs)
            }
        }
    }

    /// 更新滤波器配置
    fn update_config(&mut self, config: ParamBand, sample_rate: f64) {
        self.config = config;

        // 重新创建所有声道的滤波器
        for filter in &mut self.filters {
            *filter = Self::create_biquad(&self.config, sample_rate);
        }
    }

    /// 处理单个样本
    #[inline]
    fn process_sample(&mut self, sample: f32, channel: usize) -> f32 {
        if !self.config.enabled || channel >= self.filters.len() {
            return sample;
        }

        self.filters[channel].run(sample)
    }
}

/// 参量均衡器配置
#[derive(Debug, Clone)]
pub struct ParametricEqualizerConfig {
    /// 是否启用
    pub enabled: bool,
    /// 前置增益（dB）
    pub preamp: f32,
    /// 频段列表
    pub bands: Vec<ParamBand>,
}

impl Default for ParametricEqualizerConfig {
    fn default() -> Self {
        // 默认创建4个峰值滤波器频段
        let default_frequencies = [100.0, 400.0, 1000.0, 4000.0];
        let bands = default_frequencies
            .iter()
            .enumerate()
            .map(|(i, &freq)| ParamBand::default_peak(i, freq))
            .collect();

        Self {
            enabled: false,
            preamp: 0.0,
            bands,
        }
    }
}

/// 参量均衡器
pub struct ParametricEqualizer {
    filters: Vec<ParamFilter>,
    config: Arc<RwLock<ParametricEqualizerConfig>>,
    sample_rate: f64,
    channels: usize,
}

impl ParametricEqualizer {
    /// 创建新的参量均衡器
    pub fn new(sample_rate: u32, channels: u16) -> Self {
        let sample_rate = sample_rate as f64;
        let channels = channels as usize;
        let config = ParametricEqualizerConfig::default();

        let mut filters = Vec::new();
        for band in &config.bands {
            filters.push(ParamFilter::new(band.clone(), sample_rate, channels));
        }

        println!(
            "🎚️ 参量均衡器: 创建成功，采样率: {} Hz，声道数: {}，默认频段数: {}",
            sample_rate,
            channels,
            filters.len()
        );

        Self {
            filters,
            config: Arc::new(RwLock::new(config)),
            sample_rate,
            channels,
        }
    }

    /// 获取配置的克隆
    pub fn get_config(&self) -> Arc<RwLock<ParametricEqualizerConfig>> {
        self.config.clone()
    }

    /// 启用/禁用均衡器
    pub fn set_enabled(&self, enabled: bool) {
        let mut config = self.config.write();
        config.enabled = enabled;
        println!("🎚️ 参量均衡器: {}", if enabled { "启用" } else { "禁用" });
    }

    /// 检查是否启用
    pub fn is_enabled(&self) -> bool {
        self.config.read().enabled
    }

    /// 设置前置增益（dB）
    pub fn set_preamp(&self, gain: f32) {
        let mut config = self.config.write();
        config.preamp = gain.clamp(-12.0, 12.0);
    }

    /// 获取前置增益
    pub fn get_preamp(&self) -> f32 {
        self.config.read().preamp
    }

    /// 添加频段
    pub fn add_band(
        &mut self,
        frequency: f64,
        gain: f64,
        q: f64,
        filter_type: ParamFilterType,
    ) -> usize {
        let mut config = self.config.write();

        if config.bands.len() >= 16 {
            println!("⚠️ 参量均衡器: 已达到最大频段数(16)");
            return usize::MAX;
        }

        let id = config.bands.iter().map(|b| b.id).max().unwrap_or(0) + 1;
        let band = ParamBand::new(id, frequency, gain, q, filter_type);

        config.bands.push(band.clone());
        drop(config);

        self.filters
            .push(ParamFilter::new(band, self.sample_rate, self.channels));

        println!(
            "🎚️ 参量均衡器: 添加频段 #{}, {}Hz, {:.1}dB, Q={:.2}, {:?}",
            id, frequency, gain, q, filter_type
        );

        id
    }

    /// 移除频段
    pub fn remove_band(&mut self, band_id: usize) -> bool {
        let mut config = self.config.write();

        if let Some(pos) = config.bands.iter().position(|b| b.id == band_id) {
            config.bands.remove(pos);
            drop(config);

            self.filters.remove(pos);

            println!("🎚️ 参量均衡器: 移除频段 #{}", band_id);
            true
        } else {
            println!("⚠️ 参量均衡器: 频段 #{} 不存在", band_id);
            false
        }
    }

    /// 更新频段配置
    pub fn update_band(
        &mut self,
        band_id: usize,
        frequency: Option<f64>,
        gain: Option<f64>,
        q: Option<f64>,
        filter_type: Option<ParamFilterType>,
        enabled: Option<bool>,
    ) -> bool {
        let mut config = self.config.write();
        let Some(pos) = config.bands.iter().position(|b| b.id == band_id) else {
            println!("Warning: 参量均衡器: 频段 #{} 不存在", band_id);
            return false;
        };

        let band = &mut config.bands[pos];

        // 应用参数更新
        if let Some(freq) = frequency {
            band.frequency = freq.clamp(20.0, 20000.0);
        }
        if let Some(g) = gain {
            band.gain = g.clamp(-20.0, 20.0);
        }
        if let Some(q_val) = q {
            band.q = q_val.clamp(0.1, 30.0);
        }
        if let Some(ft) = filter_type {
            band.filter_type = ft;
        }
        if let Some(en) = enabled {
            band.enabled = en;
        }

        // 克隆更新后的配置用于重建滤波器
        let updated_band = band.clone();
        drop(config);

        // 用相同的 pos 索引更新对应的 ParamFilter
        if let Some(filter) = self.filters.get_mut(pos) {
            filter.update_config(updated_band, self.sample_rate);
            true
        } else {
            false
        }
    }

    /// 获取所有频段配置
    pub fn get_bands(&self) -> Vec<ParamBand> {
        self.config.read().bands.clone()
    }

    /// 获取单个频段配置
    pub fn get_band(&self, band_id: usize) -> Option<ParamBand> {
        self.config
            .read()
            .bands
            .iter()
            .find(|b| b.id == band_id)
            .cloned()
    }

    /// 重置均衡器
    pub fn reset(&mut self) {
        let mut config = self.config.write();
        config.preamp = 0.0;

        // 重置所有频段为0增益
        for band in &mut config.bands {
            band.gain = 0.0;
            band.enabled = true;
        }

        let bands = config.bands.clone();
        drop(config);

        // 重新创建所有滤波器
        for (i, band) in bands.iter().enumerate() {
            if let Some(filter) = self.filters.get_mut(i) {
                filter.update_config(band.clone(), self.sample_rate);
            }
        }

        println!("🎚️ 参量均衡器: 重置为平坦响应");
    }

    /// 清除所有频段
    pub fn clear_bands(&mut self) {
        let mut config = self.config.write();
        config.bands.clear();
        drop(config);

        self.filters.clear();

        println!("🎚️ 参量均衡器: 清除所有频段");
    }

    /// 更新采样率
    pub fn update_sample_rate(&mut self, sample_rate: u32) {
        let sample_rate = sample_rate as f64;

        if (self.sample_rate - sample_rate).abs() < 0.1 {
            return;
        }

        self.sample_rate = sample_rate;

        let bands = self.config.read().bands.clone();

        // 重新创建所有滤波器
        for (i, band) in bands.iter().enumerate() {
            if let Some(filter) = self.filters.get_mut(i) {
                filter.update_config(band.clone(), sample_rate);
            }
        }

        println!("🎚️ 参量均衡器: 更新采样率为 {} Hz", sample_rate);
    }

    /// 处理交错音频样本块（就地处理）
    #[inline]
    pub fn process_interleaved(&mut self, samples: &mut [f32]) {
        let config = self.config.read();

        if !config.enabled {
            return;
        }

        let preamp_linear = 10.0_f32.powf(config.preamp / 20.0);
        drop(config);

        let channels = self.channels;
        let frame_count = samples.len() / channels;

        for frame in 0..frame_count {
            for ch in 0..channels {
                let idx = frame * channels + ch;
                let mut sample = samples[idx] * preamp_linear;

                // 通过所有启用的滤波器
                for filter in &mut self.filters {
                    sample = filter.process_sample(sample, ch);
                }

                // 软限幅防止削波
                sample = soft_clip(sample);
                samples[idx] = sample;
            }
        }
    }

    /// 处理分离声道音频样本块
    pub fn process_deinterleaved(&mut self, waves: &mut [Vec<f32>]) {
        let config = self.config.read();

        if !config.enabled {
            return;
        }

        let preamp_linear = 10.0_f32.powf(config.preamp / 20.0);
        drop(config);

        let frame_count = waves.get(0).map(|w| w.len()).unwrap_or(0);

        for frame in 0..frame_count {
            for (ch, channel_data) in waves.iter_mut().enumerate() {
                if ch >= self.channels || frame >= channel_data.len() {
                    continue;
                }

                let mut sample = channel_data[frame] * preamp_linear;

                for filter in &mut self.filters {
                    sample = filter.process_sample(sample, ch);
                }

                sample = soft_clip(sample);
                channel_data[frame] = sample;
            }
        }
    }
}

/// 软限幅函数
#[inline]
fn soft_clip(x: f32) -> f32 {
    // 预增益 + 轻微动态扩张（让鼓/贝斯更顶）
    let abs_x = x.abs();
    let gain = 1.0 + 0.135 * abs_x * abs_x; // 只在波峰处轻微提升 0~0.18 dB，更自然

    // 核心双曲正切饱和
    let saturated = (x * gain * 1.1220184f32).tanh();

    // 自适应响度归一化（让 0 dBFS 正弦波输出仍接近 0 dBFS）
    let denom = 0.739 + 0.361 * saturated * saturated;
    saturated / denom
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parametric_equalizer_creation() {
        let peq = ParametricEqualizer::new(48000, 2);
        assert!(!peq.is_enabled());
        assert_eq!(peq.get_preamp(), 0.0);
        assert_eq!(peq.get_bands().len(), 4); // 默认4个频段
    }

    #[test]
    fn test_add_remove_band() {
        let mut peq = ParametricEqualizer::new(48000, 2);

        let id = peq.add_band(1000.0, 3.0, 1.5, ParamFilterType::Peak);
        assert_ne!(id, usize::MAX);
        assert_eq!(peq.get_bands().len(), 5); // 4个默认 + 1个新增

        assert!(peq.remove_band(id));
        assert_eq!(peq.get_bands().len(), 4);
    }

    #[test]
    fn test_update_band() {
        let mut peq = ParametricEqualizer::new(48000, 2);
        let bands = peq.get_bands();
        let band_id = bands[0].id;

        assert!(peq.update_band(
            band_id,
            Some(500.0),
            Some(6.0),
            Some(2.0),
            Some(ParamFilterType::LowShelf),
            None
        ));

        let updated = peq.get_band(band_id).unwrap();
        assert_eq!(updated.frequency, 500.0);
        assert_eq!(updated.gain, 6.0);
        assert_eq!(updated.q, 2.0);
        assert_eq!(updated.filter_type, ParamFilterType::LowShelf);
    }

    #[test]
    fn test_max_bands() {
        let mut peq = ParametricEqualizer::new(48000, 2);

        // 添加到最大值（16个）
        for i in 0..12 {
            // 已有4个，再添加12个
            let id = peq.add_band(100.0 * (i as f64 + 1.0), 0.0, 1.0, ParamFilterType::Peak);
            assert_ne!(id, usize::MAX);
        }

        // 尝试添加第17个
        let id = peq.add_band(2000.0, 0.0, 1.0, ParamFilterType::Peak);
        assert_eq!(id, usize::MAX); // 应该失败
    }
}
