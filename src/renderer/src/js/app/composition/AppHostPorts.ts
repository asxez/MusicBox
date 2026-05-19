import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';
import type {AppShellRuntimeHost} from '@js/features/appShell/service/AppShellRuntimeHost';
import type {ExtensionHostApp} from '@js/features/extensions/service/ExtensionHostService';
import type {FileImportHost, LibraryAppHost} from '@js/features/library/ui-bindings';
import type {PlaybackAppHost} from '@js/features/playback/ui-bindings';
import type {PlaylistAppHost} from '@js/features/playlists/PlaylistController';
import type {SettingsComponentBindingHost} from '@js/features/settings/ui-bindings';
import type {
    AppComponentPort,
    APIEventBindingHost,
    DOMEventBindingHost,
    PluginBootstrapHost,
    ViewRouterHost
} from '@js/app/runtime/AppRuntimePorts';
import type {NetworkDriveRouteHost} from '@js/app/runtime/NetworkDriveRouteController';
import type {ShortcutHost} from '@js/app/runtime/ShortcutController';
import type {
    NavigationComponentBindingHost,
    PageComponentBindingHost
} from '@js/app/runtime/components/bindings/ComponentBindingTypes';
import type {PlaybackComponentBindingHost} from '@js/features/playback/ui-bindings';
import type {PlaylistComponentBindingHost} from '@js/features/playlists/ui-bindings';
import type {ComponentMap} from '@js/app/runtime/components/ComponentTypes';
import type {MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {AppView, ConfirmOptions} from '@js/shared/types/AppContracts';

export interface MusicBoxCompositionHost {
    isInitialized: boolean;
    currentView: AppView;
    library: Track[];
    filteredLibrary: Track[];
    coversPreloadedByApp?: boolean;
    components: ComponentMap;
    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void;
    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    removeAllListeners(event?: string): void;
    addToPlaylist(track: Track): void;
    addMusicFiles(): Promise<void>;
    cleanup(): Promise<void>;
    clearRuntimeData(): void;
    confirm(options: ConfirmOptions): Promise<boolean>;
    destroyComponent(componentName: string): void;
    handleAddToCustomPlaylist(track: Track, index: number): Promise<void>;
    handleBatchDelete(selectedTracks: Set<number> | null | undefined, track: Track, index: number): Promise<void>;
    handleDeleteTrack(track: Track, index: number): Promise<void>;
    handleDriveRemoved(drive?: unknown): Promise<void>;
    handleEditTrackInfo(track: Track, index: number): Promise<void>;
    handleNetworkDriveSelected(drive: unknown): Promise<void>;
    handlePlayAllTracks(tracks: Track[]): Promise<void>;
    handlePlaylistCleared(): Promise<void>;
    handlePlaylistCoverUpdated(playlist: Playlist): Promise<void>;
    handlePlaylistCreated(playlist?: Playlist): Promise<void>;
    handlePlaylistRenamed(playlist?: Playlist): Promise<void>;
    handlePlaylistSelected(playlist: Playlist): Promise<void>;
    handlePlaylistTrackPlayed(track: Track, index: number): Promise<void>;
    handlePlaylistTrackRemoved(track: Track, index: number): Promise<void>;
    handlePlaylistTrackSelected(track: Track, index: number): void;
    handlePlaylistUpdated(playlist?: Playlist): Promise<void>;
    handleSearchCleared(): void;
    handleSearchResults(results: Track[]): void;
    handleShowAddSongsDialog(playlist: Playlist): Promise<void>;
    handleTrackAddedToPlaylist(playlist?: Playlist, track?: Track): Promise<void>;
    handleTrackIndexChanged(index: number): void;
    handleTrackInfoUpdated(data: unknown): Promise<void>;
    handleTrackPlayed(track: Track, index: number): Promise<void>;
    handleTracksAddedToPlaylist(data?: unknown): Promise<void>;
    handleViewChange(view: AppView): Promise<void>;
    hideCacheLoadingStatus(): void;
    hideAllPages(): void;
    initGlobalShortcuts(): Promise<void>;
    initKeyboardShortcuts(): void;
    initializeComponent(componentName: string): void;
    initializeComponents(): void;
    loadAndPlayFile?(filePath: string): Promise<void>;
    loadInitialData(): Promise<void>;
    openDirectoryDialog(): Promise<void>;
    playTrackFromPlaylist(track: Track, index: number): Promise<void>;
    preloadTrackCovers(): Promise<void>;
    refreshLibrary(tracks?: Track[]): Promise<void>;
    scanMusicFolder(): Promise<void>;
    schedulePluginSystemInitialization(): void;
    setupComponentEvents(componentName?: string | null): void;
    setupEventListeners(): Promise<void>;
    setupFileLoading(): void;
    showApp(): void;
    showCacheLoadingStatus(): void;
    showCreatePlaylistDialog(): void;
    showError(message: string): void;
    showFatalError(message: string): void;
    showInfo(message: string): void;
    showNetworkDriveModal(): boolean;
    showPluginManager(): Promise<boolean>;
    showScanProgress(): void;
    showSuccess(message: string): void;
    showWelcomeScreen(): void;
    syncDesktopLyricsButtonState(): Promise<void>;
    updateLibraryTrackDuration(filePath: string, duration: number): void;
    updateScanProgress(progress: ScanProgress): void;
    updateSidebarSelection(type: string, id?: string | null): void;
    updateTrackList(source?: string): void;
    navigateToView(viewId: string): void;
}

export interface AppHostPorts {
    apiEvents: APIEventBindingHost;
    appShellRuntime: AppShellRuntimeHost;
    components: AppComponentPort;
    domEvents: DOMEventBindingHost;
    extensionHost: ExtensionHostApp;
    fileImport: FileImportHost;
    legacyPluginApp: MusicBoxCompositionHost;
    library: LibraryAppHost;
    lifecycle: import('@js/app/lifecycle').AppLifecycleHost;
    navigationBindings: NavigationComponentBindingHost;
    networkDriveRoute: NetworkDriveRouteHost;
    pageBindings: PageComponentBindingHost;
    playback: PlaybackAppHost;
    playbackBindings: PlaybackComponentBindingHost;
    playlist: PlaylistAppHost;
    playlistBindings: PlaylistComponentBindingHost;
    pluginBootstrap: PluginBootstrapHost;
    settingsBindings: SettingsComponentBindingHost;
    shortcuts: ShortcutHost;
    viewRouter: ViewRouterHost;
}

export function createAppHostPorts(app: MusicBoxCompositionHost): AppHostPorts {
    const notificationPort = {
        showSuccess: (message: string) => app.showSuccess(message),
        showError: (message: string) => app.showError(message),
        showInfo: (message: string) => app.showInfo(message)
    };

    return {
        apiEvents: {
            refreshLibrary: (tracks) => app.refreshLibrary(tracks),
            updateLibraryTrackDuration: (filePath, duration) => app.updateLibraryTrackDuration(filePath, duration),
            updateScanProgress: (progress) => app.updateScanProgress(progress)
        },
        appShellRuntime: {
            confirm: (options) => app.confirm(options),
            showInfo: notificationPort.showInfo,
            showSuccess: notificationPort.showSuccess,
            showError: notificationPort.showError,
            handleViewChange: (view) => app.handleViewChange(view),
            addMusicFiles: () => app.addMusicFiles(),
            showNetworkDriveModal: () => app.showNetworkDriveModal(),
            showPluginManager: () => app.showPluginManager()
        },
        components: {
            components: app.components
        },
        domEvents: {
            addManagedEventListener: (...args) => app.addManagedEventListener(...args),
            cleanup: () => app.cleanup(),
            initKeyboardShortcuts: () => app.initKeyboardShortcuts(),
            initGlobalShortcuts: () => app.initGlobalShortcuts(),
            showCreatePlaylistDialog: () => app.showCreatePlaylistDialog(),
            setupFileLoading: () => app.setupFileLoading()
        },
        extensionHost: {
            get currentView() {
                return app.currentView;
            },
            get library() {
                return app.library;
            },
            on: (event, handler) => app.on(event, handler),
            off: (event, handler) => app.off(event, handler),
            emit: (event, ...args) => app.emit(event, ...args),
            removeAllListeners: (event) => app.removeAllListeners(event),
            handleDeleteTrack: (track, index) => app.handleDeleteTrack(track, index),
            navigateToView: (viewId) => app.navigateToView(viewId),
            ...(app.loadAndPlayFile
                ? {loadAndPlayFile: (filePath: string) => app.loadAndPlayFile!(filePath)}
                : {})
        },
        fileImport: {
            addManagedEventListener: (...args) => app.addManagedEventListener(...args),
            showScanProgress: () => app.showScanProgress(),
            showSuccess: notificationPort.showSuccess,
            showError: notificationPort.showError,
            showInfo: notificationPort.showInfo
        },
        legacyPluginApp: app,
        library: {
            get currentView() {
                return app.currentView;
            },
            get library() {
                return app.library;
            },
            set library(value: Track[]) {
                app.library = value;
            },
            get filteredLibrary() {
                return app.filteredLibrary;
            },
            set filteredLibrary(value: Track[]) {
                app.filteredLibrary = value;
            },
            get coversPreloadedByApp() {
                return app.coversPreloadedByApp;
            },
            set coversPreloadedByApp(value: boolean | undefined) {
                app.coversPreloadedByApp = value;
            },
            addManagedAPIEventListener: (...args) => app.addManagedAPIEventListener(...args),
            confirm: (options) => app.confirm(options),
            showSuccess: notificationPort.showSuccess,
            showError: notificationPort.showError,
            showInfo: notificationPort.showInfo,
            showCacheLoadingStatus: () => app.showCacheLoadingStatus(),
            hideCacheLoadingStatus: () => app.hideCacheLoadingStatus(),
            showWelcomeScreen: () => app.showWelcomeScreen(),
            updateTrackList: (source) => app.updateTrackList(source),
            syncDesktopLyricsButtonState: () => app.syncDesktopLyricsButtonState()
        },
        lifecycle: {
            get isInitialized() {
                return app.isInitialized;
            },
            set isInitialized(value: boolean) {
                app.isInitialized = value;
            },
            initializeComponents: () => app.initializeComponents(),
            setupEventListeners: () => app.setupEventListeners(),
            loadInitialData: () => app.loadInitialData(),
            showApp: () => app.showApp(),
            schedulePluginSystemInitialization: () => app.schedulePluginSystemInitialization(),
            showFatalError: (message) => app.showFatalError(message),
            clearRuntimeData: () => app.clearRuntimeData()
        },
        navigationBindings: {
            handleSearchResults: (results) => app.handleSearchResults(results),
            handleSearchCleared: () => app.handleSearchCleared(),
            handleViewChange: (view) => app.handleViewChange(view),
            handlePlaylistSelected: (playlist) => app.handlePlaylistSelected(playlist),
            handleNetworkDriveSelected: (drive) => app.handleNetworkDriveSelected(drive)
        },
        networkDriveRoute: {
            get currentView() {
                return app.currentView;
            },
            set currentView(value: AppView) {
                app.currentView = value;
            }
        },
        pageBindings: {
            handleDriveRemoved: (drive) => app.handleDriveRemoved(drive),
            handleTrackPlayed: (track, index) => app.handleTrackPlayed(track, index),
            handlePlayAllTracks: (tracks) => app.handlePlayAllTracks(tracks),
            addToPlaylist: (track) => app.addToPlaylist(track)
        },
        playback: {
            get currentView() {
                return app.currentView;
            },
            get library() {
                return app.library;
            },
            get filteredLibrary() {
                return app.filteredLibrary;
            },
            showError: notificationPort.showError
        },
        playbackBindings: {
            handleTrackPlayed: (track, index) => app.handleTrackPlayed(track, index),
            handleTrackIndexChanged: (index) => app.handleTrackIndexChanged(index),
            handlePlaylistTrackSelected: (track, index) => app.handlePlaylistTrackSelected(track, index),
            handlePlaylistTrackPlayed: (track, index) => app.handlePlaylistTrackPlayed(track, index),
            handlePlaylistTrackRemoved: (track, index) => app.handlePlaylistTrackRemoved(track, index),
            handlePlaylistCleared: () => app.handlePlaylistCleared(),
            addToPlaylist: (track) => app.addToPlaylist(track),
            handleAddToCustomPlaylist: (track, index) => app.handleAddToCustomPlaylist(track, index),
            handleDeleteTrack: (track, index) => app.handleDeleteTrack(track, index),
            handleBatchDelete: (selectedTracks, track, index) => app.handleBatchDelete(selectedTracks, track, index),
            handleEditTrackInfo: (track, index) => app.handleEditTrackInfo(track, index)
        },
        playlist: {
            get currentView() {
                return app.currentView;
            },
            set currentView(value: string) {
                app.currentView = value as AppView;
            },
            hideAllPages: () => app.hideAllPages(),
            showInfo: notificationPort.showInfo,
            updateSidebarSelection: (type, id) => app.updateSidebarSelection(type, id),
            playTrackFromPlaylist: (track, index) => app.playTrackFromPlaylist(track, index)
        },
        playlistBindings: {
            handlePlaylistCreated: (playlist) => app.handlePlaylistCreated(playlist),
            handleTrackAddedToPlaylist: (playlist, track) => app.handleTrackAddedToPlaylist(playlist, track),
            handlePlaylistRenamed: (playlist) => app.handlePlaylistRenamed(playlist),
            handleTracksAddedToPlaylist: (data) => app.handleTracksAddedToPlaylist(data),
            handleTrackInfoUpdated: (data) => app.handleTrackInfoUpdated(data),
            handleTrackPlayed: (track, index) => app.handleTrackPlayed(track, index),
            handlePlayAllTracks: (tracks) => app.handlePlayAllTracks(tracks),
            playTrackFromPlaylist: (track, index) => app.playTrackFromPlaylist(track, index),
            handlePlaylistUpdated: (playlist) => app.handlePlaylistUpdated(playlist),
            handleShowAddSongsDialog: (playlist) => app.handleShowAddSongsDialog(playlist),
            handlePlaylistCoverUpdated: (playlist) => app.handlePlaylistCoverUpdated(playlist)
        },
        pluginBootstrap: {
            get isInitialized() {
                return app.isInitialized;
            },
            get currentView() {
                return app.currentView;
            },
            navigateToView: (viewId) => app.navigateToView(viewId),
            on: (event, handler) => app.on(event, handler),
            off: (event, handler) => app.off(event, handler),
            emit: (event, ...args) => app.emit(event, ...args),
            removeAllListeners: (event) => app.removeAllListeners(event)
        },
        settingsBindings: {
            get isInitialized() {
                return app.isInitialized;
            },
            initializeComponent: (componentName) => app.initializeComponent(componentName),
            destroyComponent: (componentName) => app.destroyComponent(componentName),
            preloadTrackCovers: () => app.preloadTrackCovers()
        },
        shortcuts: {
            addManagedEventListener: (...args) => app.addManagedEventListener(...args),
            openDirectoryDialog: () => app.openDirectoryDialog(),
            addMusicFiles: () => app.addMusicFiles()
        },
        viewRouter: {
            get currentView() {
                return app.currentView;
            },
            set currentView(value: AppView) {
                app.currentView = value;
            },
            updateTrackList: (source) => app.updateTrackList(source)
        }
    };
}
