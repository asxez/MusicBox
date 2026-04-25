import {cacheManager} from "@services/CacheManager";
import AudioEngineManager from "@services/audio/AudioEngineManager";
import type {MusicBoxSettings, WasapiShareMode} from '@api/types/settings';

type AudioEngineType = 'webaudio' | 'wasapi';

interface NativeEngineBridge {
    getShareMode(): Promise<WasapiShareMode>;
    setShareMode(mode: WasapiShareMode): Promise<unknown>;
}

interface CurrentEngineBridge {
    nativeEngine?: NativeEngineBridge;
    switchShareMode?(mode: WasapiShareMode): Promise<boolean>;
}

interface AudioEngineManagerBridge {
    currentEngine?: CurrentEngineBridge | null;
    initialize(engineType: AudioEngineType): Promise<boolean>;
    setVolume(volume: number): boolean;
    setGaplessPlayback(enabled: boolean): void;
    switchEngine(engineType: AudioEngineType): Promise<boolean>;
    getEngineType(): AudioEngineType | string;
    getNextTrackIndex?: () => number;
    getPreviousTrackIndex?: () => number;
}

interface AudioEngineAdapterOptions {
    getNextTrackIndex: () => number;
    getPreviousTrackIndex: () => number;
}

export class AudioEngineAdapter {
    private readonly getNextTrackIndex: () => number;
    private readonly getPreviousTrackIndex: () => number;
    private audioEngine: AudioEngineManagerBridge | null = null;

    constructor({getNextTrackIndex, getPreviousTrackIndex}: AudioEngineAdapterOptions) {
        this.getNextTrackIndex = getNextTrackIndex;
        this.getPreviousTrackIndex = getPreviousTrackIndex;
    }

    async initializeWebAudio(): Promise<AudioEngineManagerBridge | null> {
        try {
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
            const exclusiveMode = settings.exclusiveMode === true;
            const wasapiShareMode = settings.wasapiShareMode || 'exclusive';
            const engineType: AudioEngineType = exclusiveMode ? 'wasapi' : 'webaudio';

            console.log(`🎵 API: 初始化音频引擎，类型: ${engineType}${exclusiveMode ? ` (${wasapiShareMode === 'exclusive' ? '独占' : '共享'}模式)` : ''}`);

            this.audioEngine = new AudioEngineManager() as AudioEngineManagerBridge;
            const initialized = await this.audioEngine.initialize(engineType);

            if (initialized) {
                if (engineType === 'wasapi' && this.audioEngine.currentEngine?.nativeEngine) {
                    try {
                        const currentMode = await this.audioEngine.currentEngine.nativeEngine.getShareMode();
                        if (currentMode !== wasapiShareMode) {
                            console.log(`🔧 API: 设置WASAPI模式为 ${wasapiShareMode}`);
                            await this.audioEngine.currentEngine.nativeEngine.setShareMode(wasapiShareMode);
                        }
                    } catch (error) {
                        console.warn('⚠️ API: 设置WASAPI模式失败，使用默认模式:', error);
                    }
                }

                const cachedVolume = cacheManager.getLocalCache('volume');
                const volume = typeof cachedVolume === 'number' ? cachedVolume : 0.7;
                this.audioEngine.setVolume(volume);

                const gaplessEnabled = settings.gaplessPlayback !== false;
                this.audioEngine.setGaplessPlayback(gaplessEnabled);

                this.audioEngine.getNextTrackIndex = () => this.getNextTrackIndex();
                this.audioEngine.getPreviousTrackIndex = () => this.getPreviousTrackIndex();
                console.log(`✅ API: 音频引擎初始化成功 (${this.audioEngine.getEngineType()})`);
            } else {
                console.error('❌ API: 音频引擎初始化失败');
            }
        } catch (error) {
            console.error('❌ API: 音频引擎初始化错误:', error);
            try {
                console.log('🔄 API: 尝试回退到WebAudioEngine...');
                this.audioEngine = new AudioEngineManager() as AudioEngineManagerBridge;
                await this.audioEngine.initialize('webaudio');
                console.log('✅ API: 已回退到WebAudioEngine');
            } catch (fallbackError) {
                console.error('❌ API: 回退到WebAudioEngine也失败:', fallbackError);
            }
        }

        return this.audioEngine;
    }

    getAudioEngine(): AudioEngineManagerBridge | null {
        return this.audioEngine;
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        if (!this.audioEngine) {
            console.error('❌ API: 音频引擎未初始化');
            return false;
        }

        console.log(`🔄 API: 切换音频引擎到 ${engineType}`);
        const result = await this.audioEngine.switchEngine(engineType);

        if (result) {
            console.log(`✅ API: 音频引擎切换成功`);
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
            settings.exclusiveMode = (engineType === 'wasapi');
            cacheManager.setLocalCache('musicbox-settings', settings);
        } else {
            console.error(`❌ API: 音频引擎切换失败`);
        }

        return result;
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        if (!this.audioEngine) {
            console.error('❌ API: 音频引擎未初始化');
            return false;
        }

        if (this.audioEngine.getEngineType() !== 'wasapi') {
            console.warn('⚠️ API: 当前不是WASAPI引擎，无法切换模式');
            return false;
        }

        console.log(`🔄 API: 切换WASAPI模式到 ${mode}`);

        try {
            const result = await this.audioEngine.currentEngine?.switchShareMode?.(mode);
            if (result) {
                const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
                settings.wasapiShareMode = mode;
                cacheManager.setLocalCache('musicbox-settings', settings);
                return true;
            } else {
                console.error(`❌ API: WASAPI模式切换失败`);
                return false;
            }
        } catch (error) {
            console.error('❌ API: WASAPI模式切换异常:', error);
            return false;
        }
    }

    getAudioEngineType(): string {
        return this.audioEngine?.getEngineType() || 'unknown';
    }
}
