import {EventEmitter} from '@utils';
import {cacheManager} from "@services/CacheManager";
import {AudioEngineService, PlaybackPersistenceService, PlaybackStateStore, PlaylistService} from "@services/playback";
import {libraryAPI, lyricsAPI} from "@api/modules";
import {
    electronAudioAdapter,
    electronDesktopLyricsAdapter,
    electronLibraryAdapter,
    electronWindowAdapter
} from "@api/adapters";

class MusicBoxAPI extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.playbackState = new PlaybackStateStore();
        this.playbackPersistence = new PlaybackPersistenceService({
            cacheManager,
            delay: 2000,
            getState: () => this.getPlaybackState()
        });
        this.playlistService = new PlaylistService({
            getState: () => this.getPlaybackState(),
            setState: (state) => this.playbackState.update(state)
        });
        this.audioEngineService = new AudioEngineService({cacheManager});

        // 播放历史栈，用于实现真正的"上一首"功能
        Object.defineProperty(this, 'playHistory', {
            get: () => this.playlistService.playHistory,
            set: (history) => {
                this.playlistService.playHistory = history;
            }
        });

        // 进度跟踪
        this.progressInterval = null;

        // 播放位置保存节流

        // 音频引擎
        Object.defineProperty(this, 'audioEngine', {
            get: () => this.audioEngineService.engine,
            set: (audioEngine) => {
                this.audioEngineService.engine = audioEngine;
            }
        });

        // 音频切换锁，防止快速切换时的竞态条件
        this._trackSwitchLock = false;

        // 歌词获取去重机制
        this._lyricsRequestLock = new Set(); // 正在请求歌词的歌曲集合

        this.initializeWebAudio().then(() => {
            this.setupEventListeners();
        });
    }

    get currentTrack() {
        return this.playbackState.get('currentTrack');
    }

    set currentTrack(track) {
        this.playbackState.set('currentTrack', track);
    }

    get isPlaying() {
        return this.playbackState.get('isPlaying');
    }

    set isPlaying(isPlaying) {
        this.playbackState.set('isPlaying', isPlaying);
    }

    get volume() {
        return this.playbackState.get('volume');
    }

    set volume(volume) {
        this.playbackState.set('volume', volume);
    }

    get position() {
        return this.playbackState.get('position');
    }

    set position(position) {
        this.playbackState.set('position', position);
    }

    get duration() {
        return this.playbackState.get('duration');
    }

    set duration(duration) {
        this.playbackState.set('duration', duration);
    }

    get playlist() {
        return this.playbackState.get('playlist');
    }

    set playlist(playlist) {
        this.playbackState.set('playlist', playlist);
    }

    get currentIndex() {
        return this.playbackState.get('currentIndex');
    }

    set currentIndex(currentIndex) {
        this.playbackState.set('currentIndex', currentIndex);
    }

    get playMode() {
        return this.playbackState.get('playMode');
    }

    set playMode(playMode) {
        this.playbackState.set('playMode', playMode);
    }

    getPlaybackState() {
        return this.playbackState.getSnapshot();
    }

    async initializeWebAudio() {
        this.audioEngine = await this.audioEngineService.initialize();

        if (this.audioEngine) {
            this.audioEngine.getNextTrackIndex = () => this.getNextTrackIndex();
            this.audioEngine.getPreviousTrackIndex = () => this.getPreviousTrackIndex();
        }
    }


    setupEventListeners() {
        // 音频引擎事件监听
        if (this.audioEngine) {
            this.audioEngine.onTrackChanged = async (track) => {
                this.currentTrack = track;

                // 从音频引擎获取最新的索引
                // 只有在引擎索引与API索引不一致时才同步（说明是引擎主动切换的，如自动播放下一首）
                if (this.audioEngine.currentIndex !== this.currentIndex) {
                    const previousIndex = this.currentIndex;
                    this.currentIndex = this.audioEngine.currentIndex;
                    console.log(`🔄 API: 音频引擎主动切换歌曲，同步索引: ${previousIndex} -> ${this.currentIndex}`);
                    this.emit('trackIndexChanged', this.currentIndex);
                }

                this.emit('trackChanged', track);
                await this.syncToDesktopLyrics('track', track);
                this.saveCurrentPlaybackState();
            };

            this.audioEngine.onPlaybackStateChanged = async (isPlaying) => {
                this.isPlaying = isPlaying;
                this.emit('playbackStateChanged', isPlaying ? 'playing' : 'paused');
                await this.syncToDesktopLyrics('playbackState', {isPlaying, position: this.position});
                this.saveCurrentPlaybackState();
            };

            this.audioEngine.onPositionChanged = async (position) => {
                this.position = position;
                this.emit('positionChanged', position);
                await this.syncToDesktopLyrics('position', position);
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
        if (electronAudioAdapter.isAvailable()) {
            electronAudioAdapter.onTrackChanged((event, track) => {
                if (!this.audioEngine) {
                    this.currentTrack = track;
                    this.emit('trackChanged', track);
                }
            });

            electronAudioAdapter.onPlaybackStateChanged((event, state) => {
                if (!this.audioEngine) {
                    this.isPlaying = state === 'playing';
                    this.emit('playbackStateChanged', state);
                }
            });

            electronAudioAdapter.onPositionChanged((event, position) => {
                if (!this.audioEngine) {
                    this.position = position;
                    this.emit('positionChanged', position);
                }
            });
        }

        // Library events
        if (electronLibraryAdapter.isAvailable()) {
            electronLibraryAdapter.onLibraryUpdated((event, data) => {
                this.emit('libraryUpdated', data);
            });

            electronLibraryAdapter.onScanProgress((event, progress) => {
                this.emit('scanProgress', progress);
            });
        }
    }

    // Audio Engine Methods
    async initializeAudio() {
        try {
            const result = await electronAudioAdapter.init();
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

                    // 记录加载前的索引，用于判断是否需要触发 trackIndexChanged
                    const previousIndex = this.currentIndex;

                    //bug fix: #30 issue
                    // 如果当前索引是-1，尝试在播放列表中查找
                    // 注意：不要从audioEngine同步索引，因为setPlaylist已经设置了正确的索引
                    if (this.currentIndex === -1 && this.playlist.length > 0) {
                        this.currentIndex = this.playlist.findIndex(track => {
                            const trackPath = track.filePath || track.path || track;
                            return trackPath === filePath;
                        });

                        // 如果找到了，同步到音频引擎
                        if (this.currentIndex !== -1) {
                            this.audioEngine.currentIndex = this.currentIndex;
                        }
                    } else if (this.currentIndex !== -1) {
                        // 如果已经有正确的索引（由setPlaylist设置），同步到音频引擎
                        this.audioEngine.currentIndex = this.currentIndex;
                    }

                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);

                    // 只有在索引真正变化时才触发 trackIndexChanged，避免重复触发
                    if (previousIndex !== this.currentIndex) {
                        console.log(`🔄 API: loadTrack 索引变化: ${previousIndex} -> ${this.currentIndex}`);
                        this.emit('trackIndexChanged', this.currentIndex);
                    }

                    // 同步到桌面歌词
                    await this.syncToDesktopLyrics('track', this.currentTrack);

                    // 更新播放列表中的时长信息
                    this.updateTrackDuration(filePath, this.duration);
                    await electronAudioAdapter.loadTrack(filePath);
                    return true;
                }
            }

            const result = await electronAudioAdapter.loadTrack(filePath);
            if (result) {
                this.currentTrack = await electronAudioAdapter.getCurrentTrack();
                this.duration = await electronAudioAdapter.getDuration();
                this.position = 0;

                this.emit('trackChanged', this.currentTrack);
                this.emit('durationChanged', this.duration);
                this.emit('positionChanged', 0);

                // 同步到桌面歌词
                await this.syncToDesktopLyrics('track', this.currentTrack);
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
                    await electronAudioAdapter.play();
                    return true;
                } else {
                    console.log('❌ API: Web Audio Engine 播放失败');
                }
            }

            const result = await electronAudioAdapter.play();
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
                const result = await this.audioEngine.pause();
                if (result) {
                    // 不在这里手动设置状态，让音频引擎的事件回调来处理

                    // 同步到主进程
                    await electronAudioAdapter.pause();
                    return true;
                } else {
                    console.log('❌ API: Web Audio Engine 暂停失败');
                }
            }

            const result = await electronAudioAdapter.pause();
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
            const result = await electronAudioAdapter.stop();
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
                    await electronAudioAdapter.seek(position);
                    return true;
                }
            }

            const result = await electronAudioAdapter.seek(position);
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
            const currentPosition = await this.getPosition();
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
            const currentPosition = await this.getPosition();

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
                    await electronAudioAdapter.setVolume(volume);
                    return true;
                }
            }

            await electronAudioAdapter.setVolume(volume);
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

    async getPosition() {
        try {
            this.position = await this.audioEngine.getPosition();
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

            // 设置新播放列表时清空播放历史
            this.playlistService.clearHistory();

            if (this.audioEngine) {
                const result = this.audioEngine.setPlaylist(tracks, startIndex);
                if (result) {
                    this.playlistService.setPlaylist(tracks, startIndex);

                    console.log(`✅ API: 播放列表设置成功，当前索引: ${this.currentIndex}`);
                    this.emit('playlistChanged', tracks);
                    this.emit('trackIndexChanged', this.currentIndex);

                    // 播放列表变更时保存状态
                    this.saveCurrentPlaybackState();

                    // 同步到主进程
                    await electronAudioAdapter.setPlaylist(tracks);
                    return true;
                }
            }

            await electronAudioAdapter.setPlaylist(tracks);
            this.playlistService.setPlaylist(tracks, startIndex);
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

            // 将当前索引加入播放历史（在切换到下一首之前）
            this.playlistService.pushHistory(this.currentIndex);

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

            // 如果从播放历史中获取到了索引，需要从历史栈中移除
            this.playlistService.popHistoryIfMatches(prevIndex);

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
            const result = await electronLibraryAdapter.scanDirectory(path);
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
            const result = await electronLibraryAdapter.scanNetworkDrive(driveId, relativePath);
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
            const result = await electronLibraryAdapter.addTrackToLibrary(audioFile);
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
            const tracks = await electronLibraryAdapter.loadCachedTracks();
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
            const progressListener = electronLibraryAdapter.onCacheValidationProgress((progress) => {
                this.emit('cacheValidationProgress', progress);
            });

            const result = await electronLibraryAdapter.validateCache();

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
            const success = await electronLibraryAdapter.clearCache();
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
        const result = await electronLibraryAdapter.updatePlaylistCover(playlistId, imagePath);
        if (result.success) {
            this.emit('playlistCoverUpdated', {playlistId, imagePath});
            return {success: true};
        } else {
            return {success: false, error: '更新歌单封面失败'};
        }
    }

    async getPlaylistCover(playlistId) {
        const result = await electronLibraryAdapter.getPlaylistCover(playlistId);
        if (result.success) {
            return {success: true, coverPath: result.coverPath};
        } else {
            return {success: false, error: '获取歌单封面失败'};
        }
    }

    async removePlaylistCover(playlistId) {
        const result = await electronLibraryAdapter.removePlaylistCover(playlistId);
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
        if (this.playlistService.setPlayMode(mode)) {
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
        const mode = this.playlistService.togglePlayMode();
        this.emit('playModeChanged', mode);
        cacheManager.setLocalCache('playMode', mode);
        return mode;
    }

    getNextTrackIndex() {
        return this.playlistService.getNextTrackIndex();
    }

    getPreviousTrackIndex() {
        return this.playlistService.getPreviousTrackIndex();
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
        return this.audioEngineService.getEqualizer();
    }


    // 启用/禁用均衡器
    setEqualizerEnabled(enabled) {
        this.audioEngineService.setEqualizerEnabled(enabled);
    }


    // 设置无间隙播放状态
    setGaplessPlayback(enabled) {
        this.audioEngineService.setGaplessPlayback(enabled);
        console.log(`?? API: ?????${enabled ? '??' : '??'}`);
    }


    // 获取无间隙播放状态
    getGaplessPlayback() {
        return this.audioEngineService.getGaplessPlayback();
    }


    // 切换音频引擎
    async switchAudioEngine(engineType) {
        const result = await this.audioEngineService.switchEngine(engineType);

        if (result && this.audioEngine) {
            this.audioEngine.getNextTrackIndex = () => this.getNextTrackIndex();
            this.audioEngine.getPreviousTrackIndex = () => this.getPreviousTrackIndex();
            this.setupEventListeners();
        }

        return result;
    }


    // 切换WASAPI共享模式
    async switchWasapiShareMode(mode) {
        return this.audioEngineService.switchWasapiShareMode(mode);
    }


    // 获取当前引擎类型
    getAudioEngineType() {
        return this.audioEngineService.getEngineType();
    }


    // 桌面歌词同步方法
    async syncToDesktopLyrics(type, data) {
        try {
            switch (type) {
                case 'track':
                    await electronDesktopLyricsAdapter.updateTrack(data);
                    // 如果歌曲变化，也需要更新歌词
                    if (data && data.lyrics) {
                        await electronDesktopLyricsAdapter.updateLyrics(data.lyrics);
                    } else if (data && data.title && data.artist) {
                        // 尝试获取歌词
                        await this.loadLyricsForDesktop(data);
                    }
                    break;
                case 'playbackState':
                    await electronDesktopLyricsAdapter.updatePlaybackState(data);
                    break;
                case 'position':
                    await electronDesktopLyricsAdapter.updatePosition(data);
                    break;
                case 'lyrics':
                    await electronDesktopLyricsAdapter.updateLyrics(data);
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
                let parsedLyrics;

                // 支持所有歌词格式（与主窗口歌词页保持一致）
                if (lyricsResult.format === 'ttml' && lyricsResult.content) {
                    parsedLyrics = lyricsAPI.parseTTML(lyricsResult.content);
                    console.log('🎵 loadLyricsForDesktop: 解析 TTML 格式');
                } else if (lyricsResult.lrc) {
                    parsedLyrics = lyricsAPI.parseLRC(lyricsResult.lrc);
                    console.log('🎵 loadLyricsForDesktop: 解析 LRC 格式');
                } else if (lyricsResult.content) {
                    parsedLyrics = lyricsAPI.parse(lyricsResult.content, lyricsResult.format);
                    console.log('🎵 loadLyricsForDesktop: 解析其他格式:', lyricsResult.format);
                }

                if (parsedLyrics && parsedLyrics.length > 0) {
                    const updateResult = await this.syncToDesktopLyrics('lyrics', parsedLyrics);
                    console.log('🎵 loadLyricsForDesktop: syncToDesktopLyrics 结果', updateResult);

                    // 缓存歌词到track对象，避免重复加载
                    track.lyrics = parsedLyrics;
                    if (lyricsResult.lrc) {
                        track.lrcText = lyricsResult.lrc;
                    } else if (lyricsResult.content) {
                        track.lyricsContent = lyricsResult.content;
                        track.lyricsFormat = lyricsResult.format;
                    }
                }
            }
        } catch (error) {
            console.error('❌ 为桌面歌词加载歌词失败:', error);
        }
    }

    // 桌面歌词控制方法
    async toggleDesktopLyrics() {
        try {
            const result = await electronDesktopLyricsAdapter.toggle();
            if (result.success && result.visible) {
                // 如果显示了桌面歌词，同步当前状态
                await this.syncCurrentStateToDesktopLyrics();
                await electronWindowAdapter.setBackgroundThrottling(true);
            }
            await electronWindowAdapter.setBackgroundThrottling(false);
            return result;
        } catch (error) {
            console.error('❌ 切换桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    throttledSavePosition(position) {
        this.playbackPersistence.throttledSavePosition(position);
    }

    saveCurrentPlaybackState() {
        this.playbackPersistence.saveCurrentPlaybackState();
    }

    async syncCurrentStateToDesktopLyrics() {
        try {
            // 同步当前歌曲信息
            if (this.currentTrack) {
                const _updateTrackResult = await electronDesktopLyricsAdapter.updateTrack(this.currentTrack);

                // 确保歌词被加载并发送到桌面歌词窗口
                // 无论 track.lyrics 是否存在，都重新加载以确保桌面歌词窗口收到数据
                if (this.currentTrack.lyrics && this.currentTrack.lyrics.length > 0) {
                    // 如果歌词已缓存，直接发送
                    const updateLyricsResult = await electronDesktopLyricsAdapter.updateLyrics(this.currentTrack.lyrics);
                    console.log('🔄 syncCurrentStateToDesktopLyrics: updateLyrics 结果', updateLyricsResult);
                } else if (this.currentTrack.title && this.currentTrack.artist) {
                    // 否则重新加载歌词
                    await this.loadLyricsForDesktop(this.currentTrack);
                } else {
                    console.log('🔄 syncCurrentStateToDesktopLyrics: 无法加载歌词，缺少 title 或 artist');
                }
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

    async hideDesktopLyrics() {
        try {
            return await electronDesktopLyricsAdapter.hide();
        } catch (error) {
            console.error('❌ 隐藏桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async isDesktopLyricsVisible() {
        try {
            return await electronDesktopLyricsAdapter.isVisible();
        } catch (error) {
            console.error('❌ 检查桌面歌词状态失败:', error);
            return false;
        }
    }

    async updateDesktopLyricsSettings(settings) {
        try {
            return await electronDesktopLyricsAdapter.updateSettings(settings);
        } catch (error) {
            console.error('❌ 更新桌面歌词设置失败:', error);
            return {success: false, error: error.message};
        }
    }

    destroy() {
        this.playbackPersistence.destroy();
        this.stopProgressTracking();
        this.removeAllListeners();
    }
}

let api = new MusicBoxAPI();
export {api};
