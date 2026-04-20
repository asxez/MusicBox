//! 音频解码器

use crate::decoder::{AudioResampler, ResamplingQuality};
use crate::utils::ThreadMessage;
use ringbuf::producer::Producer;
use ringbuf::HeapProd;
use rodio::Decoder;
use std::fs::File;
use std::io::{Cursor, Read, Seek};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;
use std::time::{Duration as StdDuration, Instant};

/// 组合 Read 和 Seek traits 的 trait，用于动态分发
trait ReadSeek: Read + Seek + Send + Sync {}

/// 自动为所有实现了 Read + Seek + Send + Sync 的类型实现 ReadSeek
impl<T: Read + Seek + Send + Sync> ReadSeek for T {}

/// 创建解码器
fn create_decoder(file_path: &str) -> Result<Decoder<Box<dyn ReadSeek>>, String> {
    // 检查文件扩展名，对于 M4A 文件使用内存缓冲以避免 seek 问题
    let is_m4a = file_path.to_lowercase().ends_with(".m4a");
    if is_m4a {
        println!("🎵 解码: M4A 文件，加载到内存中");
        let mut file = File::open(file_path).map_err(|e| format!("打开文件失败: {}", e))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| format!("读取文件失败: {}", e))?;
        println!("🎵 解码: M4A 文件已加载 {} 字节", buffer.len());
        let cursor: Box<dyn ReadSeek> = Box::new(Cursor::new(buffer));
        Decoder::new(cursor).map_err(|e| format!("解码失败: {:?}", e))
    } else {
        let file = File::open(file_path).map_err(|e| format!("打开文件失败: {}", e))?;
        let boxed: Box<dyn ReadSeek> = Box::new(file);
        Decoder::new(boxed).map_err(|e| format!("解码失败: {:?}", e))
    }
}

/// 直接解码（无需重采样）
pub fn decode_direct(
    file_path: String,
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
    seek_receiver: &Receiver<f64>,
    error_sender: &Sender<ThreadMessage>,
    source_sample_rate: u32,
    source_channels: u16,
) -> Result<(), String> {
    let mut sample_count = 0u64;
    let mut last_log_time = Instant::now();

    // 初始化解码器
    let mut source = create_decoder(&file_path)?;

    loop {
        // 检查是否有跳转请求
        if let Ok(target_position) = seek_receiver.try_recv() {
            println!("🎯 解码: 收到跳转请求 {:.2}秒", target_position);

            // 通知渲染器清空缓冲区
            let _ = error_sender.send(ThreadMessage::SeekRequest(target_position));
            println!("📣 解码: 已通知渲染器清空缓冲区");

            let target_sample =
                (target_position * source_sample_rate as f64 * source_channels as f64) as u64;
            let current_position =
                sample_count as f64 / (source_sample_rate as f64 * source_channels as f64);

            // 向后跳转: 重新打开文件
            if target_position < current_position {
                println!("🔄 解码: 重新打开文件以执行跳转");

                // 重新创建解码器
                source = create_decoder(&file_path)?;
                sample_count = 0;
            }

            // 跳转到目标位置
            if target_sample > sample_count {
                let skip_count = target_sample - sample_count;

                // 批量跳过样本
                let batch_size = 44100 * 2 * 5; // 每批5秒的样本
                let mut remaining = skip_count;

                while remaining > 0 {
                    let current_batch = remaining.min(batch_size as u64);

                    // 使用nth跳过样本
                    if source.nth(current_batch as usize - 1).is_none() {
                        break;
                    }

                    sample_count += current_batch;
                    remaining -= current_batch;
                }
            }

            println!(
                "✅ 解码: 跳转完成,当前位置 {:.2}秒",
                sample_count as f64 / (source_sample_rate as f64 * source_channels as f64)
            );
            continue;
        }

        if !is_playing.load(Ordering::SeqCst) {
            break;
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(5));
        }

        let sample = match source.next() {
            Some(s) => s,
            None => break,
        };
        sample_count += 1;

        while producer.try_push(sample).is_err() {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            while is_paused.load(Ordering::SeqCst) {
                if !is_playing.load(Ordering::SeqCst) {
                    return Ok(());
                }
                std::thread::sleep(StdDuration::from_millis(5));
            }
            std::thread::sleep(StdDuration::from_millis(5));
        }

        if last_log_time.elapsed() > StdDuration::from_secs(20) {
            println!("📊 解码: 已处理 {} 样本", sample_count);
            last_log_time = Instant::now();
        }
    }

    Ok(())
}

/// 带重采样的解码
pub fn decode_with_resampling(
    file_path: String,
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
    seek_receiver: &Receiver<f64>,
    error_sender: &Sender<ThreadMessage>,
    source_sample_rate: u32,
    source_channels: u16,
    device_sample_rate: u32,
    device_channels: u16,
    resampling_quality: ResamplingQuality,
) -> Result<(), String> {
    let mut resampler = AudioResampler::with_quality(
        source_sample_rate,
        device_sample_rate,
        source_channels,
        resampling_quality,
    )?;

    let chunk_size = resampler.chunk_size();
    let samples_per_chunk = chunk_size * source_channels as usize;
    let mut interleaved_samples: Vec<f32> = Vec::with_capacity(samples_per_chunk);
    let mut chunk_count = 0u64;
    let mut sample_count = 0u64;
    let mut last_log_time = Instant::now();

    // 初始化解码器
    let mut source = create_decoder(&file_path)?;

    loop {
        // 检查是否有跳转请求
        if let Ok(target_position) = seek_receiver.try_recv() {
            println!("🎯 解码: 收到跳转请求 {:.2}秒", target_position);

            // 通知渲染器清空缓冲区
            let _ = error_sender.send(ThreadMessage::SeekRequest(target_position));
            println!("📣 解码: 已通知渲染器清空缓冲区");

            let target_sample =
                (target_position * source_sample_rate as f64 * source_channels as f64) as u64;
            let current_position =
                sample_count as f64 / (source_sample_rate as f64 * source_channels as f64);

            // 向后跳转: 重新打开文件
            if target_position < current_position {
                println!("🔄 解码: 重新打开文件以执行跳转");

                // 重新创建解码器
                source = create_decoder(&file_path)?;
                sample_count = 0;
            }

            // 跳转到目标位置
            if target_sample > sample_count {
                let skip_count = target_sample - sample_count;

                // 批量跳过样本
                let batch_size = 44100 * 2 * 5; // 每批5秒的样本
                let mut remaining = skip_count;
                while remaining > 0 {
                    let current_batch = remaining.min(batch_size as u64);

                    // 使用nth跳过样本
                    if source.nth(current_batch as usize - 1).is_none() {
                        break;
                    }

                    sample_count += current_batch;
                    remaining -= current_batch;
                }
            }

            println!(
                "✅ 解码: 跳转完成,当前位置 {:.2}秒",
                sample_count as f64 / (source_sample_rate as f64 * source_channels as f64)
            );

            // 清空缓冲区和重采样器
            interleaved_samples.clear();

            // 重置重采样器
            resampler = AudioResampler::with_quality(
                source_sample_rate,
                device_sample_rate,
                source_channels,
                resampling_quality,
            )?;
            continue;
        }

        if !is_playing.load(Ordering::SeqCst) {
            break;
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(5));
        }

        let sample = match source.next() {
            Some(s) => s,
            None => break,
        };
        interleaved_samples.push(sample);
        sample_count += 1;

        if interleaved_samples.len() >= samples_per_chunk {
            chunk_count += 1;

            process_chunk(
                &mut resampler,
                &interleaved_samples[..samples_per_chunk],
                producer,
                is_playing,
                is_paused,
                source_channels,
                device_channels,
                chunk_size,
            )?;

            interleaved_samples.drain(..samples_per_chunk);

            if last_log_time.elapsed() > StdDuration::from_secs(20) {
                println!("📊 解码: 已处理 {} 块", chunk_count);
                last_log_time = Instant::now();
            }
        }
    }

    // 处理剩余样本
    if !interleaved_samples.is_empty() && is_playing.load(Ordering::SeqCst) {
        let remaining_frames = interleaved_samples.len() / source_channels as usize;
        if remaining_frames > 0 {
            // 填充到chunk_size
            interleaved_samples.resize(samples_per_chunk, 0.0);

            process_chunk(
                &mut resampler,
                &interleaved_samples,
                producer,
                is_playing,
                is_paused,
                source_channels,
                device_channels,
                chunk_size,
            )?;
        }
    }

    Ok(())
}

/// 处理单个音频块
fn process_chunk(
    resampler: &mut AudioResampler,
    interleaved_samples: &[f32],
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
    source_channels: u16,
    device_channels: u16,
    chunk_size: usize,
) -> Result<(), String> {
    let deinterleaved =
        deinterleave_samples(interleaved_samples, source_channels as usize, chunk_size);
    let resampled = resampler.process(&deinterleaved)?;

    for frame_idx in 0..resampled[0].len() {
        let samples = convert_channels(&resampled, frame_idx, source_channels, device_channels);

        for sample in samples {
            while producer.try_push(sample).is_err() {
                if !is_playing.load(Ordering::SeqCst) {
                    return Ok(());
                }
                while is_paused.load(Ordering::SeqCst) {
                    if !is_playing.load(Ordering::SeqCst) {
                        return Ok(());
                    }
                    std::thread::sleep(StdDuration::from_millis(5));
                }
                std::thread::sleep(StdDuration::from_millis(5));
            }
        }
    }

    Ok(())
}

/// 将交错样本转换为分离声道格式
fn deinterleave_samples(interleaved: &[f32], channels: usize, chunk_size: usize) -> Vec<Vec<f32>> {
    let mut deinterleaved = vec![Vec::with_capacity(chunk_size); channels];

    for frame_idx in 0..chunk_size {
        for channel_idx in 0..channels {
            let sample_idx = frame_idx * channels + channel_idx;
            if sample_idx < interleaved.len() {
                deinterleaved[channel_idx].push(interleaved[sample_idx]);
            } else {
                deinterleaved[channel_idx].push(0.0);
            }
        }
    }

    // 确保所有声道长度一致
    for channel_buf in &mut deinterleaved {
        channel_buf.resize(chunk_size, 0.0);
    }

    deinterleaved
}

/// 声道转换
fn convert_channels(
    waves: &[Vec<f32>],
    frame_idx: usize,
    source_channels: u16,
    device_channels: u16,
) -> Vec<f32> {
    match (source_channels, device_channels) {
        (1, 2) => {
            let mono = waves[0][frame_idx];
            vec![mono, mono]
        }
        (2, 1) => {
            let left = waves[0][frame_idx];
            let right = waves[1][frame_idx];
            vec![(left + right) / 2.0]
        }
        (n, m) if n == m => waves.iter().map(|ch| ch[frame_idx]).collect(),
        _ => {
            let mut result = Vec::with_capacity(device_channels as usize);
            for i in 0..device_channels as usize {
                if i < source_channels as usize {
                    result.push(waves[i][frame_idx]);
                } else {
                    result.push(0.0);
                }
            }
            result
        }
    }
}
