//! 线程间通信消息

use std::sync::mpsc::Sender;

#[derive(Debug, Clone, Copy)]
pub struct SeekCommand {
    pub generation: u64,
    pub position: f64,
}

/// 线程间消息
pub enum ThreadMessage {
    Error(String),
    DecoderFinished,
    SeekRequest {
        command: SeekCommand,
        ack_sender: Sender<()>,
    },
}
