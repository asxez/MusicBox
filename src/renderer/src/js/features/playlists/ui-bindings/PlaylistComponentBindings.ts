import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";

interface ComponentEventSource {
    on(event: string, handler: (...args: any[]) => void | Promise<void>): void;
}

interface PlaylistBindingComponents {
    createPlaylistDialog: ComponentEventSource;
    addToPlaylistDialog: ComponentEventSource;
    renamePlaylistDialog: ComponentEventSource;
    musicLibrarySelectionDialog: ComponentEventSource;
    editTrackInfoDialog: ComponentEventSource;
    playlistDetailPage: ComponentEventSource;
}

interface PlaylistBindingUI {
    showCreatePlaylistDialog(track?: Track): void;
    syncQueueTracks(tracks: Track[], currentIndex?: number): void;
    showContextMenu(x: number, y: number, track: Track, index: number, selectedTracks?: Set<number>): void;
}

export interface PlaylistComponentBindingHost {
    handlePlaylistCreated(playlist?: Playlist): Promise<void>;
    handleTrackAddedToPlaylist(playlist?: Playlist, track?: Track): Promise<void>;
    handlePlaylistRenamed(playlist?: Playlist): Promise<void>;
    handleTracksAddedToPlaylist(data?: unknown): Promise<void>;
    handleTrackInfoUpdated(data: unknown): Promise<void>;
    handleTrackPlayed(track: Track, index: number): Promise<void>;
    handlePlayAllTracks(tracks: Track[]): Promise<void>;
    playTrackFromPlaylist(track: Track, index: number): Promise<void>;
    handlePlaylistUpdated(playlist?: Playlist): Promise<void>;
    handleShowAddSongsDialog(playlist: Playlist): Promise<void>;
    handlePlaylistCoverUpdated(playlist: Playlist): Promise<void>;
}

interface ComponentNotificationPayload {
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
}

interface PlaylistTrackAddedPayload {
    playlist: Playlist;
    track: Track;
}

interface PlaylistComponentBindingContext {
    app: PlaylistComponentBindingHost;
    components: PlaylistBindingComponents;
    notify(data: ComponentNotificationPayload): void;
    ui: PlaylistBindingUI;
}

export function bindPlaylistComponentEvents({
    app,
    components,
    notify,
    ui
}: PlaylistComponentBindingContext): void {
    components.createPlaylistDialog.on('playlistCreated', async (playlist: Playlist) => {
        await app.handlePlaylistCreated(playlist);
    });
    components.createPlaylistDialog.on('notification', (data: ComponentNotificationPayload) => {
        notify(data);
    });

    components.addToPlaylistDialog.on('createNewPlaylist', (track: Track) => {
        ui.showCreatePlaylistDialog(track);
    });

    components.addToPlaylistDialog.on('trackAdded', async ({playlist, track}: PlaylistTrackAddedPayload) => {
        await app.handleTrackAddedToPlaylist(playlist, track);
    });
    components.addToPlaylistDialog.on('notification', (data: ComponentNotificationPayload) => {
        notify(data);
    });

    components.renamePlaylistDialog.on('playlistRenamed', async (playlist: Playlist) => {
        await app.handlePlaylistRenamed(playlist);
    });
    components.renamePlaylistDialog.on('notification', (data: ComponentNotificationPayload) => {
        notify(data);
    });

    components.musicLibrarySelectionDialog.on('tracksAdded', async (data: unknown) => {
        await app.handleTracksAddedToPlaylist(data);
    });
    components.musicLibrarySelectionDialog.on('notification', (data: ComponentNotificationPayload) => {
        notify(data);
    });

    components.editTrackInfoDialog.on('trackUpdated', async (data: unknown) => {
        await app.handleTrackInfoUpdated(data);
    });

    components.playlistDetailPage.on('trackPlayed', async (track: Track, index: number, tracks?: Track[]) => {
        if (tracks && tracks.length > 0) {
            ui.syncQueueTracks(tracks, index);
            await app.playTrackFromPlaylist(track, index);
            return;
        }

        await app.handleTrackPlayed(track, index);
    });

    components.playlistDetailPage.on(
        'trackRightClick',
        (track: Track, index: number, x: number, y: number, selectedTracks?: Set<number>) => {
            ui.showContextMenu(x, y, track, index, selectedTracks);
        }
    );

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
}
