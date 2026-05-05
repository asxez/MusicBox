//! MusicBox Native Audio Engine
//!
//! 提供WASAPI共享/独占模式音频播放支持

#[macro_use]
extern crate napi_derive;

use napi::{Env, JsObject, Result};
use parking_lot::Mutex;
use std::sync::Arc;

// 模块声明
mod core;
mod decoder;
mod renderer;
mod equalizer;
mod utils;

// 重新导出核心类型
use core::{AudioEngine, ShareMode, EqualizerMode};

/// 创建成功响应对象
fn create_success_response(env: &mut Env) -> Result<JsObject> {
    let mut obj = env.create_object()?;
    obj.set_named_property("success", env.create_int64(1)?)?;
    Ok(obj)
}

/// 创建错误响应对象
fn create_error_response(env: &mut Env, error_msg: &str) -> Result<JsObject> {
    let mut obj = env.create_object()?;
    obj.set_named_property("success", env.create_int64(0)?)?;
    obj.set_named_property("error", env.create_string(error_msg)?)?;
    Ok(obj)
}

/// Native音频引擎类
#[napi]
pub struct NativeAudioEngine {
    engine: Arc<Mutex<AudioEngine>>,
}

#[napi]
impl NativeAudioEngine {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        println!("🎵 NativeAudioEngine: 创建新实例");

        let engine = AudioEngine::new().map_err(|e| napi::Error::from_reason(e))?;

        Ok(Self {
            engine: Arc::new(Mutex::new(engine)),
        })
    }

    #[napi]
    pub fn initialize(&mut self, mut env: Env, share_mode: Option<String>) -> Result<JsObject> {
        println!("🎵 NativeAudioEngine: 初始化WASAPI引擎");

        let mut engine = self.engine.lock();
        if let Some(mode) = share_mode {
            let share_mode = match ShareMode::from_str(&mode) {
                Some(m) => m,
                None => return create_error_response(&mut env, "无效的音频模式"),
            };
            engine.set_share_mode(share_mode);
        }

        match engine.initialize() {
            Ok(_) => {
                let mut response = create_success_response(&mut env)?;
                response
                    .set_named_property("message", env.create_string("WASAPI引擎初始化成功")?)?;
                Ok(response)
            }
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    #[napi]
    pub fn load_track(&mut self, mut env: Env, file_path: String) -> Result<JsObject> {
        let mut engine = self.engine.lock();

        match engine.load_track(&file_path) {
            Ok(duration) => {
                let mut response = create_success_response(&mut env)?;
                response.set_named_property("duration", env.create_double(duration)?)?;
                Ok(response)
            }
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    #[napi]
    pub fn play(&mut self, mut env: Env) -> Result<JsObject> {
        let mut engine = self.engine.lock();
        match engine.play() {
            Ok(_) => create_success_response(&mut env),
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    #[napi]
    pub fn pause(&mut self, mut env: Env) -> Result<JsObject> {
        let mut engine = self.engine.lock();
        match engine.pause() {
            Ok(_) => create_success_response(&mut env),
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    #[napi]
    pub fn stop(&mut self, mut env: Env) -> Result<JsObject> {
        let mut engine = self.engine.lock();
        match engine.stop() {
            Ok(_) => create_success_response(&mut env),
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    #[napi]
    pub fn seek(&mut self, mut env: Env, position: f64) -> Result<JsObject> {
        let mut engine = self.engine.lock();
        match engine.seek(position) {
            Ok(_) => create_success_response(&mut env),
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    #[napi]
    pub fn set_volume(&mut self, volume: f64) {
        let mut engine = self.engine.lock();
        engine.set_volume(volume as f32);
    }

    #[napi]
    pub fn get_position(&self, mut env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        let position = engine.get_position();

        let mut response = create_success_response(&mut env)?;
        response.set_named_property("position", env.create_double(position)?)?;
        Ok(response)
    }

    #[napi]
    pub fn get_render_stats(&self, mut env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        let stats = engine.get_render_stats();

        let mut response = create_success_response(&mut env)?;
        response.set_named_property("callbacks", env.create_int64(stats.callbacks as i64)?)?;
        response.set_named_property("underruns", env.create_int64(stats.underruns as i64)?)?;
        response.set_named_property("framesWritten", env.create_int64(stats.frames_written as i64)?)?;
        response.set_named_property("samplesWritten", env.create_int64(stats.samples_written as i64)?)?;
        response.set_named_property("bufferMinSamples", env.create_int64(stats.buffer_min_samples as i64)?)?;
        response.set_named_property("bufferMaxSamples", env.create_int64(stats.buffer_max_samples as i64)?)?;
        response.set_named_property("renderErrors", env.create_int64(stats.render_errors as i64)?)?;
        response.set_named_property("seekClears", env.create_int64(stats.seek_clears as i64)?)?;
        Ok(response)
    }

    #[napi]
    pub fn reset_render_stats(&self, mut env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        engine.reset_render_stats();
        create_success_response(&mut env)
    }

    #[napi]
    pub fn get_duration(&self, mut env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        let duration = engine.get_duration();

        let mut response = create_success_response(&mut env)?;
        response.set_named_property("duration", env.create_double(duration)?)?;
        Ok(response)
    }

    #[napi]
    pub fn is_playing(&self) -> bool {
        let engine = self.engine.lock();
        engine.is_playing()
    }

    #[napi]
    pub fn poll_events(&mut self) -> Option<String> {
        let mut engine = self.engine.lock();
        engine.poll_events()
    }

    #[napi]
    pub fn destroy(&mut self, mut env: Env) -> Result<JsObject> {
        println!("🎵 NativeAudioEngine: 销毁引擎");

        let mut engine = self.engine.lock();
        match engine.stop() {
            Ok(_) => create_success_response(&mut env),
            Err(e) => create_error_response(&mut env, &e),
        }
    }

    // ==================== 均衡器接口 ====================

    /// 启用/禁用均衡器
    #[napi]
    pub fn set_equalizer_enabled(&self, enabled: bool) {
        let engine = self.engine.lock();
        engine.set_equalizer_enabled(enabled);
    }

    /// 获取均衡器启用状态
    #[napi]
    pub fn is_equalizer_enabled(&self) -> bool {
        let engine = self.engine.lock();
        engine.is_equalizer_enabled()
    }

    /// 设置前置增益
    #[napi]
    pub fn set_equalizer_preamp(&self, gain: f64) {
        let engine = self.engine.lock();
        engine.set_equalizer_preamp(gain as f32);
    }

    /// 获取前置增益
    #[napi]
    pub fn get_equalizer_preamp(&self) -> f64 {
        let engine = self.engine.lock();
        engine.get_equalizer_preamp() as f64
    }

    /// 设置单个频段增益
    #[napi]
    pub fn set_equalizer_band_gain(&self, band: u32, gain: f64) {
        let mut engine = self.engine.lock();
        engine.set_equalizer_band_gain(band as usize, gain as f32);
    }

    /// 获取单个频段增益
    #[napi]
    pub fn get_equalizer_band_gain(&self, band: u32) -> f64 {
        let engine = self.engine.lock();
        engine.get_equalizer_band_gain(band as usize) as f64
    }

    /// 设置所有频段增益
    #[napi]
    pub fn set_equalizer_all_gains(&self, gains: Vec<f64>) -> bool {
        if gains.len() != 10 {
            return false;
        }

        let mut engine = self.engine.lock();
        let gains_f32: [f32; 10] = [
            gains[0] as f32,
            gains[1] as f32,
            gains[2] as f32,
            gains[3] as f32,
            gains[4] as f32,
            gains[5] as f32,
            gains[6] as f32,
            gains[7] as f32,
            gains[8] as f32,
            gains[9] as f32,
        ];
        engine.set_equalizer_all_gains(&gains_f32);
        true
    }

    /// 获取所有频段增益
    #[napi]
    pub fn get_equalizer_all_gains(&self, env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        let gains = engine.get_equalizer_all_gains();

        let mut arr = env.create_array_with_length(10)?;
        for (i, &gain) in gains.iter().enumerate() {
            arr.set_element(i as u32, env.create_double(gain as f64)?)?;
        }
        Ok(arr)
    }

    /// 设置单个频段Q值
    #[napi]
    pub fn set_equalizer_band_q(&self, band: u32, q: f64) {
        let mut engine = self.engine.lock();
        engine.set_equalizer_band_q(band as usize, q as f32);
    }

    /// 获取单个频段Q值
    #[napi]
    pub fn get_equalizer_band_q(&self, band: u32) -> f64 {
        let engine = self.engine.lock();
        engine.get_equalizer_band_q(band as usize) as f64
    }

    /// 应用预设
    #[napi]
    pub fn apply_equalizer_preset(&self, preset_name: String) -> bool {
        let mut engine = self.engine.lock();
        engine.apply_equalizer_preset(&preset_name)
    }

    /// 重置均衡器
    #[napi]
    pub fn reset_equalizer(&self) {
        let mut engine = self.engine.lock();
        engine.reset_equalizer();
    }

    /// 获取频率响应曲线数据
    #[napi]
    pub fn get_equalizer_frequency_response(&self, env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        let response = engine.get_equalizer_frequency_response();

        let mut arr = env.create_array_with_length(response.len())?;
        for (i, (freq, gain)) in response.iter().enumerate() {
            let mut point = env.create_object()?;
            point.set_named_property("frequency", env.create_double(*freq as f64)?)?;
            point.set_named_property("gain", env.create_double(*gain as f64)?)?;
            arr.set_element(i as u32, point)?;
        }
        Ok(arr)
    }

    // ==================== 均衡器模式切换 ====================

    /// 设置均衡器模式（"graphic" 或 "parametric"）
    #[napi]
    pub fn set_equalizer_mode(&self, mode: String) -> bool {
        let engine = self.engine.lock();

        let eq_mode = match mode.to_lowercase().as_str() {
            "graphic" => EqualizerMode::Graphic,
            "parametric" => EqualizerMode::Parametric,
            _ => return false,
        };

        engine.set_equalizer_mode(eq_mode);
        true
    }

    /// 获取当前均衡器模式
    #[napi]
    pub fn get_equalizer_mode(&self) -> String {
        let engine = self.engine.lock();

        match engine.get_equalizer_mode() {
            EqualizerMode::Graphic => "graphic".to_string(),
            EqualizerMode::Parametric => "parametric".to_string(),
        }
    }

    // ==================== 参量均衡器接口 ====================

    /// 添加参量频段
    #[napi]
    pub fn parametric_add_band(
        &self,
        frequency: f64,
        gain: f64,
        q: f64,
        filter_type: String,
    ) -> i32 {
        let mut engine = self.engine.lock();
        if let Some(id) = engine.parametric_add_band(frequency, gain, q, &filter_type) {
            id as i32
        } else {
            -1
        }
    }

    /// 移除参量频段
    #[napi]
    pub fn parametric_remove_band(&self, band_id: u32) -> bool {
        let mut engine = self.engine.lock();
        engine.parametric_remove_band(band_id as usize)
    }

    /// 更新参量频段
    #[napi]
    pub fn parametric_update_band(
        &self,
        band_id: u32,
        frequency: Option<f64>,
        gain: Option<f64>,
        q: Option<f64>,
        filter_type: Option<String>,
        enabled: Option<bool>,
    ) -> bool {
        let mut engine = self.engine.lock();
        let filter_type_ref = filter_type.as_deref();
        engine.parametric_update_band(
            band_id as usize,
            frequency,
            gain,
            q,
            filter_type_ref,
            enabled,
        )
    }

    /// 获取所有参量频段配置
    #[napi]
    pub fn parametric_get_bands(&self, env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        let bands = engine.parametric_get_bands();

        let mut arr = env.create_array_with_length(bands.len())?;
        for (i, (id, frequency, gain, q, filter_type, enabled)) in bands.iter().enumerate() {
            let mut band = env.create_object()?;
            band.set_named_property("id", env.create_int64(*id as i64)?)?;
            band.set_named_property("frequency", env.create_double(*frequency)?)?;
            band.set_named_property("gain", env.create_double(*gain)?)?;
            band.set_named_property("q", env.create_double(*q)?)?;
            band.set_named_property("filterType", env.create_string(filter_type)?)?;
            band.set_named_property("enabled", env.get_boolean(*enabled)?)?;
            arr.set_element(i as u32, band)?;
        }
        Ok(arr)
    }

    /// 获取单个参量频段配置
    #[napi]
    pub fn parametric_get_band(&self, band_id: u32, env: Env) -> Result<JsObject> {
        let engine = self.engine.lock();
        if let Some((id, frequency, gain, q, filter_type, enabled)) =
            engine.parametric_get_band(band_id as usize)
        {
            let mut band = env.create_object()?;
            band.set_named_property("id", env.create_int64(id as i64)?)?;
            band.set_named_property("frequency", env.create_double(frequency)?)?;
            band.set_named_property("gain", env.create_double(gain)?)?;
            band.set_named_property("q", env.create_double(q)?)?;
            band.set_named_property("filterType", env.create_string(&filter_type)?)?;
            band.set_named_property("enabled", env.get_boolean(enabled)?)?;
            Ok(band)
        } else {
            env.create_object()
        }
    }

    /// 设置参量均衡器前置增益
    #[napi]
    pub fn parametric_set_preamp(&self, gain: f64) {
        let engine = self.engine.lock();
        engine.parametric_set_preamp(gain as f32);
    }

    /// 获取参量均衡器前置增益
    #[napi]
    pub fn parametric_get_preamp(&self) -> f64 {
        let engine = self.engine.lock();
        engine.parametric_get_preamp() as f64
    }

    /// 重置参量均衡器
    #[napi]
    pub fn parametric_reset(&self) {
        let mut engine = self.engine.lock();
        engine.parametric_reset();
    }

    /// 清除所有参量频段
    #[napi]
    pub fn parametric_clear_bands(&self) {
        let mut engine = self.engine.lock();
        engine.parametric_clear_bands();
    }

    /// 启用/禁用参量均衡器
    #[napi]
    pub fn parametric_set_enabled(&self, enabled: bool) {
        let engine = self.engine.lock();
        engine.parametric_set_enabled(enabled);
    }

    /// 检查参量均衡器是否启用
    #[napi]
    pub fn parametric_is_enabled(&self) -> bool {
        let engine = self.engine.lock();
        engine.parametric_is_enabled()
    }

    // ==================== 音频模式切换接口 ====================

    /// 设置音频模式（"shared" 或 "exclusive"）
    #[napi]
    pub fn set_share_mode(&self, mode: String) -> bool {
        let share_mode = match ShareMode::from_str(&mode) {
            Some(m) => m,
            None => return false,
        };

        let mut engine = self.engine.lock();
        engine.set_share_mode(share_mode);
        true
    }

    /// 获取当前音频模式
    #[napi]
    pub fn get_share_mode(&self) -> String {
        let engine = self.engine.lock();
        engine.get_share_mode().as_str().to_string()
    }

    /// 切换音频模式并重新初始化
    #[napi]
    pub fn switch_share_mode(&self, mode: String, mut env: Env) -> Result<JsObject> {
        let share_mode = match ShareMode::from_str(&mode) {
            Some(m) => m,
            None => return create_error_response(&mut env, "无效的音频模式"),
        };

        let mut engine = self.engine.lock();
        match engine.switch_share_mode(share_mode) {
            Ok(_) => create_success_response(&mut env),
            Err(e) => create_error_response(&mut env, &e),
        }
    }
}

#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[napi]
pub fn get_build_info(env: Env) -> Result<JsObject> {
    let mut obj = env.create_object()?;
    obj.set_named_property("version", env.create_string(env!("CARGO_PKG_VERSION"))?)?;
    obj.set_named_property("name", env.create_string(env!("CARGO_PKG_NAME"))?)?;
    obj.set_named_property(
        "description",
        env.create_string(env!("CARGO_PKG_DESCRIPTION"))?,
    )?;
    obj.set_named_property("is_placeholder", env.create_int64(0)?)?;
    obj.set_named_property("message", env.create_string("WASAPI音频引擎已实现")?)?;
    Ok(obj)
}
