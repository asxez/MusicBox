/**
 * WASAPI独占模式音频引擎（Rust实现的JS包装器）
 */

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

        // 待应用的播放位置（用于loadTrack后play前的seek）
        this.pendingSeekPosition = null;

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
}

export default WasapiEngine;
