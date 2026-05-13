/**
 * 音频引擎管理器
 * 负责在WebAudioEngine和WasapiEngine之间切换
 */

import {nativeAudioGateway} from "@js/infrastructure/electron";
import {WebAudioEngine} from '@services/audio/WebAudioEngine';

export type AudioEngineType = 'webaudio' | 'wasapi';

type TrackLike = string | {
    filePath?: string;
    path?: string;
    [key: string]: unknown;
};

interface AudioEngineState {
    volume: number;
    playlist: TrackLike[];
    currentIndex: number;
    position: number;
    isPlaying: boolean;
    gaplessEnabled: boolean;
    currentTrack?: unknown;
}

interface AudioEngineBridge {
    nativeEngine?: {
        getShareMode?(): Promise<unknown>;
        setShareMode?(mode: unknown): Promise<unknown>;
    };
    isPlaying: boolean;
    isPaused?: boolean;
    duration?: number;
    currentTrack?: unknown;
    playlist?: TrackLike[];
    currentIndex?: number;
    onTrackChanged: ((track: unknown) => void | Promise<void>) | null;
    onPlaybackStateChanged: ((isPlaying: boolean) => void | Promise<void>) | null;
    onPositionChanged: ((position: number) => void | Promise<void>) | null;
    onVolumeChanged: ((volume: number) => void) | null;
    getNextTrackIndex: (() => number) | null;
    getPreviousTrackIndex: (() => number) | null;
    initialize(): Promise<boolean>;
    destroy(): void;
    loadTrack(filePath: string): Promise<boolean>;
    play(): Promise<boolean>;
    pause(): Promise<boolean>;
    stop(): Promise<boolean> | boolean;
    seek(position: number): Promise<boolean>;
    setVolume(volume: number): boolean;
    getVolume(): number;
    getPosition(): Promise<number>;
    getDuration(): number;
    getCurrentTrack(): unknown;
    getEqualizer(): unknown;
    setEqualizerEnabled(enabled: boolean): unknown;
    setPlaylist(tracks: TrackLike[], startIndex?: number): boolean;
    nextTrack(nextIndex?: number | null): Promise<boolean>;
    previousTrack(prevIndex?: number | null): Promise<boolean>;
    setGaplessPlayback(enabled: boolean): void;
    getGaplessPlayback(): boolean;
    switchShareMode?(mode: unknown): Promise<boolean>;
}

type AudioEngineConstructor = new () => AudioEngineBridge;

class AudioEngineManager {
    public currentEngine: AudioEngineBridge | null;
    public engineType: AudioEngineType;
    private WasapiEngine: AudioEngineConstructor | null;
    private savedState: AudioEngineState;
    public onTrackChanged: ((track: unknown) => void | Promise<void>) | null;
    public onPlaybackStateChanged: ((isPlaying: boolean) => void | Promise<void>) | null;
    public onPositionChanged: ((position: number) => void | Promise<void>) | null;
    public onVolumeChanged: ((volume: number) => void) | null;
    public getNextTrackIndex: (() => number) | null;
    public getPreviousTrackIndex: (() => number) | null;

    constructor() {
        this.currentEngine = null;
        this.engineType = 'webaudio'; // 'webaudio' 或 'wasapi'
        this.WasapiEngine = null; // 延迟加载

        // 保存的状态，用于引擎切换时恢复
        this.savedState = {
            volume: 0.7,
            playlist: [],
            currentIndex: -1,
            position: 0,
            isPlaying: false,
            gaplessEnabled: true
        };

        // 事件回调（代理到当前引擎）
        this.onTrackChanged = null;
        this.onPlaybackStateChanged = null;
        this.onPositionChanged = null;
        this.onVolumeChanged = null;
        this.getNextTrackIndex = null;
        this.getPreviousTrackIndex = null;
    }

    /**
     * 初始化引擎管理器
     * @param {string} engineType - 引擎类型 'webaudio' 或 'wasapi'
     * @returns {Promise<boolean>}
     */
    async initialize(engineType: AudioEngineType = 'webaudio'): Promise<boolean> {
        try {
            this.engineType = engineType;
            if (engineType === 'wasapi') {
                // 尝试加载WASAPI引擎
                const wasapiAvailable = await this.checkWasapiAvailability();
                if (!wasapiAvailable) {
                    console.warn('⚠️ WASAPI引擎不可用，回退到WebAudio引擎');
                    this.engineType = 'webaudio';
                }
            }

            return await this.createEngine(this.engineType);
        } catch (error) {
            console.error('❌ 引擎管理器初始化失败:', error);
            return false;
        }
    }

    /**
     * 检查WASAPI引擎是否可用
     * @returns {Promise<boolean>}
     */
    async checkWasapiAvailability(): Promise<boolean> {
        try {
            const {default: WasapiEngine} = await import('./WasapiEngine.js') as {default: AudioEngineConstructor};
            this.WasapiEngine = WasapiEngine;

            // 检查Native模块是否可用
            if (!nativeAudioGateway.isAvailable()) {
                console.warn('⚠️ Native音频模块未加载');
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ WASAPI引擎检查失败:', error);
            return false;
        }
    }

    /**
     * 创建指定类型的引擎
     * @param {string} engineType
     * @returns {Promise<boolean>}
     */
    async createEngine(engineType: AudioEngineType): Promise<boolean> {
        try {
            let engine: AudioEngineBridge;

            if (engineType === 'wasapi' && this.WasapiEngine) {
                console.log('🎵 创建WASAPI独占引擎');
                engine = new this.WasapiEngine();
            } else {
                console.log('🎵 创建WebAudio引擎');
                engine = new WebAudioEngine() as AudioEngineBridge;
            }

            const initialized = await engine.initialize();
            if (!initialized) {
                throw new Error('引擎初始化失败');
            }

            this.currentEngine = engine;
            this.setupEngineCallbacks();
            console.log(`✅ ${engineType === 'wasapi' ? 'WASAPI' : 'WebAudio'}引擎初始化成功`);
            return true;
        } catch (error) {
            console.error('❌ 创建引擎失败:', error);
            return false;
        }
    }

    /**
     * 设置引擎回调
     */
    setupEngineCallbacks(): void {
        if (!this.currentEngine) return;

        this.currentEngine.onTrackChanged = (track) => {
            if (this.onTrackChanged) this.onTrackChanged(track);
        };

        this.currentEngine.onPlaybackStateChanged = (isPlaying) => {
            if (this.onPlaybackStateChanged) this.onPlaybackStateChanged(isPlaying);
        };

        this.currentEngine.onPositionChanged = (position) => {
            if (this.onPositionChanged) this.onPositionChanged(position);
        };

        this.currentEngine.onVolumeChanged = (volume) => {
            if (this.onVolumeChanged) this.onVolumeChanged(volume);
        };

        this.currentEngine.getNextTrackIndex = () => {
            return this.getNextTrackIndex ? this.getNextTrackIndex() : -1;
        };

        this.currentEngine.getPreviousTrackIndex = () => {
            return this.getPreviousTrackIndex ? this.getPreviousTrackIndex() : -1;
        };
    }

    /**
     * 切换引擎类型
     * @param {string} newEngineType - 新引擎类型
     * @returns {Promise<boolean>}
     */
    async switchEngine(newEngineType: AudioEngineType): Promise<boolean> {
        if (newEngineType === this.engineType) {
            console.log('ℹ️ 引擎类型未变化，无需切换');
            return true;
        }

        try {
            console.log(`🔄 切换引擎: ${this.engineType} -> ${newEngineType}`);

            // 保存当前状态
            await this.saveCurrentState();

            // 销毁旧引擎
            if (this.currentEngine) {
                this.currentEngine.destroy();
                this.currentEngine = null;
            }

            // 创建新引擎
            this.engineType = newEngineType;
            const success = await this.createEngine(newEngineType);

            if (success) {
                // 恢复状态
                await this.restoreState();
                console.log('✅ 引擎切换成功');
                return true;
            } else {
                console.error('❌ 新引擎创建失败');
                return false;
            }
        } catch (error) {
            console.error('❌ 引擎切换失败:', error);
            return false;
        }
    }

    /**
     * 保存当前引擎状态
     */
    async saveCurrentState(): Promise<void> {
        if (!this.currentEngine) return;

        try {
            this.savedState = {
                volume: this.currentEngine.getVolume(),
                playlist: this.currentEngine.playlist || [],
                currentIndex: this.currentEngine.currentIndex || -1,
                position: await this.currentEngine.getPosition(),
                isPlaying: this.currentEngine.isPlaying,
                gaplessEnabled: this.currentEngine.getGaplessPlayback(),
                currentTrack: this.currentEngine.getCurrentTrack()
            };

            console.log('💾 已保存引擎状态:', this.savedState);
        } catch (error) {
            console.error('❌ 保存状态失败:', error);
        }
    }

    /**
     * 恢复引擎状态
     */
    async restoreState(): Promise<void> {
        if (!this.currentEngine) return;

        try {
            // 恢复音量
            this.currentEngine.setVolume(this.savedState.volume);

            // 恢复无间隙播放设置
            this.currentEngine.setGaplessPlayback(this.savedState.gaplessEnabled);

            // 恢复播放列表
            if (this.savedState.playlist.length > 0) {
                this.currentEngine.setPlaylist(this.savedState.playlist, this.savedState.currentIndex);

                // 如果之前在播放，重新加载并播放
                if (this.savedState.currentIndex >= 0) {
                    const track = this.savedState.playlist[this.savedState.currentIndex];
                    const filePath = getTrackFilePath(track);

                    if (filePath) {
                        await this.currentEngine.loadTrack(filePath);

                        // 恢复播放位置
                        if (this.savedState.position > 0) {
                            await this.currentEngine.seek(this.savedState.position);
                        }

                        // 如果之前在播放，继续播放
                        if (this.savedState.isPlaying) {
                            await this.currentEngine.play();
                        }
                    }
                }
            }

            console.log('✅ 已恢复引擎状态');
        } catch (error) {
            console.error('❌ 恢复状态失败:', error);
        }
    }

    /**
     * 获取当前引擎类型
     * @returns {string}
     */
    getEngineType(): AudioEngineType {
        return this.engineType;
    }

    // ==================== 代理方法 ====================
    // 以下方法将调用转发到当前引擎

    async loadTrack(filePath: string): Promise<boolean> {
        return this.currentEngine?.loadTrack(filePath) || false;
    }

    async play(): Promise<boolean> {
        return await this.currentEngine?.play() || false;
    }

    async pause(): Promise<boolean> {
        return await this.currentEngine?.pause() || false;
    }

    async stop(): Promise<boolean> {
        return await this.currentEngine?.stop() || false;
    }

    async seek(position: number): Promise<boolean> {
        return this.currentEngine?.seek(position) || false;
    }

    setVolume(volume: number): boolean {
        return this.currentEngine?.setVolume(volume) || false;
    }

    getVolume(): number {
        return this.currentEngine?.getVolume() || 0.7;
    }

    async getPosition(): Promise<number> {
        return await this.currentEngine?.getPosition() || 0;
    }

    getDuration(): number {
        return this.currentEngine?.getDuration() || 0;
    }

    getCurrentTrack(): unknown {
        return this.currentEngine?.getCurrentTrack() || null;
    }

    getEqualizer(): unknown {
        return this.currentEngine?.getEqualizer() || undefined;
    }

    setEqualizerEnabled(enabled: boolean): unknown {
        return this.currentEngine?.setEqualizerEnabled(enabled);
    }

    setPlaylist(tracks: TrackLike[], startIndex = 0): boolean {
        return this.currentEngine?.setPlaylist(tracks, startIndex) || false;
    }

    async nextTrack(nextIndex: number | null = null): Promise<boolean> {
        return this.currentEngine?.nextTrack(nextIndex) || false;
    }

    async previousTrack(prevIndex: number | null = null): Promise<boolean> {
        return this.currentEngine?.previousTrack(prevIndex) || false;
    }

    setGaplessPlayback(enabled: boolean): void {
        this.currentEngine?.setGaplessPlayback(enabled);
    }

    getGaplessPlayback(): boolean {
        return this.currentEngine?.getGaplessPlayback() || false;
    }

    destroy(): void {
        if (this.currentEngine) {
            this.currentEngine.destroy();
            this.currentEngine = null;
        }
    }

    // 代理其他属性访问
    get isPlaying(): boolean {
        return this.currentEngine?.isPlaying || false;
    }

    get isPaused(): boolean {
        return this.currentEngine?.isPaused || false;
    }

    get currentIndex(): number {
        return this.currentEngine?.currentIndex || -1;
    }

    set currentIndex(value: number) {
        if (this.currentEngine) {
            this.currentEngine.currentIndex = value;
        }
    }

    get playlist(): TrackLike[] {
        return this.currentEngine?.playlist || [];
    }

    get duration(): number {
        return this.currentEngine?.duration || 0;
    }

    get currentTrack(): unknown {
        return this.currentEngine?.currentTrack || null;
    }
}

function getTrackFilePath(track: TrackLike): string | null {
    if (typeof track === 'string') {
        return track;
    }

    return track.filePath || track.path || null;
}

export default AudioEngineManager;
