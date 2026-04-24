import {api} from "@api/api";

export class PlaylistController {
    constructor({app}) {
        this.app = app;
    }

    handlePlaylistTrackSelected(track, _index) {
        console.log('🎵 播放列表选择歌曲:', track.title);
    }

    async handlePlaylistTrackPlayed(track, index) {
        await this.app.playTrackFromPlaylist(track, index);
    }

    async handlePlaylistTrackRemoved(track, index) {
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

    async handlePlaylistCleared() {
        await api.setPlaylist([], -1);
        await api.pause();
    }

    addToPlaylist(track) {
        const app = this.app;

        if (app.components.playlist) {
            app.components.playlist.addTrack(track);
            app.showInfo(`已添加 "${track.title}" 到播放列表`);
        }
    }

    async handleAddToCustomPlaylist(track, _index) {
        if (this.app.components.addToPlaylistDialog) {
            await this.app.components.addToPlaylistDialog.show(track);
        }
    }

    async handlePlaylistCreated() {
        await this.refreshNavigationPlaylists();
    }

    async handleTrackAddedToPlaylist() {
        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistSelected(playlist) {
        const app = this.app;

        app.hideAllPages();
        app.updateSidebarSelection('playlist', playlist.id);
        app.currentView = 'playlist-detail';
        if (app.components.playlistDetailPage) {
            await app.components.playlistDetailPage.show(playlist);
        }
    }

    async handlePlaylistUpdated() {
        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistRenamed() {
        await this.refreshNavigationPlaylists();
    }

    async handleShowAddSongsDialog(playlist) {
        await this.app.components.musicLibrarySelectionDialog.show(playlist);
    }

    async handleTracksAddedToPlaylist() {
        const app = this.app;

        if (app.currentView === 'playlist-detail' && app.components.playlistDetailPage) {
            await app.components.playlistDetailPage.loadPlaylistTracks();
        }

        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistCoverUpdated(playlist) {
        const navigation = this.app.components.navigation;
        if (navigation && navigation.updatePlaylistInfo) {
            navigation.updatePlaylistInfo(playlist);
        }
    }

    async refreshNavigationPlaylists() {
        const navigation = this.app.components.navigation;
        if (navigation && navigation.refreshPlaylists) {
            await navigation.refreshPlaylists();
        }
    }
}
