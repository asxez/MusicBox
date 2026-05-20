import {PlaybackStore} from '../PlaybackStore';
import type {PlaybackState, PlaybackStoreChange} from '../PlaybackStore';
import {playbackService} from './PlaybackService';

class PlaybackStoreProvider {
    private readonly store: PlaybackStore;

    constructor() {
        this.store = new PlaybackStore(playbackService.getInitialState());
        this.bindPlaybackEvents();
    }

    getStore(): PlaybackStore {
        return this.store;
    }

    getState(): Readonly<PlaybackState> {
        return this.store.getState();
    }

    syncStateFromRuntime(): void {
        const changes = playbackService.syncStateFromRuntime(this.store.getState());
        changes.forEach((change) => this.applyChange(change));
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

    private applyChange(change: PlaybackStoreChange): void {
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
    }
}

export const playbackStoreProvider = new PlaybackStoreProvider();
export {PlaybackStoreProvider};
