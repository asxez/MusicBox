//! 音频抖动和高精度处理
//!
//! 提供高质量的位深度转换，避免量化噪声

/// 抖动类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DitherType {
    /// 无抖动
    None,
    /// 矩形PDF抖动 (RPDF) - 最简单
    Rectangular,
    /// 三角PDF抖动 (TPDF) - 推荐用于大多数场景
    Triangular,
    /// 噪声整形 - 最高质量但计算量大
    NoiseShaped,
}

/// 抖动处理器
pub struct Ditherer {
    dither_type: DitherType,
    rng_state: u64,
    // 用于噪声整形的误差缓冲
    error_buffer: Vec<f32>,
    pcm_scale: PcmScale,
}

#[derive(Debug, Clone, Copy)]
struct PcmScale {
    valid_bits: u16,
    max_value: f32,
    min_value: f32,
}

impl Ditherer {
    pub fn new(dither_type: DitherType, channels: usize) -> Self {
        Self {
            dither_type,
            rng_state: 0x9E37_79B9_7F4A_7C15,
            error_buffer: vec![0.0; channels],
            pcm_scale: PcmScale::new(16),
        }
    }

    /// 将float32样本转换为int16，应用抖动
    pub fn float_to_i16(&mut self, sample: f32, channel: usize) -> i16 {
        self.float_to_pcm(sample, channel, 16) as i16
    }

    /// 将float32样本转换为指定有效位深的有符号PCM整数，应用抖动
    pub fn float_to_pcm(&mut self, sample: f32, channel: usize, valid_bits: u16) -> i32 {
        let scale = self.scale_for(valid_bits);

        match self.dither_type {
            DitherType::None => {
                // 直接量化，无抖动
                (sample.clamp(-1.0, 1.0) * scale.max_value)
                    .round()
                    .clamp(scale.min_value, scale.max_value) as i32
            }
            DitherType::Rectangular => {
                // RPDF抖动: 添加随机噪声 [-0.5, 0.5] LSB
                let dither = self.next_unit_noise() * 0.5;
                let dithered = sample * scale.max_value + dither;
                dithered.round().clamp(scale.min_value, scale.max_value) as i32
            }
            DitherType::Triangular => {
                // TPDF抖动: 添加三角分布噪声 [-1, 1] LSB
                // 通过两个均匀分布相加得到三角分布
                let r1 = self.next_unit_noise();
                let r2 = self.next_unit_noise();
                let dither = (r1 + r2) / 2.0;
                let dithered = sample * scale.max_value + dither;
                dithered.round().clamp(scale.min_value, scale.max_value) as i32
            }
            DitherType::NoiseShaped => {
                // 简化的噪声整形 (1阶)
                // 将量化误差推到高频段，人耳不敏感区域
                let scaled = sample * scale.max_value;

                // 添加TPDF抖动
                let r1 = self.next_unit_noise();
                let r2 = self.next_unit_noise();
                let dither = (r1 + r2) / 2.0;

                // 添加整形后的误差
                let shaped = scaled + dither + self.error_buffer[channel] * 0.5;
                let quantized = shaped.round();

                // 保存误差用于下次整形
                self.error_buffer[channel] = scaled - quantized;

                quantized.clamp(scale.min_value, scale.max_value) as i32
            }
        }
    }

    /// 批量转换
    pub fn convert_batch(&mut self, samples: &[f32], channels: usize) -> Vec<i16> {
        samples
            .iter()
            .enumerate()
            .map(|(i, &sample)| {
                let channel = i % channels;
                self.float_to_i16(sample, channel)
            })
            .collect()
    }

    /// 重置误差缓冲（用于seek等操作）
    pub fn reset(&mut self) {
        self.error_buffer.iter_mut().for_each(|e| *e = 0.0);
    }

    fn scale_for(&mut self, valid_bits: u16) -> PcmScale {
        let valid_bits = valid_bits.clamp(1, 31);
        if self.pcm_scale.valid_bits != valid_bits {
            self.pcm_scale = PcmScale::new(valid_bits);
        }
        self.pcm_scale
    }

    fn next_unit_noise(&mut self) -> f32 {
        self.rng_state ^= self.rng_state >> 12;
        self.rng_state ^= self.rng_state << 25;
        self.rng_state ^= self.rng_state >> 27;
        let value = self.rng_state.wrapping_mul(0x2545_F491_4F6C_DD1D);
        let normalized = ((value >> 40) as f32) * (1.0 / 16_777_216.0);
        normalized * 2.0 - 1.0
    }
}

impl PcmScale {
    fn new(valid_bits: u16) -> Self {
        let valid_bits = valid_bits.clamp(1, 31);
        Self {
            valid_bits,
            max_value: ((1i64 << (valid_bits - 1)) - 1) as f32,
            min_value: (-(1i64 << (valid_bits - 1))) as f32,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ditherer_types() {
        let mut ditherer = Ditherer::new(DitherType::Triangular, 2);
        let sample = 0.5f32;
        let result = ditherer.float_to_i16(sample, 0);
        // 应该接近 0.5 * 32767 = 16383
        assert!((result as f32 - 16383.5).abs() < 5.0);
    }
}
