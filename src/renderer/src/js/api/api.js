import {EventEmitter} from '@utils';
import {cacheManager} from "@services/CacheManager";
import AudioEngineManager from "@services/audio/AudioEngineManager";
import {lyricsAPI} from "@api/LyricsAPI";
import {libraryAPI} from "@api/LibraryAPI";

class MusicBoxAPI extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentTrack = null;
        this.isPlaying = false;
        this.volume = 0.7;
        this.position = 0;
        this.duration = 0;
        this.playlist = [];
        this.currentIndex = -1;
        this.playMode = 'sequence'; // sequence, shuffle, repeat-one

        // 进度跟踪
        this.progressInterval = null;

        // 播放位置保存节流
        this.savePositionTimeout = null;

        // 音频引擎（使用AudioEngineManager统一管理）
        this.audioEngine = null;
        // 保留webAudioEngine引用以支持向后兼容（指向audioEngine）
        this.webAudioEngine = null;

        // 音频切换锁，防止快速切换时的竞态条件
        this._trackSwitchLock = false;

        // 歌词获取去重机制
        this._lyricsRequestLock = new Set(); // 正在请求歌词的歌曲集合

        this.initializeWebAudio().then(() => {
            this.setupEventListeners();
        });
    }

    async initializeWebAudio() {
        try {
            // 从设置中读取引擎类型
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            const exclusiveMode = settings.exclusiveMode === true;
            const engineType = exclusiveMode ? 'wasapi' : 'webaudio';

            console.log(`🎵 API: 初始化音频引擎，类型: ${engineType}${exclusiveMode ? ' (独占模式)' : ''}`);

            // 使用AudioEngineManager统一管理引擎
            this.audioEngine = new AudioEngineManager();
            const initialized = await this.audioEngine.initialize(engineType);

            if (initialized) {
                // 设置音量
                const volume = cacheManager.getLocalCache('volume') || 0.7;
                this.audioEngine.setVolume(volume);

                // 设置无间隙播放状态
                const gaplessEnabled = settings.gaplessPlayback !== false;
                this.audioEngine.setGaplessPlayback(gaplessEnabled);

                // 设置播放模式回调函数，让引擎能够根据播放模式计算下一首/上一首
                this.audioEngine.getNextTrackIndex = () => this.getNextTrackIndex();
                this.audioEngine.getPreviousTrackIndex = () => this.getPreviousTrackIndex();

                // 保持向后兼容：webAudioEngine指向audioEngine
                this.webAudioEngine = this.audioEngine;

                console.log(`✅ API: 音频引擎初始化成功 (${this.audioEngine.getEngineType()})`);
            } else {
                console.error('❌ API: 音频引擎初始化失败');
            }
        } catch (error) {
            console.error('❌ API: 音频引擎初始化错误:', error);
            // 发生错误时，尝试回退到WebAudioEngine
            try {
                console.log('🔄 API: 尝试回退到WebAudioEngine...');
                this.audioEngine = new AudioEngineManager();
                await this.audioEngine.initialize('webaudio');
                this.webAudioEngine = this.audioEngine;
                console.log('✅ API: 已回退到WebAudioEngine');
            } catch (fallbackError) {
                console.error('❌ API: 回退到WebAudioEngine也失败:', fallbackError);
            }
        }
    }

    setupEventListeners() {
        // 音频引擎事件监听
        if (this.audioEngine) {
            this.audioEngine.onTrackChanged = (track) => {
                console.log('🎵 API: 音频引擎歌曲变化:', track);
                this.currentTrack = track;

                // 从音频引擎获取最新的索引
                if (this.audioEngine.currentIndex !== this.currentIndex) {
                    this.currentIndex = this.audioEngine.currentIndex;
                    console.log('🔄 API: 同步更新播放索引:', this.currentIndex);
                    this.emit('trackIndexChanged', this.currentIndex);
                }

                this.emit('trackChanged', track);
                // 同步到桌面歌词
                this.syncToDesktopLyrics('track', track);
                // 保存当前播放状态
                this.saveCurrentPlaybackState();
            };

            this.audioEngine.onPlaybackStateChanged = (isPlaying) => {
                console.log('🎵 API: 音频引擎播放状态变化:', isPlaying);
                this.isPlaying = isPlaying;
                this.emit('playbackStateChanged', isPlaying ? 'playing' : 'paused');
                // 同步到桌面歌词
                this.syncToDesktopLyrics('playbackState', {isPlaying, position: this.position});
                // 保存播放状态
                this.saveCurrentPlaybackState();
            };

            this.audioEngine.onPositionChanged = (position) => {
                this.position = position;
                this.emit('positionChanged', position);
                // 同步到桌面歌词
                this.syncToDesktopLyrics('position', position);
                // 保存播放位置（节流保存，避免频繁写入）
                this.throttledSavePosition(position);
            };

            this.audioEngine.onVolumeChanged = (volume) => {
                this.volume = volume;
                this.emit('volumeChanged', volume);
            };

            this.audioEngine.onDurationChanged = (filePath, duration) => {
                console.log('🎵 API: 音频时长更新:', filePath, duration.toFixed(2) + 's');
                this.updateTrackDuration(filePath, duration);
                this.emit('trackDurationUpdated', {filePath, duration});
            };
        } else {
            console.warn('⚠️ API: 音频引擎不可用，无法设置事件监听器');
        }

        // Electron IPC events（仅在音频引擎不可用时使用）
        if (window.electronAPI.audio) {
            window.electronAPI.audio.onTrackChanged((event, track) => {
                if (!this.audioEngine) {
                    this.currentTrack = track;
                    this.emit('trackChanged', track);
                }
            });

            window.electronAPI.audio.onPlaybackStateChanged((event, state) => {
                if (!this.audioEngine) {
                    this.isPlaying = state === 'playing';
                    this.emit('playbackStateChanged', state);
                }
            });

            window.electronAPI.audio.onPositionChanged((event, position) => {
                if (!this.audioEngine) {
                    this.position = position;
                    this.emit('positionChanged', position);
                }
            });
        }

        // Library events
        if (window.electronAPI.library) {
            window.electronAPI.library.onLibraryUpdated((event, data) => {
                this.emit('libraryUpdated', data);
            });

            window.electronAPI.library.onScanProgress((event, progress) => {
                this.emit('scanProgress', progress);
            });
        }
    }

    // Audio Engine Methods
    async initializeAudio() {
        try {
            const result = await window.electronAPI.audio.init();
            this.isInitialized = result;
            return result;
        } catch (error) {
            console.error('Failed to initialize audio engine:', error);
            return false;
        }
    }

    async loadTrack(filePath) {
        try {
            if (this.audioEngine) {
                const result = await this.audioEngine.loadTrack(filePath);
                if (result) {
                    this.currentTrack = this.audioEngine.getCurrentTrack();
                    this.duration = this.audioEngine.getDuration();
                    this.position = 0;

                    // 更新当前索引
                    this.currentIndex = this.audioEngine.currentIndex;

                    // 如果当前索引仍然是-1，尝试在播放列表中查找
                    if (this.currentIndex === -1 && this.playlist.length > 0) {
                        this.currentIndex = this.playlist.findIndex(track => {
                            const trackPath = track.filePath || track.path || track;
                            return trackPath === filePath;
                        });

                        // 如果找到了，同步到音频引擎
                        if (this.currentIndex !== -1) {
                            this.audioEngine.currentIndex = this.currentIndex;
                        }
                    }

                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('trackIndexChanged', this.currentIndex);

                    // 更新播放列表中的时长信息
                    this.updateTrackDuration(filePath, this.duration);
                    await window.electronAPI.audio.loadTrack(filePath);
                    return true;
                }
            }

            const result = await window.electronAPI.audio.loadTrack(filePath);
            if (result) {
                this.currentTrack = await window.electronAPI.audio.getCurrentTrack();
                this.duration = await window.electronAPI.audio.getDuration();
                this.position = 0;

                this.emit('trackChanged', this.currentTrack);
                this.emit('durationChanged', this.duration);
                this.emit('positionChanged', 0);
            }

            return result;
        } catch (error) {
            console.error('❌ 加载音频文件失败:', error);
            return false;
        }
    }

    async play() {
        try {
            if (this.audioEngine) {
                const result = await this.audioEngine.play();
                if (result) {
                    // 不在这里手动设置状态，让音频引擎的事件回调来处理

                    // 同步到主进程
                    await window.electronAPI.audio.play();
                    return true;
                } else {
                    console.log('❌ API: Web Audio Engine 播放失败');
                }
            }

            const result = await window.electronAPI.audio.play();
            if (result) {
                this.isPlaying = true;
                this.emit('playbackStateChanged', 'playing');
            }
            return result;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    async pause() {
        try {
            if (this.audioEngine) {
                const result = this.audioEngine.pause();
                if (result) {
                    // 不在这里手动设置状态，让音频引擎的事件回调来处理

                    // 同步到主进程
                    await window.electronAPI.audio.pause();
                    return true;
                } else {
                    console.log('❌ API: Web Audio Engine 暂停失败');
                }
            }

            const result = await window.electronAPI.audio.pause();
            if (result) {
                this.isPlaying = false;
                this.emit('playbackStateChanged', 'paused');
            }
            return result;
        } catch (error) {
            console.error('Failed to pause:', error);
            return false;
        }
    }

    async stop() {
        try {
            const result = await window.electronAPI.audio.stop();
            if (result) {
                this.isPlaying = false;
                this.position = 0;
                this.emit('playbackStateChanged', 'stopped');
                this.emit('positionChanged', 0);
            }
            return result;
        } catch (error) {
            console.error('Failed to stop:', error);
            return false;
        }
    }

    async seek(position) {
        try {
            if (this.audioEngine) {
                const result = await this.audioEngine.seek(position);
                if (result) {
                    this.position = position;
                    this.emit('positionChanged', position);

                    // 同步到主进程
                    await window.electronAPI.audio.seek(position);
                    return true;
                }
            }

            const result = await window.electronAPI.audio.seek(position);
            if (result) {
                this.position = position;
                this.emit('positionChanged', position);
            }
            return result;
        } catch (error) {
            console.error('❌ API: seek 失败:', error);
            return false;
        }
    }

    // 设置播放位置
    // seek的别名
    async setPosition(position) {
        console.log('API: setPosition 被调用，位置:', position);
        return await this.seek(position);
    }

    // 快进
    async seekForward(seconds = 10) {
        try {
            const currentPosition = this.getPosition();
            const duration = this.getDuration();

            if (!duration || duration <= 0) {
                console.warn('⚠️ 无法获取音频时长，跳过快进操作');
                return false;
            }

            // 计算新位置，确保不超过音频总时长
            const newPosition = Math.min(currentPosition + seconds, duration - 0.1);
            return await this.seek(newPosition);
        } catch (error) {
            console.error('❌ 快进失败:', error);
            return false;
        }
    }

    // 回退
    async seekBackward(seconds = 10) {
        try {
            const currentPosition = this.getPosition();

            // 计算新位置，确保不小于0
            const newPosition = Math.max(currentPosition - seconds, 0);
            return await this.seek(newPosition);
        } catch (error) {
            console.error('❌ 回退失败:', error);
            return false;
        }
    }

    async setVolume(volume) {
        try {
            if (this.audioEngine) {
                const result = this.audioEngine.setVolume(volume);
                if (result) {
                    this.volume = volume;
                    this.emit('volumeChanged', volume);
                    // 同步到主进程
                    await window.electronAPI.audio.setVolume(volume);
                    return true;
                }
            }

            await window.electronAPI.audio.setVolume(volume);
            this.volume = volume;
            this.emit('volumeChanged', volume);
            return true;
        } catch (error) {
            console.error('Failed to set volume:', error);
            return false;
        }
    }

    getVolume() {
        return this.volume;
    }

    getPosition() {
        try {
            this.position = this.audioEngine.getPosition();
            return this.position;
        } catch (error) {
            console.error('Failed to get position:', error);
            return this.position;
        }
    }

    getCurrentTrack() {
        try {
            this.currentTrack = this.audioEngine.getCurrentTrack();
            return this.currentTrack;
        } catch (error) {
            console.error('Failed to get track:', error);
            return this.currentTrack;
        }
    }

    getDuration() {
        try {
            this.duration = this.audioEngine.getDuration();
            return this.duration;
        } catch (error) {
            console.error('Failed to get duration:', error);
            return this.duration;
        }
    }

    // Playlist Methods
    async setPlaylist(tracks, startIndex = -1) {
        try {
            console.log(`🔄 API: 设置播放列表，${tracks.length}首歌曲，起始索引: ${startIndex}`);
            if (this.audioEngine) {
                const result = this.audioEngine.setPlaylist(tracks, startIndex);
                if (result) {
                    this.playlist = tracks;
                    this.currentIndex = startIndex;

                    console.log(`✅ API: 播放列表设置成功，当前索引: ${this.currentIndex}`);
                    this.emit('playlistChanged', tracks);
                    this.emit('trackIndexChanged', this.currentIndex);

                    // 播放列表变更时保存状态
                    this.saveCurrentPlaybackState();

                    // 同步到主进程
                    await window.electronAPI.audio.setPlaylist(tracks);
                    return true;
                }
            }

            await window.electronAPI.audio.setPlaylist(tracks);
            this.playlist = tracks;
            this.currentIndex = startIndex;
            this.emit('playlistChanged', tracks);
            this.emit('trackIndexChanged', this.currentIndex);

            // 播放列表变更时保存状态
            this.saveCurrentPlaybackState();
            return true;
        } catch (error) {
            console.error('Failed to set playlist:', error);
            return false;
        }
    }

    async nextTrack() {
        try {
            // 防止快速切换时的竞态条件
            if (this._trackSwitchLock) {
                return false;
            }

            if (this.playlist.length === 0) {
                return false;
            }

            // 设置切换锁
            this._trackSwitchLock = true;

            // 根据播放模式获取下一首的索引
            const nextIndex = this.getNextTrackIndex();
            if (nextIndex === -1) {
                console.log('⚠️ 无法获取下一首歌曲索引');
                this._trackSwitchLock = false;
                return false;
            }

            const nextTrack = this.playlist[nextIndex];
            if (!nextTrack) {
                console.log('⚠️ 下一首歌曲不存在');
                this._trackSwitchLock = false;
                return false;
            }

            if (this.audioEngine) {
                // 将计算好的nextIndex传递给音频引擎
                const result = await this.audioEngine.nextTrack(nextIndex);
                if (result) {
                    // 更新API状态
                    this.currentIndex = this.audioEngine.currentIndex;
                    this.currentTrack = this.audioEngine.getCurrentTrack();
                    this.duration = this.audioEngine.getDuration();
                    this.position = 0;
                    this.isPlaying = this.audioEngine.isPlaying;

                    // 手动切换时，onTrackChanged回调已经在nextTrack()内部被触发
                    // 由于回调中会检查索引是否变化，这里的emit不会导致重复的trackIndexChanged
                    // 但trackChanged会重复触发，这是可以接受的（UI更新是幂等的）
                    this.emit('trackIndexChanged', this.currentIndex);
                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('playbackStateChanged', this.isPlaying ? 'playing' : 'paused');

                    // 释放切换锁
                    this._trackSwitchLock = false;
                    return true;
                }
            }

            this.currentIndex = nextIndex;
            this.currentTrack = nextTrack;
            this.emit('trackIndexChanged', this.currentIndex);
            this.emit('trackChanged', this.currentTrack);

            // 释放切换锁
            this._trackSwitchLock = false;
            return true;
        } catch (error) {
            console.error('Failed to go to next track:', error);
            // 确保在异常情况下也释放锁
            this._trackSwitchLock = false;
            return false;
        }
    }

    async previousTrack() {
        try {
            // 防止快速切换时的竞态条件
            if (this._trackSwitchLock) {
                return false;
            }

            if (this.playlist.length === 0) {
                return false;
            }

            // 设置切换锁
            this._trackSwitchLock = true;

            // 根据播放模式获取上一首的索引
            const prevIndex = this.getPreviousTrackIndex();
            if (prevIndex === -1) {
                console.log('⚠️ 无法获取上一首歌曲索引');
                this._trackSwitchLock = false;
                return false;
            }

            const prevTrack = this.playlist[prevIndex];
            if (!prevTrack) {
                console.log('⚠️ 上一首歌曲不存在');
                this._trackSwitchLock = false;
                return false;
            }

            if (this.audioEngine) {
                // 将计算好的prevIndex传递给音频引擎
                const result = await this.audioEngine.previousTrack(prevIndex);
                if (result) {
                    // 更新API状态
                    this.currentIndex = this.audioEngine.currentIndex;
                    this.currentTrack = this.audioEngine.getCurrentTrack();
                    this.duration = this.audioEngine.getDuration();
                    this.position = 0;
                    this.isPlaying = this.audioEngine.isPlaying;

                    this.emit('trackIndexChanged', this.currentIndex);
                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('playbackStateChanged', this.isPlaying ? 'playing' : 'paused');

                    // 释放切换锁
                    this._trackSwitchLock = false;
                    return true;
                }
            }

            this.currentIndex = prevIndex;
            this.currentTrack = prevTrack;
            this.emit('trackIndexChanged', this.currentIndex);
            this.emit('trackChanged', this.currentTrack);

            // 释放切换锁
            this._trackSwitchLock = false;
            return true;
        } catch (error) {
            console.error('Failed to go to previous track:', error);
            // 确保在异常情况下也释放锁
            this._trackSwitchLock = false;
            return false;
        }
    }

    async scanDirectory(path) {
        try {
            const result = await window.electronAPI.library.scanDirectory(path);
            if (result) {
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('Failed to scan directory:', error);
            return false;
        }
    }

    async scanNetworkDrive(driveId, relativePath = '/') {
        try {
            const result = await window.electronAPI.library.scanNetworkDrive(driveId, relativePath);
            if (result) {
                // 刷新音乐库列表
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('❌ 网络磁盘扫描失败:', error);
            return false;
        }
    }

    async addTrackToLibrary(audioFile) {
        try {
            const result = await window.electronAPI.library.addTrackToLibrary(audioFile);
            if (result && result.success) {
                // 关键步骤：与扫描文件夹功能保持一致，重新获取最新数据
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('❌ [API] 添加文件到音乐库失败:', error);
            return {success: false, error: error.message};
        }
    }

    // 音乐库缓存方法
    async loadCachedTracks() {
        try {
            const tracks = await window.electronAPI.library.loadCachedTracks();
            if (tracks && tracks.length > 0) {
                // 注意：这里不触发libraryUpdated，避免重复的封面查找
                // libraryUpdated事件应该只在真正的库更新时触发
                return tracks;
            } else {
                return [];
            }
        } catch (error) {
            console.error('❌ 加载缓存音乐库失败:', error);
            return [];
        }
    }

    async validateCache() {
        try {
            // 设置验证进度监听器
            const progressListener = window.electronAPI.library.onCacheValidationProgress((progress) => {
                this.emit('cacheValidationProgress', progress);
            });

            const result = await window.electronAPI.library.validateCache();

            // 移除进度监听器
            if (progressListener) {
                progressListener();
            }

            if (result) {
                console.log(`✅ 缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`);
                this.emit('cacheValidationCompleted', result);

                // 只有在真正有变化时才触发libraryUpdated事件
                if (result.tracks && result.invalid > 0) {
                    this.emit('libraryUpdated', result.tracks);
                }
                return result;
            } else {
                throw new Error('缓存验证失败');
            }
        } catch (error) {
            console.error('❌ 缓存验证失败:', error);
            this.emit('cacheValidationError', error.message);
            return null;
        }
    }

    async clearCache() {
        try {
            const success = await window.electronAPI.library.clearCache();
            if (success) {
                this.emit('libraryUpdated', []);
                return true;
            } else {
                throw new Error('清空缓存失败');
            }
        } catch (error) {
            console.error('❌ 清空缓存失败:', error);
            return false;
        }
    }

    // 歌单封面管理方法
    async updatePlaylistCover(playlistId, imagePath) {
        const result = await window.electronAPI.library.updatePlaylistCover(playlistId, imagePath);
        if (result.success) {
            this.emit('playlistCoverUpdated', {playlistId, imagePath});
            return {success: true};
        } else {
            return {success: false, error: '更新歌单封面失败'};
        }
    }

    async getPlaylistCover(playlistId) {
        const result = await window.electronAPI.library.getPlaylistCover(playlistId);
        if (result.success) {
            return {success: true, coverPath: result.coverPath};
        } else {
            return {success: false, error: '获取歌单封面失败'};
        }
    }

    async removePlaylistCover(playlistId) {
        const result = await window.electronAPI.library.removePlaylistCover(playlistId);
        if (result.success) {
            this.emit('playlistCoverRemoved', {playlistId});
            return {success: true};
        } else {
            return {success: false, error: '移除歌单封面失败'};
        }
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    setPlayMode(mode) {
        const validModes = ['sequence', 'shuffle', 'repeat-one'];
        if (validModes.includes(mode)) {
            this.playMode = mode;
            this.emit('playModeChanged', mode);
            cacheManager.setLocalCache('playMode', mode);
            return true;
        }
        return false;
    }

    getPlayMode() {
        return this.playMode;
    }

    togglePlayMode() {
        const modes = ['sequence', 'shuffle', 'repeat-one'];
        const currentIndex = modes.indexOf(this.playMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setPlayMode(modes[nextIndex]);
        return this.playMode;
    }

    getNextTrackIndex() {
        if (this.playlist.length === 0) return -1;

        switch (this.playMode) {
            case 'sequence':
                return (this.currentIndex + 1) % this.playlist.length;
            case 'shuffle':
                // 随机选择一个不同的索引
                if (this.playlist.length === 1) return 0;
                let randomIndex = Math.floor(Math.random() * this.playlist.length);
                while (randomIndex === this.currentIndex) {
                    randomIndex = Math.floor(Math.random() * this.playlist.length);
                }
                return randomIndex;
            case 'repeat-one':
                return this.currentIndex;
            default:
                return (this.currentIndex + 1) % this.playlist.length;
        }
    }

    getPreviousTrackIndex() {
        if (this.playlist.length === 0) return -1;

        switch (this.playMode) {
            case 'sequence':
                return this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
            case 'shuffle':
                // 随机选择一个不同的索引
                if (this.playlist.length === 1) return 0;
                let randomIndex = Math.floor(Math.random() * this.playlist.length);
                while (randomIndex === this.currentIndex) {
                    randomIndex = Math.floor(Math.random() * this.playlist.length);
                }
                return randomIndex;
            case 'repeat-one':
                return this.currentIndex;
            default:
                return this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        }
    }

    updateTrackDuration(filePath, duration) {
        // 更新当前播放列表中的时长信息
        if (this.playlist && this.playlist.length > 0) {
            const track = this.playlist.find(t => t.filePath === filePath);
            if (track) {
                track.duration = duration;
                this.emit('playlistChanged', this.playlist);
            }
        }

        // 触发全局时长更新事件，让应用层更新音乐库
        this.emit('libraryTrackDurationUpdated', {filePath, duration});
    }

    // 获取均衡器实例
    getEqualizer() {
        if (this.audioEngine) {
            return this.audioEngine.getEqualizer();
        }
        return null;
    }

    // 启用/禁用均衡器
    setEqualizerEnabled(enabled) {
        if (this.audioEngine) {
            this.audioEngine.setEqualizerEnabled(enabled);
        }
    }

    // 设置无间隙播放状态
    setGaplessPlayback(enabled) {
        if (this.audioEngine) {
            this.audioEngine.setGaplessPlayback(enabled);
            console.log(`🎵 API: 无间隙播放${enabled ? '启用' : '禁用'}`);
        }
    }

    // 获取无间隙播放状态
    getGaplessPlayback() {
        if (this.audioEngine) {
            return this.audioEngine.getGaplessPlayback();
        }
        return false;
    }

    // 切换音频引擎
    async switchAudioEngine(engineType) {
        if (!this.audioEngine) {
            console.error('❌ API: 音频引擎未初始化');
            return false;
        }

        console.log(`🔄 API: 切换音频引擎到 ${engineType}`);
        const result = await this.audioEngine.switchEngine(engineType);

        if (result) {
            console.log(`✅ API: 音频引擎切换成功`);
            // 更新设置
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            settings.exclusiveMode = (engineType === 'wasapi');
            cacheManager.setLocalCache('musicbox-settings', settings);
        } else {
            console.error(`❌ API: 音频引擎切换失败`);
        }

        return result;
    }

    // 获取当前引擎类型
    getAudioEngineType() {
        return this.audioEngine?.getEngineType() || 'unknown';
    }

    // 桌面歌词同步方法
    async syncToDesktopLyrics(type, data) {
        try {
            switch (type) {
                case 'track':
                    await window.electronAPI.desktopLyrics.updateTrack(data);
                    // 如果歌曲变化，也需要更新歌词
                    if (data && data.lyrics) {
                        await window.electronAPI.desktopLyrics.updateLyrics(data.lyrics);
                    } else if (data && data.title && data.artist) {
                        // 尝试获取歌词
                        await this.loadLyricsForDesktop(data);
                    }
                    break;
                case 'playbackState':
                    await window.electronAPI.desktopLyrics.updatePlaybackState(data);
                    break;
                case 'position':
                    await window.electronAPI.desktopLyrics.updatePosition(data);
                    break;
                case 'lyrics':
                    await window.electronAPI.desktopLyrics.updateLyrics(data);
                    break;
            }
        } catch (error) {
            console.error('❌ 桌面歌词同步失败:', error);
        }
    }

    async loadLyricsForDesktop(track) {
        try {
            const lyricsResult = await lyricsAPI.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                const parsedLyrics = lyricsAPI.parseLRC(lyricsResult.lrc);
                await this.syncToDesktopLyrics('lyrics', parsedLyrics);
            }
        } catch (error) {
            console.error('❌ 为桌面歌词加载歌词失败:', error);
        }
    }

    // 桌面歌词控制方法
    async toggleDesktopLyrics() {
        try {
            const result = await window.electronAPI.desktopLyrics.toggle();
            if (result.success && result.visible) {
                // 如果显示了桌面歌词，同步当前状态
                await this.syncCurrentStateToDesktopLyrics();
            }
            return result;
        } catch (error) {
            console.error('❌ 切换桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    // 节流保存播放位置
    throttledSavePosition(position) {
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};

        // 只有启用记住播放位置时才保存
        if (!settings.rememberPosition) return;

        // 清除之前的定时器
        if (this.savePositionTimeout) {
            clearTimeout(this.savePositionTimeout);
        }

        // 设置新的定时器，2秒后保存
        this.savePositionTimeout = setTimeout(() => {
            try {
                const playbackState = {
                    currentTrack: this.currentTrack,
                    position: position,
                    isPlaying: this.isPlaying,
                    playlist: this.playlist,
                    currentIndex: this.currentIndex,
                    playMode: this.playMode,
                    timestamp: Date.now()
                };

                cacheManager.setLocalCache('playback-state', playbackState);
            } catch (error) {
                console.error('❌ API: 保存播放位置失败:', error);
            }
        }, 2000);
    }

    // 立即保存当前播放状态
    saveCurrentPlaybackState() {
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};

        // 只有启用记住播放位置时才保存
        if (!settings.rememberPosition) {
            return;
        }

        try {
            const playbackState = {
                currentTrack: this.currentTrack,
                position: this.position,
                isPlaying: this.isPlaying,
                playlist: this.playlist,
                currentIndex: this.currentIndex,
                playMode: this.playMode,
                timestamp: Date.now()
            };

            console.log('💾 API: 保存播放状态:', {
                hasTrack: !!this.currentTrack,
                trackTitle: this.currentTrack?.title,
                position: this.position,
                isPlaying: this.isPlaying,
                playlistLength: this.playlist.length,
                currentIndex: this.currentIndex,
                playMode: this.playMode
            });

            cacheManager.setLocalCache('playback-state', playbackState);
            console.log('✅ API: 播放状态已保存（包含播放列表）');
        } catch (error) {
            console.error('❌ API: 保存播放状态失败:', error);
        }
    }

    async syncCurrentStateToDesktopLyrics() {
        try {
            // 同步当前歌曲信息
            if (this.currentTrack) {
                await this.syncToDesktopLyrics('track', this.currentTrack);
            }

            // 同步播放状态
            await this.syncToDesktopLyrics('playbackState', {
                isPlaying: this.isPlaying,
                position: this.position
            });

            // 同步播放进度
            await this.syncToDesktopLyrics('position', this.position);
        } catch (error) {
            console.error('❌ 同步当前状态到桌面歌词失败:', error);
        }
    }

    async showDesktopLyrics() {
        try {
            const result = await window.electronAPI.desktopLyrics.show();
            if (result.success) {
                await this.syncCurrentStateToDesktopLyrics();
            }
            return result;
        } catch (error) {
            console.error('❌ 显示桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async hideDesktopLyrics() {
        try {
            return await window.electronAPI.desktopLyrics.hide();
        } catch (error) {
            console.error('❌ 隐藏桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async isDesktopLyricsVisible() {
        try {
            return await window.electronAPI.desktopLyrics.isVisible();
        } catch (error) {
            console.error('❌ 检查桌面歌词状态失败:', error);
            return false;
        }
    }

    destroy() {
        this.stopProgressTracking();
        this.removeAllListeners();
    }
}

let api = new MusicBoxAPI();
export {api};
