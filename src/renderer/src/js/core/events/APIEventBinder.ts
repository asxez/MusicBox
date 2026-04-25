import {api} from "@api/api";
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {ManagedAPIListener, RendererAppContext} from '@core/types/app';

interface APIEventBinderOptions {
    apiEventListeners: ManagedAPIListener[];
}

export class APIEventBinder {
    private readonly apiEventListeners: ManagedAPIListener[];

    constructor({apiEventListeners}: APIEventBinderOptions) {
        this.apiEventListeners = apiEventListeners;
    }

    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void {
        api.on(event, handler);
        this.apiEventListeners.push({event, handler} as ManagedAPIListener);
    }

    dispose(): void {
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                api.off(event, handler);
            } catch (error) {
                console.warn('Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners.length = 0;
    }

    bindAppEvents(app: RendererAppContext): void {
        this.addManagedAPIEventListener('libraryUpdated', async () => {
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
