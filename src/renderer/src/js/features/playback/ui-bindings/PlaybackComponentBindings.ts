import type {Track} from "@api/types/track";
import {playbackController} from "../PlaybackController";

interface ComponentEventSource {
    on(event: string, handler: (...args: any[]) => void | Promise<void>): void;
}

interface PlaybackBindingComponents {
    trackList: ComponentEventSource;
    player: ComponentEventSource;
    playlist: ComponentEventSource;
    contextMenu: ComponentEventSource;
}

interface PlaybackBindingApp {
    handleTrackPlayed(track: Track, index: number): Promise<void>;
    handleTrackIndexChanged(index: number): void;
    handlePlaylistTrackSelected(track: Track, index: number): void;
    handlePlaylistTrackPlayed(track: Track, index: number): Promise<void>;
    handlePlaylistTrackRemoved(track: Track, index: number): Promise<void>;
    handlePlaylistCleared(): Promise<void>;
    addToPlaylist(track: Track): void;
    handleAddToCustomPlaylist(track: Track, index: number): Promise<void>;
    handleDeleteTrack(track: Track, index: number): Promise<void>;
    handleBatchDelete(selectedTracks: Set<number> | null | undefined, track: Track, index: number): Promise<void>;
    handleEditTrackInfo(track: Track, index: number): Promise<void>;
}

interface PlaybackBindingUI {
    showContextMenu(x: number, y: number, track: Track, index: number, selectedTracks?: Set<number>): void;
    toggleQueue(): void;
    toggleLyricsForTrack(track: Track | null): Promise<void>;
}

interface PlaybackComponentBindingContext {
    app: PlaybackBindingApp;
    components: PlaybackBindingComponents;
    ui: PlaybackBindingUI;
}

interface TrackEventPayload {
    track: Track;
    index: number;
}

interface ContextMenuPayload extends TrackEventPayload {
    selectedTracks?: Set<number>;
    _index?: number;
}

export function bindPlaybackComponentEvents({
    app,
    components,
    ui
}: PlaybackComponentBindingContext): void {
    components.trackList.on('trackPlayed', async (track: Track, index: number) => {
        await app.handleTrackPlayed(track, index);
    });

    components.trackList.on(
        'trackRightClick',
        (track: Track, index: number, x: number, y: number, selectedTracks?: Set<number>) => {
            ui.showContextMenu(x, y, track, index, selectedTracks);
        }
    );

    components.player.on('togglePlaylist', () => {
        ui.toggleQueue();
    });

    components.player.on('toggleLyrics', async () => {
        await ui.toggleLyricsForTrack(playbackController.getCurrentTrackSnapshot());
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
}
