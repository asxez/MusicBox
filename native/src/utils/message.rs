//! 线程间通信消息

#[derive(Debug, Clone, Copy)]
pub struct SeekCommand {
    pub generation: u64,
    pub position: f64,
}

/// 线程间消息
pub enum ThreadMessage {
    Error(String),
    DecoderFinished,
    SeekRequest(SeekCommand),
}
