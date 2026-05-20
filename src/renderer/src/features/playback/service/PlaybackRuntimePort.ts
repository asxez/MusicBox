import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {AudioEngineManagerBridge, AudioEngineType} from './AudioEngineAdapter';
import type {PlaybackRuntimeStateSnapshot} from './PlaybackRuntimeState';

export type PlaybackEventName =
    | 'durationChanged'
    | 'positionChanged'
    | 'playbackStateChanged'
    | 'volumeChanged'
    | 'trackChanged'
    | 'trackIndexChanged'
    | 'playlistChanged'
    | 'playModeChanged'
    | 'audioEngineChanged';

export type PlaybackEventHandler<K extends PlaybackEventName> = (payload: MusicBoxAPIEvents[K]) => void;

export interface PlaybackRuntimePort {
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    currentTrack: Track | null;
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    currentIndex: number;
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    playlist: Track[];
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    isPlaying: boolean;
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    position: number;
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    duration: number;
    /** @deprecated Use getPlaybackRuntimeSnapshot() for state reads. */
    volume: number;
    audioEngine: AudioEngineManagerBridge | null;
    getPlaybackRuntimeSnapshot(): Readonly<PlaybackRuntimeStateSnapshot>;
    play(): Promise<boolean>;
    pause(): Promise<boolean>;
    stop(): Promise<boolean>;
    initializeAudio(): Promise<boolean>;
    loadTrack(filePath: string): Promise<boolean>;
    previousTrack(): Promise<boolean>;
    nextTrack(): Promise<boolean>;
    seek(position: number): Promise<boolean>;
    seekForward(seconds?: number): Promise<boolean>;
    seekBackward(seconds?: number): Promise<boolean>;
    setVolume(volume: number): Promise<boolean>;
    setPosition(position: number): Promise<boolean>;
    setPlaylist(tracks: Track[], startIndex?: number): Promise<boolean>;
    getPosition(): Promise<number>;
    getCurrentTrack(): Track | null;
    togglePlayMode(): PlayMode;
    setPlayMode(mode: PlayMode): boolean;
    getPlayMode(): PlayMode;
    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): void;
    off<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): void;
    setGaplessPlayback(enabled: boolean): void;
    getEqualizer(): unknown;
    setEqualizerEnabled(enabled: boolean): void;
    switchAudioEngine(engineType: AudioEngineType): Promise<boolean>;
    switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean>;
}
