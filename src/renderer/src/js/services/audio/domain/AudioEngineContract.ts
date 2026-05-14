import type {TrackSource} from './AudioTrack';

export type AudioEngineType = 'webaudio' | 'wasapi';

export interface AudioEngineState {
    volume: number;
    playlist: TrackSource[];
    currentIndex: number;
    position: number;
    isPlaying: boolean;
    gaplessEnabled: boolean;
    currentTrack?: unknown;
}

export interface AudioEngineBridge {
    nativeEngine?: {
        getShareMode?(): Promise<unknown>;
        setShareMode?(mode: unknown): Promise<unknown>;
    };
    isPlaying: boolean;
    isPaused?: boolean;
    duration?: number;
    currentTrack?: unknown;
    playlist?: TrackSource[];
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
    setPlaylist(tracks: TrackSource[], startIndex?: number): boolean;
    nextTrack(nextIndex?: number | null): Promise<boolean>;
    previousTrack(prevIndex?: number | null): Promise<boolean>;
    setGaplessPlayback(enabled: boolean): void;
    getGaplessPlayback(): boolean;
    switchShareMode?(mode: unknown): Promise<boolean>;
}

export type AudioEngineConstructor = new () => AudioEngineBridge;
