import {appEventController} from "@js/features/events";
import {playbackController} from "@js/features/playback";
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {APIEventBindingHost, AppComponentPort} from './AppRuntimePorts';
import type {ManagedAPIListener} from '@js/shared/types/AppContracts';
import {AppUIFacade} from './AppUIFacade';

interface APIEventBinderOptions {
    apiEventListeners: ManagedAPIListener[];
    components: AppComponentPort;
}

export class APIEventBinder {
    private readonly apiEventListeners: ManagedAPIListener[];
    private readonly ui: AppUIFacade;

    constructor({apiEventListeners, components}: APIEventBinderOptions) {
        this.apiEventListeners = apiEventListeners;
        this.ui = new AppUIFacade(components);
    }

    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void {
        appEventController.on(event, handler);
        this.apiEventListeners.push({event, handler} as ManagedAPIListener);
    }

    dispose(): void {
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                appEventController.off(event, handler as any);
            } catch (error) {
                console.warn('Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners.length = 0;
    }

    bindAppEvents(app: APIEventBindingHost): void {
        this.addManagedAPIEventListener('libraryUpdated', async () => {
            await app.refreshLibrary();
        });

        this.addManagedAPIEventListener('playlistChanged', (tracks) => {
            console.log('🎵 API播放列表改变:', tracks.length, '首歌曲');
            if (tracks.length > 0) {
                this.ui.syncQueueTracks(tracks, playbackController.getCurrentIndex());
            }
        });

        this.addManagedAPIEventListener('libraryTrackDurationUpdated', ({filePath, duration}) => {
            console.log('🎵 更新音乐库歌曲时长:', filePath, duration.toFixed(2) + 's');
            app.updateLibraryTrackDuration(filePath, duration);
        });

        this.addManagedAPIEventListener('playModeChanged', (mode) => {
            this.ui.updatePlayModeDisplay(mode);
        });

        this.addManagedAPIEventListener('trackChanged', async (track) => {
            await this.ui.showLyricsForTrack(track);
        });

        this.addManagedAPIEventListener('positionChanged', (position) => {
            if (this.ui.isLyricsVisible()) {
                const currentTrack = playbackController.getCurrentTrackSnapshot();
                const duration = currentTrack?.duration || playbackController.getDuration();
                this.ui.updateLyricsProgress(position, duration);
            }
        });

        this.addManagedAPIEventListener('playbackStateChanged', (_state) => {
            this.ui.updateLyricsPlayButton();
        });

        this.addManagedAPIEventListener('scanProgress', (progress) => {
            app.updateScanProgress(progress);
        });
    }
}
