/**
 * WASAPI独占模式音频引擎（Rust实现的JS包装器）
 */

import {audioDriverController} from "@js/features/audioDriver";
import ParametricEqualizer from "@js/features/equalizer/service/ParametricEqualizer";
import WasapiEqualizer from "@js/features/equalizer/service/WasapiEqualizer";
import {libraryController} from "@js/features/library";
import {cacheManager} from "@js/shared/cache";
import type {MusicBoxSettings} from "@api/types/settings";
import {getTrackFilePath, type AudioTrack, type TrackSource} from "../AudioTrack";
import type {AudioEngineState} from "../AudioEngineContract";

type WasapiShareMode = 'exclusive' | 'shared';
type EqualizerMode = 'graphic' | 'parametric';
type NativeResult<T extends Record<string, unknown> = Record<string, unknown>> = {success?: boolean; error?: string} & T;

interface WasapiTrack extends AudioTrack {
    filePath: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    cover?: unknown;
}

class WasapiEngine {
    public nativeEngine: any | null;
    public isPlaying: boolean;
    public isPaused: boolean;
    public duration: number;
    private volume: number;
    public currentTrack: WasapiTrack | null;
    public playlist: TrackSource[];
    public currentIndex: number;
    private gaplessPlaybackEnabled: boolean;
    private parametricEqualizer: ParametricEqualizer | null;
    private pendingSeekPosition: number | null;
    private playStartTime: number;
    private isLoadingNewTrack: boolean;
    public onTrackChanged: ((track: WasapiTrack | null) => void | Promise<void>) | null;
    public onPlaybackStateChanged: ((isPlaying: boolean) => void | Promise<void>) | null;
    public onPositionChanged: ((position: number) => void | Promise<void>) | null;
    public onVolumeChanged: ((volume: number) => void) | null;
    public getNextTrackIndex: (() => number) | null;
    public getPreviousTrackIndex: (() => number) | null;
    private progressTimer: ReturnType<typeof setInterval> | null;

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

    async initialize(): Promise<boolean> {
        try {
            if (!audioDriverController.isNativeAudioAvailable()) {
                throw new Error('Native音频模块未加载');
            }

            const nativeAudio = audioDriverController.getNativeAudio();
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
            const shareMode: WasapiShareMode = settings.wasapiShareMode === 'shared' ? 'shared' : 'exclusive';

            // 初始化Rust音频引擎
            const result = await nativeAudio.initialize(shareMode) as NativeResult;
            if (!result.success) {
                throw new Error(result.error || '初始化失败');
            }

            this.nativeEngine = nativeAudio;

            // 初始化参量均衡器（传入this以便切换均衡器模式）
            this.parametricEqualizer = new ParametricEqualizer(this.nativeEngine, this);
            await this.parametricEqualizer.init();

            // 设置事件监听
            this.setupEventListeners();
            console.log(`✅ WASAPI引擎初始化成功 (${shareMode === 'exclusive' ? '独占' : '共享'}模式)`);
            return true;
        } catch (error) {
            console.error('❌ WASAPI引擎初始化失败:', error);
            return false;
        }
    }

    setupEventListeners(): void {
        // 监听播放结束事件
        audioDriverController.onNativeAudioEvent('track-ended', () => {
            this.onTrackEnded();
        });

        // 监听错误事件
        audioDriverController.onNativeAudioEvent('error', (errorMsg: unknown) => {
            console.error('❌ Native音频错误:', errorMsg);
            this.isPlaying = false;
            this.isPaused = false;
            if (this.onPlaybackStateChanged) {
                this.onPlaybackStateChanged(false);
            }
        });
    }

    async loadTrack(filePath: string): Promise<boolean> {
        try {
            // 标记正在加载新曲目，阻止旧曲目的finished事件触发自动播放
            this.isLoadingNewTrack = true;

            await this.stop();

            const result = await this.nativeEngine.loadTrack(filePath) as NativeResult<{duration?: number}>;
            if (!result.success) {
                throw new Error(result.error || '加载失败');
            }

            // 获取音频元数据
            const metadata = await libraryController.getTrackMetadata(filePath);
            this.duration = metadata?.duration || result.duration || 0;

            this.currentTrack = {
                filePath: filePath,
                title: metadata?.title || '未知标题',
                artist: metadata?.artist || '未知艺术家',
                album: metadata?.album || '未知专辑',
                duration: this.duration,
                cover: metadata?.cover
            };

            // 重置pending seek位置
            this.pendingSeekPosition = null;
            return true;
        } catch (error) {
            console.error('❌ 加载音频文件失败:', error);
            return false;
        }
    }

    async play(): Promise<boolean> {
        try {
            if (!this.currentTrack) {
                return false;
            }

            const result = await this.nativeEngine.play() as NativeResult;
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

    async pause(): Promise<boolean> {
        try {
            const result = await this.nativeEngine.pause() as NativeResult;
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

    async stop(): Promise<boolean> {
        try {
            const result = await this.nativeEngine.stop() as NativeResult | undefined;

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

    async seek(position: number): Promise<boolean> {
        try {
            // 如果正在播放或暂停，立即执行seek
            if (this.isPlaying || this.isPaused) {
                const result = await this.nativeEngine.seek(position) as NativeResult;
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

    setVolume(volume: number): boolean {
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

    getVolume(): number {
        return this.volume;
    }

    async getPosition(): Promise<number> {
        try {
            const result = await this.nativeEngine.getPosition() as NativeResult<{position?: number}>;
            return result.position || 0.0;
        } catch (error) {
            return 0.0;
        }
    }

    getDuration(): number {
        return this.duration;
    }

    getCurrentTrack(): WasapiTrack | null {
        return this.currentTrack;
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

    setPlaylist(tracks: TrackSource[], startIndex = 0): boolean {
        this.playlist = tracks || [];
        this.currentIndex = startIndex;
        return true;
    }

    async nextTrack(nextIndex: number | null = null): Promise<boolean> {
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
        const filePath = getTrackFilePath(nextTrack);

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

    async previousTrack(prevIndex: number | null = null): Promise<boolean> {
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
        const filePath = getTrackFilePath(prevTrack);

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

    setGaplessPlayback(enabled: boolean): void {
        this.gaplessPlaybackEnabled = enabled;
        console.log(`🎵 WasapiEngine: 无间隙播放${enabled ? '启用' : '禁用'}`);
    }

    getGaplessPlayback(): boolean {
        return this.gaplessPlaybackEnabled;
    }

    onTrackEnded(): void {
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

    startProgressTimer(): void {
        this.stopProgressTimer();
        this.progressTimer = setInterval(async () => {
            if (this.isPlaying && this.onPositionChanged) {
                this.onPositionChanged(await this.getPosition());
            }
        }, 50);
    }

    stopProgressTimer(): void {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    destroy(): void {
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

    async switchShareMode(mode: WasapiShareMode): Promise<boolean> {
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
            const result = await this.nativeEngine.switchShareMode(mode) as NativeResult;
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
    getEqualizer(): WasapiEqualizer | null {
        if (!this.nativeEngine) {
            return null;
        }

        // 创建一个均衡器代理对象，将调用转发到Rust引擎
        return new WasapiEqualizer(this.nativeEngine);
    }

    // 获取参量均衡器实例
    getParametricEqualizer(): ParametricEqualizer | null {
        return this.parametricEqualizer;
    }

    // 设置均衡器启用状态
    setEqualizerEnabled(enabled: boolean): void {
        if (this.nativeEngine) {
            this.nativeEngine.setEqualizerEnabled(enabled);
        }
    }

    // 设置均衡器模式 ('graphic' 或 'parametric')
    async setEqualizerMode(mode: EqualizerMode): Promise<boolean> {
        if (!this.nativeEngine?.setEqualizerMode) {
            console.warn('⚠️ 均衡器模式切换不支持');
            return false;
        }

        try {
            const result = await this.nativeEngine.setEqualizerMode(mode) as NativeResult;
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
    async getEqualizerMode(): Promise<EqualizerMode> {
        if (!this.nativeEngine?.getEqualizerMode) {
            return 'graphic'; // 默认返回图形模式
        }

        try {
            const result = await this.nativeEngine.getEqualizerMode() as NativeResult<{mode?: EqualizerMode}>;
            if (result.success) {
                return result.mode || 'graphic';
            }
            return 'graphic';
        } catch (error) {
            console.error('❌ 获取均衡器模式失败:', error);
            return 'graphic';
        }
    }
}

export default WasapiEngine;
