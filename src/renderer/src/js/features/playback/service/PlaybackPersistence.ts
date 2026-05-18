import {cacheManager} from '@js/shared/cache';
import type {PlaybackStateSnapshot} from '@api/types/playback';
import type {MusicBoxSettings} from '@api/types/settings';

interface PlaybackPersistenceOptions {
    getPlaybackState: () => PlaybackStateSnapshot;
}

export class PlaybackPersistence {
    private readonly getPlaybackState: () => PlaybackStateSnapshot;
    private savePositionTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor({getPlaybackState}: PlaybackPersistenceOptions) {
        this.getPlaybackState = getPlaybackState;
    }

    isRememberPositionEnabled(): boolean {
        const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
        return !!settings.rememberPosition;
    }

    createPlaybackState(position?: number): PlaybackStateSnapshot {
        const state = this.getPlaybackState();
        return {
            ...state,
            position: position ?? state.position,
            timestamp: Date.now()
        };
    }

    throttledSavePosition(position: number): void {
        if (!this.isRememberPositionEnabled()) return;

        if (this.savePositionTimeout) {
            clearTimeout(this.savePositionTimeout);
        }

        this.savePositionTimeout = setTimeout(() => {
            try {
                cacheManager.setLocalCache('playback-state', this.createPlaybackState(position));
            } catch (error) {
                console.error('❌ API: 保存播放位置失败:', error);
            }
        }, 2000);
    }

    saveCurrentPlaybackState(): void {
        if (!this.isRememberPositionEnabled()) {
            return;
        }

        try {
            const playbackState = this.createPlaybackState();

            console.log('💾 API: 保存播放状态:', {
                hasTrack: !!playbackState.currentTrack,
                trackTitle: playbackState.currentTrack?.title,
                position: playbackState.position,
                isPlaying: playbackState.isPlaying,
                playlistLength: playbackState.playlist.length,
                currentIndex: playbackState.currentIndex,
                playMode: playbackState.playMode
            });

            cacheManager.setLocalCache('playback-state', playbackState);
            console.log('✅ API: 播放状态已保存（包含播放列表）');
        } catch (error) {
            console.error('❌ API: 保存播放状态失败:', error);
        }
    }
}
