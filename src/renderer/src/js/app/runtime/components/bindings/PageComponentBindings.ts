import type {Track} from "@api/types/track";
import type {AppView} from "@js/app/runtime/AppRuntimeTypes";

import type {
    ComponentBindingContext,
    ComponentEventName,
    ComponentNotificationPayload
} from "./ComponentBindingTypes";

export class PageComponentBindings {
    constructor(private readonly context: ComponentBindingContext) {}

    setupComponentEvents(componentName: ComponentEventName | null = null): void {
        if (componentName) {
            this.setupSingleComponentEvents(componentName);
            return;
        }

        const {app, components, ui} = this.context;

        components.homePage.on('trackPlayed', async (track: Track, index: number) => {
            await app.handleTrackPlayed(track, index);
        });

        components.homePage.on('viewChange', (view: AppView) => {
            ui.navigateToView(view);
        });

        components.homePage.on('toggleLyricsFullscreen', () => {
            ui.toggleLyricsFullscreen(false);
        });

        if (components.recentPage) {
            this.setupSingleComponentEvents('recentPage');
        }

        if (components.artistsPage) {
            this.setupSingleComponentEvents('artistsPage');
        }

        if (components.albumsPage) {
            this.setupSingleComponentEvents('albumsPage');
        }

        if (components.statisticsPage) {
            this.setupSingleComponentEvents('statisticsPage');
        }

        if (components.networkDiskModal) {
            this.setupSingleComponentEvents('networkDiskModal');
        }

        if (components.networkDriveDetailPage) {
            this.setupSingleComponentEvents('networkDriveDetailPage');
        }
    }

    setupSingleComponentEvents(componentName: ComponentEventName | string): void {
        const {app, components, notify, ui} = this.context;

        switch (componentName) {
            case 'recentPage':
                if (components.recentPage) {
                    components.recentPage.on('trackPlayed', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    components.recentPage.on('playAll', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    components.recentPage.on('addToPlaylist', (track: Track) => {
                        app.addToPlaylist(track);
                    });

                    components.recentPage.on('viewChange', (view: AppView) => {
                        ui.navigateToView(view);
                    });
                }
                break;

            case 'artistsPage':
                if (components.artistsPage) {
                    components.artistsPage.on('trackPlayed', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    components.artistsPage.on('playAll', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    components.artistsPage.on('addToPlaylist', (track: Track) => {
                        app.addToPlaylist(track);
                    });
                }
                break;

            case 'albumsPage':
                if (components.albumsPage) {
                    components.albumsPage.on('trackPlayed', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    components.albumsPage.on('playAll', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    components.albumsPage.on('addToPlaylist', (track: Track) => {
                        app.addToPlaylist(track);
                    });
                }
                break;

            case 'statisticsPage':
                break;

            case 'networkDiskModal':
                if (components.networkDiskModal) {
                    components.networkDiskModal.on('notification', (data: ComponentNotificationPayload) => {
                        notify(data);
                    });
                }
                break;

            case 'networkDriveDetailPage':
                if (components.networkDriveDetailPage) {
                    components.networkDriveDetailPage.on('driveRemoved', async (drive: unknown) => {
                        await app.handleDriveRemoved(drive);
                    });

                    components.networkDriveDetailPage.on('playTrack', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    components.networkDriveDetailPage.on('playTracks', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    components.networkDriveDetailPage.on(
                        'trackRightClick',
                        (track: Track, index: number, x: number, y: number) => {
                            ui.showContextMenu(x, y, track, index);
                        }
                    );
                }
                break;

            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }
}
