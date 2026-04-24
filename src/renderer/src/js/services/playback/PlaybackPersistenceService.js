class PlaybackPersistenceService {
    constructor({cacheManager, getState, delay = 1000}) {
        this.cacheManager = cacheManager;
        this.getState = getState;
        this.delay = delay;
        this.savePositionTimeout = null;
    }

    throttledSavePosition(position) {
        if (this.savePositionTimeout) {
            clearTimeout(this.savePositionTimeout);
        }

        this.savePositionTimeout = setTimeout(() => {
            this.savePosition(position);
        }, this.delay);
    }

    savePosition(position) {
        const settings = this.cacheManager.getLocalCache('musicbox-settings') || {};

        if (!settings.rememberPosition) {
            return;
        }

        const state = this.getState();
        const playbackState = {
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

    saveCurrentPlaybackState() {
        const settings = this.cacheManager.getLocalCache('musicbox-settings') || {};

        if (!settings.rememberPosition) {
            return;
        }

        const state = this.getState();
        const playbackState = {
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

    destroy() {
        if (this.savePositionTimeout) {
            clearTimeout(this.savePositionTimeout);
            this.savePositionTimeout = null;
        }
    }
}

export {PlaybackPersistenceService};

