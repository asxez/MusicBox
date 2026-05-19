import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {AudioEngineManagerBridge, AudioEngineType} from './AudioEngineAdapter';

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
    currentTrack: Track | null;
    currentIndex: number;
    playlist: Track[];
    isPlaying: boolean;
    position: number;
    duration: number;
    volume: number;
    audioEngine: AudioEngineManagerBridge | null;
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
