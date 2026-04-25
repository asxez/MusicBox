import {EventEmitter} from '@utils';
import {cacheManager} from "@services/CacheManager";
import {PlaybackQueue} from './playback/PlaybackQueue.js';
import {PlaybackPersistence} from './playback/PlaybackPersistence.js';
import {DesktopLyricsSync} from './desktopLyrics/DesktopLyricsSync.js';
import {AudioEngineAdapter} from './audio/AudioEngineAdapter.js';
import {LibraryBridge} from './library/LibraryBridge.js';

export class MusicBoxAPI extends EventEmitter {
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
        this.queue = new PlaybackQueue({
            emit: (event, data) => this.emit(event, data),
            persistPlayMode: (mode) => cacheManager.setLocalCache('playMode', mode)
        });
        this.playMode = this.queue.getPlayMode();
        this.playbackPersistence = new PlaybackPersistence({
            getPlaybackState: () => ({
                currentTrack: this.currentTrack,
                position: this.position,
                isPlaying: this.isPlaying,
                playlist: this.playlist,
                currentIndex: this.currentIndex,
                playMode: this.playMode
            })
        });
        this.desktopLyricsSync = new DesktopLyricsSync({
            getCurrentState: () => ({
                currentTrack: this.currentTrack,
                isPlaying: this.isPlaying,
                position: this.position
            })
        });
        this.audioEngineAdapter = new AudioEngineAdapter({
            getNextTrackIndex: () => this.getNextTrackIndex(),
            getPreviousTrackIndex: () => this.getPreviousTrackIndex()
        });
        this.libraryBridge = new LibraryBridge({
            emit: (event, data) => this.emit(event, data)
        });

        // 进度跟踪
        this.progressInterval = null;

        // 音频引擎
        this.audioEngine = null;

        // 音频切换锁，防止快速切换时的竞态条件
        this._trackSwitchLock = false;

        // 歌词获取去重机制
        this._lyricsRequestLock = new Set(); // 正在请求歌词的歌曲集合

        this.initializeWebAudio().then(() => {
            this.setupEventListeners();
        });
    }

    async initializeWebAudio() {
        this.audioEngine = await this.audioEngineAdapter.initializeWebAudio();
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

        this.libraryBridge.bindEvents();
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
                const result = await this.audioEngine.pause();
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
            this.queue.clearHistory();

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

            // 将当前索引加入播放历史（在切换到下一首之前）
            this.queue.pushHistory(this.currentIndex);

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
            this.queue.removeLastHistoryIndexIfMatches(prevIndex);

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
        return await this.libraryBridge.scanDirectory(path);
    }

    async scanNetworkDrive(driveId, relativePath = '/') {
        return await this.libraryBridge.scanNetworkDrive(driveId, relativePath);
    }

    async addTrackToLibrary(audioFile) {
        return await this.libraryBridge.addTrackToLibrary(audioFile);
    }

    // 音乐库缓存方法
    async loadCachedTracks() {
        return await this.libraryBridge.loadCachedTracks();
    }

    async validateCache() {
        return await this.libraryBridge.validateCache();
    }

    async clearCache() {
        return await this.libraryBridge.clearCache();
    }

    // 歌单封面管理方法
    async updatePlaylistCover(playlistId, imagePath) {
        return await this.libraryBridge.updatePlaylistCover(playlistId, imagePath);
    }

    async getPlaylistCover(playlistId) {
        return await this.libraryBridge.getPlaylistCover(playlistId);
    }

    async removePlaylistCover(playlistId) {
        return await this.libraryBridge.removePlaylistCover(playlistId);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    setPlayMode(mode) {
        const changed = this.queue.setPlayMode(mode);
        this.playMode = this.queue.getPlayMode();
        return changed;
    }

    getPlayMode() {
        return this.queue.getPlayMode();
    }

    togglePlayMode() {
        this.playMode = this.queue.togglePlayMode();
        return this.playMode;
    }

    getNextTrackIndex() {
        return this.queue.getNextTrackIndex(this.playlist, this.currentIndex);
    }

    getPreviousTrackIndex() {
        return this.queue.getPreviousTrackIndex(this.playlist, this.currentIndex);
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

    async switchAudioEngine(engineType) {
        return await this.audioEngineAdapter.switchAudioEngine(engineType);
    }

    async switchWasapiShareMode(mode) {
        return await this.audioEngineAdapter.switchWasapiShareMode(mode);
    }

    getAudioEngineType() {
        return this.audioEngineAdapter.getAudioEngineType();
    }

    async syncToDesktopLyrics(type, data) {
        return await this.desktopLyricsSync.syncToDesktopLyrics(type, data);
    }

    async loadLyricsForDesktop(track) {
        return await this.desktopLyricsSync.loadLyricsForDesktop(track);
    }

    async toggleDesktopLyrics() {
        return await this.desktopLyricsSync.toggleDesktopLyrics();
    }

    throttledSavePosition(position) {
        this.playbackPersistence.throttledSavePosition(position);
    }

    saveCurrentPlaybackState() {
        this.playbackPersistence.saveCurrentPlaybackState();
    }

    async syncCurrentStateToDesktopLyrics() {
        return await this.desktopLyricsSync.syncCurrentStateToDesktopLyrics();
    }

    async hideDesktopLyrics() {
        return await this.desktopLyricsSync.hideDesktopLyrics();
    }

    async isDesktopLyricsVisible() {
        return await this.desktopLyricsSync.isDesktopLyricsVisible();
    }

    async updateDesktopLyricsSettings(settings) {
        return await this.desktopLyricsSync.updateDesktopLyricsSettings(settings);
    }

    destroy() {
        this.stopProgressTracking();
        this.removeAllListeners();
    }
}

export const api = new MusicBoxAPI();
