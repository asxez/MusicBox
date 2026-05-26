//! 音频解码器

use crate::decoder::{AudioResampler, ResamplingQuality};
use crate::utils::SeekCommand;
use crate::utils::ThreadMessage;
use ringbuf::HeapProd;
use ringbuf::producer::Producer;
use ringbuf::traits::Observer;
use rodio::{Decoder, Source};
use std::fs::File;
use std::io::{Cursor, Read, Seek};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::time::{Duration as StdDuration, Instant};

/// 组合 Read 和 Seek traits 的 trait，用于动态分发
trait ReadSeek: Read + Seek + Send + Sync {}

/// 自动为所有实现了 Read + Seek + Send + Sync 的类型实现 ReadSeek
impl<T: Read + Seek + Send + Sync> ReadSeek for T {}

const DIRECT_DECODE_BATCH_SAMPLES: usize = 2048;
const RING_BUFFER_FULL_SLEEP_MS: u64 = 2;
const PAUSED_SLEEP_MS: u64 = 5;
const DECODER_THROTTLE_SLEEP_MS: u64 = 2;
const DECODER_TARGET_BUFFER_MS: u64 = 200;

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
    seek_receiver: &Receiver<SeekCommand>,
    error_sender: &Sender<ThreadMessage>,
    seek_generation: &Arc<AtomicU64>,
    source_sample_rate: u32,
    source_channels: u16,
) -> Result<(), String> {
    let mut sample_count = 0u64;
    let mut last_log_time = Instant::now();
    let mut sample_batch = Vec::with_capacity(DIRECT_DECODE_BATCH_SAMPLES);

    // 初始化解码器
    let mut source = create_decoder(&file_path)?;

    loop {
        if let Some(seek) = drain_latest_seek(seek_receiver) {
            sample_batch.clear();
            sample_count = seek_decoder(
                &mut source,
                &file_path,
                seek,
                sample_count,
                source_sample_rate,
                source_channels,
                seek_generation,
            )?;

            if !is_current_seek(seek_generation, seek.generation) {
                continue;
            }

            prefill_direct_samples(
                &mut source,
                &mut sample_count,
                &mut sample_batch,
                DIRECT_DECODE_BATCH_SAMPLES,
            );

            notify_renderer_seek_clear(error_sender, seek, is_playing)?;
            if !is_current_seek(seek_generation, seek.generation) {
                sample_batch.clear();
                continue;
            }

            if !sample_batch.is_empty() {
                push_samples_blocking(producer, &sample_batch, is_playing, is_paused)?;
                sample_batch.clear();
            }
            continue;
        }

        if !is_playing.load(Ordering::SeqCst) {
            break;
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(PAUSED_SLEEP_MS));
        }

        let sample = match source.next() {
            Some(s) => s,
            None => break,
        };
        sample_count += 1;
        sample_batch.push(sample);

        if sample_batch.len() >= DIRECT_DECODE_BATCH_SAMPLES {
            wait_for_decode_buffer_space(
                producer,
                source_sample_rate,
                source_channels,
                sample_batch.len(),
                is_playing,
                is_paused,
            )?;
            push_samples_blocking(producer, &sample_batch, is_playing, is_paused)?;
            sample_batch.clear();
        }

        if last_log_time.elapsed() > StdDuration::from_secs(20) {
            println!("📊 解码: 已处理 {} 样本", sample_count);
            last_log_time = Instant::now();
        }
    }

    if !sample_batch.is_empty() && is_playing.load(Ordering::SeqCst) {
        push_samples_blocking(producer, &sample_batch, is_playing, is_paused)?;
    }

    Ok(())
}

/// 带重采样的解码
pub fn decode_with_resampling(
    file_path: String,
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
    seek_receiver: &Receiver<SeekCommand>,
    error_sender: &Sender<ThreadMessage>,
    seek_generation: &Arc<AtomicU64>,
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
    let mut deinterleaved_samples = vec![vec![0.0; chunk_size]; source_channels as usize];
    let mut resampled_output = resampler.output_buffer();
    let mut output_samples = Vec::new();
    let mut chunk_count = 0u64;
    let mut sample_count = 0u64;
    let mut last_log_time = Instant::now();

    // 初始化解码器
    let mut source = create_decoder(&file_path)?;

    loop {
        if let Some(seek) = drain_latest_seek(seek_receiver) {
            sample_count = seek_decoder(
                &mut source,
                &file_path,
                seek,
                sample_count,
                source_sample_rate,
                source_channels,
                seek_generation,
            )?;

            if !is_current_seek(seek_generation, seek.generation) {
                continue;
            }

            interleaved_samples.clear();
            output_samples.clear();

            // 重置重采样器，清除 seek 前的滤波器历史状态。
            resampler.reset();

            prefill_direct_samples(
                &mut source,
                &mut sample_count,
                &mut interleaved_samples,
                samples_per_chunk,
            );

            if interleaved_samples.len() >= samples_per_chunk {
                process_chunk_samples(
                    &mut resampler,
                    &interleaved_samples[..samples_per_chunk],
                    &mut deinterleaved_samples,
                    &mut resampled_output,
                    &mut output_samples,
                    source_channels,
                    device_channels,
                    chunk_size,
                    false,
                )?;
                interleaved_samples.clear();
            } else if !interleaved_samples.is_empty() {
                interleaved_samples.resize(samples_per_chunk, 0.0);
                process_chunk_samples(
                    &mut resampler,
                    &interleaved_samples,
                    &mut deinterleaved_samples,
                    &mut resampled_output,
                    &mut output_samples,
                    source_channels,
                    device_channels,
                    chunk_size,
                    true,
                )?;
                interleaved_samples.clear();
            }

            notify_renderer_seek_clear(error_sender, seek, is_playing)?;
            if !is_current_seek(seek_generation, seek.generation) {
                output_samples.clear();
                continue;
            }

            if !output_samples.is_empty() {
                push_samples_blocking(producer, &output_samples, is_playing, is_paused)?;
                output_samples.clear();
            }
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

            wait_for_decode_buffer_space(
                producer,
                device_sample_rate,
                device_channels,
                estimate_resampled_output_samples(
                    chunk_size,
                    source_sample_rate,
                    device_sample_rate,
                    device_channels,
                ),
                is_playing,
                is_paused,
            )?;

            process_chunk(
                &mut resampler,
                &interleaved_samples[..samples_per_chunk],
                &mut deinterleaved_samples,
                &mut resampled_output,
                &mut output_samples,
                producer,
                is_playing,
                is_paused,
                source_channels,
                device_channels,
                chunk_size,
                false,
            )?;

            interleaved_samples.clear();

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
                &mut deinterleaved_samples,
                &mut resampled_output,
                &mut output_samples,
                producer,
                is_playing,
                is_paused,
                source_channels,
                device_channels,
                chunk_size,
                true,
            )?;
        }
    }

    Ok(())
}

/// 处理单个音频块
fn process_chunk(
    resampler: &mut AudioResampler,
    interleaved_samples: &[f32],
    deinterleaved: &mut [Vec<f32>],
    resampled_output: &mut [Vec<f32>],
    output_samples: &mut Vec<f32>,
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
    source_channels: u16,
    device_channels: u16,
    chunk_size: usize,
    zero_fill_input: bool,
) -> Result<(), String> {
    process_chunk_samples(
        resampler,
        interleaved_samples,
        deinterleaved,
        resampled_output,
        output_samples,
        source_channels,
        device_channels,
        chunk_size,
        zero_fill_input,
    )?;

    push_samples_blocking(producer, output_samples, is_playing, is_paused)?;
    Ok(())
}

fn process_chunk_samples(
    resampler: &mut AudioResampler,
    interleaved_samples: &[f32],
    deinterleaved: &mut [Vec<f32>],
    resampled_output: &mut [Vec<f32>],
    output_samples: &mut Vec<f32>,
    source_channels: u16,
    device_channels: u16,
    chunk_size: usize,
    zero_fill_input: bool,
) -> Result<(), String> {
    deinterleave_samples(
        interleaved_samples,
        source_channels as usize,
        chunk_size,
        deinterleaved,
        zero_fill_input,
    );
    let output_frames = resampler.process_into(deinterleaved, resampled_output)?;

    interleave_and_convert_channels(
        resampled_output,
        output_frames,
        source_channels as usize,
        device_channels as usize,
        output_samples,
    );

    Ok(())
}

/// 将交错样本转换为分离声道格式
fn deinterleave_samples(
    interleaved: &[f32],
    channels: usize,
    chunk_size: usize,
    deinterleaved: &mut [Vec<f32>],
    zero_fill: bool,
) {
    if channels == 2 && deinterleaved.len() >= 2 {
        deinterleaved[0].resize(chunk_size, 0.0);
        deinterleaved[1].resize(chunk_size, 0.0);
        if zero_fill {
            deinterleaved[0].fill(0.0);
            deinterleaved[1].fill(0.0);
        }

        let available_frames = (interleaved.len() / 2).min(chunk_size);
        for frame_idx in 0..available_frames {
            let input_idx = frame_idx * 2;
            deinterleaved[0][frame_idx] = interleaved[input_idx];
            deinterleaved[1][frame_idx] = interleaved[input_idx + 1];
        }
        return;
    }

    for channel_buf in deinterleaved.iter_mut().take(channels) {
        channel_buf.resize(chunk_size, 0.0);
        if zero_fill {
            channel_buf.fill(0.0);
        }
    }

    for frame_idx in 0..chunk_size {
        for channel_idx in 0..channels {
            let sample_idx = frame_idx * channels + channel_idx;
            if sample_idx < interleaved.len() {
                deinterleaved[channel_idx][frame_idx] = interleaved[sample_idx];
            }
        }
    }
}

/// 将重采样后的分离声道转换为设备交错格式
fn interleave_and_convert_channels(
    waves: &[Vec<f32>],
    output_frames: usize,
    source_channels: usize,
    device_channels: usize,
    output: &mut Vec<f32>,
) {
    let samples_needed = output_frames * device_channels;
    output.resize(samples_needed, 0.0);

    match (source_channels, device_channels) {
        (1, 2) => {
            for frame_idx in 0..output_frames {
                let mono = waves[0][frame_idx];
                let out_idx = frame_idx * 2;
                output[out_idx] = mono;
                output[out_idx + 1] = mono;
            }
        }
        (2, 1) => {
            for frame_idx in 0..output_frames {
                output[frame_idx] = (waves[0][frame_idx] + waves[1][frame_idx]) * 0.5;
            }
        }
        (n, m) if n == m => {
            for frame_idx in 0..output_frames {
                let out_base = frame_idx * device_channels;
                for channel_idx in 0..device_channels {
                    output[out_base + channel_idx] = waves[channel_idx][frame_idx];
                }
            }
        }
        _ => {
            let copied_channels = source_channels.min(device_channels);
            for frame_idx in 0..output_frames {
                let out_base = frame_idx * device_channels;
                for channel_idx in 0..copied_channels {
                    output[out_base + channel_idx] = waves[channel_idx][frame_idx];
                }
            }
        }
    }
}

fn seek_decoder(
    source: &mut Decoder<Box<dyn ReadSeek>>,
    file_path: &str,
    seek: SeekCommand,
    current_sample: u64,
    source_sample_rate: u32,
    source_channels: u16,
    seek_generation: &Arc<AtomicU64>,
) -> Result<u64, String> {
    let target_position = seek.position;
    let target_duration = StdDuration::from_secs_f64(target_position.max(0.0));
    let target_sample =
        (target_position * source_sample_rate as f64 * source_channels as f64) as u64;

    if source.try_seek(target_duration).is_ok() {
        return Ok(target_sample);
    }

    let current_position =
        current_sample as f64 / (source_sample_rate as f64 * source_channels as f64);
    let mut sample_count = current_sample;

    if target_position < current_position || target_position < 2.0 {
        println!("🔄 解码: 重新打开文件以执行跳转");
        *source = create_decoder(file_path)?;
        sample_count = 0;

        if !is_current_seek(seek_generation, seek.generation) {
            return Ok(sample_count);
        }

        if source.try_seek(target_duration).is_ok() {
            println!("✅ 解码: 重新打开后原生跳转成功");
            return Ok(target_sample);
        }
    }

    if target_sample > sample_count {
        println!("⚠️ 解码器不支持原生跳转，回退到样本跳过");
        let mut remaining = target_sample - sample_count;
        let batch_size = source_sample_rate as u64 * source_channels as u64 * 5;

        while remaining > 0 {
            if !is_current_seek(seek_generation, seek.generation) {
                return Ok(sample_count);
            }

            let current_batch = remaining.min(batch_size);

            if source.nth(current_batch as usize - 1).is_none() {
                break;
            }

            sample_count += current_batch;
            remaining -= current_batch;
        }
    }

    Ok(sample_count)
}

fn drain_latest_seek(seek_receiver: &Receiver<SeekCommand>) -> Option<SeekCommand> {
    let mut latest = None;
    while let Ok(command) = seek_receiver.try_recv() {
        latest = Some(command);
    }
    latest
}

fn is_current_seek(seek_generation: &Arc<AtomicU64>, generation: u64) -> bool {
    seek_generation.load(Ordering::SeqCst) == generation
}

fn notify_renderer_seek_clear(
    message_sender: &Sender<ThreadMessage>,
    seek: SeekCommand,
    is_playing: &Arc<AtomicBool>,
) -> Result<(), String> {
    let (ack_sender, ack_receiver) = channel();
    message_sender
        .send(ThreadMessage::SeekRequest {
            command: seek,
            ack_sender,
        })
        .map_err(|e| format!("通知渲染器清空缓冲区失败: {}", e))?;

    while is_playing.load(Ordering::SeqCst) {
        if ack_receiver
            .recv_timeout(StdDuration::from_millis(5))
            .is_ok()
        {
            return Ok(());
        }
    }

    Ok(())
}

fn prefill_direct_samples(
    source: &mut Decoder<Box<dyn ReadSeek>>,
    sample_count: &mut u64,
    output: &mut Vec<f32>,
    target_samples: usize,
) {
    output.clear();
    while output.len() < target_samples {
        match source.next() {
            Some(sample) => {
                *sample_count += 1;
                output.push(sample);
            }
            None => break,
        }
    }
}

fn wait_for_decode_buffer_space(
    producer: &HeapProd<f32>,
    sample_rate: u32,
    channels: u16,
    next_write_samples: usize,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
) -> Result<(), String> {
    let target_samples =
        decode_throttle_threshold_samples(producer, sample_rate, channels, next_write_samples);

    while producer.occupied_len() >= target_samples {
        if !is_playing.load(Ordering::SeqCst) {
            return Ok(());
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(PAUSED_SLEEP_MS));
        }

        std::thread::sleep(StdDuration::from_millis(DECODER_THROTTLE_SLEEP_MS));
    }

    Ok(())
}

fn decode_throttle_threshold_samples(
    producer: &HeapProd<f32>,
    sample_rate: u32,
    channels: u16,
    next_write_samples: usize,
) -> usize {
    let capacity = producer.capacity().get();
    let target_by_time = decode_target_buffer_samples(sample_rate, channels);
    let target_before_write = target_by_time.saturating_sub(next_write_samples);
    target_before_write.clamp(capacity / 8, capacity.saturating_sub(1).max(1))
}

fn decode_target_buffer_samples(sample_rate: u32, channels: u16) -> usize {
    sample_rate as usize * channels as usize * DECODER_TARGET_BUFFER_MS as usize / 1000
}

fn estimate_resampled_output_samples(
    input_frames: usize,
    source_sample_rate: u32,
    device_sample_rate: u32,
    device_channels: u16,
) -> usize {
    let estimated_frames =
        (input_frames as u64 * device_sample_rate as u64).div_ceil(source_sample_rate as u64);
    estimated_frames as usize * device_channels as usize
}

fn push_samples_blocking(
    producer: &mut HeapProd<f32>,
    samples: &[f32],
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut written = 0;

    while written < samples.len() {
        if !is_playing.load(Ordering::SeqCst) {
            return Ok(());
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(PAUSED_SLEEP_MS));
        }

        let pushed = producer.push_slice(&samples[written..]);
        if pushed == 0 {
            std::thread::sleep(StdDuration::from_millis(RING_BUFFER_FULL_SLEEP_MS));
        } else {
            written += pushed;
        }
    }

    Ok(())
}
