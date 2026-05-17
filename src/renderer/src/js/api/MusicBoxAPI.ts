import {EventEmitter} from '@utils/index.js';
import {audioGateway} from '@js/infrastructure/electron/AudioGateway';
import {cacheManager} from "@services/CacheManager";
import {PlaybackQueue} from '@js/features/playback/domain';
import {AudioEngineAdapter} from '@js/features/playback/service/AudioEngineAdapter';
import type {AudioEngineManagerBridge, AudioEngineType} from '@js/features/playback/service/AudioEngineAdapter';
import {PlaybackPersistence} from '@js/features/playback/service/PlaybackPersistence';
import {PlaybackStateSynchronizer} from '@js/features/playback/service/PlaybackStateSynchronizer';
import {DesktopLyricsSync} from '@js/features/desktopLyrics/service/DesktopLyricsSync';
import {LibraryBridge} from '@js/features/library/service/LibraryBridge';
import type {Result} from '@api/types/common';
import type {CacheValidationResult} from '@api/types/events';
import type {DesktopLyricsPlaybackState, PlayMode, PlaybackStateName} from '@api/types/playback';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsSettings, MusicBoxSettings, WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';

export class MusicBoxAPI extends EventEmitter {
    isInitialized: boolean;
    currentTrack: Track | null;
    isPlaying: boolean;
    volume: number;
    position: number;
    duration: number;
    playlist: Track[];
    currentIndex: number;
    queue: PlaybackQueue;
    playMode: PlayMode;
    playbackPersistence: PlaybackPersistence;
    playbackStateSynchronizer: PlaybackStateSynchronizer;
    desktopLyricsSync: DesktopLyricsSync;
    audioEngineAdapter: AudioEngineAdapter;
    libraryBridge: LibraryBridge;
    progressInterval: ReturnType<typeof setInterval> | null;
    audioEngine: AudioEngineManagerBridge | null;
    audioEngineReady: Promise<void>;
    _trackSwitchLock: boolean;
    _lyricsRequestLock: Set<string>;

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
        this.playbackStateSynchronizer = new PlaybackStateSynchronizer({
            getAudioEngine: () => this.audioEngine,
            getState: () => ({
                currentTrack: this.currentTrack,
                duration: this.duration,
                currentIndex: this.currentIndex,
                position: this.position,
                isPlaying: this.isPlaying
            }),
            setState: (state) => {
                if ('currentTrack' in state) this.currentTrack = state.currentTrack ?? null;
                if (typeof state.duration === 'number') this.duration = state.duration;
                if (typeof state.currentIndex === 'number') this.currentIndex = state.currentIndex;
                if (typeof state.position === 'number') this.position = state.position;
                if (typeof state.isPlaying === 'boolean') this.isPlaying = state.isPlaying;
            }
        });
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
        this.audioEngineReady = Promise.resolve();

        // 音频切换锁，防止快速切换时的竞态条件
        this._trackSwitchLock = false;

        // 歌词获取去重机制
        this._lyricsRequestLock = new Set(); // 正在请求歌词的歌曲集合

        this.audioEngineReady = this.initializeWebAudio().then(() => {
            this.setupEventListeners();
        });
    }

    async initializeWebAudio(): Promise<void> {
        this.audioEngine = await this.audioEngineAdapter.initializeWebAudio();
    }

    setupEventListeners(): void {
        // 音频引擎事件监听
        const audioEngine = this.audioEngine;
        if (audioEngine) {
            audioEngine.onTrackChanged = async (track: unknown) => {
                const state = await audioEngine.getStateSnapshot();
                const syncResult = this.playbackStateSynchronizer.applyTrackChangedState(track, state);

                // 只有在引擎索引与API索引不一致时才同步（说明是引擎主动切换的，如自动播放下一首）
                if (syncResult.indexChanged) {
                    console.log(`🔄 API: 音频引擎主动切换歌曲，同步索引: ${syncResult.previousIndex} -> ${this.currentIndex}`);
                    this.emit('trackIndexChanged', this.currentIndex);
                }

                this.emit('trackChanged', this.currentTrack);
                await this.syncToDesktopLyrics('track', this.currentTrack);
                this.saveCurrentPlaybackState();
            };

            audioEngine.onPlaybackStateChanged = async (isPlaying: boolean) => {
                this.isPlaying = isPlaying;
                this.emit('playbackStateChanged', isPlaying ? 'playing' : 'paused');
                await this.syncToDesktopLyrics('playbackState', {isPlaying, position: this.position});
                this.saveCurrentPlaybackState();
            };

            audioEngine.onPositionChanged = async (position: number) => {
                this.position = position;
                this.emit('positionChanged', position);
                await this.syncToDesktopLyrics('position', position);
                this.throttledSavePosition(position);
            };

            audioEngine.onVolumeChanged = (volume: number) => {
                this.volume = volume;
                this.emit('volumeChanged', volume);
            };

            audioEngine.onDurationChanged = (filePath: string, duration: number) => {
                console.log('🎵 API: 音频时长更新:', filePath, duration.toFixed(2) + 's');
                this.updateTrackDuration(filePath, duration);
                this.emit('trackDurationUpdated', {filePath, duration});
            };
        } else {
            console.warn('⚠️ API: 音频引擎不可用，无法设置事件监听器');
        }

        // Electron IPC events（仅在音频引擎不可用时使用）
        if (audioGateway.isAvailable()) {
            audioGateway.onTrackChanged((track) => {
                if (!this.audioEngine) {
                    this.currentTrack = track;
                    this.emit('trackChanged', track);
                }
            });

            audioGateway.onPlaybackStateChanged((state) => {
                if (!this.audioEngine) {
                    this.isPlaying = state === 'playing';
                    this.emit('playbackStateChanged', state as PlaybackStateName);
                }
            });

            audioGateway.onPositionChanged((position) => {
                if (!this.audioEngine) {
                    this.position = position;
                    this.emit('positionChanged', position);
                }
            });
        }

        this.libraryBridge.bindEvents();
    }

    // Audio Engine Methods
    async initializeAudio(): Promise<boolean> {
        try {
            await this.audioEngineReady;
            if (this.audioEngine) {
                this.isInitialized = true;
                return true;
            }

            const result = await audioGateway.init();
            this.isInitialized = result;
            return result;
        } catch (error) {
            console.error('Failed to initialize audio engine:', error);
            return false;
        }
    }

    async loadTrack(filePath: string): Promise<boolean> {
        try {
            await this.audioEngineReady;

            if (this.audioEngine) {
                const result = await this.audioEngine.loadTrack(filePath);
                if (result) {
                    // 记录加载前的索引，用于判断是否需要触发 trackIndexChanged
                    const previousIndex = this.currentIndex;
                    await this.playbackStateSynchronizer.syncFromEngine({position: 0});

                    //bug fix: #30 issue
                    // 如果当前索引是-1，尝试在播放列表中查找
                    // 注意：不要从audioEngine同步索引，因为setPlaylist已经设置了正确的索引
                    if (this.currentIndex === -1 && this.playlist.length > 0) {
                        this.currentIndex = this.playlist.findIndex((track) => {
                            const trackPath = track.filePath || track.path;
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

                    await this.playbackStateSynchronizer.syncFromEngine({position: 0});

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
                    return true;
                }

                return false;
            }

            const result = await audioGateway.loadTrack(filePath);
            if (result) {
                this.currentTrack = await audioGateway.getCurrentTrack();
                this.duration = await audioGateway.getDuration();
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

    async play(): Promise<boolean> {
        try {
            await this.audioEngineReady;

            if (this.audioEngine) {
                const hasLoadedTrack = await this.ensureAudioEngineTrackLoaded();
                if (!hasLoadedTrack) {
                    console.warn('⚠️ API: 没有可播放的已加载歌曲');
                    return false;
                }

                const result = await this.audioEngine.play();
                if (result) {
                    // 不在这里手动设置状态，让音频引擎的事件回调来处理
                    return true;
                } else {
                    console.log(`❌ API: ${this.getAudioEngineLabel()} 播放失败`);
                }

                return false;
            }

            const result = await audioGateway.play();
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

    private async ensureAudioEngineTrackLoaded(): Promise<boolean> {
        if (!this.audioEngine) {
            return true;
        }

        const state = await this.audioEngine.getStateSnapshot();
        if (state.currentTrack) {
            return true;
        }

        const track = this.getCurrentPlaybackTrack();
        const filePath = this.getTrackFilePath(track);
        if (!filePath) {
            return false;
        }

        console.log('🔄 API: 播放前补加载当前歌曲:', track?.title || filePath);
        const loadResult = await this.loadTrack(filePath);

        if (loadResult && this.position > 0) {
            await this.seek(this.position);
        }

        return loadResult;
    }

    private getCurrentPlaybackTrack(): Track | null {
        if (this.currentTrack) {
            return this.currentTrack;
        }

        if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
            return this.playlist[this.currentIndex];
        }

        return null;
    }

    private getTrackFilePath(track: Track | null | undefined): string | null {
        return track?.filePath || track?.path || null;
    }

    private getAudioEngineLabel(): string {
        return this.audioEngine?.getEngineType() === 'wasapi' ? 'WASAPI Engine' : 'Web Audio Engine';
    }

    async pause(): Promise<boolean> {
        try {
            if (this.audioEngine) {
                const result = await this.audioEngine.pause();
                if (result) {
                    // 不在这里手动设置状态，让音频引擎的事件回调来处理
                    return true;
                } else {
                    console.log(`❌ API: ${this.getAudioEngineLabel()} 暂停失败`);
                }

                return false;
            }

            const result = await audioGateway.pause();
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

    async stop(): Promise<boolean> {
        try {
            if (this.audioEngine) {
                const result = await this.audioEngine.stop();
                if (result) {
                    this.isPlaying = false;
                    this.position = 0;
                    this.emit('playbackStateChanged', 'stopped');
                    this.emit('positionChanged', 0);
                }
                return result;
            }

            const result = await audioGateway.stop();
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

    async seek(position: number): Promise<boolean> {
        try {
            if (this.audioEngine) {
                const result = await this.audioEngine.seek(position);
                if (result) {
                    this.position = position;
                    this.emit('positionChanged', position);
                    return true;
                }

                return false;
            }

            const result = await audioGateway.seek(position);
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
    async setPosition(position: number): Promise<boolean> {
        console.log('API: setPosition 被调用，位置:', position);
        return await this.seek(position);
    }

    // 快进
    async seekForward(seconds = 10): Promise<boolean> {
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
    async seekBackward(seconds = 10): Promise<boolean> {
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

    async setVolume(volume: number): Promise<boolean> {
        try {
            if (this.audioEngine) {
                const result = this.audioEngine.setVolume(volume);
                if (result) {
                    this.volume = volume;
                    this.emit('volumeChanged', volume);
                    return true;
                }

                return false;
            }

            await audioGateway.setVolume(volume);
            this.volume = volume;
            this.emit('volumeChanged', volume);
            return true;
        } catch (error) {
            console.error('Failed to set volume:', error);
            return false;
        }
    }

    getVolume(): number {
        return this.volume;
    }

    async getPosition(): Promise<number> {
        try {
            this.position = await this.audioEngine!.getPosition();
            return this.position;
        } catch (error) {
            console.error('Failed to get position:', error);
            return this.position;
        }
    }

    getCurrentTrack(): Track | null {
        try {
            this.currentTrack = this.audioEngine!.getCurrentTrack() as Track | null;
            return this.currentTrack;
        } catch (error) {
            console.error('Failed to get track:', error);
            return this.currentTrack;
        }
    }

    getDuration(): number {
        try {
            this.duration = this.audioEngine!.getDuration();
            return this.duration;
        } catch (error) {
            console.error('Failed to get duration:', error);
            return this.duration;
        }
    }

    // Playlist Methods
    async setPlaylist(tracks: Track[], startIndex = -1): Promise<boolean> {
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
                    return true;
                }

                return false;
            }

            await audioGateway.setPlaylist(tracks);
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

    async nextTrack(): Promise<boolean> {
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
                    await this.playbackStateSynchronizer.syncFromEngine({position: 0});

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

    async previousTrack(): Promise<boolean> {
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
                    await this.playbackStateSynchronizer.syncFromEngine({position: 0});

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

    async scanDirectory(path: string): Promise<boolean> {
        return await this.libraryBridge.scanDirectory(path);
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return await this.libraryBridge.scanNetworkDrive(driveId, relativePath);
    }

    async addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return await this.libraryBridge.addTrackToLibrary(audioFile);
    }

    // 音乐库缓存方法
    async loadCachedTracks(): Promise<Track[]> {
        return await this.libraryBridge.loadCachedTracks();
    }

    async validateCache(): Promise<CacheValidationResult | null> {
        return await this.libraryBridge.validateCache();
    }

    async clearCache(): Promise<boolean> {
        return await this.libraryBridge.clearCache();
    }

    // 歌单封面管理方法
    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        return await this.libraryBridge.updatePlaylistCover(playlistId, imagePath);
    }

    async getPlaylistCover(playlistId: string): Promise<{success: boolean; coverPath?: string; error?: string}> {
        return await this.libraryBridge.getPlaylistCover(playlistId);
    }

    async removePlaylistCover(playlistId: string): Promise<Result> {
        return await this.libraryBridge.removePlaylistCover(playlistId);
    }

    stopProgressTracking(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    setPlayMode(mode: unknown): boolean {
        const changed = this.queue.setPlayMode(mode);
        this.playMode = this.queue.getPlayMode();
        return changed;
    }

    getPlayMode(): PlayMode {
        return this.queue.getPlayMode();
    }

    togglePlayMode(): PlayMode {
        this.playMode = this.queue.togglePlayMode();
        return this.playMode;
    }

    getNextTrackIndex(): number {
        return this.queue.getNextTrackIndex(this.playlist, this.currentIndex);
    }

    getPreviousTrackIndex(): number {
        return this.queue.getPreviousTrackIndex(this.playlist, this.currentIndex);
    }

    updateTrackDuration(filePath: string, duration: number): void {
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
    getEqualizer(): unknown {
        if (this.audioEngine) {
            return this.audioEngine.getEqualizer();
        }
        return null;
    }

    // 启用/禁用均衡器
    setEqualizerEnabled(enabled: boolean): void {
        if (this.audioEngine) {
            this.audioEngine.setEqualizerEnabled(enabled);
        }
    }

    // 设置无间隙播放状态
    setGaplessPlayback(enabled: boolean): void {
        if (this.audioEngine) {
            this.audioEngine.setGaplessPlayback(enabled);
            console.log(`🎵 API: 无间隙播放${enabled ? '启用' : '禁用'}`);
        }
    }

    // 获取无间隙播放状态
    getGaplessPlayback(): boolean {
        if (this.audioEngine) {
            return this.audioEngine.getGaplessPlayback();
        }
        return false;
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        const result = await this.audioEngineAdapter.switchAudioEngine(engineType);
        if (result) {
            this.emit('audioEngineChanged', {
                engineType: this.audioEngineAdapter.getAudioEngineType()
            });
        }

        return result;
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        return await this.audioEngineAdapter.switchWasapiShareMode(mode);
    }

    getAudioEngineType(): string {
        return this.audioEngineAdapter.getAudioEngineType();
    }

    async syncToDesktopLyrics(
        type: 'track' | 'playbackState' | 'position' | 'lyrics',
        data: Track | DesktopLyricsPlaybackState | number | LyricLine[] | string | null
    ): Promise<void> {
        return await this.desktopLyricsSync.syncToDesktopLyrics(type, data);
    }

    async loadLyricsForDesktop(track: Track): Promise<void> {
        return await this.desktopLyricsSync.loadLyricsForDesktop(track);
    }

    async toggleDesktopLyrics(): Promise<{success: boolean; visible?: boolean; error?: string}> {
        return await this.desktopLyricsSync.toggleDesktopLyrics();
    }

    throttledSavePosition(position: number): void {
        this.playbackPersistence.throttledSavePosition(position);
    }

    saveCurrentPlaybackState(): void {
        this.playbackPersistence.saveCurrentPlaybackState();
    }

    async syncCurrentStateToDesktopLyrics(): Promise<void> {
        return await this.desktopLyricsSync.syncCurrentStateToDesktopLyrics();
    }

    async hideDesktopLyrics(): Promise<Result> {
        return await this.desktopLyricsSync.hideDesktopLyrics();
    }

    async isDesktopLyricsVisible(): Promise<boolean> {
        return await this.desktopLyricsSync.isDesktopLyricsVisible();
    }

    async updateDesktopLyricsSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return await this.desktopLyricsSync.updateDesktopLyricsSettings(settings);
    }

    destroy(): void {
        this.stopProgressTracking();
        this.removeAllListeners();
    }
}

export const api = new MusicBoxAPI();
