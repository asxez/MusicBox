import {api} from '@api/api';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {Track} from '@api/types/track';

type PlaybackEventName =
    | 'durationChanged'
    | 'positionChanged'
    | 'playbackStateChanged'
    | 'volumeChanged'
    | 'trackChanged'
    | 'trackIndexChanged';

type PlaybackEventHandler<K extends PlaybackEventName> = (payload: MusicBoxAPIEvents[K]) => void;
type Unsubscribe = () => void;

class PlaybackController {
    private toggleInProgress = false;

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
        return api.getVolume();
    }

    getCurrentTrack(): Track | null {
        return api.getCurrentTrack?.() ?? null;
    }

    getCurrentTrackSnapshot(): Track | null {
        return api.currentTrack ?? null;
    }

    togglePlayMode(): PlayMode {
        return api.togglePlayMode();
    }

    getPlayMode(): PlayMode {
        return api.getPlayMode();
    }

    on<K extends PlaybackEventName>(event: K, handler: PlaybackEventHandler<K>): Unsubscribe {
        api.on(event, handler);
        return () => {
            api.off(event, handler);
        };
    }
}

export const playbackController = new PlaybackController();
export type {PlaybackEventHandler, PlaybackEventName, Unsubscribe};
export {PlaybackController};
