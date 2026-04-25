import {api} from "@api/api";
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {RendererAppContext} from '@core/types/app';

interface PlaylistControllerOptions {
    app: RendererAppContext;
}

export class PlaylistController {
    private readonly app: RendererAppContext;

    constructor({app}: PlaylistControllerOptions) {
        this.app = app;
    }

    handlePlaylistTrackSelected(track: Track, _index: number): void {
        console.log('🎵 播放列表选择歌曲:', track.title);
    }

    async handlePlaylistTrackPlayed(track: Track, index: number): Promise<void> {
        await this.app.playTrackFromPlaylist(track, index);
    }

    async handlePlaylistTrackRemoved(_track: Track, index: number): Promise<void> {
        const playlist = this.app.components.playlist;

        if (playlist && playlist.tracks.length >= 0) {
            console.log('🔄 同步删除操作到API，剩余歌曲:', playlist.tracks.length);

            const currentIndex = playlist.currentTrackIndex;
            await api.setPlaylist(playlist.tracks, currentIndex);

            if (index === api.currentIndex) {
                console.log('⚠️ 删除的是当前播放歌曲，停止播放');
                await api.pause();
            }
        }
    }

    async handlePlaylistCleared(): Promise<void> {
        await api.setPlaylist([], -1);
        await api.pause();
    }

    addToPlaylist(track: Track): void {
        const app = this.app;

        if (app.components.playlist) {
            app.components.playlist.addTrack(track);
            app.showInfo(`已添加 "${track.title}" 到播放列表`);
        }
    }

    async handleAddToCustomPlaylist(track: Track, _index: number): Promise<void> {
        if (this.app.components.addToPlaylistDialog) {
            await this.app.components.addToPlaylistDialog.show(track);
        }
    }

    async handlePlaylistCreated(): Promise<void> {
        await this.refreshNavigationPlaylists();
    }

    async handleTrackAddedToPlaylist(): Promise<void> {
        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistSelected(playlist: Playlist): Promise<void> {
        const app = this.app;

        app.hideAllPages();
        app.updateSidebarSelection('playlist', playlist.id);
        app.currentView = 'playlist-detail';
        if (app.components.playlistDetailPage) {
            await app.components.playlistDetailPage.show(playlist);
        }
    }

    async handlePlaylistUpdated(): Promise<void> {
        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistRenamed(): Promise<void> {
        await this.refreshNavigationPlaylists();
    }

    async handleShowAddSongsDialog(playlist: Playlist): Promise<void> {
        await this.app.components.musicLibrarySelectionDialog.show(playlist);
    }

    async handleTracksAddedToPlaylist(): Promise<void> {
        const app = this.app;

        if (app.currentView === 'playlist-detail' && app.components.playlistDetailPage) {
            await app.components.playlistDetailPage.loadPlaylistTracks();
        }

        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistCoverUpdated(playlist: Playlist): Promise<void> {
        const navigation = this.app.components.navigation;
        if (navigation && navigation.updatePlaylistInfo) {
            navigation.updatePlaylistInfo(playlist);
        }
    }

    async refreshNavigationPlaylists(): Promise<void> {
        const navigation = this.app.components.navigation;
        if (navigation && navigation.refreshPlaylists) {
            await navigation.refreshPlaylists();
        }
    }
}
