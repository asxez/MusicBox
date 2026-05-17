import {api} from '@api/api';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {PlaybackState, Unsubscribe} from '../PlaybackStore';
import type {AudioEngineManagerBridge, AudioEngineType} from './AudioEngineAdapter';
import type {PlaybackEventHandler, PlaybackEventName} from './PlaybackService';

export class PlaybackApiAdapter {
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

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        api.on(event, handler as (payload: MusicBoxAPIEvents[K]) => void);
        return () => {
            api.off(event, handler as (payload: MusicBoxAPIEvents[K]) => void);
        };
    }

    setGaplessPlayback(enabled: boolean): void {
        api.setGaplessPlayback(enabled);
    }

    getEqualizer<T = unknown>(): T | null {
        return api.getEqualizer() as T | null;
    }

    setEqualizerEnabled(enabled: boolean): void {
        api.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return api.audioEngine as T | null;
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        return await api.switchAudioEngine(engineType);
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        return await api.switchWasapiShareMode(mode);
    }
}

export const playbackApiAdapter = new PlaybackApiAdapter();
