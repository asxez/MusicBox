import {cacheManager} from "@services/CacheManager";

export class PlaybackPersistence {
    constructor({getPlaybackState}) {
        this.getPlaybackState = getPlaybackState;
        this.savePositionTimeout = null;
    }

    isRememberPositionEnabled() {
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};
        return !!settings.rememberPosition;
    }

    createPlaybackState(position) {
        const state = this.getPlaybackState();
        return {
            ...state,
            position: position ?? state.position,
            timestamp: Date.now()
        };
    }

    throttledSavePosition(position) {
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

    saveCurrentPlaybackState() {
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
