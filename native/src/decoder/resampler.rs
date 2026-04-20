//! 音频重采样器
//!
//! 提供高质量音频重采样，支持多种质量模式

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

/// 重采样质量级别
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResamplingQuality {
    /// 快速模式 - 适合实时处理，质量较低
    Fast,
    /// 平衡模式 - 质量和性能平衡
    Balanced,
    /// 高质量模式 - 高质量，适度性能开销
    High,
    /// 极致模式 - 最高质量，性能开销大
    Ultimate,
}

pub struct AudioResampler {
    resampler: SincFixedIn<f32>,
    chunk_size: usize,
    quality: ResamplingQuality,
}

impl AudioResampler {
    /// 创建新的重采样器，使用默认质量（高质量）
    pub fn new(
        source_sample_rate: u32,
        device_sample_rate: u32,
        source_channels: u16,
    ) -> Result<Self, String> {
        Self::with_quality(
            source_sample_rate,
            device_sample_rate,
            source_channels,
            ResamplingQuality::High,
        )
    }

    /// 创建指定质量级别的重采样器
    pub fn with_quality(
        source_sample_rate: u32,
        device_sample_rate: u32,
        source_channels: u16,
        quality: ResamplingQuality,
    ) -> Result<Self, String> {
        let resample_ratio = device_sample_rate as f64 / source_sample_rate as f64;

        // 根据质量级别选择参数
        let (chunk_size, params) = match quality {
            ResamplingQuality::Fast => {
                // 快速模式: 较小的滤波器，线性插值
                let chunk_size = 1024;
                let params = SincInterpolationParameters {
                    sinc_len: 128,
                    f_cutoff: 0.92,
                    interpolation: SincInterpolationType::Linear,
                    oversampling_factor: 128,
                    window: WindowFunction::Blackman,
                };
                (chunk_size, params)
            }
            ResamplingQuality::Balanced => {
                // 平衡模式: 中等滤波器，立方插值
                let chunk_size = 2048;
                let params = SincInterpolationParameters {
                    sinc_len: 256,
                    f_cutoff: 0.94649,
                    interpolation: SincInterpolationType::Cubic,
                    oversampling_factor: 256,
                    window: WindowFunction::BlackmanHarris2,
                };
                (chunk_size, params)
            }
            ResamplingQuality::High => {
                // 高质量模式: 大滤波器，立方插值
                let chunk_size = 4096;
                let params = SincInterpolationParameters {
                    sinc_len: 512,
                    f_cutoff: 0.94649,
                    interpolation: SincInterpolationType::Cubic,
                    oversampling_factor: 512,
                    window: WindowFunction::BlackmanHarris2,
                };
                (chunk_size, params)
            }
            ResamplingQuality::Ultimate => {
                // 极致模式: 超大滤波器，立方插值，最高精度
                let chunk_size = 8192;
                let params = SincInterpolationParameters {
                    sinc_len: 1024,
                    f_cutoff: 0.94649,
                    interpolation: SincInterpolationType::Cubic,
                    oversampling_factor: 1024,
                    window: WindowFunction::BlackmanHarris2,
                };
                (chunk_size, params)
            }
        };

        println!(
            "🔧 重采样器配置: {:?} 质量 (块大小: {}, 滤波器长度: {})",
            quality, chunk_size, params.sinc_len
        );

        let resampler = SincFixedIn::<f32>::new(
            resample_ratio,
            2.0,
            params,
            chunk_size,
            source_channels as usize,
        )
        .map_err(|e| format!("创建重采样器失败: {:?}", e))?;

        Ok(Self {
            resampler,
            chunk_size,
            quality,
        })
    }

    pub fn chunk_size(&self) -> usize {
        self.chunk_size
    }

    pub fn quality(&self) -> ResamplingQuality {
        self.quality
    }

    pub fn process(&mut self, input: &[Vec<f32>]) -> Result<Vec<Vec<f32>>, String> {
        let waves_in: Vec<&[f32]> = input.iter().map(|v| v.as_slice()).collect();
        self.resampler
            .process(&waves_in, None)
            .map_err(|e| format!("重采样失败: {:?}", e))
    }
}
