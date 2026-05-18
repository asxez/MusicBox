import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {AppUIFacade} from "@js/app/runtime/AppUIFacade";
import type {ComponentMap, RendererAppContext} from "@js/app/runtime/AppRuntimeTypes";

export type ComponentEventName =
    | 'recentPage'
    | 'artistsPage'
    | 'albumsPage'
    | 'statisticsPage'
    | 'networkDiskModal'
    | 'networkDriveDetailPage';

export interface ComponentBindingContext {
    app: RendererAppContext;
    components: ComponentMap;
    ui: AppUIFacade;
    notify(data: ComponentNotificationPayload): void;
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
    app: RendererAppContext,
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
