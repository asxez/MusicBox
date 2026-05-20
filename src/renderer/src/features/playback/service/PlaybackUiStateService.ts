import type {PlaybackStateSnapshot, PlayMode} from '@api/types/playback';
import type {Track} from '@api/types/track';
import type {PlaybackState, PlaybackStoreListener, Unsubscribe} from '../PlaybackStore';
import {playbackService} from './PlaybackService';
import {playbackStoreProvider} from './PlaybackStoreProvider';
import type {PlaybackEventHandler, PlaybackEventName} from './PlaybackRuntimePort';

export class PlaybackUiStateService {
    private toggleInProgress = false;

    getState(): Readonly<PlaybackState> {
        return playbackStoreProvider.getState();
    }

    subscribe(listener: PlaybackStoreListener): Unsubscribe {
        return playbackStoreProvider.getStore().subscribe(listener);
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
        return playbackStoreProvider.getState().volume;
    }

    isPlaying(): boolean {
        return playbackStoreProvider.getState().isPlaying;
    }

    getCurrentTrack(): Track | null {
        return playbackService.getCurrentTrack();
    }

    getCurrentTrackSnapshot(): Track | null {
        return playbackStoreProvider.getState().currentTrack;
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
        return playbackStoreProvider.getState().duration;
    }

    getPlaylist(): Track[] {
        return playbackStoreProvider.getState().playlist;
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
        return playbackStoreProvider.getState().playMode;
    }

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        return playbackService.on(event, handler);
    }

    getPlaybackSnapshot(): PlaybackStateSnapshot {
        return playbackService.getPlaybackSnapshot(playbackStoreProvider.getState());
    }

    syncStateFromRuntime(): void {
        playbackStoreProvider.syncStateFromRuntime();
    }
}

export const playbackUiStateService = new PlaybackUiStateService();
