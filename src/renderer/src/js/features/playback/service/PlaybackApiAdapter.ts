import type {PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {PlaybackState, Unsubscribe} from '../PlaybackStore';
import type {AudioEngineManagerBridge, AudioEngineType} from './AudioEngineAdapter';
import type {PlaybackEventHandler, PlaybackEventName, PlaybackRuntimePort} from './PlaybackRuntimePort';

export class PlaybackApiAdapter {
    private runtime: PlaybackRuntimePort | null = null;
    private readonly pendingHandlers = new Map<PlaybackEventName, Set<PlaybackEventHandler<PlaybackEventName>>>();

    bindRuntime(runtime: PlaybackRuntimePort): void {
        if (this.runtime === runtime) {
            return;
        }

        this.runtime = runtime;
        this.bindPendingHandlers(runtime);
    }

    getInitialState(): PlaybackState {
        const api = this.runtime;
        if (!api) {
            return this.getFallbackInitialState();
        }

        return api.getPlaybackRuntimeSnapshot();
    }

    async play(): Promise<boolean> {
        const api = this.getRuntime();
        return await api.play();
    }

    async pause(): Promise<boolean> {
        const api = this.getRuntime();
        return await api.pause();
    }

    async stop(): Promise<boolean> {
        const api = this.getRuntime();
        return await api.stop();
    }

    async initializeAudio(): Promise<boolean> {
        const api = this.getRuntime();
        return await api.initializeAudio();
    }

    async loadTrack(filePath: string): Promise<boolean> {
        const api = this.getRuntime();
        return await api.loadTrack(filePath);
    }

    async previousTrack(): Promise<boolean> {
        const api = this.getRuntime();
        return await api.previousTrack();
    }

    async nextTrack(): Promise<boolean> {
        const api = this.getRuntime();
        return await api.nextTrack();
    }

    async seek(position: number): Promise<boolean> {
        const api = this.getRuntime();
        return await api.seek(position);
    }

    async seekForward(seconds = 10): Promise<boolean> {
        const api = this.getRuntime();
        return await api.seekForward(seconds);
    }

    async seekBackward(seconds = 10): Promise<boolean> {
        const api = this.getRuntime();
        return await api.seekBackward(seconds);
    }

    async setVolume(volume: number): Promise<boolean> {
        const api = this.getRuntime();
        return await api.setVolume(Math.max(0, Math.min(1, volume)));
    }

    async setPosition(position: number): Promise<boolean> {
        const api = this.getRuntime();
        return await api.setPosition(position);
    }

    async setPlaylist(tracks: Track[], startIndex = -1): Promise<boolean> {
        const api = this.getRuntime();
        return await api.setPlaylist(tracks, startIndex);
    }

    async getPosition(): Promise<number> {
        const api = this.getRuntime();
        return await api.getPosition();
    }

    getCurrentTrack(): Track | null {
        const api = this.getRuntime();
        return api.getCurrentTrack();
    }

    togglePlayMode(): PlayMode {
        const api = this.getRuntime();
        return api.togglePlayMode();
    }

    setPlayMode(mode: PlayMode): boolean {
        const api = this.getRuntime();
        return api.setPlayMode(mode);
    }

    getPlayMode(): PlayMode {
        const api = this.getRuntime();
        return api.getPlayMode();
    }

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        const typedHandler = handler as PlaybackEventHandler<PlaybackEventName>;
        this.addPendingHandler(event, typedHandler);
        this.runtime?.on(event, handler);

        return () => {
            this.removePendingHandler(event, typedHandler);
            this.runtime?.off(event, handler);
        };
    }

    setGaplessPlayback(enabled: boolean): void {
        const api = this.getRuntime();
        api.setGaplessPlayback(enabled);
    }

    getEqualizer<T = unknown>(): T | null {
        const api = this.getRuntime();
        return api.getEqualizer() as T | null;
    }

    setEqualizerEnabled(enabled: boolean): void {
        const api = this.getRuntime();
        api.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        const api = this.getRuntime();
        return api.audioEngine as T | null;
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        const api = this.getRuntime();
        return await api.switchAudioEngine(engineType);
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        const api = this.getRuntime();
        return await api.switchWasapiShareMode(mode);
    }

    private getRuntime(): PlaybackRuntimePort {
        if (!this.runtime) {
            throw new Error('Playback runtime port has not been configured');
        }

        return this.runtime;
    }

    private getFallbackInitialState(): PlaybackState {
        return {
            currentTrack: null,
            currentIndex: -1,
            playlist: [],
            isPlaying: false,
            position: 0,
            duration: 0,
            volume: 0.7,
            playMode: 'sequence'
        };
    }

    private addPendingHandler(event: PlaybackEventName, handler: PlaybackEventHandler<PlaybackEventName>): void {
        const handlers = this.pendingHandlers.get(event) ?? new Set<PlaybackEventHandler<PlaybackEventName>>();
        handlers.add(handler);
        this.pendingHandlers.set(event, handlers);
    }

    private removePendingHandler(event: PlaybackEventName, handler: PlaybackEventHandler<PlaybackEventName>): void {
        const handlers = this.pendingHandlers.get(event);
        if (!handlers) {
            return;
        }

        handlers.delete(handler);
        if (handlers.size === 0) {
            this.pendingHandlers.delete(event);
        }
    }

    private bindPendingHandlers(runtime: PlaybackRuntimePort): void {
        this.pendingHandlers.forEach((handlers, event) => {
            handlers.forEach((handler) => {
                runtime.on(event, handler);
            });
        });
    }
}

export const playbackApiAdapter = new PlaybackApiAdapter();
