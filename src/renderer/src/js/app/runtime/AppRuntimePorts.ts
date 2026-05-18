import type {MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {Track} from '@api/types/track';
import type {AppView, ConfirmOptions} from '@js/shared/types/AppContracts';
import type {ComponentMap} from './components/ComponentTypes';

export interface AppComponentPort {
    components: ComponentMap;
}

export interface AppInitializationPort {
    isInitialized: boolean;
}

export interface AppViewStatePort {
    currentView: AppView;
}

export interface AppLibraryStatePort {
    library: Track[];
    filteredLibrary: Track[];
}

export interface AppCoverPreloadPort {
    coversPreloadedByApp?: boolean;
}

export interface AppEventEmitterPort {
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    removeAllListeners(event?: string): void;
}

export interface AppDOMEventPort {
    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void;
}

export interface AppAPIEventPort {
    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void;
}

export interface AppNotificationPort {
    showSuccess(message: string): void;
    showError(message: string): void;
    showInfo(message: string): void;
}

export interface AppConfirmationPort {
    confirm(options: ConfirmOptions): Promise<boolean>;
}

export interface APIEventBindingHost {
    refreshLibrary(): Promise<void>;
    updateLibraryTrackDuration(filePath: string, duration: number): void;
    updateScanProgress(progress: ScanProgress): void;
}

export interface DOMEventBindingHost extends AppDOMEventPort {
    cleanup(): Promise<void>;
    initKeyboardShortcuts(): void;
    initGlobalShortcuts(): Promise<void>;
    showCreatePlaylistDialog(): void;
    setupFileLoading(): void;
}

export interface ViewRouterHost extends AppViewStatePort {
    updateTrackList(source?: string): void;
}

export interface PluginBootstrapHost extends AppComponentPort, AppInitializationPort {}
