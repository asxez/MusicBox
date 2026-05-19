import {APIEventBinder} from '@js/app/runtime/APIEventBinder';
import {AppNotifier} from '@js/app/runtime/AppNotifier';
import {ComponentEventBinder, type ComponentBindingPorts} from '@js/app/runtime/components/ComponentEventBinder';
import {ComponentRegistry} from '@js/app/runtime/components/ComponentRegistry';
import {DesktopLyricsButtonSync} from '@js/app/runtime/DesktopLyricsButtonSync';
import {DOMEventBinder} from '@js/app/runtime/DOMEventBinder';
import {NetworkDriveRouteController} from '@js/app/runtime/NetworkDriveRouteController';
import {PluginBootstrap} from '@js/app/runtime/PluginBootstrap';
import {ShortcutController} from '@js/app/runtime/ShortcutController';
import {ViewRouter} from '@js/app/runtime/ViewRouter';
import {createAppUIPorts, type AppUIPorts} from '@js/app/runtime/ui/AppUIPorts';
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
    AppViewStatePort,
    ViewRouterHost
} from '@js/app/runtime/AppRuntimePorts';
import type {ComponentMap} from '@js/app/runtime/components/ComponentTypes';
import type {ManagedAPIListener, ManagedDOMListener} from '@js/shared/types/AppContracts';
import type {
    NavigationComponentBindingHost,
    PageComponentBindingHost
} from '@js/app/runtime/components/bindings/ComponentBindingTypes';
import {AppLifecycleController} from '@js/app/lifecycle';
import {AppShellView} from '@js/app/shell';
import {
    FileImportController,
    LibraryAppController
} from '@js/features/library/ui-bindings';
import {libraryDataService} from '@js/features/library/service/LibraryDataService';
import type {FileImportHost, LibraryAppHost} from '@js/features/library/ui-bindings';
import {PlaylistController, type PlaylistAppHost} from '@js/features/playlists/PlaylistController';
import type {PlaylistComponentBindingHost} from '@js/features/playlists/ui-bindings';
import {playbackController} from '@js/features/playback/PlaybackController';
import {PlaybackAppController} from '@js/features/playback/ui-bindings/PlaybackAppController';
import type {PlaybackAppHost} from '@js/features/playback/ui-bindings';
import type {PlaybackComponentBindingHost} from '@js/features/playback/ui-bindings';
import type {SettingsComponentBindingHost} from '@js/features/settings/ui-bindings';
import {playbackService} from '@js/features/playback/service/PlaybackService';
import {desktopLyricsService} from '@js/features/desktopLyrics/service/DesktopLyricsService';
import {equalizerService} from '@js/features/equalizer/service/EqualizerService';
import {mediaFileDialogService} from '@js/features/media/service';
import {extensionHostService} from '@js/features/extensions/service';
import {appShellRuntimeHost} from '@js/features/appShell/service';
import type {AudioEngineManagerBridge} from '@js/features/equalizer/service';

interface AppCompositionRootOptions {
    app: MusicBoxAppHost;
    components: ComponentMap;
    eventListeners: ManagedDOMListener[];
    apiEventListeners: ManagedAPIListener[];
}

interface MusicBoxAppHost
    extends AppAPIEventPort,
        AppComponentPort,
        AppConfirmationPort,
        AppCoverPreloadPort,
        AppDOMEventPort,
        AppEventEmitterPort,
        AppInitializationPort,
        AppLibraryStatePort,
        AppNotificationPort,
        AppViewStatePort,
        FileImportHost,
        LibraryAppHost,
        NavigationComponentBindingHost,
        PageComponentBindingHost,
        PlaybackAppHost,
        PlaybackComponentBindingHost,
        PlaylistAppHost,
        PlaylistComponentBindingHost,
        SettingsComponentBindingHost,
        ViewRouterHost {
    addMusicFiles(): Promise<void>;
    clearRuntimeData(): void;
    cleanup(): Promise<void>;
    hideAllPages(): void;
    handleViewChange(view: string): Promise<void>;
    hideCacheLoadingStatus(): void;
    initializeComponents(): void;
    initGlobalShortcuts(): Promise<void>;
    initKeyboardShortcuts(): void;
    loadAndPlayFile?(filePath: string): Promise<void>;
    loadInitialData(): Promise<void>;
    openDirectoryDialog(): Promise<void>;
    scanMusicFolder(): Promise<void>;
    schedulePluginSystemInitialization(): void;
    setupComponentEvents(componentName?: string | null): void;
    setupEventListeners(): Promise<void>;
    setupFileLoading(): void;
    showApp(): void;
    showCacheLoadingStatus(): void;
    showCreatePlaylistDialog(): void;
    showFatalError(message: string): void;
    showNetworkDriveModal(): boolean;
    showPluginManager(): Promise<boolean>;
    showScanProgress(): void;
    showWelcomeScreen(): void;
    syncDesktopLyricsButtonState(): Promise<void>;
    updateSidebarSelection(type: string, id?: string | null): void;
    navigateToView(viewId: string): void;
}

export interface AppComposition {
    apiEventBinder: APIEventBinder;
    componentEventBinder: ComponentEventBinder;
    componentRegistry: ComponentRegistry;
    desktopLyricsButtonSync: DesktopLyricsButtonSync;
    domEventBinder: DOMEventBinder;
    fileImportController: FileImportController;
    lifecycleController: AppLifecycleController;
    libraryController: LibraryAppController;
    networkDriveRouteController: NetworkDriveRouteController;
    notifier: AppNotifier;
    playbackController: PlaybackAppController;
    playlistController: PlaylistController;
    pluginBootstrap: PluginBootstrap;
    shellView: AppShellView;
    shortcutController: ShortcutController;
    ui: AppUIPorts;
    viewRouter: ViewRouter;
}

export function createAppComposition({
    app,
    components,
    eventListeners,
    apiEventListeners
}: AppCompositionRootOptions): AppComposition {
    const componentPort: AppComponentPort = {components};
    const ui = createAppUIPorts(componentPort);
    const componentRegistry = new ComponentRegistry({
        components,
        setupComponentEvents: (componentName: string) => app.setupComponentEvents(componentName)
    });
    const domEventBinder = new DOMEventBinder({eventListeners});
    const apiEventBinder = new APIEventBinder({
        apiEventListeners,
        playbackUI: ui.playback,
        queueUI: ui.queue
    });
    const shellView = new AppShellView({
        onScanMusicFolder: () => app.scanMusicFolder(),
        onAddMusicFiles: () => app.addMusicFiles(),
        onShowHomePage: () => app.handleViewChange('home-page')
    });
    const componentBindingPorts: ComponentBindingPorts = {
        navigation: app,
        pages: app,
        playback: app,
        playlists: app,
        settings: app,
        notifications: app
    };
    const componentEventBinder = new ComponentEventBinder({
        ports: componentBindingPorts,
        components: componentPort,
        ui
    });
    const viewRouter = new ViewRouter({app, content: ui.content});
    const notifier = new AppNotifier(shellView);
    const desktopLyricsButtonSync = new DesktopLyricsButtonSync(ui.playback);

    const shortcutController = new ShortcutController({
        app,
        integrations: {
            toggleCurrentPlayback: () => playbackController.toggleCurrentPlayback(),
            previousTrack: () => playbackController.previousTrack(),
            nextTrack: () => playbackController.nextTrack(),
            adjustVolume: (delta) => playbackController.adjustVolume(delta),
            seekForward: (seconds) => playbackController.seekForward(seconds),
            seekBackward: (seconds) => playbackController.seekBackward(seconds),
            getCurrentTrackSnapshot: () => playbackController.getCurrentTrackSnapshot()
        },
        ui: {
            getActivePlayer: () => ui.playback.getActivePlayer(),
            focusSearchInput: () => ui.content.focusSearchInput(),
            toggleLyricsPanel: (track) => ui.playback.toggleLyricsPanel(track),
            exitLyricsPanel: () => ui.playback.exitLyricsPanel(),
            toggleLyricsFullscreen: () => ui.playback.toggleLyricsFullscreen()
        }
    });

    const fileImportController = new FileImportController({
        app,
        integrations: {
            openDirectory: () => mediaFileDialogService.openDirectory(),
            openDirectoryDialog: () => mediaFileDialogService.openDirectoryDialog(),
            openFiles: () => mediaFileDialogService.openFiles(),
            loadTrack: (filePath) => playbackController.loadTrack(filePath),
            play: () => playbackController.play()
        }
    });

    const pluginBootstrap = new PluginBootstrap({app, legacyComponents: components});

    const libraryController = new LibraryAppController({
        app,
        integrations: {
            getCurrentPlaybackTrack: () => playbackController.getCurrentTrackSnapshot()
        },
        ui: {
            setTrackListTracks: (tracks) => ui.content.setTrackListTracks(tracks),
            updateQueuedTrack: (filePath, updatedData) => ui.queue.updateQueuedTrack(filePath, updatedData),
            findQueueIndex: (predicate) => ui.queue.findQueueIndex(predicate),
            removeQueueTrack: (index) => ui.queue.removeQueueTrack(index),
            removeTrackFromPlaylistDetail: (track, index) => ui.content.removeTrackFromPlaylistDetail(track, index),
            removeSelectedTracksFromPlaylistDetail: () => ui.content.removeSelectedTracksFromPlaylistDetail(),
            clearTrackListSelection: () => ui.content.clearTrackListSelection(),
            updatePlayerTrackInfo: (track) => ui.playback.updatePlayerTrackInfo(track),
            isPlaylistDetailVisible: () => ui.content.isPlaylistDetailVisible(),
            updatePlaylistDetailTrack: (filePath, updatedData) => (
                ui.content.updatePlaylistDetailTrack(filePath, updatedData)
            )
        }
    });

    const playbackAppController = new PlaybackAppController({
        app,
        integrations: {
            getLibraryTracks: () => libraryDataService.getTracks(),
            setPlaylist: (tracks, startIndex) => playbackController.setPlaylist(tracks, startIndex),
            loadTrack: (filePath) => playbackController.loadTrack(filePath),
            play: () => playbackController.play(),
            setPosition: (position) => playbackController.setPosition(position),
            setPlayMode: (mode) => playbackController.setPlayMode(mode),
            getPlaybackSnapshot: () => playbackController.getPlaybackSnapshot()
        },
        ui: {
            hasQueue: () => ui.queue.hasQueue(),
            getQueueTracks: () => ui.queue.getQueueTracks(),
            isQueueEmpty: () => ui.queue.isQueueEmpty(),
            syncQueueTracks: (tracks, currentIndex) => ui.queue.syncQueueTracks(tracks, currentIndex),
            setQueueCurrentTrack: (index) => ui.queue.setQueueCurrentTrack(index),
            findQueueIndex: (predicate) => ui.queue.findQueueIndex(predicate),
            addQueueTrack: (track) => ui.queue.addQueueTrack(track)
        }
    });

    const playlistController = new PlaylistController({
        app,
        playback: {
            setPlaylist: (tracks, startIndex) => playbackController.setPlaylist(tracks, startIndex),
            getCurrentIndex: () => playbackController.getCurrentIndex(),
            pause: () => playbackController.pause()
        },
        ui: {
            hasQueue: () => ui.queue.hasQueue(),
            getQueueTracks: () => ui.queue.getQueueTracks(),
            getQueueCurrentIndex: () => ui.queue.getQueueCurrentIndex(),
            addQueueTrack: (track) => ui.queue.addQueueTrack(track),
            showAddToPlaylistDialog: (track) => ui.dialogs.showAddToPlaylistDialog(track),
            showPlaylistDetail: (playlist) => ui.content.showPlaylistDetail(playlist),
            showMusicLibrarySelectionDialog: (playlist) => ui.dialogs.showMusicLibrarySelectionDialog(playlist),
            reloadPlaylistDetailTracks: () => ui.content.reloadPlaylistDetailTracks(),
            updateNavigationPlaylistInfo: (playlist) => ui.content.updateNavigationPlaylistInfo(playlist),
            refreshNavigationPlaylists: () => ui.content.refreshNavigationPlaylists()
        }
    });
    const networkDriveRouteController = new NetworkDriveRouteController({
        app,
        library: libraryController,
        content: ui.content,
        viewRouter
    });

    configureSharedFeatureDependencies();
    appShellRuntimeHost.bindApp(app);
    extensionHostService.bindApp(app);

    const lifecycleController = new AppLifecycleController({
        app,
        playback: {
            initializeAudio: () => playbackController.initializeAudio(),
            restorePlaybackState: () => playbackAppController.restorePlaybackState(),
            savePlaybackState: () => playbackAppController.savePlaybackState(),
            setPlayMode: (mode) => playbackController.setPlayMode(mode),
            setVolume: (volume) => playbackController.setVolume(volume)
        },
        playbackUI: ui.playback
    });

    return {
        apiEventBinder,
        componentEventBinder,
        componentRegistry,
        desktopLyricsButtonSync,
        domEventBinder,
        fileImportController,
        lifecycleController,
        libraryController,
        networkDriveRouteController,
        notifier,
        playbackController: playbackAppController,
        playlistController,
        pluginBootstrap,
        shellView,
        shortcutController,
        ui,
        viewRouter
    };
}

function configureSharedFeatureDependencies(): void {
    desktopLyricsService.configure({
        getPlaybackSnapshot: () => playbackController.getPlaybackSnapshot()
    });
    equalizerService.configure({
        getEqualizer: <T = unknown>() => playbackService.getEqualizer<T>(),
        setEqualizerEnabled: (enabled) => playbackService.setEqualizerEnabled(enabled),
        getAudioEngine: <T extends AudioEngineManagerBridge>() => playbackService.getAudioEngine() as T | null
    });
}
