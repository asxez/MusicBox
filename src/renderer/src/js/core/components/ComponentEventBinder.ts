import {api} from "@api/api";
import {trackCoverDisplayPreferenceService} from "@services/preferences/TrackCoverDisplayPreferenceService";
import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {AppView, ComponentMap, RendererAppContext} from "@core/types/app";

interface ComponentEventBinderOptions {
    app: RendererAppContext;
}

type ComponentEventName =
    | 'recentPage'
    | 'artistsPage'
    | 'albumsPage'
    | 'statisticsPage'
    | 'networkDiskModal'
    | 'networkDriveDetailPage';

interface TrackEventPayload {
    track: Track;
    index: number;
}

interface ContextMenuPayload extends TrackEventPayload {
    selectedTracks?: Set<number>;
    _index?: number;
}

interface PlaylistTrackAddedPayload {
    playlist: Playlist;
    track: Track;
}

interface ComponentNotificationPayload {
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
}

export class ComponentEventBinder {
    private readonly app: RendererAppContext;
    private readonly components: ComponentMap;

    constructor({app}: ComponentEventBinderOptions) {
        this.app = app;
        this.components = app.components;
    }

    bindInitialComponentEvents(): void {
        const app = this.app;
        const components = this.components;

        components.search.on('searchResults', (results: Track[]) => {
            app.handleSearchResults(results);
        });

        components.search.on('searchCleared', () => {
            app.handleSearchCleared();
        });

        components.navigation.on('viewChanged', async (view: AppView) => {
            await app.handleViewChange(view);
        });

        components.navigation.on('showSettings', async () => {
            await components.settings.toggle();
        });

        components.navigation.on('playlistSelected', async (playlist: Playlist) => {
            await app.handlePlaylistSelected(playlist);
        });

        components.navigation.on('networkDriveSelected', async (drive: unknown) => {
            await app.handleNetworkDriveSelected(drive);
        });

        components.navigation.on('showRenameDialog', (playlist: Playlist) => {
            components.renamePlaylistDialog.show(playlist);
        });

        components.settings.on('shortcutsUpdated', () => {
            console.log('🎹 快捷键配置已更新');
        });

        components.trackList.on('trackPlayed', async (track: Track, index: number) => {
            await app.handleTrackPlayed(track, index);
        });

        components.trackList.on('trackRightClick', (track: Track, index: number, x: number, y: number, selectedTracks?: Set<number>) => {
            components.contextMenu.show(x, y, track, index, selectedTracks);
        });

        components.player.on('togglePlaylist', () => {
            components.playlist.toggle();
        });

        components.player.on('toggleLyrics', async () => {
            await components.lyrics.toggle(api.currentTrack);
        });

        components.player.on('trackIndexChanged', (index: number) => {
            app.handleTrackIndexChanged(index);
        });

        components.playlist.on('trackSelected', ({track, index}: TrackEventPayload) => {
            app.handlePlaylistTrackSelected(track, index);
        });

        components.playlist.on('trackPlayed', async ({track, index}: TrackEventPayload) => {
            await app.handlePlaylistTrackPlayed(track, index);
        });

        components.playlist.on('trackRemoved', async ({track, index}: TrackEventPayload) => {
            await app.handlePlaylistTrackRemoved(track, index);
        });

        components.playlist.on('playlistCleared', async () => {
            await app.handlePlaylistCleared();
        });

        components.contextMenu.on('play', async ({track, index}: ContextMenuPayload) => {
            await app.handleTrackPlayed(track, index);
        });

        components.contextMenu.on('addToPlaylist', ({track}: ContextMenuPayload) => {
            app.addToPlaylist(track);
        });

        components.contextMenu.on('addToCustomPlaylist', async ({track, index}: ContextMenuPayload) => {
            await app.handleAddToCustomPlaylist(track, index);
        });

        components.contextMenu.on('delete', async ({track, index}: ContextMenuPayload) => {
            await app.handleDeleteTrack(track, index);
        });

        components.contextMenu.on('batchDelete', async ({selectedTracks, track, index}: ContextMenuPayload) => {
            await app.handleBatchDelete(selectedTracks, track, index);
        });

        components.contextMenu.on('editInfo', async ({track, index}: ContextMenuPayload) => {
            await app.handleEditTrackInfo(track, index);
        });

        components.createPlaylistDialog.on('playlistCreated', async (playlist: Playlist) => {
            await app.handlePlaylistCreated(playlist);
        });
        components.createPlaylistDialog.on('notification', (data: ComponentNotificationPayload) => {
            this.showNotification(data);
        });

        components.addToPlaylistDialog.on('createNewPlaylist', (track: Track) => {
            components.createPlaylistDialog.show(track);
        });

        components.addToPlaylistDialog.on('trackAdded', async ({playlist, track}: PlaylistTrackAddedPayload) => {
            await app.handleTrackAddedToPlaylist(playlist, track);
        });
        components.addToPlaylistDialog.on('notification', (data: ComponentNotificationPayload) => {
            this.showNotification(data);
        });

        components.renamePlaylistDialog.on('playlistRenamed', async (playlist: Playlist) => {
            await app.handlePlaylistRenamed(playlist);
        });
        components.renamePlaylistDialog.on('notification', (data: ComponentNotificationPayload) => {
            this.showNotification(data);
        });

        components.musicLibrarySelectionDialog.on('tracksAdded', async (data: unknown) => {
            await app.handleTracksAddedToPlaylist(data);
        });
        components.musicLibrarySelectionDialog.on('notification', (data: ComponentNotificationPayload) => {
            this.showNotification(data);
        });

        components.editTrackInfoDialog.on('trackUpdated', async (data: unknown) => {
            await app.handleTrackInfoUpdated(data);
        });

        components.playlistDetailPage.on('trackPlayed', async (track: Track, index: number) => {
            await app.handleTrackPlayed(track, index);
        });

        components.playlistDetailPage.on('playAllTracks', async (tracks: Track[]) => {
            await app.handlePlayAllTracks(tracks);
        });

        components.playlistDetailPage.on('playlistUpdated', async (playlist: Playlist) => {
            await app.handlePlaylistUpdated(playlist);
        });

        components.playlistDetailPage.on('showAddSongsDialog', async (playlist: Playlist) => {
            await app.handleShowAddSongsDialog(playlist);
        });

        components.playlistDetailPage.on('playlistCoverUpdated', async (playlist: Playlist) => {
            await app.handlePlaylistCoverUpdated(playlist);
        });

        components.settings.on('checkUpdates', () => {
            components.updateModal.show();
        });

        components.settings.on('desktopLyricsEnabled', async (enabled: boolean) => {
            if (components.player) {
                await components.player.updateDesktopLyricsButtonVisibility(enabled);
            }
        });

        components.settings.on('networkDriveEnabled', (enabled: boolean) => {
            if (enabled) {
                app.initializeComponent('networkDiskModal');
            } else {
                app.destroyComponent('networkDiskModal');
            }
        });

        components.settings.on('statisticsEnabled', (enabled: boolean) => {
            if (components.navigation) {
                components.navigation.updateStatisticsButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('statisticsPage');
            } else {
                app.destroyComponent('statisticsPage');
            }
        });

        components.settings.on('recentPlayEnabled', (enabled: boolean) => {
            if (components.navigation) {
                components.navigation.updateRecentPlayButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('recentPage');
            } else {
                app.destroyComponent('recentPage');
            }
        });

        components.settings.on('artistsPageEnabled', (enabled: boolean) => {
            if (components.navigation) {
                components.navigation.updateArtistsPageButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('artistsPage');
            } else {
                app.destroyComponent('artistsPage');
            }
        });

        components.settings.on('albumsPageEnabled', (enabled: boolean) => {
            if (components.navigation) {
                components.navigation.updateAlbumsPageButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('albumsPage');
            } else {
                app.destroyComponent('albumsPage');
            }
        });

        components.settings.on('showTrackCoversEnabled', async (enabled: boolean) => {
            trackCoverDisplayPreferenceService.setEnabled(enabled);
            if (enabled && app.isInitialized) {
                await app.preloadTrackCovers();
            }
        });

        components.settings.on('gaplessPlaybackEnabled', (enabled: boolean) => {
            api.setGaplessPlayback(enabled);
        });

        this.setupComponentEvents();
    }

    setupComponentEvents(componentName: ComponentEventName | null = null): void {
        if (componentName) {
            this.setupSingleComponentEvents(componentName);
            return;
        }

        this.components.homePage.on('trackPlayed', async (track: Track, index: number) => {
            await this.app.handleTrackPlayed(track, index);
        });

        this.components.homePage.on('viewChange', (view: AppView) => {
            this.components.navigation.navigateToView(view);
        });

        if (this.components.recentPage) {
            this.setupSingleComponentEvents('recentPage');
        }

        if (this.components.artistsPage) {
            this.setupSingleComponentEvents('artistsPage');
        }

        if (this.components.albumsPage) {
            this.setupSingleComponentEvents('albumsPage');
        }

        if (this.components.statisticsPage) {
            this.setupSingleComponentEvents('statisticsPage');
        }

        if (this.components.networkDiskModal) {
            this.setupSingleComponentEvents('networkDiskModal');
        }

        if (this.components.networkDriveDetailPage) {
            this.setupSingleComponentEvents('networkDriveDetailPage');
        }
    }

    setupSingleComponentEvents(componentName: ComponentEventName | string): void {
        const app = this.app;

        switch (componentName) {
            case 'recentPage':
                if (this.components.recentPage) {
                    this.components.recentPage.on('trackPlayed', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.recentPage.on('playAll', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.recentPage.on('addToPlaylist', (track: Track) => {
                        app.addToPlaylist(track);
                    });

                    this.components.recentPage.on('viewChange', (view: AppView) => {
                        this.components.navigation.navigateToView(view);
                    });
                }
                break;

            case 'artistsPage':
                if (this.components.artistsPage) {
                    this.components.artistsPage.on('trackPlayed', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.artistsPage.on('playAll', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.artistsPage.on('addToPlaylist', (track: Track) => {
                        app.addToPlaylist(track);
                    });
                }
                break;

            case 'albumsPage':
                if (this.components.albumsPage) {
                    this.components.albumsPage.on('trackPlayed', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.albumsPage.on('playAll', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.albumsPage.on('addToPlaylist', (track: Track) => {
                        app.addToPlaylist(track);
                    });
                }
                break;

            case 'statisticsPage':
                break;

            case 'networkDiskModal':
                if (this.components.networkDiskModal) {
                    this.components.networkDiskModal.on('notification', (data: ComponentNotificationPayload) => {
                        this.showNotification(data);
                    });
                }
                break;

            case 'networkDriveDetailPage':
                if (this.components.networkDriveDetailPage) {
                    this.components.networkDriveDetailPage.on('driveRemoved', async (drive: unknown) => {
                        await app.handleDriveRemoved(drive);
                    });

                    this.components.networkDriveDetailPage.on('playTrack', async (track: Track, index: number) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.networkDriveDetailPage.on('playTracks', async (tracks: Track[]) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.networkDriveDetailPage.on('trackRightClick', (track: Track, index: number, x: number, y: number) => {
                        this.components.contextMenu.show(x, y, track, index);
                    });
                }
                break;

            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }

    private showNotification(data: ComponentNotificationPayload): void {
        switch (data.type) {
            case 'success':
                this.app.showSuccess(data.message);
                break;
            case 'error':
                this.app.showError(data.message);
                break;
            case 'info':
            case 'warning':
            default:
                this.app.showInfo(data.message);
                break;
        }
    }
}
