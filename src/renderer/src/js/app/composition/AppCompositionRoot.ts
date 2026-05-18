import {APIEventBinder} from '@js/app/runtime/APIEventBinder';
import {AppNotifier} from '@js/app/runtime/AppNotifier';
import {AppUIFacade} from '@js/app/runtime/AppUIFacade';
import {ComponentEventBinder} from '@js/app/runtime/components/ComponentEventBinder';
import {ComponentRegistry} from '@js/app/runtime/components/ComponentRegistry';
import {DesktopLyricsButtonSync} from '@js/app/runtime/DesktopLyricsButtonSync';
import {DOMEventBinder} from '@js/app/runtime/DOMEventBinder';
import {NetworkDriveRouteController} from '@js/app/runtime/NetworkDriveRouteController';
import {PluginBootstrap} from '@js/app/runtime/PluginBootstrap';
import {ShortcutController} from '@js/app/runtime/ShortcutController';
import {ViewRouter} from '@js/app/runtime/ViewRouter';
import type {
    ComponentMap,
    ManagedAPIListener,
    ManagedDOMListener,
    RendererAppContext
} from '@js/app/runtime/AppRuntimeTypes';
import {AppLifecycleController} from '@js/app/lifecycle';
import {AppShellView} from '@js/app/shell';
import {
    FileImportController,
    LibraryAppController,
    libraryController as libraryFeatureController
} from '@js/features/library';
import {PlaylistController} from '@js/features/playlists';
import {PlaybackAppController, playbackController} from '@js/features/playback';
import {playbackService} from '@js/features/playback/service';
import {desktopLyricsController} from '@js/features/desktopLyrics';
import {equalizerController} from '@js/features/equalizer';
import {mediaController} from '@js/features/media';
import {extensionHostService} from '@services/plugins/ExtensionHostService';
import {appInteractionService} from '@services/ui/AppInteractionService';
import type {AudioEngineManagerBridge} from '@js/features/equalizer/service';

interface AppCompositionRootOptions {
    app: MusicBoxAppHost;
    components: ComponentMap;
    eventListeners: ManagedDOMListener[];
    apiEventListeners: ManagedAPIListener[];
}

interface MusicBoxAppHost extends RendererAppContext {
    addMusicFiles(): Promise<void>;
    clearRuntimeData(): void;
    handleViewChange(view: string): Promise<void>;
    initializeComponents(): void;
    loadInitialData(): Promise<void>;
    scanMusicFolder(): Promise<void>;
    schedulePluginSystemInitialization(): void;
    setupComponentEvents(componentName?: string | null): void;
    setupEventListeners(): Promise<void>;
    showApp(): void;
    showFatalError(message: string): void;
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
    const ui = new AppUIFacade(app);
    const componentRegistry = new ComponentRegistry({
        components,
        setupComponentEvents: (componentName: string) => app.setupComponentEvents(componentName)
    });
    const domEventBinder = new DOMEventBinder({eventListeners});
    const apiEventBinder = new APIEventBinder({apiEventListeners});
    const shellView = new AppShellView({
        onScanMusicFolder: () => app.scanMusicFolder(),
        onAddMusicFiles: () => app.addMusicFiles(),
        onShowHomePage: () => app.handleViewChange('home-page')
    });
    const componentEventBinder = new ComponentEventBinder({app});
    const viewRouter = new ViewRouter({app});
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
            openDirectory: () => mediaController.openDirectory(),
            openDirectoryDialog: () => mediaController.openDirectoryDialog(),
            openFiles: () => mediaController.openFiles(),
            loadTrack: (filePath) => playbackController.loadTrack(filePath),
            play: () => playbackController.play()
        }
    });

    const pluginBootstrap = new PluginBootstrap({app});

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
    appInteractionService.bindApp(app);
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
