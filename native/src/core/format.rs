//! 音频格式定义

use wasapi::{SampleType, WaveFormat};

const WAVE_FORMAT_PCM: u16 = 1;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;

/// 音频格式信息
#[derive(Debug, Clone)]
pub struct AudioFormat {
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
    pub valid_bits_per_sample: u16,
    pub sample_type: SampleType,
    pub block_align: u16,
    pub channel_mask: u32,
    pub wave_format: WaveFormat,
}

impl AudioFormat {
    pub fn new(
        sample_rate: u32,
        channels: u16,
        bits_per_sample: u16,
        sample_type: SampleType,
    ) -> Self {
        let channel_mask = wasapi::make_channelmasks(channels as usize)
            .first()
            .copied()
            .unwrap_or(0);
        let wave_format = WaveFormat::new(
            bits_per_sample as usize,
            bits_per_sample as usize,
            &sample_type,
            sample_rate as usize,
            channels as usize,
            Some(channel_mask),
        );
        Self::from_wave_format_with_sample_type(wave_format, sample_type)
    }

    pub fn from_wave_format(wave_format: WaveFormat) -> Result<Self, String> {
        let sample_type = Self::detect_sample_type(&wave_format)?;
        Ok(Self::from_wave_format_with_sample_type(wave_format, sample_type))
    }

    pub fn from_wave_format_with_sample_type(
        wave_format: WaveFormat,
        sample_type: SampleType,
    ) -> Self {
        let valid_bits_per_sample = wave_format.get_validbitspersample();
        let bits_per_sample = wave_format.get_bitspersample();
        Self {
            sample_rate: wave_format.get_samplespersec(),
            channels: wave_format.get_nchannels(),
            bits_per_sample,
            valid_bits_per_sample: if valid_bits_per_sample == 0 {
                bits_per_sample
            } else {
                valid_bits_per_sample
            },
            sample_type,
            block_align: wave_format.get_blockalign() as u16,
            channel_mask: wave_format.get_dwchannelmask(),
            wave_format,
        }
    }

    fn detect_sample_type(wave_format: &WaveFormat) -> Result<SampleType, String> {
        if let Ok(sample_type) = wave_format.get_subformat() {
            return Ok(sample_type);
        }

        match wave_format.wave_fmt.Format.wFormatTag {
            WAVE_FORMAT_PCM => Ok(SampleType::Int),
            WAVE_FORMAT_IEEE_FLOAT => Ok(SampleType::Float),
            tag => Err(format!("不支持的WASAPI样本格式: 0x{tag:04X}")),
        }
    }
}
