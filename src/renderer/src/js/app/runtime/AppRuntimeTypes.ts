import type {Track} from '@api/types/track';
import type {
    AppComponentPort,
    AppEventEmitterPort,
    AppLibraryStatePort,
    AppViewStatePort
} from './AppRuntimePorts';

export type {
    AppView,
    ConfirmOptions,
    ManagedAPIListener,
    ManagedDOMListener
} from '@js/shared/types/AppContracts';
export type {
    ComponentMap,
    ComponentRegistryMap,
    LyricsLike,
    PlayerLike
} from './components/ComponentTypes';
export type {
    APIEventBindingHost,
    AppAPIEventPort,
    AppComponentPort,
    AppConfirmationPort,
    AppCoverPreloadPort,
    AppDOMEventPort,
    AppEventEmitterPort,
    AppInitializationPort,
    AppLibraryStatePort,
    AppNotificationPort,
    AppViewStatePort,
    DOMEventBindingHost,
    PluginBootstrapHost,
    ViewRouterHost
} from './AppRuntimePorts';

export interface ExtensionHostApp extends AppComponentPort, AppEventEmitterPort, AppViewStatePort, AppLibraryStatePort {
    handleDeleteTrack(track: Track, index: number): Promise<void>;
    loadAndPlayFile?(filePath: string): Promise<void>;
}
