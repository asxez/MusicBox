//! 均衡器模块
//!
//! 包含图形均衡器和参量均衡器

mod graphic;
mod parametric;

pub use graphic::AudioEqualizer;
pub use parametric::{ParamFilterType, ParametricEqualizer};
