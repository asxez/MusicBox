import {api} from "@api/api";

export class APIEventBinder {
    constructor({apiEventListeners}) {
        this.apiEventListeners = apiEventListeners;
    }

    addManagedAPIEventListener(event, handler) {
        api.on(event, handler);
        this.apiEventListeners.push({event, handler});
    }

    dispose() {
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                api.off(event, handler);
            } catch (error) {
                console.warn('Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners.length = 0;
    }

    bindAppEvents(app) {
        this.addManagedAPIEventListener('libraryUpdated', async (_data) => {
            await app.refreshLibrary();
        });

        this.addManagedAPIEventListener('playlistChanged', (tracks) => {
            console.log('🎵 API播放列表改变:', tracks.length, '首歌曲');
            if (app.components.playlist && tracks.length > 0) {
                app.components.playlist.setTracks(tracks, api.currentIndex);
            }
        });

        this.addManagedAPIEventListener('libraryTrackDurationUpdated', ({filePath, duration}) => {
            console.log('🎵 更新音乐库歌曲时长:', filePath, duration.toFixed(2) + 's');
            app.updateLibraryTrackDuration(filePath, duration);
        });

        this.addManagedAPIEventListener('playModeChanged', (mode) => {
            app.components.player.updatePlayModeDisplay(mode);
        });

        this.addManagedAPIEventListener('trackChanged', async (track) => {
            if (app.components.lyrics && app.components.lyrics.isVisible) {
                await app.components.lyrics.show(track);
            }
        });

        this.addManagedAPIEventListener('positionChanged', (position) => {
            if (app.components.lyrics && app.components.lyrics.isVisible) {
                const duration = (api.currentTrack && api.currentTrack.duration) ? api.currentTrack.duration : api.duration;
                app.components.lyrics.updateProgress(position, duration);
            }
        });

        this.addManagedAPIEventListener('playbackStateChanged', (state) => {
            if (app.components.lyrics && app.components.lyrics.isVisible) {
                app.components.lyrics.updatePlayButton(state === 'playing');
            }
        });

        this.addManagedAPIEventListener('scanProgress', (progress) => {
            app.updateScanProgress(progress);
        });
    }
}
