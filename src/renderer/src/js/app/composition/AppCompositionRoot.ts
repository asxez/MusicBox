import {APIEventBinder} from '@js/app/runtime/APIEventBinder';
import {AppNotifier} from '@js/app/runtime/AppNotifier';
import {AppUIFacade} from '@js/app/runtime/AppUIFacade';
import {ComponentEventBinder, type ComponentBindingPorts} from '@js/app/runtime/components/ComponentEventBinder';
import {ComponentRegistry} from '@js/app/runtime/components/ComponentRegistry';
import {DesktopLyricsButtonSync} from '@js/app/runtime/DesktopLyricsButtonSync';
import {DOMEventBinder} from '@js/app/runtime/DOMEventBinder';
import {NetworkDriveRouteController} from '@js/app/runtime/NetworkDriveRouteController';
import {PluginBootstrap} from '@js/app/runtime/PluginBootstrap';
import {ShortcutController} from '@js/app/runtime/ShortcutController';
import {ViewRouter} from '@js/app/runtime/ViewRouter';
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
    LibraryAppController,
    libraryController as libraryFeatureController
} from '@js/features/library';
import type {FileImportHost, LibraryAppHost} from '@js/features/library/ui-bindings';
import {PlaylistController, type PlaylistAppHost} from '@js/features/playlists';
import type {PlaylistComponentBindingHost} from '@js/features/playlists/ui-bindings';
import {PlaybackAppController, playbackController} from '@js/features/playback';
import type {PlaybackAppHost} from '@js/features/playback/ui-bindings';
import type {PlaybackComponentBindingHost} from '@js/features/playback/ui-bindings';
import type {SettingsComponentBindingHost} from '@js/features/settings/ui-bindings';
import {playbackService} from '@js/features/playback/service';
import {desktopLyricsController} from '@js/features/desktopLyrics';
import {equalizerController} from '@js/features/equalizer';
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
    ui: AppUIFacade;
    viewRouter: ViewRouter;
}

export function createAppComposition({
    app,
    components,
    eventListeners,
    apiEventListeners
}: AppCompositionRootOptions): AppComposition {
    const componentPort: AppComponentPort = {components};
    const ui = new AppUIFacade(componentPort);
    const componentRegistry = new ComponentRegistry({
        components,
        setupComponentEvents: (componentName: string) => app.setupComponentEvents(componentName)
    });
    const domEventBinder = new DOMEventBinder({eventListeners});
    const apiEventBinder = new APIEventBinder({apiEventListeners, components: componentPort});
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
    const componentEventBinder = new ComponentEventBinder({ports: componentBindingPorts, components: componentPort});
    const viewRouter = new ViewRouter({app, components: componentPort});
    const notifier = new AppNotifier(shellView);
    const desktopLyricsButtonSync = new DesktopLyricsButtonSync(ui);

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
        ui
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
        ui
    });

    const playbackAppController = new PlaybackAppController({
        app,
        integrations: {
            getLibraryTracks: () => libraryFeatureController.getTracks()
        },
        ui
    });

    const playlistController = new PlaylistController({
        app,
        playback: {
            setPlaylist: (tracks, startIndex) => playbackController.setPlaylist(tracks, startIndex),
            getCurrentIndex: () => playbackController.getCurrentIndex(),
            pause: () => playbackController.pause()
        },
        ui
    });
    const networkDriveRouteController = new NetworkDriveRouteController({
        app,
        library: libraryController,
        ui,
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
        ui
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
    desktopLyricsController.configure({
        getPlaybackSnapshot: () => playbackController.getPlaybackSnapshot()
    });
    equalizerController.configure({
        getEqualizer: <T = unknown>() => playbackService.getEqualizer<T>(),
        setEqualizerEnabled: (enabled) => playbackService.setEqualizerEnabled(enabled),
        getAudioEngine: <T extends AudioEngineManagerBridge>() => playbackService.getAudioEngine() as T | null
    });
}
