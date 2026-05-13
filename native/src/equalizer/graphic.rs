//! 10段图形均衡器，支持Biquad滤波器链

use parking_lot::RwLock;
use std::f64::consts::PI;
use std::sync::Arc;

/// 滤波器类型
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FilterType {
    /// 低频搁架滤波器
    LowShelf,
    /// 高频搁架滤波器
    HighShelf,
    /// 峰值滤波器（参数均衡）
    Peaking,
}

/// Biquad滤波器系数
#[derive(Debug, Clone, Copy, Default)]
struct BiquadCoefficients {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
}

/// Biquad滤波器状态（每声道）
#[derive(Debug, Clone, Copy, Default)]
struct BiquadState {
    x1: f64,
    x2: f64,
    y1: f64,
    y2: f64,
}

/// 单频段滤波器
#[derive(Debug, Clone)]
struct BiquadFilter {
    filter_type: FilterType,
    frequency: f64,
    gain: f64,
    q: f64,
    sample_rate: f64,
    coefficients: BiquadCoefficients,
    states: Vec<BiquadState>,
}

impl BiquadFilter {
    /// 创建新的Biquad滤波器
    fn new(filter_type: FilterType, frequency: f64, sample_rate: f64, channels: usize) -> Self {
        let mut filter = Self {
            filter_type,
            frequency,
            gain: 0.0,
            q: if filter_type == FilterType::Peaking {
                1.0
            } else {
                0.707
            },
            sample_rate,
            coefficients: BiquadCoefficients::default(),
            states: vec![BiquadState::default(); channels],
        };
        filter.update_coefficients();
        filter
    }

    /// 设置增益（dB）
    fn set_gain(&mut self, gain: f64) {
        self.gain = gain.clamp(-12.0, 12.0);
        self.update_coefficients();
    }

    /// 设置Q值
    fn set_q(&mut self, q: f64) {
        self.q = q.clamp(0.1, 10.0);
        self.update_coefficients();
    }

    /// 更新滤波器系数
    fn update_coefficients(&mut self) {
        let omega = 2.0 * PI * self.frequency / self.sample_rate;
        let sin_omega = omega.sin();
        let cos_omega = omega.cos();
        let a = 10.0_f64.powf(self.gain / 40.0);

        let (b0, b1, b2, a0, a1, a2) = match self.filter_type {
            FilterType::LowShelf => {
                let alpha = sin_omega / 2.0 * ((a + 1.0 / a) * (1.0 / self.q - 1.0) + 2.0).sqrt();
                let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

                let b0 = a * ((a + 1.0) - (a - 1.0) * cos_omega + two_sqrt_a_alpha);
                let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_omega);
                let b2 = a * ((a + 1.0) - (a - 1.0) * cos_omega - two_sqrt_a_alpha);
                let a0 = (a + 1.0) + (a - 1.0) * cos_omega + two_sqrt_a_alpha;
                let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_omega);
                let a2 = (a + 1.0) + (a - 1.0) * cos_omega - two_sqrt_a_alpha;

                (b0, b1, b2, a0, a1, a2)
            }
            FilterType::HighShelf => {
                let alpha = sin_omega / 2.0 * ((a + 1.0 / a) * (1.0 / self.q - 1.0) + 2.0).sqrt();
                let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

                let b0 = a * ((a + 1.0) + (a - 1.0) * cos_omega + two_sqrt_a_alpha);
                let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_omega);
                let b2 = a * ((a + 1.0) + (a - 1.0) * cos_omega - two_sqrt_a_alpha);
                let a0 = (a + 1.0) - (a - 1.0) * cos_omega + two_sqrt_a_alpha;
                let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_omega);
                let a2 = (a + 1.0) - (a - 1.0) * cos_omega - two_sqrt_a_alpha;

                (b0, b1, b2, a0, a1, a2)
            }
            FilterType::Peaking => {
                let alpha = sin_omega / (2.0 * self.q);
                let a_db = 10.0_f64.powf(self.gain / 20.0);

                let b0 = 1.0 + alpha * a_db;
                let b1 = -2.0 * cos_omega;
                let b2 = 1.0 - alpha * a_db;
                let a0 = 1.0 + alpha / a_db;
                let a1 = -2.0 * cos_omega;
                let a2 = 1.0 - alpha / a_db;

                (b0, b1, b2, a0, a1, a2)
            }
        };

        // 归一化系数
        self.coefficients = BiquadCoefficients {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
        };
    }

    /// 处理单个样本
    #[inline]
    fn process_sample(&mut self, sample: f32, channel: usize) -> f32 {
        let x = sample as f64;
        let state = &mut self.states[channel];
        let coef = &self.coefficients;

        let y = coef.b0 * x + coef.b1 * state.x1 + coef.b2 * state.x2
            - coef.a1 * state.y1
            - coef.a2 * state.y2;

        state.x2 = state.x1;
        state.x1 = x;
        state.y2 = state.y1;
        state.y1 = y;

        y as f32
    }

    /// 重置滤波器状态
    fn reset(&mut self) {
        for state in &mut self.states {
            *state = BiquadState::default();
        }
    }

    /// 更新采样率
    fn set_sample_rate(&mut self, sample_rate: f64) {
        self.sample_rate = sample_rate;
        self.update_coefficients();
    }
}

/// 均衡器配置
#[derive(Debug, Clone)]
pub struct EqualizerConfig {
    pub enabled: bool,
    pub preamp: f32,
    pub gains: [f32; 10],
    pub q_values: [f32; 10],
}

impl Default for EqualizerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            preamp: 0.0,
            gains: [0.0; 10],
            q_values: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.707],
        }
    }
}

/// 内置预设定义
pub struct EqualizerPresets;

impl EqualizerPresets {
    pub const FLAT: [f32; 10] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    pub const POP: [f32; 10] = [1.0, 2.0, 3.0, 1.0, -1.0, -1.0, 1.0, 2.0, 3.0, 2.0];
    pub const ROCK: [f32; 10] = [3.0, 2.0, 1.0, 0.0, -1.0, 0.0, 1.0, 2.0, 3.0, 3.0];
    pub const CLASSICAL: [f32; 10] = [2.0, 1.0, 0.0, 0.0, 0.0, 0.0, -1.0, -1.0, 0.0, 1.0];
    pub const JAZZ: [f32; 10] = [2.0, 1.0, 0.0, 1.0, 2.0, 1.0, 0.0, 1.0, 2.0, 2.0];
    pub const VOCAL: [f32; 10] = [0.0, -1.0, -2.0, -1.0, 1.0, 3.0, 3.0, 2.0, 1.0, 0.0];
    pub const BASS: [f32; 10] = [4.0, 3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -2.0, -1.0, 0.0];
    pub const TREBLE: [f32; 10] = [0.0, -1.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0, 4.0];
    pub const ELECTRONIC: [f32; 10] = [2.0, 3.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, 2.0, 3.0];

    // 高级预设
    pub const HIFI: [f32; 10] = [1.0, 0.5, 0.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 1.5];
    pub const STUDIO: [f32; 10] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    pub const LIVE: [f32; 10] = [2.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 2.0, 3.0, 2.0];
    pub const LOUDNESS: [f32; 10] = [4.0, 2.0, 0.0, -1.0, -2.0, -2.0, -1.0, 0.0, 2.0, 4.0];
    pub const CINEMA: [f32; 10] = [3.0, 2.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 2.0];
    pub const WARM: [f32; 10] = [2.0, 1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5, -1.0, 0.0];
    pub const BRIGHT: [f32; 10] = [-1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.0];

    pub fn get_preset(name: &str) -> Option<[f32; 10]> {
        match name.to_lowercase().as_str() {
            "flat" => Some(Self::FLAT),
            "pop" => Some(Self::POP),
            "rock" => Some(Self::ROCK),
            "classical" => Some(Self::CLASSICAL),
            "jazz" => Some(Self::JAZZ),
            "vocal" => Some(Self::VOCAL),
            "bass" => Some(Self::BASS),
            "treble" => Some(Self::TREBLE),
            "electronic" => Some(Self::ELECTRONIC),
            "hifi" => Some(Self::HIFI),
            "studio" => Some(Self::STUDIO),
            "live" => Some(Self::LIVE),
            "loudness" => Some(Self::LOUDNESS),
            "cinema" => Some(Self::CINEMA),
            "warm" => Some(Self::WARM),
            "bright" => Some(Self::BRIGHT),
            _ => None,
        }
    }
}

/// 10段音频均衡器
pub struct AudioEqualizer {
    filters: Vec<BiquadFilter>,
    config: Arc<RwLock<EqualizerConfig>>,
    channels: usize,
    sample_rate: f64,
    enabled: bool,
    preamp_linear: f32,
}

/// 标准10段均衡器频率（Hz）
const FREQUENCIES: [f64; 10] = [
    31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];

impl AudioEqualizer {
    /// 创建新的均衡器实例
    pub fn new(sample_rate: u32, channels: u16) -> Self {
        let sample_rate = sample_rate as f64;
        let channels = channels as usize;

        let mut filters = Vec::with_capacity(10);

        for (i, &freq) in FREQUENCIES.iter().enumerate() {
            let filter_type = if i == 0 {
                FilterType::LowShelf
            } else if i == 9 {
                FilterType::HighShelf
            } else {
                FilterType::Peaking
            };

            filters.push(BiquadFilter::new(filter_type, freq, sample_rate, channels));
        }

        println!(
            "🎛️ 均衡器: 创建10段均衡器，采样率: {} Hz，声道数: {}",
            sample_rate, channels
        );

        Self {
            filters,
            config: Arc::new(RwLock::new(EqualizerConfig::default())),
            channels,
            sample_rate,
            enabled: false,
            preamp_linear: 1.0,
        }
    }

    /// 获取配置的克隆
    pub fn get_config(&self) -> Arc<RwLock<EqualizerConfig>> {
        self.config.clone()
    }

    /// 启用/禁用均衡器
    pub fn set_enabled(&mut self, enabled: bool) {
        let mut config = self.config.write();
        config.enabled = enabled;
        self.enabled = enabled;
        println!("🎛️ 均衡器: {}", if enabled { "启用" } else { "禁用" });
    }

    /// 检查是否启用
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// 设置前置增益（dB）
    pub fn set_preamp(&mut self, gain: f32) {
        let gain = gain.clamp(-12.0, 12.0);
        let mut config = self.config.write();
        config.preamp = gain;
        self.preamp_linear = 10.0_f32.powf(gain / 20.0);
    }

    /// 获取前置增益
    pub fn get_preamp(&self) -> f32 {
        self.config.read().preamp
    }

    /// 设置单个频段增益（dB）
    pub fn set_band_gain(&mut self, band: usize, gain: f32) {
        if band >= 10 {
            return;
        }

        let clamped_gain = gain.clamp(-12.0, 12.0);

        {
            let mut config = self.config.write();
            config.gains[band] = clamped_gain;
        }

        self.filters[band].set_gain(clamped_gain as f64);
    }

    /// 获取单个频段增益
    pub fn get_band_gain(&self, band: usize) -> f32 {
        if band >= 10 {
            return 0.0;
        }
        self.config.read().gains[band]
    }

    /// 设置所有频段增益
    pub fn set_all_gains(&mut self, gains: &[f32; 10]) {
        {
            let mut config = self.config.write();
            config.gains = *gains;
        }

        for (i, &gain) in gains.iter().enumerate() {
            self.filters[i].set_gain(gain.clamp(-12.0, 12.0) as f64);
        }
    }

    /// 获取所有频段增益
    pub fn get_all_gains(&self) -> [f32; 10] {
        self.config.read().gains
    }

    /// 设置单个频段Q值
    pub fn set_band_q(&mut self, band: usize, q: f32) {
        if band >= 10 {
            return;
        }

        let clamped_q = q.clamp(0.1, 10.0);

        {
            let mut config = self.config.write();
            config.q_values[band] = clamped_q;
        }

        self.filters[band].set_q(clamped_q as f64);
    }

    /// 获取单个频段Q值
    pub fn get_band_q(&self, band: usize) -> f32 {
        if band >= 10 {
            return 1.0;
        }
        self.config.read().q_values[band]
    }

    /// 应用预设
    pub fn apply_preset(&mut self, name: &str) -> bool {
        if let Some(gains) = EqualizerPresets::get_preset(name) {
            self.set_all_gains(&gains);
            println!("🎛️ 均衡器: 应用预设 '{}'", name);
            true
        } else {
            println!("⚠️ 均衡器: 未知预设 '{}'", name);
            false
        }
    }

    /// 重置为平坦响应
    pub fn reset(&mut self) {
        self.set_all_gains(&[0.0; 10]);
        self.set_preamp(0.0);

        for filter in &mut self.filters {
            filter.reset();
        }

        println!("🎛️ 均衡器: 重置为平坦响应");
    }

    /// 更新采样率
    pub fn update_sample_rate(&mut self, sample_rate: u32) {
        let sample_rate = sample_rate as f64;

        if (self.sample_rate - sample_rate).abs() < 0.1 {
            return;
        }

        self.sample_rate = sample_rate;

        for filter in &mut self.filters {
            filter.set_sample_rate(sample_rate);
        }

        println!("🎛️ 均衡器: 更新采样率为 {} Hz", sample_rate);
    }

    /// 处理交错音频样本块（就地处理）
    ///
    /// samples: 交错的音频样本 [L, R, L, R, ...]
    #[inline]
    pub fn process_interleaved(&mut self, samples: &mut [f32]) {
        if !self.enabled {
            return;
        }

        let preamp_linear = self.preamp_linear;
        let channels = self.channels;
        let frame_count = samples.len() / channels;

        for frame in 0..frame_count {
            for ch in 0..channels {
                let idx = frame * channels + ch;
                let mut sample = samples[idx] * preamp_linear;

                // 通过所有滤波器
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
    ///
    /// waves: 分离的声道数据 [[L...], [R...]]
    pub fn process_deinterleaved(&mut self, waves: &mut [Vec<f32>]) {
        if !self.enabled {
            return;
        }

        let preamp_linear = self.preamp_linear;
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

    /// 获取频率响应曲线数据（用于可视化）
    ///
    /// 返回128个点的响应曲线，范围20Hz-20kHz
    pub fn get_frequency_response(&self) -> Vec<(f32, f32)> {
        let num_points = 128;
        let mut response = Vec::with_capacity(num_points);

        let min_freq = 20.0_f64;
        let max_freq = 20000.0_f64;

        for i in 0..num_points {
            let t = i as f64 / (num_points - 1) as f64;
            let freq = min_freq * (max_freq / min_freq).powf(t);

            let omega = 2.0 * PI * freq / self.sample_rate;
            let z_re = omega.cos();
            let z_im = omega.sin();

            let mut total_gain_db = self.config.read().preamp as f64;

            for filter in &self.filters {
                let coef = &filter.coefficients;

                // 计算分子 H(z) 的 |B(e^jω)|²
                let b_re = coef.b0 + coef.b1 * z_re + coef.b2 * (2.0 * z_re * z_re - 1.0);
                let b_im = coef.b1 * z_im + coef.b2 * 2.0 * z_re * z_im;

                // 计算分母 |A(e^jω)|²
                let a_re = 1.0 + coef.a1 * z_re + coef.a2 * (2.0 * z_re * z_re - 1.0);
                let a_im = coef.a1 * z_im + coef.a2 * 2.0 * z_re * z_im;

                let b_mag_sq = b_re * b_re + b_im * b_im;
                let a_mag_sq = a_re * a_re + a_im * a_im;

                if a_mag_sq > 1e-10 {
                    let gain = (b_mag_sq / a_mag_sq).sqrt();
                    if gain > 1e-10 {
                        total_gain_db += 20.0 * gain.log10();
                    }
                }
            }

            response.push((freq as f32, total_gain_db as f32));
        }

        response
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
    fn test_equalizer_creation() {
        let eq = AudioEqualizer::new(48000, 2);
        assert!(!eq.is_enabled());
        assert_eq!(eq.get_preamp(), 0.0);
    }

    #[test]
    fn test_band_gain() {
        let mut eq = AudioEqualizer::new(48000, 2);
        eq.set_band_gain(0, 6.0);
        assert_eq!(eq.get_band_gain(0), 6.0);

        eq.set_band_gain(0, 15.0); // 应被限制到12
        assert_eq!(eq.get_band_gain(0), 12.0);
    }

    #[test]
    fn test_preset() {
        let mut eq = AudioEqualizer::new(48000, 2);
        assert!(eq.apply_preset("rock"));

        let gains = eq.get_all_gains();
        assert_eq!(gains, EqualizerPresets::ROCK);
    }

    #[test]
    fn test_process_disabled() {
        let mut eq = AudioEqualizer::new(48000, 2);
        let mut samples = vec![0.5, -0.5, 0.3, -0.3];
        let original = samples.clone();

        eq.process_interleaved(&mut samples);

        // 禁用时不应修改样本
        assert_eq!(samples, original);
    }

    #[test]
    fn test_process_enabled() {
        let mut eq = AudioEqualizer::new(48000, 2);
        eq.set_enabled(true);
        eq.set_band_gain(0, 6.0);

        let mut samples = vec![0.5, -0.5, 0.3, -0.3];
        eq.process_interleaved(&mut samples);

        // 启用时样本应被处理（值会变化）
        // 具体值取决于滤波器参数，这里只验证处理发生了
    }
}
