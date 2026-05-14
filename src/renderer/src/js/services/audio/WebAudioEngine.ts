/**
 * 基于 Web Audio API 的音频引擎
 */

import {libraryController} from "@js/features/library";
import {mediaController} from "@js/features/media";
import {
    getTrackDuration,
    getTrackFilePath,
    getTrackTitle,
    normalizeTrack,
    type AudioTrack,
    type TrackSource
} from '@services/audio/domain';
import WebAudioEqualizer from "@services/audio/WebAudioEqualizer";
import {webAudioChain} from "@services/audio/WebAudioChain";
import WebAudioPreloadCoordinator from "@services/audio/WebAudioPreloadCoordinator";
import {embeddedCoverManager} from "@services/cover/EmbeddedCoverManager";

interface WebAudioTrack extends AudioTrack {
    filePath: string;
    title?: string;
    artist?: string;
    album?: string;
    duration: number;
    bitrate?: number;
    sampleRate?: number;
    year?: number;
    genre?: string;
    track?: number;
    disc?: number;
    cover?: unknown;
    [key: string]: unknown;
}

interface CoverData {
    data?: BlobPart;
    format?: string;
    [key: string]: unknown;
}

interface TrackMetadata {
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    year?: number;
    genre?: string;
    track?: number;
    disc?: number;
    cover?: unknown;
    [key: string]: unknown;
}

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
    private progressTimer: ReturnType<typeof setInterval> | null;
    private coverObjectUrls: Set<string>;
    private gaplessPlaybackEnabled: boolean;
    private preloadCoordinator: WebAudioPreloadCoordinator | null;
    private isWindowVisible: boolean;
    private memoryCleanupTimer: ReturnType<typeof setTimeout> | null;
    private visibilityChangeListener: EventListener | null;
    private windowFocusListener: EventListener | null;
    private windowBlurListener: EventListener | null;

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

        // 进度更新定时器
        this.progressTimer = null;

        // 封面对象URL管理
        this.coverObjectUrls = new Set();

        // 无间隙播放相关属性
        this.gaplessPlaybackEnabled = true; // 默认启用无间隙播放
        this.preloadCoordinator = null;

        // 窗口可见性监听和内存管理
        this.isWindowVisible = true;
        this.memoryCleanupTimer = null;
        this.visibilityChangeListener = null;
        this.windowFocusListener = null;
        this.windowBlurListener = null;
    }

    async initialize(): Promise<boolean> {
        try {
            // 初始化窗口可见性监听
            this.initVisibilityListener();
            this.audioContext = new window.AudioContext();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
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

            let arrayBuffer: ArrayBuffer | null;
            try {
                arrayBuffer = await mediaController.readAudioFile(filePath);
            } catch {
                const fileUrl = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`;
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch audio file: ${response.status}`);
                }
                arrayBuffer = await response.arrayBuffer();
            }

            // 解码音频数据
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            const webAudioDuration = this.audioBuffer.duration;

            // 清理arrayBuffer引用以释放内存
            arrayBuffer = null;
            const metadata = await this.getTrackMetadata(filePath);
            this.duration = (metadata.duration && metadata.duration > 0) ? metadata.duration : webAudioDuration;

            // 处理内嵌封面
            let coverUrl: string | null = null;
            const embeddedCover = metadata.cover as CoverData | undefined;
            if (embeddedCover?.data) {
                try {
                    if (embeddedCoverManager) {
                        const coverResult = embeddedCoverManager.convertCoverToUrl(embeddedCover as any);
                        if (coverResult.success && typeof coverResult.url === 'string') {
                            coverUrl = coverResult.url;
                            this.coverObjectUrls.add(coverUrl);
                        }
                    } else {
                        // 直接处理封面数据
                        const coverBlob = new Blob([embeddedCover.data], {
                            type: `image/${(embeddedCover.format || 'jpeg').toLowerCase()}`
                        });
                        coverUrl = URL.createObjectURL(coverBlob);
                        this.coverObjectUrls.add(coverUrl);
                    }
                } catch (error) {
                    console.error('封面处理失败:', error);
                }
            }

            // 验证封面URL格式
            if (coverUrl && typeof coverUrl !== 'string') {
                coverUrl = null;
            }

            // 更新当前歌曲信息
            this.currentTrack = {
                filePath: filePath,
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                duration: this.duration,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                year: metadata.year,
                genre: metadata.genre,
                track: metadata.track,
                disc: metadata.disc,
                cover: coverUrl
            };

            // 触发事件
            if (this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

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
            this.startProgressTimer();

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
            this.stopProgressTimer();
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
            this.stopProgressTimer();
            if (!this.isWindowVisible) {
                this.cleanupCoverUrls();
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
            if (!this.isWindowVisible) {
                setTimeout(() => this.performMemoryCleanup(), 0);
            }

            console.log('⏹️ 停止播放');
            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    // 清理封面对象URL
    cleanupCoverUrls(): void {
        for (const url of this.coverObjectUrls) {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                console.warn('⚠️ 清理封面URL失败:', error);
            }
        }
        this.coverObjectUrls.clear();
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
            this.stopProgressTimer();

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
            if (!this.isWindowVisible) {
                setTimeout(() => this.forceGarbageCollection(), 0);
            }
        }
    }

    // 清理下一首歌曲的缓冲区
    clearNextTrackBuffer(): void {
        this.preloadCoordinator?.clear();

        // 在窗口隐藏时强制垃圾回收
        if (!this.isWindowVisible) {
            setTimeout(() => this.forceGarbageCollection(), 0);
        }
    }

    // 预加载下一首歌曲
    async preloadNextTrack(nextIndex: number | null = null): Promise<boolean> {
        if (!this.gaplessPlaybackEnabled || this.playlist.length <= 1) {
            return false;
        }

        // 计算下一首歌曲的索引：优先使用提供的nextIndex，其次使用回调函数，最后使用顺序播放逻辑
        if (nextIndex === null || nextIndex < 0 || nextIndex >= this.playlist.length) {
            if (typeof this.getNextTrackIndex === 'function') {
                nextIndex = this.getNextTrackIndex();
            } else {
                nextIndex = (this.currentIndex + 1) % this.playlist.length;
            }
        }
        const nextTrackInfo = this.playlist[nextIndex];

        if (!nextTrackInfo) {
            return false;
        }

        const filePath = getTrackFilePath(nextTrackInfo);
        if (!filePath) {
            console.warn('⚠️ 下一首歌曲文件路径为空');
            return false;
        }

        return await this.loadNextTrackBuffer(filePath, nextTrackInfo);
    }

    // 加载下一首歌曲的音频缓冲区
    async loadNextTrackBuffer(filePath: string, trackInfo: TrackSource): Promise<boolean> {
        if (!this.preloadCoordinator) {
            return false;
        }

        return await this.preloadCoordinator.preload(filePath, trackInfo);
    }

    // 播放下一首
    async nextTrack(nextIndex: number | null = null): Promise<boolean> {
        if (this.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        // 如果当前索引为-1，说明还没有开始播放，这种情况不应该发生
        if (this.currentIndex === -1) {
            console.warn('⚠️ 当前索引为-1，无法切换到下一首');
            return false;
        }

        // 在切换歌曲前，主动清理当前音频资源和预加载资源
        this.clearCurrentAudioBuffer();
        this.clearNextTrackBuffer();

        // 停止当前播放，确保音频资源完全释放
        this.stop();

        // 切换到下一首：优先使用提供的nextIndex，其次使用回调函数，最后使用顺序播放逻辑
        if (nextIndex !== null && nextIndex >= 0 && nextIndex < this.playlist.length) {
            this.currentIndex = nextIndex;
        } else if (typeof this.getNextTrackIndex === 'function') {
            this.currentIndex = this.getNextTrackIndex();
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }
        const nextTrack = this.playlist[this.currentIndex];

        // 获取文件路径，支持多种数据结构
        const filePath = getTrackFilePath(nextTrack);

        if (!filePath) {
            console.error('❌ 下一首歌曲文件路径为空:', nextTrack);
            return false;
        }

        console.log(`⏭️ 切换到下一首 (索引 ${this.currentIndex}): ${getTrackTitle(nextTrack) || filePath}`);

        // 若启用无间隙播放且已预加载，检查预加载的歌曲是否与当前要播放的歌曲一致
        const canUsePreloadedBuffer = this.gaplessPlaybackEnabled &&
            this.preloadCoordinator?.hasPreloaded(filePath);

        if (canUsePreloadedBuffer) {
            console.log('🎵 使用预加载的音频缓冲区进行无间隙播放');
            this.stop();
            this.audioBuffer = null;
            const preloadedTrack = this.preloadCoordinator?.getPreloaded();
            if (!preloadedTrack) {
                return false;
            }

            // 使用预加载的缓冲区
            this.audioBuffer = preloadedTrack.buffer;
            this.duration = getTrackDuration(preloadedTrack.trackInfo) || preloadedTrack.buffer.duration || 0;
            this.currentTrack = normalizeTrack(preloadedTrack.trackInfo, filePath, this.duration);

            // 清理预加载的资源
            this.clearNextTrackBuffer();

            // 播放
            const playResult = await this.play();

            // 只有在播放成功后才触发歌曲变更事件，确保UI与实际播放同步
            if (playResult && this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            // 预加载下一首
            // 无间隙播放模式下
            if (playResult && this.gaplessPlaybackEnabled) {
                setTimeout(() => this.preloadNextTrack(), 1000);
            }

            return playResult;
        } else {
            // 普通加载方式（预加载不可用或预加载的歌曲不匹配）
            if (this.preloadCoordinator?.getPreloaded() && !this.preloadCoordinator.hasPreloaded(filePath)) {
                console.log('⚠️ 预加载的歌曲与目标歌曲不一致，清理预加载缓冲区');
                this.clearNextTrackBuffer();
            }

            const loadResult = await this.loadTrack(filePath);
            if (loadResult) {
                // 播放
                const playResult = await this.play();

                // 只有在播放成功后才触发歌曲变更事件，确保UI与实际播放同步
                if (playResult && this.onTrackChanged) {
                    this.onTrackChanged(this.currentTrack);
                }

                // 无间隙播放模式下预加载下一首歌曲
                if (playResult && this.gaplessPlaybackEnabled) {
                    setTimeout(() => this.preloadNextTrack(), 1000);
                }
                return playResult;
            }
            return false;
        }
    }

    // 播放上一首
    async previousTrack(prevIndex: number | null = null): Promise<boolean> {
        if (this.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        // 如果当前索引为-1，说明还没有开始播放，这种情况不应该发生
        if (this.currentIndex === -1) {
            console.warn('⚠️ 当前索引为-1，无法切换到上一首');
            return false;
        }

        // 在切换歌曲前，主动清理当前音频资源和预加载资源
        this.clearCurrentAudioBuffer();
        this.clearNextTrackBuffer();

        // 停止当前播放，确保音频资源完全释放
        this.stop();

        // 切换到上一首：优先使用提供的prevIndex，其次使用回调函数，最后使用顺序播放逻辑
        if (prevIndex !== null && prevIndex >= 0 && prevIndex < this.playlist.length) {
            this.currentIndex = prevIndex;
        } else if (typeof this.getPreviousTrackIndex === 'function') {
            this.currentIndex = this.getPreviousTrackIndex();
        } else {
            this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        }
        const prevTrack = this.playlist[this.currentIndex];

        // 获取文件路径，支持多种数据结构
        const filePath = getTrackFilePath(prevTrack);

        if (!filePath) {
            console.error('❌ 上一首歌曲文件路径为空:', prevTrack);
            return false;
        }

        console.log(`⏮️ 切换到上一首 (索引 ${this.currentIndex}): ${getTrackTitle(prevTrack) || filePath}`);

        const loadResult = await this.loadTrack(filePath);
        if (loadResult) {
            // 自动开始播放
            const playResult = await this.play();

            // 只有在播放成功后才触发歌曲变更事件，确保UI与实际播放同步
            if (playResult && this.onTrackChanged) {
                this.onTrackChanged(this.currentTrack);
            }

            return playResult;
        }
        return false;
    }

    async getTrackMetadata(filePath: string): Promise<TrackMetadata> {
        // console.log('🔄 从主进程获取音频元数据...');
        const metadata = await libraryController.getTrackMetadata(filePath);
        if (metadata) {
            // console.log(`✅ 成功获取元数据: ${metadata.title} - ${metadata.artist}`);
            return {
                title: metadata.title || '未知标题',
                artist: metadata.artist || '未知艺术家',
                album: metadata.album || '未知专辑',
                duration: metadata.duration || 0,
                bitrate: metadata.bitrate || 0,
                sampleRate: metadata.sampleRate || 0,
                year: metadata.year,
                genre: metadata.genre,
                track: metadata.track,
                disc: metadata.disc,
                cover: metadata.cover
            };
        }
        return {};
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

    // 开始进度更新定时器
    startProgressTimer(): void {
        this.stopProgressTimer();
        this.progressTimer = setInterval(async () => {
            if (this.isPlaying && this.onPositionChanged) {
                this.onPositionChanged(await this.getPosition());
            }
        }, 50);
    }

    // 停止进度更新定时器
    stopProgressTimer(): void {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
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

    // 初始化窗口可见性监听
    initVisibilityListener(): void {
        try {
            if (this.visibilityChangeListener || this.windowFocusListener || this.windowBlurListener) {
                return;
            }

            this.visibilityChangeListener = () => {
                void this.handleVisibilityChange();
            };
            this.windowFocusListener = () => {
                this.isWindowVisible = true;
                void this.handleWindowVisible();
            };
            this.windowBlurListener = () => {
                this.isWindowVisible = false;
                this.handleWindowHidden();
            };

            // 监听页面可见性变化
            document.addEventListener('visibilitychange', this.visibilityChangeListener);

            // 监听窗口焦点变化
            window.addEventListener('focus', this.windowFocusListener);

            window.addEventListener('blur', this.windowBlurListener);
        } catch (error) {
            console.error('❌ WebAudioEngine: 初始化窗口可见性监听失败:', error);
        }
    }

    // 处理窗口可见性变化
    async handleVisibilityChange(): Promise<void> {
        if (document.hidden) {
            this.isWindowVisible = false;
            this.handleWindowHidden();
        } else {
            this.isWindowVisible = true;
            await this.handleWindowVisible();
        }
    }

    // 处理窗口隐藏（最小化或隐藏到托盘）
    handleWindowHidden(): void {
        this.scheduleMemoryCleanup();
    }

    // 处理窗口显示
    async handleWindowVisible(): Promise<void> {
        this.cancelScheduledMemoryCleanup();
        await this.forceGarbageCollection();
    }

    // 调度内存清理
    scheduleMemoryCleanup(): void {
        // 取消之前的清理任务
        this.cancelScheduledMemoryCleanup();

        // 5秒后执行内存清理，给窗口恢复留出时间
        this.memoryCleanupTimer = setTimeout(async () => {
            await this.performMemoryCleanup();
        }, 5000);
    }

    // 取消调度的内存清理
    cancelScheduledMemoryCleanup(): void {
        if (this.memoryCleanupTimer) {
            clearTimeout(this.memoryCleanupTimer);
            this.memoryCleanupTimer = null;
        }
    }

    // 执行内存清理
    async performMemoryCleanup(): Promise<void> {
        if (this.isWindowVisible) {
            return;
        }
        try {
            // 清理封面URL
            this.cleanupCoverUrls();

            // 强制垃圾回收
            await this.forceGarbageCollection();
        } catch (error) {
            console.error('❌ WebAudioEngine: 内存清理失败:', error);
        }
    }

    // 强制垃圾回收
    async forceGarbageCollection(): Promise<void> {
        const maybeWindowWithGc = window as Window & {gc?: () => void};
        if (typeof maybeWindowWithGc.gc === 'function') {
            maybeWindowWithGc.gc();
        }
    }

    destroy(): void {
        this.stop();
        this.stopProgressTimer();

        // 取消内存清理任务
        this.cancelScheduledMemoryCleanup();

        // 清理封面URL
        this.cleanupCoverUrls();

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

        this.removeVisibilityListeners();
    }

    removeVisibilityListeners(): void {
        if (this.visibilityChangeListener) {
            document.removeEventListener('visibilitychange', this.visibilityChangeListener);
            this.visibilityChangeListener = null;
        }

        if (this.windowFocusListener) {
            window.removeEventListener('focus', this.windowFocusListener);
            this.windowFocusListener = null;
        }

        if (this.windowBlurListener) {
            window.removeEventListener('blur', this.windowBlurListener);
            this.windowBlurListener = null;
        }
    }
}

export {WebAudioEngine, WebAudioEqualizer};
