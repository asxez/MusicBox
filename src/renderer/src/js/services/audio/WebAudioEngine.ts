/**
 * 基于 Web Audio API 的音频引擎
 */

import {
    getTrackFilePath,
    getTrackTitle,
    type TrackSource
} from '@services/audio/domain';
import WebAudioEqualizer from "@services/audio/WebAudioEqualizer";
import {webAudioChain} from "@services/audio/WebAudioChain";
import {forceWebAudioGarbageCollection} from "@services/audio/WebAudioGarbageCollector";
import WebAudioObjectUrlStore from "@services/audio/WebAudioObjectUrlStore";
import WebAudioPlaylistCoordinator from "@services/audio/WebAudioPlaylistCoordinator";
import WebAudioPreloadCoordinator from "@services/audio/WebAudioPreloadCoordinator";
import WebAudioProgressTicker from "@services/audio/WebAudioProgressTicker";
import WebAudioTrackLoader from "@services/audio/WebAudioTrackLoader";
import type {WebAudioTrack} from "@services/audio/WebAudioTypes";
import WebAudioVisibilityCoordinator from "@services/audio/WebAudioVisibilityCoordinator";

class WebAudioEngine {
    public audioContext: any;
    private audioBuffer: any;
    private sourceNode: any;
    private gainNode: any;
    public isPlaying: boolean;
    public isPaused: boolean;
    private startTime: number;
    private pauseTime: number;
    public duration: number;
    private volume: number;
    public currentTrack: WebAudioTrack | null;
    public playlist: TrackSource[];
    public currentIndex: number;
    private equalizer: any;
    private equalizerEnabled: boolean;
    private onEqualizerChanged: ((state: {enabled: boolean}) => void) | null;
    public onTrackChanged: ((track: WebAudioTrack | null) => void | Promise<void>) | null;
    public onPlaybackStateChanged: ((isPlaying: boolean) => void | Promise<void>) | null;
    public onPositionChanged: ((position: number) => void | Promise<void>) | null;
    public onVolumeChanged: ((volume: number) => void) | null;
    public getNextTrackIndex: (() => number) | null;
    public getPreviousTrackIndex: (() => number) | null;
    private gaplessPlaybackEnabled: boolean;
    private preloadCoordinator: WebAudioPreloadCoordinator | null;
    private readonly playlistCoordinator: WebAudioPlaylistCoordinator;
    private readonly coverUrlStore: WebAudioObjectUrlStore;
    private readonly progressTicker: WebAudioProgressTicker;
    private visibilityCoordinator: WebAudioVisibilityCoordinator | null;
    private trackLoader: WebAudioTrackLoader | null;

    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.currentTrack = null;
        this.playlist = [];
        this.currentIndex = -1;

        // 均衡器相关属性
        this.equalizer = null;
        this.equalizerEnabled = false;
        this.onEqualizerChanged = null;

        // 事件回调
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;

        // 播放模式回调：用于获取下一首/上一首的索引
        this.getNextTrackIndex = null;
        this.getPreviousTrackIndex = null;

        // 无间隙播放相关属性
        this.gaplessPlaybackEnabled = true; // 默认启用无间隙播放
        this.preloadCoordinator = null;
        this.playlistCoordinator = new WebAudioPlaylistCoordinator({
            getState: () => ({
                playlist: this.playlist,
                currentIndex: this.currentIndex,
                gaplessPlaybackEnabled: this.gaplessPlaybackEnabled,
                preloadCoordinator: this.preloadCoordinator,
                getNextTrackIndex: this.getNextTrackIndex,
                getPreviousTrackIndex: this.getPreviousTrackIndex,
                currentTrack: this.currentTrack
            }),
            setCurrentIndex: (index) => {
                this.currentIndex = index;
            },
            setCurrentBuffer: (buffer) => {
                this.audioBuffer = buffer;
            },
            setDuration: (duration) => {
                this.duration = duration;
            },
            setCurrentTrack: (track) => {
                this.currentTrack = track;
            },
            clearCurrentAudioBuffer: () => this.clearCurrentAudioBuffer(),
            clearNextTrackBuffer: () => this.clearNextTrackBuffer(),
            stop: () => this.stop(),
            loadTrack: (filePath) => this.loadTrack(filePath),
            play: () => this.play(),
            notifyTrackChanged: () => this.notifyTrackChanged()
        });

        this.coverUrlStore = new WebAudioObjectUrlStore();
        this.progressTicker = new WebAudioProgressTicker();
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
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            this.trackLoader = new WebAudioTrackLoader(this.audioContext, this.coverUrlStore);
            this.preloadCoordinator = new WebAudioPreloadCoordinator(this.audioContext);
            this.initializeEqualizer();
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
            this.audioBuffer = loadedTrack.buffer;
            this.duration = loadedTrack.duration;
            this.currentTrack = loadedTrack.track;

            // 触发事件
            this.notifyTrackChanged();

            // 若启用无间隙播放，预加载下一首歌曲
            if (this.gaplessPlaybackEnabled && this.playlist.length > 1) {
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
        try {
            if (!this.audioBuffer) {
                return false;
            }

            // 恢复音频上下文（用户交互后需要）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 如果已经在播放且未暂停，不重复播放
            if (this.isPlaying && !this.isPaused) {
                return true;
            }

            // 停止当前播放
            if (this.sourceNode) {
                try {
                    this.sourceNode.onended = null; // 移除回调避免意外触发
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                    // 忽略已停止的错误
                }
                this.sourceNode = null;
            }

            // 创建新的音频源
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = this.audioBuffer;

            // 连接到音频链
            this.connectSourceToChain();

            // 设置播放结束回调
            this.sourceNode.onended = () => {
                if (this.isPlaying) {
                    this.onTrackEnded();
                }
            };

            // 开始播放
            const offset = this.isPaused ? this.pauseTime : 0;

            // 确保偏移量在有效范围内
            const validOffset = Math.max(0, Math.min(offset, this.duration - 0.1));
            console.log(`▶️ 开始播放，原始偏移量: ${offset.toFixed(2)}s, 有效偏移量: ${validOffset.toFixed(2)}s, 音频时长: ${this.duration.toFixed(2)}s`);

            try {
                this.sourceNode.start(0, validOffset);
                this.startTime = this.audioContext.currentTime - validOffset;

                // 如果偏移量被调整了，更新pauseTime
                if (validOffset !== offset) {
                    this.pauseTime = validOffset;

                }
            } catch (startError) {
                console.error('❌ 音频源启动失败:', startError);


                // 重新创建音频源并从头开始
                this.sourceNode = this.audioContext.createBufferSource();
                this.sourceNode.buffer = this.audioBuffer;

                // 连接到音频链
                this.connectSourceToChain();
                this.sourceNode.onended = () => {
                    if (this.isPlaying) {
                        this.onTrackEnded();
                    }
                };

                this.sourceNode.start(0, 0);
                this.startTime = this.audioContext.currentTime;
                this.pauseTime = 0;
                this.isPaused = false;
            }

            this.isPlaying = true;
            this.isPaused = false;

            // 开始进度更新
            this.progressTicker.start({
                isPlaying: () => this.isPlaying,
                getPosition: () => this.getPosition(),
                getPositionChangedCallback: () => this.onPositionChanged
            });

            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(true);
            }

            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    // 暂停播放
    async pause(): Promise<boolean> {
        try {
            if (!this.isPlaying && !this.sourceNode) {
                console.log('⚠️ 音频未在播放且无音频源，无法暂停');
                return false;
            }

            if (!this.isPlaying) {
                console.log('⚠️ 状态显示未播放，但仍尝试暂停');
            }

            // 记录暂停位置
            const currentPosition = this.audioContext.currentTime - this.startTime;
            this.pauseTime = Math.max(0, Math.min(currentPosition, this.duration - 0.1));
            console.log(`🔄 暂停位置计算: currentTime=${this.audioContext.currentTime.toFixed(2)}, startTime=${this.startTime.toFixed(2)}, 计算位置=${currentPosition.toFixed(2)}, 最终位置=${this.pauseTime.toFixed(2)}`);

            // 如果计算出的位置异常，使用当前进度
            if (this.pauseTime < 0 || this.pauseTime >= this.duration) {
                const fallbackPosition = await this.getPosition();
                console.log(`⚠️ 暂停位置异常，使用备用位置: ${fallbackPosition.toFixed(2)}s`);
                this.pauseTime = Math.max(0, Math.min(fallbackPosition, this.duration - 0.1));
            }

            // 停止音频源（不触发onended事件）
            if (this.sourceNode) {
                try {
                    // 移除onended回调，避免触发自动播放下一首
                    this.sourceNode.onended = null;
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                }
                this.sourceNode = null;
            }

            this.isPlaying = false;
            this.isPaused = true;

            // 停止进度更新
            this.progressTicker.stop();
            console.log(`⏸️ 暂停播放，位置: ${this.pauseTime.toFixed(2)}s`);

            // 触发事件
            if (this.onPlaybackStateChanged) {
                console.log('🔄 Web Audio Engine: 触发暂停状态变化事件');
                this.onPlaybackStateChanged(false);
            } else {
                console.warn('⚠️ Web Audio Engine: onPlaybackStateChanged 回调未设置');
            }
            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    // 停止播放
    stop(): boolean {
        try {
            // 停止音频源（不触发onended事件）
            if (this.sourceNode) {
                try {
                    // 移除onended回调，避免触发自动播放下一首
                    this.sourceNode.onended = null;
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                }
                this.sourceNode = null;
            }

            this.isPlaying = false;
            this.isPaused = false;
            this.startTime = 0;
            this.pauseTime = 0;

            // 停止进度更新
            this.progressTicker.stop();
            if (!this.visibilityCoordinator?.isVisible()) {
                this.coverUrlStore.cleanup();
                this.clearCurrentAudioBuffer();
            }

            // 触发事件
            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }

            // 触发位置重置事件
            if (this.onPositionChanged) {
                this.onPositionChanged(0);
            }

            // 在窗口隐藏时执行内存清理
            this.visibilityCoordinator?.requestMemoryCleanupIfHidden();

            console.log('⏹️ 停止播放');
            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    // 跳转到指定位置
    async seek(position: number): Promise<boolean> {
        try {
            if (!this.audioBuffer) {
                return false;
            }

            const wasPlaying = this.isPlaying;

            // 停止当前播放（但不触发onended事件）
            if (this.sourceNode) {
                try {
                    // 临时移除onended回调，避免触发自动播放下一首
                    this.sourceNode.onended = null;
                    this.sourceNode.stop();
                    this.sourceNode.disconnect();
                } catch (e) {
                }
                this.sourceNode = null;
            }

            // 停止进度更新
            this.progressTicker.stop();

            // 设置新位置
            this.pauseTime = Math.max(0, Math.min(position, this.duration));
            this.isPaused = true;
            this.isPlaying = false;
            console.log(`⏭️ 跳转到: ${position.toFixed(2)}s`);

            // 如果之前在播放，继续播放
            if (wasPlaying) {
                await this.play();
            }

            // 触发位置更新事件
            if (this.onPositionChanged) {
                this.onPositionChanged(this.pauseTime);
            }
            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    // 设置音量
    setVolume(volume: number): boolean {
        try {
            this.volume = Math.max(0, Math.min(1, volume));

            if (this.gainNode) {
                // 使用线性渐变避免音量突变
                this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
            }

            console.log(`🔊 音量设置为: ${(this.volume * 100).toFixed(0)}%`);

            // 触发事件
            if (this.onVolumeChanged) {
                this.onVolumeChanged(this.volume);
            }

            return true;
        } catch (error) {
            console.error('❌ 音量设置失败:', error);
            return false;
        }
    }

    // 获取当前音量
    getVolume(): number {
        return this.volume;
    }

    // 设置无间隙播放状态
    setGaplessPlayback(enabled: boolean): void {
        this.gaplessPlaybackEnabled = enabled;
        console.log(`🎵 WebAudioEngine: 无间隙播放${enabled ? '启用' : '禁用'}`);

        // 如果禁用无间隙播放，清理预加载的资源
        if (!enabled) {
            this.clearNextTrackBuffer();
        }
    }

    // 获取无间隙播放状态
    getGaplessPlayback(): boolean {
        return this.gaplessPlaybackEnabled;
    }

    // 获取当前播放位置
    async getPosition(): Promise<number> {
        if (!this.isPlaying && !this.isPaused) {
            return 0;
        }

        if (this.isPaused) {
            return this.pauseTime;
        }

        return this.audioContext.currentTime - this.startTime;
    }

    // 获取音频时长
    getDuration(): number {
        return this.duration;
    }

    // 获取当前歌曲信息
    getCurrentTrack(): WebAudioTrack | null {
        return this.currentTrack;
    }

    // 设置播放列表
    setPlaylist(tracks: TrackSource[], startIndex = -1): boolean {
        this.playlist = tracks;
        this.currentIndex = startIndex; // 设置起始索引

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
        if (this.audioBuffer) {
            this.audioBuffer = null;

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
        this.isPlaying = false;
        this.isPaused = false;

        // 自动播放下一首
        if (this.playlist.length > 0) {
            if (this.gaplessPlaybackEnabled) {
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

    // 初始化均衡器
    initializeEqualizer(): void {
        if (!this.audioContext) {
            console.error('❌ 音频上下文未初始化，无法创建均衡器');
            return;
        }
        this.equalizer = new WebAudioEqualizer(this.audioContext);
    }

    // 获取均衡器实例
    getEqualizer(): WebAudioEqualizer | null {
        return this.equalizer;
    }

    // 启用/禁用均衡器
    setEqualizerEnabled(enabled: boolean): void {
        // 如果状态没有变化，直接返回
        if (this.equalizerEnabled === enabled) {
            return;
        }

        this.equalizerEnabled = enabled;

        // 如果音频正在播放且sourceNode存在，立即重新连接音频链
        if (this.sourceNode && this.isPlaying) {
            // console.log('🔄 音频正在播放，立即重新连接音频链以应用均衡器状态变化');
            this.reconnectAudioChain();
        }

        if (this.onEqualizerChanged) {
            this.onEqualizerChanged({enabled});
        }
    }

    // 连接音频源到音频链
    connectSourceToChain(): void {
        if (!this.audioContext || !this.sourceNode || !this.gainNode) {
            console.warn('⚠️ sourceNode不存在，无法连接音频链');
            return;
        }

        webAudioChain.connect({
            audioContext: this.audioContext,
            sourceNode: this.sourceNode,
            gainNode: this.gainNode,
            equalizer: this.equalizer,
            equalizerEnabled: this.equalizerEnabled
        });
    }

    // 重新连接音频链 - 支持实时切换
    reconnectAudioChain(): boolean {
        if (!this.audioContext || !this.sourceNode || !this.gainNode) {
            console.warn('⚠️ sourceNode不存在，无法重新连接音频链');
            return false;
        }

        return webAudioChain.reconnect({
            audioContext: this.audioContext,
            sourceNode: this.sourceNode,
            gainNode: this.gainNode,
            equalizer: this.equalizer,
            equalizerEnabled: this.equalizerEnabled
        });
    }

    destroy(): void {
        this.stop();
        this.progressTicker.stop();
        this.visibilityCoordinator?.destroy();
        this.visibilityCoordinator = null;

        // 清理封面URL
        this.coverUrlStore.cleanup();

        // 清理所有音频缓冲区
        this.clearCurrentAudioBuffer();
        this.clearNextTrackBuffer();

        if (this.equalizer) {
            this.equalizer.destroy();
            this.equalizer = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

export {WebAudioEngine, WebAudioEqualizer};
