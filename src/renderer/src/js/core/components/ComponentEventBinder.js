import {api} from "@api/api";

export class ComponentEventBinder {
    constructor({app}) {
        this.app = app;
        this.components = app.components;
    }

    bindInitialComponentEvents() {
        const app = this.app;
        const components = this.components;

        components.search.on('searchResults', (results) => {
            app.handleSearchResults(results);
        });

        components.search.on('searchCleared', () => {
            app.handleSearchCleared();
        });

        components.navigation.on('viewChanged', async (view) => {
            await app.handleViewChange(view);
        });

        components.navigation.on('showSettings', async () => {
            await components.settings.toggle();
        });

        components.navigation.on('playlistSelected', async (playlist) => {
            await app.handlePlaylistSelected(playlist);
        });

        components.navigation.on('networkDriveSelected', async (drive) => {
            await app.handleNetworkDriveSelected(drive);
        });

        components.navigation.on('showRenameDialog', (playlist) => {
            components.renamePlaylistDialog.show(playlist);
        });

        components.settings.on('shortcutsUpdated', () => {
            console.log('🎹 快捷键配置已更新');
        });

        components.trackList.on('trackPlayed', async (track, index) => {
            await app.handleTrackPlayed(track, index);
        });

        components.trackList.on('trackRightClick', (track, index, x, y, selectedTracks) => {
            components.contextMenu.show(x, y, track, index, selectedTracks);
        });

        components.player.on('togglePlaylist', () => {
            components.playlist.toggle();
        });

        components.player.on('toggleLyrics', async () => {
            await components.lyrics.toggle(api.currentTrack);
        });

        components.player.on('trackIndexChanged', (index) => {
            app.handleTrackIndexChanged(index);
        });

        components.playlist.on('trackSelected', ({track, index}) => {
            app.handlePlaylistTrackSelected(track, index);
        });

        components.playlist.on('trackPlayed', async ({track, index}) => {
            await app.handlePlaylistTrackPlayed(track, index);
        });

        components.playlist.on('trackRemoved', async ({track, index}) => {
            await app.handlePlaylistTrackRemoved(track, index);
        });

        components.playlist.on('playlistCleared', async () => {
            await app.handlePlaylistCleared();
        });

        components.contextMenu.on('play', async ({track, index}) => {
            await app.handleTrackPlayed(track, index);
        });

        components.contextMenu.on('addToPlaylist', ({track, _index}) => {
            app.addToPlaylist(track);
        });

        components.contextMenu.on('addToCustomPlaylist', async ({track, index}) => {
            await app.handleAddToCustomPlaylist(track, index);
        });

        components.contextMenu.on('delete', async ({track, index}) => {
            await app.handleDeleteTrack(track, index);
        });

        components.contextMenu.on('batchDelete', async ({selectedTracks, track, index}) => {
            await app.handleBatchDelete(selectedTracks, track, index);
        });

        components.contextMenu.on('editInfo', async ({track, index}) => {
            await app.handleEditTrackInfo(track, index);
        });

        components.createPlaylistDialog.on('playlistCreated', async (playlist) => {
            await app.handlePlaylistCreated(playlist);
        });

        components.addToPlaylistDialog.on('createNewPlaylist', (track) => {
            components.createPlaylistDialog.show(track);
        });

        components.addToPlaylistDialog.on('trackAdded', async ({playlist, track}) => {
            await app.handleTrackAddedToPlaylist(playlist, track);
        });

        components.renamePlaylistDialog.on('playlistRenamed', async (playlist) => {
            await app.handlePlaylistRenamed(playlist);
        });

        components.musicLibrarySelectionDialog.on('tracksAdded', async (data) => {
            await app.handleTracksAddedToPlaylist(data);
        });

        components.editTrackInfoDialog.on('trackUpdated', async (data) => {
            await app.handleTrackInfoUpdated(data);
        });

        components.playlistDetailPage.on('trackPlayed', async (track, index) => {
            await app.handleTrackPlayed(track, index);
        });

        components.playlistDetailPage.on('playAllTracks', async (tracks) => {
            await app.handlePlayAllTracks(tracks);
        });

        components.playlistDetailPage.on('playlistUpdated', async (playlist) => {
            await app.handlePlaylistUpdated(playlist);
        });

        components.playlistDetailPage.on('showAddSongsDialog', async (playlist) => {
            await app.handleShowAddSongsDialog(playlist);
        });

        components.playlistDetailPage.on('playlistCoverUpdated', async (playlist) => {
            await app.handlePlaylistCoverUpdated(playlist);
        });

        components.settings.on('checkUpdates', () => {
            components.updateModal.show();
        });

        components.settings.on('desktopLyricsEnabled', async (enabled) => {
            if (components.player) {
                await components.player.updateDesktopLyricsButtonVisibility(enabled);
            }
        });

        components.settings.on('networkDriveEnabled', (enabled) => {
            if (enabled) {
                app.initializeComponent('networkDiskModal');
            } else {
                app.destroyComponent('networkDiskModal');
            }
        });

        components.settings.on('statisticsEnabled', (enabled) => {
            if (components.navigation) {
                components.navigation.updateStatisticsButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('statisticsPage');
            } else {
                app.destroyComponent('statisticsPage');
            }
        });

        components.settings.on('recentPlayEnabled', (enabled) => {
            if (components.navigation) {
                components.navigation.updateRecentPlayButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('recentPage');
            } else {
                app.destroyComponent('recentPage');
            }
        });

        components.settings.on('artistsPageEnabled', (enabled) => {
            if (components.navigation) {
                components.navigation.updateArtistsPageButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('artistsPage');
            } else {
                app.destroyComponent('artistsPage');
            }
        });

        components.settings.on('albumsPageEnabled', (enabled) => {
            if (components.navigation) {
                components.navigation.updateAlbumsPageButtonVisibility(enabled);
            }

            if (enabled) {
                app.initializeComponent('albumsPage');
            } else {
                app.destroyComponent('albumsPage');
            }
        });

        components.settings.on('showTrackCoversEnabled', async (enabled) => {
            if (enabled && app.isInitialized) {
                await app.preloadTrackCovers();
            }
        });

        components.settings.on('gaplessPlaybackEnabled', (enabled) => {
            api.setGaplessPlayback(enabled);
        });

        this.setupComponentEvents();
    }

    setupComponentEvents(componentName = null) {
        if (componentName) {
            this.setupSingleComponentEvents(componentName);
            return;
        }

        this.components.homePage.on('trackPlayed', async (track, index) => {
            await this.app.handleTrackPlayed(track, index);
        });

        this.components.homePage.on('viewChange', (view) => {
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

    setupSingleComponentEvents(componentName) {
        const app = this.app;

        switch (componentName) {
            case 'recentPage':
                if (this.components.recentPage) {
                    this.components.recentPage.on('trackPlayed', async (track, index) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.recentPage.on('playAll', async (tracks) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.recentPage.on('addToPlaylist', (track) => {
                        app.addToPlaylist(track);
                    });

                    this.components.recentPage.on('viewChange', (view) => {
                        this.components.navigation.navigateToView(view);
                    });
                }
                break;

            case 'artistsPage':
                if (this.components.artistsPage) {
                    this.components.artistsPage.on('trackPlayed', async (track, index) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.artistsPage.on('playAll', async (tracks) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.artistsPage.on('addToPlaylist', (track) => {
                        app.addToPlaylist(track);
                    });
                }
                break;

            case 'albumsPage':
                if (this.components.albumsPage) {
                    this.components.albumsPage.on('trackPlayed', async (track, index) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.albumsPage.on('playAll', async (tracks) => {
                        await app.handlePlayAllTracks(tracks);
                    });

                    this.components.albumsPage.on('addToPlaylist', (track) => {
                        app.addToPlaylist(track);
                    });
                }
                break;

            case 'statisticsPage':
                break;

            case 'networkDiskModal':
                if (this.components.networkDiskModal) {
                    this.components.networkDiskModal.on('notification', (data) => {
                        app.showSuccess(data.message);
                    });
                }
                break;

            case 'networkDriveDetailPage':
                if (this.components.networkDriveDetailPage) {
                    this.components.networkDriveDetailPage.on('driveRemoved', async (drive) => {
                        await app.handleDriveRemoved(drive);
                    });

                    this.components.networkDriveDetailPage.on('playTrack', async (track, index) => {
                        await app.handleTrackPlayed(track, index);
                    });

                    this.components.networkDriveDetailPage.on('playTracks', async (tracks, _startIndex) => {
                        await app.handlePlayAllTracks(tracks);
                    });
                }
                break;

            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }
}
