import {audioDriverController} from '@js/features/audioDriver';
import {WebAudioEngine} from '@services/audio/WebAudioEngine';
import type {AudioEngineBridge, AudioEngineConstructor, AudioEngineType} from './AudioEngineContract';

class AudioEngineFactory {
    private WasapiEngine: AudioEngineConstructor | null = null;

    async ensureWasapiAvailable(): Promise<boolean> {
        try {
            const {default: WasapiEngine} = await import('@services/audio/WasapiEngine') as {default: AudioEngineConstructor};
            this.WasapiEngine = WasapiEngine;

            if (!audioDriverController.isNativeAudioAvailable()) {
                console.warn('⚠️ Native音频模块未加载');
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ WASAPI引擎检查失败:', error);
            return false;
        }
    }

    async create(engineType: AudioEngineType): Promise<AudioEngineBridge> {
        let engine: AudioEngineBridge;

        if (engineType === 'wasapi') {
            const wasapiAvailable = this.WasapiEngine !== null || await this.ensureWasapiAvailable();
            if (!wasapiAvailable || !this.WasapiEngine) {
                throw new Error('WASAPI引擎不可用');
            }

            console.log('🎵 创建WASAPI独占引擎');
            engine = new this.WasapiEngine();
        } else {
            console.log('🎵 创建WebAudio引擎');
            engine = new WebAudioEngine() as AudioEngineBridge;
        }

        const initialized = await engine.initialize();
        if (!initialized) {
            throw new Error('引擎初始化失败');
        }

        return engine;
    }
}

export const audioEngineFactory = new AudioEngineFactory();
export {AudioEngineFactory};
