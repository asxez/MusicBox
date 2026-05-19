import type {PlaybackStateSnapshot, PlayMode} from '@api/types/playback';
import type {Track} from '@api/types/track';
import {PlaybackStore} from '../PlaybackStore';
import type {PlaybackState, PlaybackStoreListener, Unsubscribe} from '../PlaybackStore';
import {playbackService} from './PlaybackService';
import type {PlaybackEventHandler, PlaybackEventName} from './PlaybackRuntimePort';

export class PlaybackUiStateService {
    private readonly store: PlaybackStore;
    private toggleInProgress = false;

    constructor() {
        this.store = new PlaybackStore(playbackService.getInitialState());
        this.bindPlaybackEvents();
    }

    getState(): Readonly<PlaybackState> {
        return this.store.getState();
    }

    subscribe(listener: PlaybackStoreListener): Unsubscribe {
        return this.store.subscribe(listener);
    }

    async toggleCurrentPlayback(): Promise<boolean> {
        if (this.toggleInProgress) {
            console.log('🚫 PlaybackUiStateService: 播放状态切换正在进行中，忽略重复调用');
            return false;
        }

        this.toggleInProgress = true;
        try {
            return this.isPlaying() ? await this.pause() : await this.play();
        } finally {
            setTimeout(() => {
                this.toggleInProgress = false;
            }, 100);
        }
    }

    async play(): Promise<boolean> {
        return await playbackService.play();
    }

    async pause(): Promise<boolean> {
        return await playbackService.pause();
    }

    async stop(): Promise<boolean> {
        return await playbackService.stop();
    }

    async previousTrack(): Promise<boolean> {
        return await playbackService.previousTrack();
    }

    async nextTrack(): Promise<boolean> {
        return await playbackService.nextTrack();
    }

    async seek(position: number): Promise<boolean> {
        return await playbackService.seek(position);
    }

    async setVolume(volume: number): Promise<boolean> {
        return await playbackService.setVolume(volume);
    }

    async adjustVolume(delta: number): Promise<boolean> {
        return await this.setVolume(this.getVolume() + delta);
    }

    getVolume(): number {
        return this.store.getState().volume;
    }

    isPlaying(): boolean {
        return this.store.getState().isPlaying;
    }

    getCurrentTrack(): Track | null {
        return playbackService.getCurrentTrack();
    }

    getCurrentTrackSnapshot(): Track | null {
        return this.store.getState().currentTrack;
    }

    getCurrentTrackSummary(): Pick<Track, 'title' | 'artist' | 'album'> | null {
        const track = this.getCurrentTrackSnapshot();
        if (!track) {
            return null;
        }

        return {
            title: track.title,
            artist: track.artist,
            album: track.album
        };
    }

    getDuration(): number {
        return this.store.getState().duration;
    }

    getPlaylist(): Track[] {
        return this.store.getState().playlist;
    }

    async setPlaylist(tracks: Track[], startIndex = -1): Promise<boolean> {
        return await playbackService.setPlaylist(tracks, startIndex);
    }

    setPlayMode(mode: PlayMode): boolean {
        return playbackService.setPlayMode(mode);
    }

    togglePlayMode(): PlayMode {
        return playbackService.togglePlayMode();
    }

    getPlayMode(): PlayMode {
        return this.store.getState().playMode;
    }

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        return playbackService.on(event, handler);
    }

    getPlaybackSnapshot(): PlaybackStateSnapshot {
        return playbackService.getPlaybackSnapshot(this.store.getState());
    }

    syncStateFromRuntime(): void {
        const changes = playbackService.syncStateFromRuntime(this.store.getState());
        changes.forEach((change) => {
            switch (change.type) {
                case 'trackChanged':
                    this.store.setTrack(change.payload);
                    break;
                case 'trackIndexChanged':
                    this.store.setTrackIndex(change.payload);
                    break;
                case 'playlistChanged':
                    this.store.setPlaylist(change.payload);
                    break;
                case 'playbackStateChanged':
                    this.store.setPlaybackState(change.payload);
                    break;
                case 'positionChanged':
                    this.store.setPosition(change.payload);
                    break;
                case 'durationChanged':
                    this.store.setDuration(change.payload);
                    break;
                case 'volumeChanged':
                    this.store.setVolume(change.payload);
                    break;
                case 'playModeChanged':
                    this.store.setPlayMode(change.payload);
                    break;
            }
        });
    }

    private bindPlaybackEvents(): void {
        playbackService.on('durationChanged', (duration) => {
            this.store.setDuration(duration);
        });
        playbackService.on('positionChanged', (position) => {
            this.store.setPosition(position);
        });
        playbackService.on('playbackStateChanged', (state) => {
            this.store.setPlaybackState(state);
        });
        playbackService.on('volumeChanged', (volume) => {
            this.store.setVolume(volume);
        });
        playbackService.on('trackChanged', (track) => {
            this.store.setTrack(track);
        });
        playbackService.on('trackIndexChanged', (index) => {
            this.store.setTrackIndex(index);
        });
        playbackService.on('playlistChanged', (tracks) => {
            this.store.setPlaylist(tracks);
        });
        playbackService.on('playModeChanged', (mode) => {
            this.store.setPlayMode(mode);
        });
    }
}

export const playbackUiStateService = new PlaybackUiStateService();
