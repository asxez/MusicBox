import {appEventService} from "@js/features/events/service/AppEventService";
import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {APIEventBindingHost} from './AppRuntimePorts';
import type {ManagedAPIListener} from '@js/shared/types/AppContracts';
import type {PlaybackUIFacade} from './ui/PlaybackUIFacade';
import type {QueueUIFacade} from './ui/QueueUIFacade';

interface APIEventBinderOptions {
    apiEventListeners: ManagedAPIListener[];
    playbackUI: PlaybackUIFacade;
    queueUI: QueueUIFacade;
}

export class APIEventBinder {
    private readonly apiEventListeners: ManagedAPIListener[];
    private readonly playbackUI: PlaybackUIFacade;
    private readonly queueUI: QueueUIFacade;

    constructor({apiEventListeners, playbackUI, queueUI}: APIEventBinderOptions) {
        this.apiEventListeners = apiEventListeners;
        this.playbackUI = playbackUI;
        this.queueUI = queueUI;
    }

    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void {
        appEventService.on(event, handler);
        this.apiEventListeners.push({event, handler} as ManagedAPIListener);
    }

    dispose(): void {
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                appEventService.off(event, handler as any);
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
                this.queueUI.syncQueueTracks(tracks, playbackUiStateService.getState().currentIndex);
            }
        });

        this.addManagedAPIEventListener('libraryTrackDurationUpdated', ({filePath, duration}) => {
            console.log('🎵 更新音乐库歌曲时长:', filePath, duration.toFixed(2) + 's');
            app.updateLibraryTrackDuration(filePath, duration);
        });

        this.addManagedAPIEventListener('playModeChanged', (mode) => {
            this.playbackUI.updatePlayModeDisplay(mode);
        });

        this.addManagedAPIEventListener('trackChanged', async (track) => {
            await this.playbackUI.showLyricsForTrack(track);
        });

        this.addManagedAPIEventListener('positionChanged', (position) => {
            if (this.playbackUI.isLyricsVisible()) {
                const currentTrack = playbackUiStateService.getCurrentTrackSnapshot();
                const duration = currentTrack?.duration || playbackUiStateService.getDuration();
                this.playbackUI.updateLyricsProgress(position, duration);
            }
        });

        this.addManagedAPIEventListener('playbackStateChanged', (_state) => {
            this.playbackUI.updateLyricsPlayButton();
        });

        this.addManagedAPIEventListener('scanProgress', (progress) => {
            app.updateScanProgress(progress);
        });
    }
}
