import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AppNotificationPort, AppViewStatePort} from '@js/app/runtime/AppRuntimeTypes';

interface PlaylistControllerOptions {
    app: PlaylistAppHost;
    playback: PlaylistPlaybackIntegrations;
    ui: PlaylistUI;
}

interface PlaylistAppHost extends AppNotificationPort, AppViewStatePort {
    hideAllPages(): void;
    updateSidebarSelection(type: string, id?: string | null): void;
    playTrackFromPlaylist(track: Track, index: number): Promise<void>;
}

interface PlaylistUI {
    hasQueue(): boolean;
    getQueueTracks(): Track[];
    getQueueCurrentIndex(): number;
    addQueueTrack(track: Track): number;
    showAddToPlaylistDialog(track: Track): Promise<void>;
    showPlaylistDetail(playlist: Playlist): Promise<void>;
    showMusicLibrarySelectionDialog(playlist: Playlist): Promise<void>;
    reloadPlaylistDetailTracks(): Promise<void>;
    updateNavigationPlaylistInfo(playlist: Playlist): void;
    refreshNavigationPlaylists(): Promise<void>;
}

interface PlaylistPlaybackIntegrations {
    setPlaylist(tracks: Track[], startIndex?: number): Promise<boolean>;
    getCurrentIndex(): number;
    pause(): Promise<boolean>;
}

export class PlaylistController {
    private readonly app: PlaylistAppHost;
    private readonly playback: PlaylistPlaybackIntegrations;
    private readonly ui: PlaylistUI;

    constructor({app, playback, ui}: PlaylistControllerOptions) {
        this.app = app;
        this.playback = playback;
        this.ui = ui;
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
            await this.playback.setPlaylist(queueTracks, currentIndex);

            if (index === this.playback.getCurrentIndex()) {
                console.log('⚠️ 删除的是当前播放歌曲，停止播放');
                await this.playback.pause();
            }
        }
    }

    async handlePlaylistCleared(): Promise<void> {
        await this.playback.setPlaylist([], -1);
        await this.playback.pause();
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
