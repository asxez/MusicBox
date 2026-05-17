import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlaybackStateSnapshot, PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {PlaybackState, Unsubscribe} from '../PlaybackStore';
import type {AudioEngineManagerBridge, AudioEngineType} from './AudioEngineAdapter';
import {playbackApiAdapter} from './PlaybackApiAdapter';

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

export class PlaybackService {
    getInitialState(): PlaybackState {
        return playbackApiAdapter.getInitialState();
    }

    async play(): Promise<boolean> {
        return await playbackApiAdapter.play();
    }

    async pause(): Promise<boolean> {
        return await playbackApiAdapter.pause();
    }

    async stop(): Promise<boolean> {
        return await playbackApiAdapter.stop();
    }

    async initializeAudio(): Promise<boolean> {
        return await playbackApiAdapter.initializeAudio();
    }

    async loadTrack(filePath: string): Promise<boolean> {
        return await playbackApiAdapter.loadTrack(filePath);
    }

    async previousTrack(): Promise<boolean> {
        return await playbackApiAdapter.previousTrack();
    }

    async nextTrack(): Promise<boolean> {
        return await playbackApiAdapter.nextTrack();
    }

    async seek(position: number): Promise<boolean> {
        return await playbackApiAdapter.seek(position);
    }

    async seekForward(seconds = 10): Promise<boolean> {
        return await playbackApiAdapter.seekForward(seconds);
    }

    async seekBackward(seconds = 10): Promise<boolean> {
        return await playbackApiAdapter.seekBackward(seconds);
    }

    async setVolume(volume: number): Promise<boolean> {
        return await playbackApiAdapter.setVolume(volume);
    }

    async setPosition(position: number): Promise<boolean> {
        return await playbackApiAdapter.setPosition(position);
    }

    async setPlaylist(tracks: Track[], startIndex = -1): Promise<boolean> {
        return await playbackApiAdapter.setPlaylist(tracks, startIndex);
    }

    async getPosition(): Promise<number> {
        return await playbackApiAdapter.getPosition();
    }

    getCurrentTrack(): Track | null {
        return playbackApiAdapter.getCurrentTrack();
    }

    togglePlayMode(): PlayMode {
        return playbackApiAdapter.togglePlayMode();
    }

    setPlayMode(mode: PlayMode): boolean {
        return playbackApiAdapter.setPlayMode(mode);
    }

    getPlayMode(): PlayMode {
        return playbackApiAdapter.getPlayMode();
    }

    getPlaybackSnapshot(state: Readonly<PlaybackState>): PlaybackStateSnapshot {
        return {
            currentTrack: state.currentTrack,
            position: state.position,
            isPlaying: state.isPlaying,
            playlist: state.playlist,
            currentIndex: state.currentIndex,
            playMode: state.playMode,
            timestamp: Date.now()
        };
    }

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        return playbackApiAdapter.on(event, handler);
    }

    setGaplessPlayback(enabled: boolean): void {
        playbackApiAdapter.setGaplessPlayback(enabled);
    }

    getEqualizer<T = unknown>(): T | null {
        return playbackApiAdapter.getEqualizer<T>();
    }

    setEqualizerEnabled(enabled: boolean): void {
        playbackApiAdapter.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return playbackApiAdapter.getAudioEngine<T>();
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        return await playbackApiAdapter.switchAudioEngine(engineType);
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        return await playbackApiAdapter.switchWasapiShareMode(mode);
    }
}

export const playbackService = new PlaybackService();
