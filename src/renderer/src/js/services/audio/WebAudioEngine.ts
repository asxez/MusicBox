/**
 * 基于 Web Audio API 的音频引擎
 */

import {
    getTrackFilePath,
    getTrackTitle,
    type AudioEngineState,
    type TrackSource
} from '@js/features/playback/service/audioEngine';
import WebAudioEqualizer from "@js/features/equalizer/service/WebAudioEqualizer";
import WebAudioCurrentTrackStore from "@services/audio/WebAudioCurrentTrackStore";
import {forceWebAudioGarbageCollection} from "@services/audio/WebAudioGarbageCollector";
import WebAudioMixerController from "@services/audio/WebAudioMixerController";
import WebAudioObjectUrlStore from "@services/audio/WebAudioObjectUrlStore";
import WebAudioPlaylistCoordinator from "@services/audio/WebAudioPlaylistCoordinator";
import WebAudioPreloadCoordinator from "@services/audio/WebAudioPreloadCoordinator";
import WebAudioSessionStore from "@services/audio/WebAudioSessionStore";
import WebAudioTrackLoader from "@services/audio/WebAudioTrackLoader";
import WebAudioTransportController from "@services/audio/WebAudioTransportController";
import type {WebAudioTrack} from "@services/audio/WebAudioTypes";
import WebAudioVisibilityCoordinator from "@services/audio/WebAudioVisibilityCoordinator";

class WebAudioEngine {
    public audioContext: AudioContext | null;
    private onEqualizerChanged: ((state: {enabled: boolean}) => void) | null;
    public onTrackChanged: ((track: WebAudioTrack | null) => void | Promise<void>) | null;
    public onPlaybackStateChanged: ((isPlaying: boolean) => void | Promise<void>) | null;
    public onPositionChanged: ((position: number) => void | Promise<void>) | null;
    public onVolumeChanged: ((volume: number) => void) | null;
    public getNextTrackIndex: (() => number) | null;
    public getPreviousTrackIndex: (() => number) | null;
    private preloadCoordinator: WebAudioPreloadCoordinator | null;
    private readonly sessionStore: WebAudioSessionStore;
    private readonly currentTrackStore: WebAudioCurrentTrackStore;
    private readonly mixerController: WebAudioMixerController;
    private readonly transportController: WebAudioTransportController;
    private readonly playlistCoordinator: WebAudioPlaylistCoordinator;
    private readonly coverUrlStore: WebAudioObjectUrlStore;
    private visibilityCoordinator: WebAudioVisibilityCoordinator | null;
    private trackLoader: WebAudioTrackLoader | null;

    constructor() {
        this.audioContext = null;

        // 均衡器相关属性
        this.onEqualizerChanged = null;

        // 事件回调
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;

        // 播放模式回调：用于获取下一首/上一首的索引
        this.getNextTrackIndex = null;
        this.getPreviousTrackIndex = null;

        this.preloadCoordinator = null;
        this.sessionStore = new WebAudioSessionStore();
        this.currentTrackStore = new WebAudioCurrentTrackStore();
        this.mixerController = new WebAudioMixerController({
            getVolumeChangedCallback: () => this.onVolumeChanged,
            getEqualizerChangedCallback: () => this.onEqualizerChanged
        });
        this.transportController = new WebAudioTransportController({
            getAudioContext: () => this.audioContext,
            getAudioBuffer: () => this.currentTrackStore.getBuffer(),
            getDuration: () => this.currentTrackStore.getDuration(),
            connectSourceToChain: (sourceNode) => this.mixerController.connectSource(sourceNode),
            onTrackEnded: () => this.onTrackEnded(),
            getPlaybackStateChangedCallback: () => this.onPlaybackStateChanged,
            getPositionChangedCallback: () => this.onPositionChanged
        });
        this.playlistCoordinator = new WebAudioPlaylistCoordinator({
            getState: () => ({
                playlist: this.playlist,
                currentIndex: this.currentIndex,
                gaplessPlaybackEnabled: this.getGaplessPlayback(),
                preloadCoordinator: this.preloadCoordinator,
                getNextTrackIndex: this.getNextTrackIndex,
                getPreviousTrackIndex: this.getPreviousTrackIndex,
                currentTrack: this.currentTrack
            }),
            setCurrentIndex: (index) => {
                this.currentIndex = index;
            },
            setCurrentBuffer: (buffer) => {
                this.currentTrackStore.setBuffer(buffer);
            },
            setDuration: (duration) => {
                this.currentTrackStore.setDuration(duration);
            },
            setCurrentTrack: (track) => {
                this.currentTrackStore.setTrack(track);
            },
            clearCurrentAudioBuffer: () => this.clearCurrentAudioBuffer(),
            clearNextTrackBuffer: () => this.clearNextTrackBuffer(),
            stop: () => this.stop(),
            loadTrack: (filePath) => this.loadTrack(filePath),
            play: () => this.play(),
            notifyTrackChanged: () => this.notifyTrackChanged()
        });

        this.coverUrlStore = new WebAudioObjectUrlStore();
        this.visibilityCoordinator = null;
        this.trackLoader = null;
    }

    async initialize(): Promise<boolean> {
        try {
            // 初始化窗口可见性监听
            this.visibilityCoordinator = new WebAudioVisibilityCoordinator({
                onHiddenCleanup: async () => {
                    this.coverUrlStore.cleanup();
                },
                forceGarbageCollection: forceWebAudioGarbageCollection
            });
            this.visibilityCoordinator.start();
            this.audioContext = new window.AudioContext();
            this.mixerController.initialize(this.audioContext);
            this.trackLoader = new WebAudioTrackLoader(this.audioContext, this.coverUrlStore);
            this.preloadCoordinator = new WebAudioPreloadCoordinator(this.audioContext);
            return true;
        } catch (error) {
            console.error('❌ Web Audio Engine 初始化失败:', error);
            return false;
        }
    }

    async loadTrack(filePath: string): Promise<boolean> {
        try {
            this.stop();

            // 清理旧的音频缓冲区以释放内存
            this.clearCurrentAudioBuffer();

            if (!this.trackLoader) {
                throw new Error('Web Audio track loader is not initialized');
            }

            const loadedTrack = await this.trackLoader.load(filePath);
            this.currentTrackStore.setLoadedTrack(loadedTrack);

            // 触发事件
            this.notifyTrackChanged();

            // 若启用无间隙播放，预加载下一首歌曲
            if (this.getGaplessPlayback() && this.playlist.length > 1) {
                setTimeout(() => this.preloadNextTrack(), 2000);
            }
            return true;
        } catch (error) {
            console.error('❌ 音频文件加载失败:', error);
            return false;
        }
    }

    // 播放音频
    async play(): Promise<boolean> {
        return await this.transportController.play();
    }

    // 暂停播放
    async pause(): Promise<boolean> {
        return await this.transportController.pause();
    }

    // 停止播放
    stop(): boolean {
        const stopped = this.transportController.stop();
        if (stopped) {
            if (!this.visibilityCoordinator?.isVisible()) {
                this.coverUrlStore.cleanup();
                this.clearCurrentAudioBuffer();
            }

            this.visibilityCoordinator?.requestMemoryCleanupIfHidden();
        }

        return stopped;
    }

    // 跳转到指定位置
    async seek(position: number): Promise<boolean> {
        return await this.transportController.seek(position);
    }

    // 设置音量
    setVolume(volume: number): boolean {
        return this.mixerController.setVolume(volume);
    }

    // 获取当前音量
    getVolume(): number {
        return this.mixerController.getVolume();
    }

    // 设置无间隙播放状态
    setGaplessPlayback(enabled: boolean): void {
        this.sessionStore.setGaplessPlayback(enabled);
        console.log(`🎵 WebAudioEngine: 无间隙播放${enabled ? '启用' : '禁用'}`);

        // 如果禁用无间隙播放，清理预加载的资源
        if (!enabled) {
            this.clearNextTrackBuffer();
        }
    }

    // 获取无间隙播放状态
    getGaplessPlayback(): boolean {
        return this.sessionStore.getGaplessPlayback();
    }

    get playlist(): TrackSource[] {
        return this.sessionStore.getPlaylist();
    }

    set playlist(tracks: TrackSource[]) {
        this.sessionStore.setPlaylist(tracks, this.currentIndex);
    }

    get currentIndex(): number {
        return this.sessionStore.getCurrentIndex();
    }

    set currentIndex(index: number) {
        this.sessionStore.setCurrentIndex(index);
    }

    get duration(): number {
        return this.currentTrackStore.getDuration();
    }

    get currentTrack(): WebAudioTrack | null {
        return this.currentTrackStore.getTrack();
    }

    get isPlaying(): boolean {
        return this.transportController.isPlaying();
    }

    get isPaused(): boolean {
        return this.transportController.isPaused();
    }

    // 获取当前播放位置
    async getPosition(): Promise<number> {
        return await this.transportController.getPosition();
    }

    // 获取音频时长
    getDuration(): number {
        return this.currentTrackStore.getDuration();
    }

    // 获取当前歌曲信息
    getCurrentTrack(): WebAudioTrack | null {
        return this.currentTrackStore.getTrack();
    }

    async getStateSnapshot(): Promise<AudioEngineState> {
        return {
            volume: this.getVolume(),
            playlist: this.playlist,
            currentIndex: this.currentIndex,
            position: await this.getPosition(),
            duration: this.getDuration(),
            isPlaying: this.isPlaying,
            gaplessEnabled: this.getGaplessPlayback(),
            currentTrack: this.getCurrentTrack()
        };
    }

    // 设置播放列表
    setPlaylist(tracks: TrackSource[], startIndex = -1): boolean {
        this.sessionStore.setPlaylist(tracks, startIndex);

        console.log(`📋 播放列表设置: ${tracks.length}首歌曲，起始索引: ${startIndex}`);
        if (tracks.length > 0) {
            const firstTrack = tracks[0];
            console.log('📋 第一首歌曲信息:', tracks[0]);
            if (startIndex >= 0 && startIndex < tracks.length) {
                console.log('📋 当前选中歌曲:', tracks[startIndex]);
            }
            console.log('📋 歌曲数据结构:', {
                hasFilePath: !!getTrackFilePath(firstTrack),
                hasTitle: !!getTrackTitle(firstTrack),
                hasArtist: typeof firstTrack !== 'string' && !!firstTrack.artist,
                keys: typeof firstTrack === 'string' ? [] : Object.keys(firstTrack)
            });
        }

        return true;
    }

    // 清理当前音频缓冲区
    clearCurrentAudioBuffer(): void {
        if (this.currentTrackStore.clearBuffer()) {
            // 在窗口隐藏时强制垃圾回收
            this.visibilityCoordinator?.requestGarbageCollectionIfHidden();
        }
    }

    // 清理下一首歌曲的缓冲区
    clearNextTrackBuffer(): void {
        this.preloadCoordinator?.clear();

        // 在窗口隐藏时强制垃圾回收
        this.visibilityCoordinator?.requestGarbageCollectionIfHidden();
    }

    // 预加载下一首歌曲
    async preloadNextTrack(nextIndex: number | null = null): Promise<boolean> {
        return await this.playlistCoordinator.preloadNextTrack(nextIndex);
    }

    // 加载下一首歌曲的音频缓冲区
    async loadNextTrackBuffer(filePath: string, trackInfo: TrackSource): Promise<boolean> {
        return await this.playlistCoordinator.loadNextTrackBuffer(filePath, trackInfo);
    }

    // 播放下一首
    async nextTrack(nextIndex: number | null = null): Promise<boolean> {
        return await this.playlistCoordinator.nextTrack(nextIndex);
    }

    // 播放上一首
    async previousTrack(prevIndex: number | null = null): Promise<boolean> {
        return await this.playlistCoordinator.previousTrack(prevIndex);
    }

    // 歌曲播放结束处理
    onTrackEnded(): void {
        // console.log('🔚 歌曲播放结束');

        // 自动播放下一首
        if (this.playlist.length > 0) {
            if (this.getGaplessPlayback()) {
                // 无间隙播放
                setTimeout(async () => {
                    await this.nextTrack();
                }, 0);
            } else {
                // 普通播放
                setTimeout(async () => {
                    await this.nextTrack();
                }, 500);
            }
        }
    }

    notifyTrackChanged(): void {
        if (this.onTrackChanged) {
            this.onTrackChanged(this.currentTrack);
        }
    }

    // 获取均衡器实例
    getEqualizer(): WebAudioEqualizer | null {
        return this.mixerController.getEqualizer();
    }

    // 启用/禁用均衡器
    setEqualizerEnabled(enabled: boolean): void {
        this.mixerController.setEqualizerEnabled(
            enabled,
            this.transportController.getSourceNode(),
            this.isPlaying
        );
    }

    destroy(): void {
        this.stop();
        this.transportController.destroy();
        this.visibilityCoordinator?.destroy();
        this.visibilityCoordinator = null;

        // 清理封面URL
        this.coverUrlStore.cleanup();

        // 清理所有音频缓冲区
        this.currentTrackStore.clear();
        this.clearNextTrackBuffer();
        this.sessionStore.clear();

        this.mixerController.destroy();

        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

export {WebAudioEngine, WebAudioEqualizer};
