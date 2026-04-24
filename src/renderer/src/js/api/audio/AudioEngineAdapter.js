import {cacheManager} from "@services/CacheManager";
import AudioEngineManager from "@services/audio/AudioEngineManager";

export class AudioEngineAdapter {
    constructor({getNextTrackIndex, getPreviousTrackIndex}) {
        this.getNextTrackIndex = getNextTrackIndex;
        this.getPreviousTrackIndex = getPreviousTrackIndex;
        this.audioEngine = null;
    }

    async initializeWebAudio() {
        try {
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            const exclusiveMode = settings.exclusiveMode === true;
            const wasapiShareMode = settings.wasapiShareMode || 'exclusive';
            const engineType = exclusiveMode ? 'wasapi' : 'webaudio';

            console.log(`🎵 API: 初始化音频引擎，类型: ${engineType}${exclusiveMode ? ` (${wasapiShareMode === 'exclusive' ? '独占' : '共享'}模式)` : ''}`);

            this.audioEngine = new AudioEngineManager();
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

                const volume = cacheManager.getLocalCache('volume') || 0.7;
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
                this.audioEngine = new AudioEngineManager();
                await this.audioEngine.initialize('webaudio');
                console.log('✅ API: 已回退到WebAudioEngine');
            } catch (fallbackError) {
                console.error('❌ API: 回退到WebAudioEngine也失败:', fallbackError);
            }
        }

        return this.audioEngine;
    }

    getAudioEngine() {
        return this.audioEngine;
    }

    async switchAudioEngine(engineType) {
        if (!this.audioEngine) {
            console.error('❌ API: 音频引擎未初始化');
            return false;
        }

        console.log(`🔄 API: 切换音频引擎到 ${engineType}`);
        const result = await this.audioEngine.switchEngine(engineType);

        if (result) {
            console.log(`✅ API: 音频引擎切换成功`);
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            settings.exclusiveMode = (engineType === 'wasapi');
            cacheManager.setLocalCache('musicbox-settings', settings);
        } else {
            console.error(`❌ API: 音频引擎切换失败`);
        }

        return result;
    }

    async switchWasapiShareMode(mode) {
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
            const result = await this.audioEngine.currentEngine?.switchShareMode(mode);
            if (result) {
                const settings = cacheManager.getLocalCache('musicbox-settings') || {};
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

    getAudioEngineType() {
        return this.audioEngine?.getEngineType() || 'unknown';
    }
}
