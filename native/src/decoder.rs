//! 音频解码器

use crate::resampler::AudioResampler;
use ringbuf::HeapProd;
use ringbuf::producer::Producer;
use rodio::Decoder;
use std::fs::File;
use std::io::BufReader;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration as StdDuration, Instant};

/// 直接解码（无需重采样）
pub fn decode_direct(
    source: Decoder<BufReader<File>>,
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut sample_count = 0u64;
    let mut last_log_time = Instant::now();

    for sample in source {
        if !is_playing.load(Ordering::SeqCst) {
            break;
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(10));
        }

        sample_count += 1;
        let sample_f32 = sample as f32 / 32768.0;

        while producer.try_push(sample_f32).is_err() {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            while is_paused.load(Ordering::SeqCst) {
                if !is_playing.load(Ordering::SeqCst) {
                    return Ok(());
                }
                std::thread::sleep(StdDuration::from_millis(10));
            }
            std::thread::sleep(StdDuration::from_millis(5));
        }

        if last_log_time.elapsed() > StdDuration::from_secs(10) {
            println!("📊 解码: 已处理 {} 样本", sample_count);
            last_log_time = Instant::now();
        }
    }

    Ok(())
}

/// 带重采样的解码
pub fn decode_with_resampling(
    source: Decoder<BufReader<File>>,
    producer: &mut HeapProd<f32>,
    is_playing: &Arc<AtomicBool>,
    is_paused: &Arc<AtomicBool>,
    source_sample_rate: u32,
    source_channels: u16,
    device_sample_rate: u32,
    device_channels: u16,
) -> Result<(), String> {
    let mut resampler =
        AudioResampler::new(source_sample_rate, device_sample_rate, source_channels)?;

    let chunk_size = resampler.chunk_size();
    let samples_per_chunk = chunk_size * source_channels as usize;
    let mut interleaved_samples: Vec<f32> = Vec::with_capacity(samples_per_chunk);
    let mut chunk_count = 0u64;
    let mut last_log_time = Instant::now();

    for sample in source {
        if !is_playing.load(Ordering::SeqCst) {
            break;
        }

        while is_paused.load(Ordering::SeqCst) {
            if !is_playing.load(Ordering::SeqCst) {
                return Ok(());
            }
            std::thread::sleep(StdDuration::from_millis(10));
        }

        let sample_f32 = sample as f32 / 32768.0;
        interleaved_samples.push(sample_f32);

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

            if last_log_time.elapsed() > StdDuration::from_secs(10) {
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
                    std::thread::sleep(StdDuration::from_millis(10));
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
