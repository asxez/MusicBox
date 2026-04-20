//! 播放位置跟踪器

use std::time::Instant;

/// 播放状态跟踪器
pub struct PlaybackTracker {
    /// 累计播放时间（秒）
    accumulated_time: f64,
    /// 最后一次开始播放的时间点
    last_play_time: Option<Instant>,
}

impl PlaybackTracker {
    pub fn new() -> Self {
        Self {
            accumulated_time: 0.0,
            last_play_time: None,
        }
    }

    /// 开始播放
    pub fn start(&mut self) {
        self.last_play_time = Some(Instant::now());
    }

    /// 暂停播放
    pub fn pause(&mut self) {
        if let Some(start_time) = self.last_play_time.take() {
            let elapsed = start_time.elapsed().as_secs_f64();
            self.accumulated_time += elapsed;
        }
    }

    /// 获取当前播放位置
    pub fn get_position(&self) -> f64 {
        let current_segment = if let Some(start_time) = self.last_play_time {
            start_time.elapsed().as_secs_f64()
        } else {
            0.0
        };
        self.accumulated_time + current_segment
    }

    /// 重置位置
    pub fn reset(&mut self) {
        self.accumulated_time = 0.0;
        self.last_play_time = None;
    }

    /// 设置位置（用于seek）
    pub fn set_position(&mut self, position: f64) {
        let was_playing = self.last_play_time.is_some();
        self.accumulated_time = position;
        if was_playing {
            self.last_play_time = Some(Instant::now());
        } else {
            self.last_play_time = None;
        }
    }
}
