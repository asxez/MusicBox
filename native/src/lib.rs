//! MusicBox Native Audio Engine
//!
//! 提供WASAPI独占模式音频播放支持

#[macro_use]
extern crate napi_derive;

use napi::{Env, JsObject, Result};
use parking_lot::Mutex;
use std::sync::Arc;

mod audio_engine;
mod audio_format;
mod decoder;
mod playback_tracker;
mod renderer;
mod resampler;
mod thread_message;

use audio_engine::AudioEngine;

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
    pub fn initialize(&mut self, mut env: Env) -> Result<JsObject> {
        println!("🎵 NativeAudioEngine: 初始化WASAPI引擎");

        let mut engine = self.engine.lock();
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
