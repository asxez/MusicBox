import type {MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AlbumsPage} from '@ui/pages/AlbumsPage';
import type {ArtistsPage} from '@ui/pages/ArtistsPage';
import type {HomePage} from '@ui/pages/HomePage';
import type {NetworkDriveDetailPage} from '@ui/pages/NetworkDriveDetailPage';
import type {PlaylistDetailPage} from '@ui/pages/PlaylistDetailPage';
import type {RecentPage} from '@ui/pages/RecentPage';
import type {Settings} from '@ui/pages/Settings';
import type {StatisticsPage} from '@ui/pages/StatisticsPage';
import type {ContextMenu} from '@ui/widgets/ContextMenu';
import type {EqualizerComponent} from '@ui/widgets/EqualizerComponent';
import type ParametricEqualizerComponent from '@ui/widgets/ParametricEqualizerComponent';
import type {Lyrics} from '@ui/widgets/Lyrics';
import type {Navigation} from '@ui/widgets/Navigation';
import type {Player} from '@ui/widgets/Player';
import type {Playlist as QueuePlaylist} from '@ui/widgets/Playlist';
import type {Search} from '@ui/widgets/Search';
import type {TrackList} from '@ui/widgets/TrackList';
import type {NetworkDiskModal} from '@ui/modals/NetworkDiskModal';
import type {PluginManagerModal} from '@ui/modals/PluginManagerModal';
import type {UpdateModal} from '@ui/modals/UpdateModal';
import type {AddToPlaylistDialog} from '@ui/dialogs/AddToPlaylistDialog';
import type {ConfirmDialog} from '@ui/dialogs/ConfirmDialog';
import type {CreatePlaylistDialog} from '@ui/dialogs/CreatePlaylistDialog';
import type {EditTrackInfoDialog} from '@ui/dialogs/EditTrackInfoDialog';
import type {MusicLibrarySelectionDialog} from '@ui/dialogs/MusicLibrarySelectionDialog';
import type {RenamePlaylistDialog} from '@ui/dialogs/RenamePlaylistDialog';

export type AppView =
    | 'home-page'
    | 'library'
    | 'recent'
    | 'artists'
    | 'albums'
    | 'statistics'
    | 'playlist-detail'
    | 'network-drive-detail'
    | string;

export interface ManagedDOMListener {
    element: EventTarget;
    event: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
}

export interface ManagedAPIListener<K extends keyof MusicBoxAPIEvents = keyof MusicBoxAPIEvents> {
    event: K;
    handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>;
}

export interface ComponentRegistryMap {
    player: Player;
    search: Search;
    navigation: Navigation & Record<string, any>;
    trackList: TrackList;
    playlist: QueuePlaylist;
    contextMenu: ContextMenu;
    settings: Settings;
    lyrics: Lyrics;
    equalizer: EqualizerComponent;
    parametricEqualizer: ParametricEqualizerComponent;
    confirmDialog: ConfirmDialog;
    createPlaylistDialog: CreatePlaylistDialog;
    addToPlaylistDialog: AddToPlaylistDialog;
    renamePlaylistDialog: RenamePlaylistDialog;
    musicLibrarySelectionDialog: MusicLibrarySelectionDialog;
    editTrackInfoDialog: EditTrackInfoDialog;
    playlistDetailPage: PlaylistDetailPage;
    networkDriveDetailPage: NetworkDriveDetailPage;
    updateModal: UpdateModal;
    pluginManagerModal: PluginManagerModal;
    homePage: HomePage;
    recentPage: RecentPage | null;
    artistsPage: ArtistsPage | null;
    albumsPage: AlbumsPage | null;
    statisticsPage: StatisticsPage | null;
    networkDiskModal: NetworkDiskModal | null;
}

export type ComponentMap = ComponentRegistryMap & Record<string, any>;

export interface ConfirmOptions {
    title: string;
    message: string;
    type?: 'default' | 'danger' | 'warning';
    confirmText?: string;
    cancelText?: string;
}

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

export interface PlayerLike {
    togglePlayPause?: () => Promise<void> | void;
    updatePlayModeDisplay?: (mode: PlayMode) => void;
}

export interface LyricsLike {
    isVisible?: boolean;
    isFullscreen?: boolean;
    show?: (track: Track | null) => Promise<void> | void;
    hide?: () => void;
    updateProgress?: (position: number, duration: number) => void;
    updatePlayButton?: (isPlaying: boolean) => void;
    exitFullscreen?: () => void;
    toggleFullscreen?: () => void;
}
