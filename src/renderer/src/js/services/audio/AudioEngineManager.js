/**
 * 音频引擎管理器
 * 负责在WebAudioEngine和WasapiEngine之间切换
 */

import {WebAudioEngine} from '@services/audio/WebAudioEngine';

class AudioEngineManager {
    constructor() {
        this.currentEngine = null;
        this.engineType = 'webaudio'; // 'webaudio' 或 'wasapi'
        this.WasapiEngine = null; // 延迟加载

        // 保存的状态，用于引擎切换时恢复
        this.savedState = {
            volume: 0.7,
            playlist: [],
            currentIndex: -1,
            position: 0,
            isPlaying: false,
            gaplessEnabled: true
        };

        // 事件回调（代理到当前引擎）
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;
        this.getNextTrackIndex = null;
        this.getPreviousTrackIndex = null;
    }

    /**
     * 初始化引擎管理器
     * @param {string} engineType - 引擎类型 'webaudio' 或 'wasapi'
     * @returns {Promise<boolean>}
     */
    async initialize(engineType = 'webaudio') {
        try {
            this.engineType = engineType;
            if (engineType === 'wasapi') {
                // 尝试加载WASAPI引擎
                const wasapiAvailable = await this.checkWasapiAvailability();
                if (!wasapiAvailable) {
                    console.warn('⚠️ WASAPI引擎不可用，回退到WebAudio引擎');
                    this.engineType = 'webaudio';
                }
            }

            return await this.createEngine(this.engineType);
        } catch (error) {
            console.error('❌ 引擎管理器初始化失败:', error);
            return false;
        }
    }

    /**
     * 检查WASAPI引擎是否可用
     * @returns {Promise<boolean>}
     */
    async checkWasapiAvailability() {
        try {
            const {default: WasapiEngine} = await import('./WasapiEngine.js');
            this.WasapiEngine = WasapiEngine;

            // 检查Native模块是否可用
            if (!window.electronAPI.nativeAudio) {
                console.warn('⚠️ Native音频模块未加载');
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ WASAPI引擎检查失败:', error);
            return false;
        }
    }

    /**
     * 创建指定类型的引擎
     * @param {string} engineType
     * @returns {Promise<boolean>}
     */
    async createEngine(engineType) {
        try {
            let engine;

            if (engineType === 'wasapi' && this.WasapiEngine) {
                console.log('🎵 创建WASAPI独占引擎');
                engine = new this.WasapiEngine();
            } else {
                console.log('🎵 创建WebAudio引擎');
                engine = new WebAudioEngine();
            }

            const initialized = await engine.initialize();
            if (!initialized) {
                throw new Error('引擎初始化失败');
            }

            this.currentEngine = engine;
            this.setupEngineCallbacks();
            console.log(`✅ ${engineType === 'wasapi' ? 'WASAPI' : 'WebAudio'}引擎初始化成功`);
            return true;
        } catch (error) {
            console.error('❌ 创建引擎失败:', error);
            return false;
        }
    }

    /**
     * 设置引擎回调
     */
    setupEngineCallbacks() {
        if (!this.currentEngine) return;

        this.currentEngine.onTrackChanged = (track) => {
            if (this.onTrackChanged) this.onTrackChanged(track);
        };

        this.currentEngine.onPlaybackStateChanged = (isPlaying) => {
            if (this.onPlaybackStateChanged) this.onPlaybackStateChanged(isPlaying);
        };

        this.currentEngine.onPositionChanged = (position) => {
            if (this.onPositionChanged) this.onPositionChanged(position);
        };

        this.currentEngine.onVolumeChanged = (volume) => {
            if (this.onVolumeChanged) this.onVolumeChanged(volume);
        };

        this.currentEngine.getNextTrackIndex = () => {
            return this.getNextTrackIndex ? this.getNextTrackIndex() : -1;
        };

        this.currentEngine.getPreviousTrackIndex = () => {
            return this.getPreviousTrackIndex ? this.getPreviousTrackIndex() : -1;
        };
    }

    /**
     * 切换引擎类型
     * @param {string} newEngineType - 新引擎类型
     * @returns {Promise<boolean>}
     */
    async switchEngine(newEngineType) {
        if (newEngineType === this.engineType) {
            console.log('ℹ️ 引擎类型未变化，无需切换');
            return true;
        }

        try {
            console.log(`🔄 切换引擎: ${this.engineType} -> ${newEngineType}`);

            // 保存当前状态
            await this.saveCurrentState();

            // 销毁旧引擎
            if (this.currentEngine) {
                this.currentEngine.destroy();
                this.currentEngine = null;
            }

            // 创建新引擎
            this.engineType = newEngineType;
            const success = await this.createEngine(newEngineType);

            if (success) {
                // 恢复状态
                await this.restoreState();
                console.log('✅ 引擎切换成功');
                return true;
            } else {
                console.error('❌ 新引擎创建失败');
                return false;
            }
        } catch (error) {
            console.error('❌ 引擎切换失败:', error);
            return false;
        }
    }

    /**
     * 保存当前引擎状态
     */
    async saveCurrentState() {
        if (!this.currentEngine) return;

        try {
            this.savedState = {
                volume: this.currentEngine.getVolume(),
                playlist: this.currentEngine.playlist || [],
                currentIndex: this.currentEngine.currentIndex || -1,
                position: await this.currentEngine.getPosition(),
                isPlaying: this.currentEngine.isPlaying,
                gaplessEnabled: this.currentEngine.getGaplessPlayback(),
                currentTrack: this.currentEngine.getCurrentTrack()
            };

            console.log('💾 已保存引擎状态:', this.savedState);
        } catch (error) {
            console.error('❌ 保存状态失败:', error);
        }
    }

    /**
     * 恢复引擎状态
     */
    async restoreState() {
        if (!this.currentEngine) return;

        try {
            // 恢复音量
            this.currentEngine.setVolume(this.savedState.volume);

            // 恢复无间隙播放设置
            this.currentEngine.setGaplessPlayback(this.savedState.gaplessEnabled);

            // 恢复播放列表
            if (this.savedState.playlist.length > 0) {
                this.currentEngine.setPlaylist(this.savedState.playlist, this.savedState.currentIndex);

                // 如果之前在播放，重新加载并播放
                if (this.savedState.currentIndex >= 0) {
                    const track = this.savedState.playlist[this.savedState.currentIndex];
                    const filePath = track.filePath || track.path || track;

                    if (filePath) {
                        await this.currentEngine.loadTrack(filePath);

                        // 恢复播放位置
                        if (this.savedState.position > 0) {
                            await this.currentEngine.seek(this.savedState.position);
                        }

                        // 如果之前在播放，继续播放
                        if (this.savedState.isPlaying) {
                            await this.currentEngine.play();
                        }
                    }
                }
            }

            console.log('✅ 已恢复引擎状态');
        } catch (error) {
            console.error('❌ 恢复状态失败:', error);
        }
    }

    /**
     * 获取当前引擎类型
     * @returns {string}
     */
    getEngineType() {
        return this.engineType;
    }

    // ==================== 代理方法 ====================
    // 以下方法将调用转发到当前引擎

    async loadTrack(filePath) {
        return this.currentEngine?.loadTrack(filePath) || false;
    }

    async play() {
        return await this.currentEngine?.play() || false;
    }

    async pause() {
        return await this.currentEngine?.pause() || false;
    }

    async stop() {
        return this.currentEngine?.stop() || false;
    }

    async seek(position) {
        return this.currentEngine?.seek(position) || false;
    }

    setVolume(volume) {
        return this.currentEngine?.setVolume(volume) || false;
    }

    getVolume() {
        return this.currentEngine?.getVolume() || 0.7;
    }

    async getPosition() {
        return await this.currentEngine?.getPosition() || 0;
    }

    getDuration() {
        return this.currentEngine?.getDuration() || 0;
    }

    getCurrentTrack() {
        return this.currentEngine?.getCurrentTrack() || null;
    }

    getEqualizer() {
        return this.currentEngine?.getEqualizer() || undefined;
    }

    setEqualizerEnabled(enabled) {
        return this.currentEngine.setEqualizerEnabled(enabled);
    }

    setPlaylist(tracks, startIndex = 0) {
        return this.currentEngine?.setPlaylist(tracks, startIndex) || false;
    }

    async nextTrack(nextIndex = null) {
        return this.currentEngine?.nextTrack(nextIndex) || false;
    }

    async previousTrack(prevIndex = null) {
        return this.currentEngine?.previousTrack(prevIndex) || false;
    }

    setGaplessPlayback(enabled) {
        this.currentEngine?.setGaplessPlayback(enabled);
    }

    getGaplessPlayback() {
        return this.currentEngine?.getGaplessPlayback() || false;
    }

    destroy() {
        if (this.currentEngine) {
            this.currentEngine.destroy();
            this.currentEngine = null;
        }
    }

    // 代理其他属性访问
    get isPlaying() {
        return this.currentEngine?.isPlaying || false;
    }

    get isPaused() {
        return this.currentEngine?.isPaused || false;
    }

    get currentIndex() {
        return this.currentEngine?.currentIndex || -1;
    }

    set currentIndex(value) {
        if (this.currentEngine) {
            this.currentEngine.currentIndex = value;
        }
    }

    get playlist() {
        return this.currentEngine?.playlist || [];
    }

    get duration() {
        return this.currentEngine?.duration || 0;
    }

    get currentTrack() {
        return this.currentEngine?.currentTrack || null;
    }
}

export default AudioEngineManager;
