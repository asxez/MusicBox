import type {ScanProgress} from '@api/types/events';
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AppView} from '@js/shared/types/AppContracts';
import type {
    AppAPIEventPort,
    AppComponentPort,
    AppConfirmationPort,
    AppCoverPreloadPort,
    AppDOMEventPort,
    AppEventEmitterPort,
    AppInitializationPort,
    AppLibraryStatePort,
    AppNotificationPort,
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

export interface AppInteractionHost extends AppComponentPort, AppNotificationPort, AppConfirmationPort {
    handleViewChange(view: AppView): Promise<void>;
    addMusicFiles(): Promise<void>;
}

export interface ExtensionHostApp extends AppComponentPort, AppEventEmitterPort, AppViewStatePort, AppLibraryStatePort {
    handleDeleteTrack(track: Track, index: number): Promise<void>;
    loadAndPlayFile?(filePath: string): Promise<void>;
}

export interface RendererAppContext
    extends AppComponentPort,
        AppInitializationPort,
        AppViewStatePort,
        AppLibraryStatePort,
        AppCoverPreloadPort,
        AppEventEmitterPort,
        AppDOMEventPort,
        AppAPIEventPort,
        AppNotificationPort,
        AppConfirmationPort {
    initializeComponent(componentName: string): void;
    destroyComponent(componentName: string): void;
    loadInitialData?(): Promise<void>;
    preloadTrackCovers(): Promise<void>;
    refreshLibrary(): Promise<void>;
    handleSearchResults(results: Track[]): void;
    handleSearchCleared(): void;
    handleViewChange(view: AppView): Promise<void>;
    handlePlayAllTracks(tracks: Track[]): Promise<void>;
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
    handleTrackInfoUpdated(data: unknown): Promise<void>;
    handlePlaylistSelected(playlist: Playlist): Promise<void>;
    handleNetworkDriveSelected(drive: unknown): Promise<void>;
    handleDriveRemoved(drive?: unknown): Promise<void>;
    handlePlaylistCreated(playlist?: Playlist): Promise<void>;
    handleTrackAddedToPlaylist(playlist?: Playlist, track?: Track): Promise<void>;
    handlePlaylistUpdated(playlist?: Playlist): Promise<void>;
    handlePlaylistRenamed(playlist?: Playlist): Promise<void>;
    handleShowAddSongsDialog(playlist: Playlist): Promise<void>;
    handleTracksAddedToPlaylist(data?: unknown): Promise<void>;
    handlePlaylistCoverUpdated(playlist: Playlist): Promise<void>;
    updateLibraryTrackDuration(filePath: string, duration: number): void;
    updateScanProgress(progress: ScanProgress): void;
    updateTrackList(source?: string): void;
    addMusicFiles(): Promise<void>;
    openDirectoryDialog(): Promise<void>;
    showScanProgress(): void;
    showCacheLoadingStatus(): void;
    hideCacheLoadingStatus(): void;
    showWelcomeScreen(): void;
    showFatalError?(message: string): void;
    syncDesktopLyricsButtonState(): Promise<void>;
    hideAllPages(): void;
    updateSidebarSelection(type: string, id?: string | null): void;
    playTrackFromPlaylist(track: Track, index: number): Promise<void>;
    loadAndPlayFile?(filePath: string): Promise<void>;
}
