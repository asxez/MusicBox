//! 音频格式定义

use wasapi::SampleType;

/// 音频格式信息
#[derive(Debug, Clone)]
pub struct AudioFormat {
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
    pub sample_type: SampleType,
}

impl AudioFormat {
    pub fn new(
        sample_rate: u32,
        channels: u16,
        bits_per_sample: u16,
        sample_type: SampleType,
    ) -> Self {
        Self {
            sample_rate,
            channels,
            bits_per_sample,
            sample_type,
        }
    }
}
