import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';

interface PlaylistControllerOptions {
    app: PlaylistAppHost;
    playback: PlaylistPlaybackIntegrations;
    ui: PlaylistUI;
}

export interface PlaylistAppHost {
    currentView: string;
    hideAllPages(): void;
    showInfo(message: string): void;
    updateSidebarSelection(type: string, id?: string | null): void;
    playTrackFromPlaylist(track: Track, index: number, tracks?: Track[]): Promise<void>;
}

interface PlaylistUI {
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
    getPlaylist(): Track[];
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
        const currentPlaylist = this.playback.getPlaylist();
        if (index < 0 || index >= currentPlaylist.length) {
            return;
        }

        const nextPlaylist = currentPlaylist.filter((_track, trackIndex) => trackIndex !== index);
        const currentIndex = this.playback.getCurrentIndex();
        const nextIndex = this.resolveIndexAfterRemoval(index, currentIndex, nextPlaylist.length);

        console.log('🔄 同步删除操作到播放状态，剩余歌曲:', nextPlaylist.length);
        await this.playback.setPlaylist(nextPlaylist, nextIndex);

        if (index === currentIndex) {
            console.log('⚠️ 删除的是当前播放歌曲，停止播放');
            await this.playback.pause();
        }
    }

    async handlePlaylistCleared(): Promise<void> {
        await this.playback.setPlaylist([], -1);
        await this.playback.pause();
    }

    async addToPlaylist(track: Track): Promise<void> {
        const currentPlaylist = this.playback.getPlaylist();
        const nextPlaylist = [...currentPlaylist, track];
        await this.playback.setPlaylist(nextPlaylist, this.playback.getCurrentIndex());
        this.app.showInfo(`已添加 "${track.title}" 到播放列表`);
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

    private resolveIndexAfterRemoval(removedIndex: number, currentIndex: number, nextLength: number): number {
        if (nextLength === 0) {
            return -1;
        }

        if (removedIndex < currentIndex) {
            return currentIndex - 1;
        }

        if (removedIndex === currentIndex) {
            return Math.min(removedIndex, nextLength - 1);
        }

        return currentIndex;
    }
}
