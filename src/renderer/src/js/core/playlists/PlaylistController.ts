import {playbackController} from "@js/features/playback";
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {RendererAppContext} from '@core/types/app';
import {AppUIFacade} from '@core/ui/AppUIFacade';

interface PlaylistControllerOptions {
    app: RendererAppContext;
}

export class PlaylistController {
    private readonly app: RendererAppContext;
    private readonly ui: AppUIFacade;

    constructor({app}: PlaylistControllerOptions) {
        this.app = app;
        this.ui = new AppUIFacade(app);
    }

    handlePlaylistTrackSelected(track: Track, _index: number): void {
        console.log('🎵 播放列表选择歌曲:', track.title);
    }

    async handlePlaylistTrackPlayed(track: Track, index: number): Promise<void> {
        await this.app.playTrackFromPlaylist(track, index);
    }

    async handlePlaylistTrackRemoved(_track: Track, index: number): Promise<void> {
        const queueTracks = this.ui.getQueueTracks();

        if (this.ui.hasQueue()) {
            console.log('🔄 同步删除操作到API，剩余歌曲:', queueTracks.length);

            const currentIndex = this.ui.getQueueCurrentIndex();
            await playbackController.setPlaylist(queueTracks, currentIndex);

            if (index === playbackController.getCurrentIndex()) {
                console.log('⚠️ 删除的是当前播放歌曲，停止播放');
                await playbackController.pause();
            }
        }
    }

    async handlePlaylistCleared(): Promise<void> {
        await playbackController.setPlaylist([], -1);
        await playbackController.pause();
    }

    addToPlaylist(track: Track): void {
        if (this.ui.hasQueue()) {
            this.ui.addQueueTrack(track);
            this.app.showInfo(`已添加 "${track.title}" 到播放列表`);
        }
    }

    async handleAddToCustomPlaylist(track: Track, _index: number): Promise<void> {
        await this.ui.showAddToPlaylistDialog(track);
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
        await this.ui.showPlaylistDetail(playlist);
    }

    async handlePlaylistUpdated(): Promise<void> {
        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistRenamed(): Promise<void> {
        await this.refreshNavigationPlaylists();
    }

    async handleShowAddSongsDialog(playlist: Playlist): Promise<void> {
        await this.ui.showMusicLibrarySelectionDialog(playlist);
    }

    async handleTracksAddedToPlaylist(): Promise<void> {
        const app = this.app;

        if (app.currentView === 'playlist-detail') {
            await this.ui.reloadPlaylistDetailTracks();
        }

        await this.refreshNavigationPlaylists();
    }

    async handlePlaylistCoverUpdated(playlist: Playlist): Promise<void> {
        this.ui.updateNavigationPlaylistInfo(playlist);
    }

    async refreshNavigationPlaylists(): Promise<void> {
        await this.ui.refreshNavigationPlaylists();
    }
}
