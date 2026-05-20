import type {PlaybackStateSnapshot, PlayMode} from '@api/types/playback';
import type {WasapiShareMode} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {PlaybackState, PlaybackStoreListener, Unsubscribe} from './PlaybackStore';
import {playbackService} from './service/PlaybackService';
import {playbackStoreProvider} from './service/PlaybackStoreProvider';
import type {AudioEngineType, PlaybackEventHandler, PlaybackEventName} from './service';

class PlaybackController {
    private toggleInProgress = false;

    getState(): Readonly<PlaybackState> {
        return playbackStoreProvider.getState();
    }

    subscribe(listener: PlaybackStoreListener): Unsubscribe {
        return playbackStoreProvider.getStore().subscribe(listener);
    }

    async togglePlayPause(isPlaying: boolean): Promise<boolean> {
        return isPlaying ? await this.pause() : await this.play();
    }

    async toggleCurrentPlayback(): Promise<boolean> {
        if (this.toggleInProgress) {
            console.log('🚫 PlaybackController: 播放状态切换正在进行中，忽略重复调用');
            return false;
        }

        this.toggleInProgress = true;

        try {
            return await this.togglePlayPause(this.isPlaying());
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

    async initializeAudio(): Promise<boolean> {
        return await playbackService.initializeAudio();
    }

    async loadTrack(filePath: string): Promise<boolean> {
        return await playbackService.loadTrack(filePath);
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

    async seekForward(seconds = 10): Promise<boolean> {
        return await playbackService.seekForward(seconds);
    }

    async seekBackward(seconds = 10): Promise<boolean> {
        return await playbackService.seekBackward(seconds);
    }

    async setVolume(volume: number): Promise<boolean> {
        return await playbackService.setVolume(volume);
    }

    async setPosition(position: number): Promise<boolean> {
        return await playbackService.setPosition(position);
    }

    async setPlaylist(tracks: Track[], startIndex = -1): Promise<boolean> {
        return await playbackService.setPlaylist(tracks, startIndex);
    }

    async adjustVolume(delta: number): Promise<boolean> {
        return await this.setVolume(this.getVolume() + delta);
    }

    async toggleMute(currentVolume: number, fallbackVolume: number): Promise<boolean> {
        return await this.setVolume(currentVolume > 0 ? 0 : fallbackVolume);
    }

    getVolume(): number {
        return playbackStoreProvider.getState().volume;
    }

    isPlaying(): boolean {
        return playbackStoreProvider.getState().isPlaying;
    }

    async getPosition(): Promise<number> {
        return await playbackService.getPosition();
    }

    getCurrentTrack(): Track | null {
        return playbackService.getCurrentTrack();
    }

    getCurrentTrackSnapshot(): Track | null {
        return playbackStoreProvider.getState().currentTrack;
    }

    getCurrentIndex(): number {
        return playbackStoreProvider.getState().currentIndex;
    }

    getPlaylist(): Track[] {
        return playbackStoreProvider.getState().playlist;
    }

    getDuration(): number {
        return playbackStoreProvider.getState().duration;
    }

    getDurationSnapshot(): number {
        return playbackStoreProvider.getState().duration;
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

    togglePlayMode(): PlayMode {
        return playbackService.togglePlayMode();
    }

    setPlayMode(mode: PlayMode): boolean {
        return playbackService.setPlayMode(mode);
    }

    getPlayMode(): PlayMode {
        return playbackStoreProvider.getState().playMode;
    }

    getPlaybackSnapshot(): PlaybackStateSnapshot {
        return playbackService.getPlaybackSnapshot(playbackStoreProvider.getState());
    }

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        return playbackService.on(event, handler);
    }

    setGaplessPlayback(enabled: boolean): void {
        playbackService.setGaplessPlayback(enabled);
    }

    async switchAudioEngine(engineType: AudioEngineType): Promise<boolean> {
        return await playbackService.switchAudioEngine(engineType);
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<boolean> {
        return await playbackService.switchWasapiShareMode(mode);
    }

    syncStateFromRuntime(): void {
        playbackStoreProvider.syncStateFromRuntime();
    }
}

export const playbackController = new PlaybackController();
export type {AudioEngineType, PlaybackEventHandler, PlaybackEventName};
export type {PlaybackState, PlaybackStoreChange, PlaybackStoreListener, Unsubscribe} from './PlaybackStore';
export {PlaybackController};
