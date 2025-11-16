//! 音频抖动和高精度处理
//!
//! 提供高质量的位深度转换，避免量化噪声

use rand::Rng;

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
    rng: rand::rngs::ThreadRng,
    // 用于噪声整形的误差缓冲
    error_buffer: Vec<f32>,
}

impl Ditherer {
    pub fn new(dither_type: DitherType, channels: usize) -> Self {
        Self {
            dither_type,
            rng: rand::thread_rng(),
            error_buffer: vec![0.0; channels],
        }
    }

    /// 将float32样本转换为int16，应用抖动
    pub fn float_to_i16(&mut self, sample: f32, channel: usize) -> i16 {
        match self.dither_type {
            DitherType::None => {
                // 直接量化，无抖动
                (sample.clamp(-1.0, 1.0) * 32767.0) as i16
            }
            DitherType::Rectangular => {
                // RPDF抖动: 添加随机噪声 [-0.5, 0.5] LSB
                let dither = self.rng.gen_range(-0.5..0.5);
                let dithered = sample * 32767.0 + dither;
                dithered.clamp(-32768.0, 32767.0) as i16
            }
            DitherType::Triangular => {
                // TPDF抖动: 添加三角分布噪声 [-1, 1] LSB
                // 通过两个均匀分布相加得到三角分布
                let r1 = self.rng.gen_range(-1.0..1.0);
                let r2 = self.rng.gen_range(-1.0..1.0);
                let dither = (r1 + r2) / 2.0;
                let dithered = sample * 32767.0 + dither;
                dithered.clamp(-32768.0, 32767.0) as i16
            }
            DitherType::NoiseShaped => {
                // 简化的噪声整形 (1阶)
                // 将量化误差推到高频段，人耳不敏感区域
                let scaled = sample * 32767.0;

                // 添加TPDF抖动
                let r1 = self.rng.gen_range(-1.0..1.0);
                let r2 = self.rng.gen_range(-1.0..1.0);
                let dither = (r1 + r2) / 2.0;

                // 添加整形后的误差
                let shaped = scaled + dither + self.error_buffer[channel] * 0.5;
                let quantized = shaped.round();

                // 保存误差用于下次整形
                self.error_buffer[channel] = scaled - quantized;

                quantized.clamp(-32768.0, 32767.0) as i16
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
}

/// 精度转换工具
pub struct PrecisionConverter;

impl PrecisionConverter {
    /// 从i16样本转换为归一化的f32 [-1.0, 1.0]
    /// 使用精确的除法而不是近似值
    pub fn i16_to_f32_precise(sample: i16) -> f32 {
        // 使用32768.0而不是32767.0以避免不对称
        // i16范围: -32768 to 32767
        // 正值: sample / 32767.0
        // 负值: sample / 32768.0
        if sample >= 0 {
            sample as f32 / 32767.0
        } else {
            sample as f32 / 32768.0
        }
    }

    /// 批量转换i16到f32
    pub fn i16_batch_to_f32(samples: &[i16]) -> Vec<f32> {
        samples
            .iter()
            .map(|&s| Self::i16_to_f32_precise(s))
            .collect()
    }

    /// 检查样本是否需要抖动
    /// 如果位深度减少，建议使用抖动
    pub fn should_dither(source_bits: u8, target_bits: u8) -> bool {
        source_bits > target_bits
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

    #[test]
    fn test_precision_conversion() {
        let original = 16384i16;
        let float = PrecisionConverter::i16_to_f32_precise(original);
        assert!((float - 0.5).abs() < 0.0001);
    }
}
