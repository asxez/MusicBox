import {api} from '@api/api';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {Track} from '@api/types/track';
import {PlaybackStore} from './PlaybackStore';
import type {PlaybackState, PlaybackStoreListener, Unsubscribe} from './PlaybackStore';

type PlaybackEventName =
    | 'durationChanged'
    | 'positionChanged'
    | 'playbackStateChanged'
    | 'volumeChanged'
    | 'trackChanged'
    | 'trackIndexChanged';

type PlaybackEventHandler<K extends PlaybackEventName> = (payload: MusicBoxAPIEvents[K]) => void;

class PlaybackController {
    private readonly store: PlaybackStore;
    private toggleInProgress = false;

    constructor() {
        this.store = new PlaybackStore({
            currentTrack: api.currentTrack ?? null,
            currentIndex: api.currentIndex,
            isPlaying: api.isPlaying,
            position: api.position,
            duration: api.duration,
            volume: api.volume,
            playMode: api.getPlayMode()
        });
        this.bindAPIEvents();
    }

    getState(): Readonly<PlaybackState> {
        return this.store.getState();
    }

    subscribe(listener: PlaybackStoreListener): Unsubscribe {
        return this.store.subscribe(listener);
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
            return await this.togglePlayPause(api.isPlaying);
        } finally {
            setTimeout(() => {
                this.toggleInProgress = false;
            }, 100);
        }
    }

    async play(): Promise<boolean> {
        return await api.play();
    }

    async pause(): Promise<boolean> {
        return await api.pause();
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

    async adjustVolume(delta: number): Promise<boolean> {
        return await this.setVolume(this.getVolume() + delta);
    }

    async toggleMute(currentVolume: number, fallbackVolume: number): Promise<boolean> {
        return await this.setVolume(currentVolume > 0 ? 0 : fallbackVolume);
    }

    getVolume(): number {
        return this.store.getState().volume;
    }

    getCurrentTrack(): Track | null {
        return api.getCurrentTrack?.() ?? null;
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

    togglePlayMode(): PlayMode {
        return api.togglePlayMode();
    }

    getPlayMode(): PlayMode {
        return this.store.getState().playMode;
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

    private bindAPIEvents(): void {
        api.on('durationChanged', (duration) => {
            this.store.setDuration(duration);
        });
        api.on('positionChanged', (position) => {
            this.store.setPosition(position);
        });
        api.on('playbackStateChanged', (state) => {
            this.store.setPlaybackState(state);
        });
        api.on('volumeChanged', (volume) => {
            this.store.setVolume(volume);
        });
        api.on('trackChanged', (track) => {
            this.store.setTrack(track);
        });
        api.on('trackIndexChanged', (index) => {
            this.store.setTrackIndex(index);
        });
        api.on('playModeChanged', (mode) => {
            this.store.setPlayMode(mode);
        });
    }
}

export const playbackController = new PlaybackController();
export type {PlaybackEventHandler, PlaybackEventName};
export type {PlaybackState, PlaybackStoreChange, PlaybackStoreListener, Unsubscribe} from './PlaybackStore';
export {PlaybackController};
