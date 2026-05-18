import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {AppUIFacade} from "@js/app/runtime/AppUIFacade";
import type {AppView} from "@js/shared/types/AppContracts";
import type {
    AppNotificationPort,
    ComponentMap
} from "@js/app/runtime/AppRuntimeTypes";

export interface NavigationComponentBindingHost {
    handleSearchResults(results: Track[]): void;
    handleSearchCleared(): void;
    handleViewChange(view: AppView): Promise<void>;
    handlePlaylistSelected(playlist: Playlist): Promise<void>;
    handleNetworkDriveSelected(drive: unknown): Promise<void>;
}

export interface PageComponentBindingHost {
    handleDriveRemoved(drive?: unknown): Promise<void>;
    handleTrackPlayed(track: Track, index: number): Promise<void>;
    handlePlayAllTracks(tracks: Track[]): Promise<void>;
    addToPlaylist(track: Track): void;
}

export type ComponentEventName =
    | 'recentPage'
    | 'artistsPage'
    | 'albumsPage'
    | 'statisticsPage'
    | 'networkDiskModal'
    | 'networkDriveDetailPage';

export interface ComponentBindingContext {
    components: ComponentMap;
    ui: AppUIFacade;
    notify(data: ComponentNotificationPayload): void;
}

export interface NavigationComponentBindingContext extends ComponentBindingContext {
    app: NavigationComponentBindingHost;
}

export interface PageComponentBindingContext extends ComponentBindingContext {
    app: PageComponentBindingHost;
}

export interface TrackEventPayload {
    track: Track;
    index: number;
}

export interface ContextMenuPayload extends TrackEventPayload {
    selectedTracks?: Set<number>;
    _index?: number;
}

export interface PlaylistTrackAddedPayload {
    playlist: Playlist;
    track: Track;
}

export interface ComponentNotificationPayload {
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
}

export function notifyComponentEvent(
    app: AppNotificationPort,
    data: ComponentNotificationPayload
): void {
    switch (data.type) {
        case 'success':
            app.showSuccess(data.message);
            break;
        case 'error':
            app.showError(data.message);
            break;
        case 'info':
        case 'warning':
        default:
            app.showInfo(data.message);
            break;
    }
}
