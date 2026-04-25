import type {PlaybackStateSnapshot} from "@api/types/playback";
import type {MusicBoxSettings} from "@api/types/settings";
import type {PlaybackState} from "./PlaybackStateStore";

interface CacheManagerLike {
    getLocalCache<T = unknown>(key: string): T | null;
    setLocalCache(key: string, data: unknown): void;
}

interface PlaybackPersistenceServiceOptions {
    cacheManager: CacheManagerLike;
    getState: () => PlaybackState;
    delay?: number;
}

class PlaybackPersistenceService {
    private readonly cacheManager: CacheManagerLike;
    private readonly getState: () => PlaybackState;
    private readonly delay: number;
    private savePositionTimeout: ReturnType<typeof setTimeout> | null;

    constructor({cacheManager, getState, delay = 1000}: PlaybackPersistenceServiceOptions) {
        this.cacheManager = cacheManager;
        this.getState = getState;
        this.delay = delay;
        this.savePositionTimeout = null;
    }

    throttledSavePosition(position: number): void {
        if (this.savePositionTimeout) {
            clearTimeout(this.savePositionTimeout);
        }

        this.savePositionTimeout = setTimeout(() => {
            this.savePosition(position);
        }, this.delay);
    }

    savePosition(position: number): void {
        const settings = this.cacheManager.getLocalCache<MusicBoxSettings>('musicbox-settings') || {};

        if (!settings.rememberPosition) {
            return;
        }

        const state = this.getState();
        const playbackState: PlaybackStateSnapshot = {
            currentTrack: state.currentTrack,
            position,
            isPlaying: state.isPlaying,
            playlist: state.playlist,
            currentIndex: state.currentIndex,
            playMode: state.playMode,
            timestamp: Date.now()
        };

        this.cacheManager.setLocalCache('playback-state', playbackState);
    }

    saveCurrentPlaybackState(): void {
        const settings = this.cacheManager.getLocalCache<MusicBoxSettings>('musicbox-settings') || {};

        if (!settings.rememberPosition) {
            return;
        }

        const state = this.getState();
        const playbackState: PlaybackStateSnapshot = {
            currentTrack: state.currentTrack,
            position: state.position,
            isPlaying: state.isPlaying,
            playlist: state.playlist,
            currentIndex: state.currentIndex,
            playMode: state.playMode,
            timestamp: Date.now()
        };

        this.cacheManager.setLocalCache('playback-state', playbackState);
    }

    destroy(): void {
        if (this.savePositionTimeout) {
            clearTimeout(this.savePositionTimeout);
            this.savePositionTimeout = null;
        }
    }
}

export {PlaybackPersistenceService};

