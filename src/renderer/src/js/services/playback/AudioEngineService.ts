import AudioEngineManager from "@services/audio/AudioEngineManager";
import {audioGateway} from "@js/infrastructure/electron";
import type {MusicBoxSettings, WasapiShareMode} from "@api/types/settings";

type AudioEngineType = 'webaudio' | 'wasapi';

interface CacheManagerLike {
    getLocalCache<T = unknown>(key: string): T | null;
    setLocalCache(key: string, data: unknown): void;
}

interface AudioEngineServiceOptions {
    cacheManager: CacheManagerLike;
}

class AudioEngineService {
    private readonly cacheManager: CacheManagerLike;
    private audioEngine: any | null;

    constructor({cacheManager}: AudioEngineServiceOptions) {
        this.cacheManager = cacheManager;
        this.audioEngine = null;
    }

    get engine(): any | null {
        return this.audioEngine;
    }

    set engine(audioEngine: any | null) {
        this.audioEngine = audioEngine;
    }

    async initialize(): Promise<any | null> {
        try {
            const settings = this.cacheManager.getLocalCache<MusicBoxSettings>('musicbox-settings') || {};
            const exclusiveMode = settings.exclusiveMode === true;
            const wasapiShareMode = settings.wasapiShareMode || 'exclusive';
            const engineType: AudioEngineType = exclusiveMode ? 'wasapi' : 'webaudio';

            console.log(`🎵 API: 初始化音频引擎，类型: ${engineType}${exclusiveMode ? ` (${wasapiShareMode === 'exclusive' ? '独占' : '共享'}模式)` : ''}`);

            this.audioEngine = new AudioEngineManager();
            const initialized = await this.audioEngine.initialize(engineType);

            if (initialized) {
                await this.applyWasapiShareMode(engineType, wasapiShareMode);
                this.restoreRuntimeSettings(settings);
                console.log(`✅ API: 音频引擎初始化成功 (${this.audioEngine.getEngineType()})`);
            } else {
                console.error('❌ API: 音频引擎初始化失败');
            }

            return this.audioEngine;
        } catch (error) {
            console.error('❌ API: 音频引擎初始化错误', error);
            return this.fallbackToWebAudio();
        }
    }

    async fallbackToWebAudio(): Promise<any | null> {
        try {
            console.log('🔧 API: 尝试回退到 WebAudioEngine...');
            this.audioEngine = new AudioEngineManager();
            await this.audioEngine.initialize('webaudio');
            console.log('✅ API: 已回退到 WebAudioEngine');
            return this.audioEngine;
        } catch (fallbackError) {
            console.error('❌ API: 回退到 WebAudioEngine 也失败', fallbackError);
            return null;
        }
    }

    async applyWasapiShareMode(engineType: AudioEngineType, wasapiShareMode: WasapiShareMode): Promise<void> {
        if (engineType !== 'wasapi' || !this.audioEngine.currentEngine?.nativeEngine) {
            return;
        }

        try {
            const currentMode = await this.audioEngine.currentEngine.nativeEngine.getShareMode();
            if (currentMode !== wasapiShareMode) {
                console.log(`🔧 API: 设置 WASAPI 模式为 ${wasapiShareMode}`);
                await this.audioEngine.currentEngine.nativeEngine.setShareMode(wasapiShareMode);
            }
        } catch (error) {
            console.warn('⚠️ API: 设置 WASAPI 模式失败，使用默认模式', error);
        }
    }

    restoreRuntimeSettings(settings: MusicBoxSettings): void {
        if (!this.audioEngine) {
            return;
        }

        const volume = this.cacheManager.getLocalCache('volume') || 0.7;
        this.audioEngine.setVolume(volume);

        const gaplessEnabled = settings.gaplessPlayback !== false;
        this.audioEngine.setGaplessPlayback(gaplessEnabled);
    }

    async initializeMainProcessAudio(): Promise<boolean> {
        return audioGateway.init();
    }

    getEqualizer(): any | null {
        return this.audioEngine?.getEqualizer() || null;
    }

    setEqualizerEnabled(enabled: boolean): void {
        this.audioEngine?.setEqualizerEnabled(enabled);
    }

    setGaplessPlayback(enabled: boolean): void {
        this.audioEngine?.setGaplessPlayback(enabled);
    }

    getGaplessPlayback(): boolean {
        return this.audioEngine?.getGaplessPlayback() || false;
    }

    async switchEngine(engineType: AudioEngineType): Promise<boolean> {
        if (!this.audioEngine) {
            console.error('❌ API: 音频引擎未初始化');
            return false;
        }

        console.log(`🔧 API: 切换音频引擎到 ${engineType}`);
        const result = await this.audioEngine.switchEngine(engineType);

        if (result) {
            console.log('✅ API: 音频引擎切换成功');
            const settings = this.cacheManager.getLocalCache<MusicBoxSettings>('musicbox-settings') || {};
            settings.exclusiveMode = (engineType === 'wasapi');
            this.cacheManager.setLocalCache('musicbox-settings', settings);
        } else {
            console.error('❌ API: 音频引擎切换失败');
        }

        return result;
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        if (!this.audioEngine) {
            console.error('❌ API: 音频引擎未初始化');
            return false;
        }

        if (this.audioEngine.getEngineType() !== 'wasapi') {
            console.warn('⚠️ API: 当前不是 WASAPI 引擎，无法切换模式');
            return false;
        }

        console.log(`🔧 API: 切换 WASAPI 模式到 ${mode}`);

        try {
            const result = await this.audioEngine.currentEngine?.switchShareMode(mode);
            if (result) {
                const settings = this.cacheManager.getLocalCache<MusicBoxSettings>('musicbox-settings') || {};
                settings.wasapiShareMode = mode;
                this.cacheManager.setLocalCache('musicbox-settings', settings);
                return true;
            }

            console.error('❌ API: WASAPI 模式切换失败');
            return false;
        } catch (error) {
            console.error('❌ API: WASAPI 模式切换异常:', error);
            return false;
        }
    }

    getEngineType(): string {
        return this.audioEngine?.getEngineType() || 'unknown';
    }
}

export {AudioEngineService};
