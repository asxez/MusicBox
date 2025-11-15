//! 线程间通信消息

/// 线程间消息
pub enum ThreadMessage {
    Error(String),
    DecoderFinished,
}
