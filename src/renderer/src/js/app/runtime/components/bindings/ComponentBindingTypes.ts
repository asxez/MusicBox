import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {ContentUIFacade} from "@js/app/runtime/ui/ContentUIFacade";
import type {DialogUIFacade} from "@js/app/runtime/ui/DialogUIFacade";
import type {PlaybackUIFacade} from "@js/app/runtime/ui/PlaybackUIFacade";
import type {QueueUIFacade} from "@js/app/runtime/ui/QueueUIFacade";
import type {AppView} from "@js/shared/types/AppContracts";
import type {AppNotificationPort} from "@js/app/runtime/AppRuntimePorts";
import type {ComponentMap} from "@js/app/runtime/components/ComponentTypes";

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
    content: ContentUIFacade;
    dialogs: DialogUIFacade;
    playback: PlaybackUIFacade;
    queue: QueueUIFacade;
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
