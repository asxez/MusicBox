//! 音频重采样器

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

pub struct AudioResampler {
    resampler: SincFixedIn<f32>,
    chunk_size: usize,
}

impl AudioResampler {
    pub fn new(
        source_sample_rate: u32,
        device_sample_rate: u32,
        source_channels: u16,
    ) -> Result<Self, String> {
        let resample_ratio = device_sample_rate as f64 / source_sample_rate as f64;
        let chunk_size = 1024;

        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

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
        })
    }

    pub fn chunk_size(&self) -> usize {
        self.chunk_size
    }

    pub fn process(&mut self, input: &[Vec<f32>]) -> Result<Vec<Vec<f32>>, String> {
        let waves_in: Vec<&[f32]> = input.iter().map(|v| v.as_slice()).collect();
        self.resampler
            .process(&waves_in, None)
            .map_err(|e| format!("重采样失败: {:?}", e))
    }
}
