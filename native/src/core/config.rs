//! 音频引擎配置

use crate::renderer::DitherType;
use crate::decoder::ResamplingQuality;

/// WASAPI共享模式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShareMode {
    /// 共享模式 - 与其他应用共享音频设备，系统混音
    Shared,
    /// 独占模式 - 独占音频设备，直接输出，低延迟
    Exclusive,
}

impl ShareMode {
    /// 从字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "shared" => Some(Self::Shared),
            "exclusive" => Some(Self::Exclusive),
            _ => None,
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Shared => "shared",
            Self::Exclusive => "exclusive",
        }
    }
}

/// 音频引擎配置
#[derive(Debug, Clone)]
pub struct AudioConfig {
    /// WASAPI共享模式
    pub share_mode: ShareMode,
    /// 重采样质量
    pub resampling_quality: ResamplingQuality,
    /// 抖动类型
    pub dither_type: DitherType,
    /// 环形缓冲区大小（秒）
    pub ring_buffer_seconds: f32,
    /// 优先使用的WASAPI缓冲区大小（毫秒，0表示自动）
    pub preferred_wasapi_buffer_ms: u32,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            share_mode: ShareMode::Exclusive, // 默认使用独占模式
            resampling_quality: ResamplingQuality::High,
            dither_type: DitherType::Triangular,
            ring_buffer_seconds: 1.0,
            preferred_wasapi_buffer_ms: 0, // 自动选择
        }
    }
}

impl AudioConfig {
    /// 创建性能优先配置（低延迟，快速处理）
    pub fn performance() -> Self {
        Self {
            share_mode: ShareMode::Exclusive,
            resampling_quality: ResamplingQuality::Fast,
            dither_type: DitherType::Rectangular,
            ring_buffer_seconds: 0.5,
            preferred_wasapi_buffer_ms: 3,
        }
    }

    /// 创建平衡配置
    pub fn balanced() -> Self {
        Self {
            share_mode: ShareMode::Exclusive,
            resampling_quality: ResamplingQuality::Balanced,
            dither_type: DitherType::Triangular,
            ring_buffer_seconds: 1.0,
            preferred_wasapi_buffer_ms: 5,
        }
    }

    /// 创建质量优先配置（最高音质）
    pub fn quality() -> Self {
        Self {
            share_mode: ShareMode::Exclusive,
            resampling_quality: ResamplingQuality::High,
            dither_type: DitherType::Triangular,
            ring_buffer_seconds: 1.5,
            preferred_wasapi_buffer_ms: 10,
        }
    }

    /// 创建极致质量配置
    pub fn ultimate() -> Self {
        Self {
            share_mode: ShareMode::Exclusive,
            resampling_quality: ResamplingQuality::Ultimate,
            dither_type: DitherType::NoiseShaped,
            ring_buffer_seconds: 2.0,
            preferred_wasapi_buffer_ms: 10,
        }
    }

    /// 从字符串创建配置
    pub fn from_preset(preset: &str) -> Self {
        match preset.to_lowercase().as_str() {
            "performance" | "low_latency" => Self::performance(),
            "balanced" | "default" => Self::balanced(),
            "quality" | "high" => Self::quality(),
            "ultimate" | "maximum" => Self::ultimate(),
            _ => Self::default(),
        }
    }

    /// 获取环形缓冲区样本数
    pub fn get_ring_buffer_size(&self, sample_rate: u32, channels: u16) -> usize {
        (self.ring_buffer_seconds * sample_rate as f32 * channels as f32) as usize
    }

    /// 获取WASAPI缓冲区时长列表（100纳秒单位）
    pub fn get_wasapi_buffer_durations(&self) -> Vec<i64> {
        match self.share_mode {
            ShareMode::Exclusive => {
                // 独占模式：支持低延迟缓冲区
                if self.preferred_wasapi_buffer_ms > 0 {
                    vec![
                        (self.preferred_wasapi_buffer_ms as i64) * 10_000,
                        5_000_000,
                        10_000_000,
                        20_000_000,
                    ]
                } else {
                    vec![3_000_000, 5_000_000, 10_000_000, 20_000_000]
                }
            }
            ShareMode::Shared => {
                // 共享模式：使用系统默认缓冲区（通常10ms）
                // 返回空列表表示使用系统默认值
                vec![]
            }
        }
    }

    /// 设置共享模式
    pub fn set_share_mode(&mut self, mode: ShareMode) {
        self.share_mode = mode;
    }

    /// 获取共享模式
    pub fn get_share_mode(&self) -> ShareMode {
        self.share_mode
    }
}
