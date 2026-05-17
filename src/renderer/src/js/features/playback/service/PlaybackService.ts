import {api} from '@api/api';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlaybackStateSnapshot, PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {PlaybackState, Unsubscribe} from '../PlaybackStore';
import type {AudioEngineType} from './AudioEngineAdapter';

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
        return {
            currentTrack: api.currentTrack ?? null,
            currentIndex: api.currentIndex,
            playlist: api.playlist,
            isPlaying: api.isPlaying,
            position: api.position,
            duration: api.duration,
            volume: api.volume,
            playMode: api.getPlayMode()
        };
    }

    async play(): Promise<boolean> {
        return await api.play();
    }

    async pause(): Promise<boolean> {
        return await api.pause();
    }

    async stop(): Promise<boolean> {
        return await api.stop();
    }

    async initializeAudio(): Promise<boolean> {
        return await api.initializeAudio();
    }

    async loadTrack(filePath: string): Promise<boolean> {
        return await api.loadTrack(filePath);
    }

    async previousTrack(): Promise<boolean> {
        return await api.previousTrack();
    }

    async nextTrack(): Promise<boolean> {
        return await api.nextTrack();
    }

    async seek(position: number): Promise<boolean> {
        return await api.seek(position);
    }

    async seekForward(seconds = 10): Promise<boolean> {
        return await api.seekForward(seconds);
    }

    async seekBackward(seconds = 10): Promise<boolean> {
        return await api.seekBackward(seconds);
    }

    async setVolume(volume: number): Promise<boolean> {
        return await api.setVolume(Math.max(0, Math.min(1, volume)));
    }

    async setPosition(position: number): Promise<boolean> {
        return await api.setPosition(position);
    }

    async setPlaylist(tracks: Track[], startIndex = -1): Promise<boolean> {
        return await api.setPlaylist(tracks, startIndex);
    }

    async getPosition(): Promise<number> {
        return await api.getPosition();
    }

    getCurrentTrack(): Track | null {
        return api.getCurrentTrack?.() ?? null;
    }

    togglePlayMode(): PlayMode {
        return api.togglePlayMode();
    }

    setPlayMode(mode: PlayMode): boolean {
        return api.setPlayMode(mode);
    }

    getPlayMode(): PlayMode {
        return api.getPlayMode();
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
        api.on(event, handler);
        return () => {
            api.off(event, handler);
        };
    }

    setGaplessPlayback(enabled: boolean): void {
        api.setGaplessPlayback(enabled);
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        return await api.switchAudioEngine(engineType);
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        return await api.switchWasapiShareMode(mode);
    }
}

export const playbackService = new PlaybackService();
