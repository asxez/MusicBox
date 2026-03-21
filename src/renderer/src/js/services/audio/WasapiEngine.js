/**
 * WASAPI独占模式音频引擎（Rust实现的JS包装器）
 */

import ParametricEqualizer from "@services/audio/ParametricEqualizer";

class WasapiEngine {
    constructor() {
        this.nativeEngine = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.duration = 0;
        this.volume = 0.7;
        this.currentTrack = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.gaplessPlaybackEnabled = true;

        // 参量均衡器
        this.parametricEqualizer = null;

        // 待应用的播放位置（用于loadTrack后play前的seek）
        this.pendingSeekPosition = null;

        // 播放开始时间戳（用于过滤旧的finished事件）
        this.playStartTime = 0;

        // 标记是否正在加载新曲目（用于阻止旧曲目的finished事件）
        this.isLoadingNewTrack = false;

        // 事件回调
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;
        this.getNextTrackIndex = null;
        this.getPreviousTrackIndex = null;

        // 进度更新定时器
        this.progressTimer = null;
    }

    async initialize() {
        try {
            if (!window.electronAPI?.nativeAudio) {
                throw new Error('Native音频模块未加载');
            }

            // 初始化Rust音频引擎
            const result = await window.electronAPI.nativeAudio.initialize();
            if (!result.success) {
                throw new Error(result.error || '初始化失败');
            }

            this.nativeEngine = window.electronAPI.nativeAudio;

            // 初始化参量均衡器（传入this以便切换均衡器模式）
            this.parametricEqualizer = new ParametricEqualizer(this.nativeEngine, this);
            await this.parametricEqualizer.init();

            // 设置事件监听
            this.setupEventListeners();
            console.log('✅ WASAPI引擎初始化成功');
            return true;
        } catch (error) {
            console.error('❌ WASAPI引擎初始化失败:', error);
            return false;
        }
    }

    setupEventListeners() {
        // 监听播放结束事件
        window.electronAPI.onNativeAudioEvent('track-ended', () => {
            this.onTrackEnded();
        });

        // 监听错误事件
        window.electronAPI.onNativeAudioEvent('error', (errorMsg) => {
            console.error('❌ Native音频错误:', errorMsg);
            this.isPlaying = false;
            this.isPaused = false;
            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }
        });
    }

    async loadTrack(filePath) {
        try {
            // 标记正在加载新曲目，阻止旧曲目的finished事件触发自动播放
            this.isLoadingNewTrack = true;

            await this.stop();

            const result = await this.nativeEngine.loadTrack(filePath);
            if (!result.success) {
                throw new Error(result.error || '加载失败');
            }

            // 获取音频元数据
            const metadata = await window.electronAPI.library.getTrackMetadata(filePath);
            this.duration = metadata.duration || result.duration || 0;

            this.currentTrack = {
                filePath: filePath,
                title: metadata.title || '未知标题',
                artist: metadata.artist || '未知艺术家',
                album: metadata.album || '未知专辑',
                duration: this.duration,
                cover: metadata.cover
            };

            // 重置pending seek位置
            this.pendingSeekPosition = null;
            return true;
        } catch (error) {
            console.error('❌ 加载音频文件失败:', error);
            return false;
        }
    }

    async play() {
        try {
            if (!this.currentTrack) {
                return false;
            }

            const result = await this.nativeEngine.play();
            if (!result.success) {
                throw new Error(result.error || '播放失败');
            }

            this.isPlaying = true;
            this.isPaused = false;

            // 记录播放开始时间，用于过滤旧的finished事件
            this.playStartTime = Date.now();

            // 清除加载标记，允许finished事件触发自动播放
            this.isLoadingNewTrack = false;

            this.startProgressTimer();

            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(true);
            }

            // 如果有待应用的seek位置，在播放开始后立即执行seek
            if (this.pendingSeekPosition !== null && this.pendingSeekPosition > 0) {
                const seekPos = this.pendingSeekPosition;
                this.pendingSeekPosition = null;
                console.log(`🎵 WasapiEngine: 播放后应用待定的播放位置: ${seekPos.toFixed(2)}s`);

                // 等待一小段时间让播放稳定
                await new Promise(resolve => setTimeout(resolve, 50));

                const seekResult = await this.nativeEngine.seek(seekPos);
                if (!seekResult.success) {
                    console.warn('⚠️ WasapiEngine: 应用待定播放位置失败');
                } else if (this.onPositionChanged) {
                    this.onPositionChanged(seekPos);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    async pause() {
        try {
            const result = await this.nativeEngine.pause();
            if (!result.success) {
                throw new Error(result.error || '暂停失败');
            }

            this.isPlaying = false;
            this.isPaused = true;
            this.stopProgressTimer();

            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }

            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    async stop() {
        try {
            const result = await this.nativeEngine.stop();

            this.isPlaying = false;
            this.isPaused = false;
            this.pendingSeekPosition = null;
            this.stopProgressTimer();

            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }

            return result?.success || true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    async seek(position) {
        try {
            // 如果正在播放或暂停，立即执行seek
            if (this.isPlaying || this.isPaused) {
                const result = await this.nativeEngine.seek(position);
                if (!result.success) {
                    throw new Error(result.error || '跳转失败');
                }

                if (this.onPositionChanged) {
                    this.onPositionChanged(position);
                }

                return true;
            } else {
                // 如果还未开始播放，保存位置待play时应用
                this.pendingSeekPosition = position;
                console.log(`🎵 WasapiEngine: 保存待定的播放位置: ${position.toFixed(2)}s`);

                if (this.onPositionChanged) {
                    this.onPositionChanged(position);
                }

                return true;
            }
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    setVolume(volume) {
        try {
            this.volume = Math.max(0, Math.min(1, volume));
            this.nativeEngine.setVolume(this.volume);

            if (this.onVolumeChanged) {
                this.onVolumeChanged(this.volume);
            }

            return true;
        } catch (error) {
            console.error('❌ 设置音量失败:', error);
            return false;
        }
    }

    getVolume() {
        return this.volume;
    }

    async getPosition() {
        try {
            const result = await this.nativeEngine.getPosition();
            return result.position || 0.0;
        } catch (error) {
            return 0.0;
        }
    }

    getDuration() {
        return this.duration;
    }

    getCurrentTrack() {
        return this.currentTrack;
    }

    setPlaylist(tracks, startIndex = 0) {
        this.playlist = tracks || [];
        this.currentIndex = startIndex;
        return true;
    }

    async nextTrack(nextIndex = null) {
        if (this.playlist.length === 0) {
            return false;
        }

        if (this.currentIndex === -1) {
            return false;
        }

        await this.stop();

        // 计算下一首索引
        if (nextIndex !== null && nextIndex >= 0 && nextIndex < this.playlist.length) {
            this.currentIndex = nextIndex;
        } else if (typeof this.getNextTrackIndex === 'function') {
            this.currentIndex = this.getNextTrackIndex();
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }

        const nextTrack = this.playlist[this.currentIndex];
        const filePath = nextTrack.filePath || nextTrack.path || nextTrack;

        if (!filePath) {
            return false;
        }

        const loadResult = await this.loadTrack(filePath);
        if (loadResult) {
            const playResult = await this.play();

            if (playResult && this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            return playResult;
        }
        return false;
    }

    async previousTrack(prevIndex = null) {
        if (this.playlist.length === 0) {
            return false;
        }

        if (this.currentIndex === -1) {
            return false;
        }

        await this.stop();

        // 计算上一首索引
        if (prevIndex !== null && prevIndex >= 0 && prevIndex < this.playlist.length) {
            this.currentIndex = prevIndex;
        } else if (typeof this.getPreviousTrackIndex === 'function') {
            this.currentIndex = this.getPreviousTrackIndex();
        } else {
            this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        }

        const prevTrack = this.playlist[this.currentIndex];
        const filePath = prevTrack.filePath || prevTrack.path || prevTrack;

        if (!filePath) {
            return false;
        }

        const loadResult = await this.loadTrack(filePath);
        if (loadResult) {
            const playResult = await this.play();

            if (playResult && this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            return playResult;
        }
        return false;
    }

    setGaplessPlayback(enabled) {
        this.gaplessPlaybackEnabled = enabled;
        console.log(`🎵 WasapiEngine: 无间隙播放${enabled ? '启用' : '禁用'}`);
    }

    getGaplessPlayback() {
        return this.gaplessPlaybackEnabled;
    }

    onTrackEnded() {
        // 如果正在加载新曲目，忽略finished事件（这是旧曲目的finished事件）
        if (this.isLoadingNewTrack) {
            return;
        }

        // 检查finished事件是否来自刚开始播放的曲目
        // 如果距离play()调用不到2秒，这必定是旧曲目的finished事件（因为歌曲不可能在2秒内播完）
        const timeSincePlay = Date.now() - this.playStartTime;
        if (timeSincePlay < 2000) {
            return;
        }

        this.isPlaying = false;
        this.isPaused = false;

        // 自动播放下一首
        if (this.playlist.length > 0) {
            setTimeout(async () => {
                await this.nextTrack();
            }, this.gaplessPlaybackEnabled ? 0 : 500);
        }
    }

    startProgressTimer() {
        this.stopProgressTimer();
        this.progressTimer = setInterval(async () => {
            if (this.isPlaying && this.onPositionChanged) {
                this.onPositionChanged(await this.getPosition());
            }
        }, 50);
    }

    stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    destroy() {
        this.stop();
        this.stopProgressTimer();
        this.currentTrack = null;
        this.playlist = [];
        this.currentIndex = -1;

        // 清理Native引擎
        if (this.nativeEngine) {
            this.nativeEngine.destroy?.();
            this.nativeEngine = null;
        }
    }

    // ==================== WASAPI模式切换 ====================

    async switchShareMode(mode) {
        if (!this.nativeEngine?.switchShareMode) {
            console.error('❌ WasapiEngine: Native引擎不支持模式切换');
            return false;
        }

        try {
            console.log(`🔄 WasapiEngine: 切换到${mode === 'exclusive' ? '独占' : '共享'}模式`);

            // 保存当前状态
            const wasPlaying = this.isPlaying;
            const currentPosition = await this.getPosition();
            const savedTrack = this.currentTrack;

            // 停止当前播放
            await this.stop();

            // 调用Native引擎切换模式
            const result = await this.nativeEngine.switchShareMode(mode);
            if (!result.success) {
                throw new Error(result.error || '模式切换失败');
            }

            console.log(`✅ WasapiEngine: 模式切换成功`);

            // 如果之前有歌曲在播放，重新加载并恢复
            if (savedTrack && savedTrack.filePath) {
                await this.loadTrack(savedTrack.filePath);

                if (currentPosition > 0) {
                    this.pendingSeekPosition = currentPosition;
                }

                if (wasPlaying) {
                    await this.play();
                }
            }

            return true;
        } catch (error) {
            console.error('❌ WasapiEngine: 模式切换失败:', error);
            return false;
        }
    }

    // ==================== 均衡器接口 ====================

    // 获取图形均衡器代理对象
    getEqualizer() {
        if (!this.nativeEngine) {
            return null;
        }

        // 创建一个均衡器代理对象，将调用转发到Rust引擎
        return new WasapiEqualizer(this.nativeEngine);
    }

    // 获取参量均衡器实例
    getParametricEqualizer() {
        return this.parametricEqualizer;
    }

    // 设置均衡器启用状态
    setEqualizerEnabled(enabled) {
        if (this.nativeEngine) {
            this.nativeEngine.setEqualizerEnabled(enabled);
        }
    }

    // 设置均衡器模式 ('graphic' 或 'parametric')
    async setEqualizerMode(mode) {
        if (!this.nativeEngine?.setEqualizerMode) {
            console.warn('⚠️ 均衡器模式切换不支持');
            return false;
        }

        try {
            const result = await this.nativeEngine.setEqualizerMode(mode);
            if (result.success) {
                console.log(`🎛️ 切换到${mode === 'graphic' ? '图形' : '参量'}均衡器模式`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ 切换均衡器模式失败:', error);
            return false;
        }
    }

    // 获取当前均衡器模式
    async getEqualizerMode() {
        if (!this.nativeEngine?.getEqualizerMode) {
            return 'graphic'; // 默认返回图形模式
        }

        try {
            const result = await this.nativeEngine.getEqualizerMode();
            if (result.success) {
                return result.mode;
            }
            return 'graphic';
        } catch (error) {
            console.error('❌ 获取均衡器模式失败:', error);
            return 'graphic';
        }
    }
}

/**
 * WASAPI均衡器代理类
 * 将均衡器调用转发到Rust原生引擎
 */

class WasapiEqualizer {
    constructor(nativeEngine) {
        this.nativeEngine = nativeEngine;
        this.presets = {
            'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'pop': [1, 2, 3, 1, -1, -1, 1, 2, 3, 2],
            'rock': [3, 2, 1, 0, -1, 0, 1, 2, 3, 3],
            'classical': [2, 1, 0, 0, 0, 0, -1, -1, 0, 1],
            'jazz': [2, 1, 0, 1, 2, 1, 0, 1, 2, 2],
            'vocal': [0, -1, -2, -1, 1, 3, 3, 2, 1, 0],
            'bass': [4, 3, 2, 1, 0, -1, -2, -2, -1, 0],
            'treble': [0, -1, -2, -1, 0, 1, 2, 3, 4, 4],
            'electronic': [2, 3, 1, 0, -1, 1, 0, 1, 2, 3],
            'hifi': [1, 0.5, 0, -0.5, 0, 0.5, 1, 1.5, 2, 1.5],
            'studio': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'live': [2, 1, 0, -1, -1, 0, 1, 2, 3, 2],
            'loudness': [4, 2, 0, -1, -2, -2, -1, 0, 2, 4],
            'cinema': [3, 2, 1, 1, 0, -1, -1, 0, 1, 2],
            'warm': [2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -1, 0],
            'bright': [-1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3]
        };

        // 本地缓存增益值和Q值
        this.gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.qValues = [0.707, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.707];
        this.preampGain = 0;
    }

    // 设置频段增益
    setBandGain(bandIndex, gain) {
        if (bandIndex < 0 || bandIndex >= 10) {
            return;
        }

        gain = Math.max(-12, Math.min(12, gain));
        this.gains[bandIndex] = gain;

        if (this.nativeEngine?.setEqualizerBandGain) {
            this.nativeEngine.setEqualizerBandGain(bandIndex, gain);
        }
    }

    // 获取频段增益
    getBandGain(bandIndex) {
        if (bandIndex < 0 || bandIndex >= 10) {
            return 0;
        }

        // 从本地缓存返回（已在setBandGain中同步）
        return this.gains[bandIndex];
    }

    // 设置所有频段增益
    setAllGains(gains) {
        if (!Array.isArray(gains) || gains.length !== 10) {
            return;
        }

        this.gains = gains.map(g => Math.max(-12, Math.min(12, g)));

        // 逐个设置到Rust引擎
        for (let i = 0; i < 10; i++) {
            if (this.nativeEngine?.setEqualizerBandGain) {
                this.nativeEngine.setEqualizerBandGain(i, this.gains[i]);
            }
        }
    }

    // 获取所有频段增益
    getAllGains() {
        // 从本地缓存返回
        return [...this.gains];
    }

    // 设置前置增益
    setPreamp(gainDb) {
        this.preampGain = Math.max(-12, Math.min(12, gainDb));

        if (this.nativeEngine?.setEqualizerPreamp) {
            this.nativeEngine.setEqualizerPreamp(this.preampGain);
        }
    }

    // 获取前置增益
    getPreamp() {
        // 从本地缓存返回
        return this.preampGain;
    }

    // 设置单个频段Q值
    setBandQ(bandIndex, q) {
        if (bandIndex < 0 || bandIndex >= 10) {
            return;
        }

        q = Math.max(0.1, Math.min(10, q));
        this.qValues[bandIndex] = q;

        if (this.nativeEngine?.setEqualizerBandQ) {
            this.nativeEngine.setEqualizerBandQ(bandIndex, q);
        }
    }

    // 获取单个频段Q值
    getBandQ(bandIndex) {
        if (bandIndex < 0 || bandIndex >= 10) {
            return 1.0;
        }

        // 从本地缓存返回
        return this.qValues[bandIndex];
    }

    // 获取所有Q值
    getAllQValues() {
        return [...this.qValues];
    }

    // 应用预设
    applyPreset(presetName) {
        if (this.presets[presetName]) {
            this.setAllGains(this.presets[presetName]);
            return true;
        }

        // 使用Rust端的预设
        if (this.nativeEngine?.applyEqualizerPreset) {
            return this.nativeEngine.applyEqualizerPreset(presetName);
        }

        return false;
    }

    // 获取预设名称列表
    getPresetNames() {
        return Object.keys(this.presets);
    }

    // 重置均衡器
    reset() {
        this.gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.qValues = [0.707, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.707];
        this.preampGain = 0;

        if (this.nativeEngine?.resetEqualizer) {
            this.nativeEngine.resetEqualizer();
        }
    }

    // 获取频率响应曲线
    async getFrequencyResponse() {
        if (this.nativeEngine?.getEqualizerFrequencyResponse) {
            try {
                const result = await this.nativeEngine.getEqualizerFrequencyResponse();
                if (result.success && result.response) {
                    return result.response;
                }
            } catch (error) {
                console.error('❌ 获取频率响应失败:', error);
            }
        }
        return [];
    }
}

export default WasapiEngine;
