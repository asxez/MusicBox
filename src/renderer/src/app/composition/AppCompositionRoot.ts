import {APIEventBinder} from '@/app/runtime/APIEventBinder';
import {AppNotifier} from '@/app/runtime/AppNotifier';
import {ComponentEventBinder, type ComponentBindingPorts} from '@/app/runtime/components/ComponentEventBinder';
import {ComponentRegistry} from '@/app/runtime/components/ComponentRegistry';
import {DesktopLyricsButtonSync} from '@/app/runtime/DesktopLyricsButtonSync';
import {DOMEventBinder} from '@/app/runtime/DOMEventBinder';
import {NetworkDriveRouteController} from '@/app/runtime/NetworkDriveRouteController';
import {PlaybackQueueSyncService} from '@/app/runtime/PlaybackQueueSyncService';
import {PluginBootstrap} from '@/app/runtime/PluginBootstrap';
import {ShortcutController} from '@/app/runtime/ShortcutController';
import {ViewRouter} from '@/app/runtime/ViewRouter';
import {createAppUIPorts, type AppUIPorts} from '@/app/runtime/ui/AppUIPorts';
import {createAppHostPorts, type MusicBoxCompositionHost} from './AppHostPorts';
import type {ComponentMap} from '@/app/runtime/components/ComponentTypes';
import type {ManagedAPIListener, ManagedDOMListener} from '@/shared/types/AppContracts';
import {AppLifecycleController} from '@/app/lifecycle';
import {AppShellView} from '@/app/shell';
import {
    FileImportController,
    LibraryAppController
} from '@/features/library/ui-bindings';
import {libraryDataService} from '@/features/library/service/LibraryDataService';
import {PlaylistController} from '@/features/playlists/PlaylistController';
import {playbackController} from '@/features/playback/PlaybackController';
import {PlaybackAppController} from '@/features/playback/ui-bindings/PlaybackAppController';
import {playbackService} from '@/features/playback/service/PlaybackService';
import {desktopLyricsService} from '@/features/desktopLyrics/service/DesktopLyricsService';
import {equalizerService} from '@/features/equalizer/service/EqualizerService';
import {mediaFileDialogService} from '@/features/media/service';
import {extensionHostService} from '@/features/extensions/service';
import {appShellRuntimeHost} from '@/features/appShell/service';
import type {AudioEngineManagerBridge} from '@/features/equalizer/service';

interface AppCompositionRootOptions {
    app: MusicBoxCompositionHost;
    components: ComponentMap;
    eventListeners: ManagedDOMListener[];
    apiEventListeners: ManagedAPIListener[];
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
    playbackQueueSyncService: PlaybackQueueSyncService;
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
    const hostPorts = createAppHostPorts(app);
    const componentPort = hostPorts.components;
    const ui = createAppUIPorts(hostPorts.components);
    const componentRegistry = new ComponentRegistry({
        components,
        setupComponentEvents: (componentName: string) => app.setupComponentEvents(componentName)
    });
    const domEventBinder = new DOMEventBinder({
        app: hostPorts.domEvents,
        eventListeners
    });
    const apiEventBinder = new APIEventBinder({
        app: hostPorts.apiEvents,
        apiEventListeners,
        playbackUI: ui.playback
    });
    const shellView = new AppShellView({
        onScanMusicFolder: () => app.scanMusicFolder(),
        onAddMusicFiles: () => app.addMusicFiles(),
        onShowHomePage: () => app.handleViewChange('home-page')
    });
    const componentBindingPorts: ComponentBindingPorts = {
        navigation: hostPorts.navigationBindings,
        pages: hostPorts.pageBindings,
        playback: hostPorts.playbackBindings,
        playlists: hostPorts.playlistBindings,
        settings: hostPorts.settingsBindings,
        notifications: hostPorts.appShellRuntime
    };
    const componentEventBinder = new ComponentEventBinder({
        ports: componentBindingPorts,
        components: componentPort,
        ui
    });
    const viewRouter = new ViewRouter({app: hostPorts.viewRouter, content: ui.content});
    const notifier = new AppNotifier(shellView);
    const desktopLyricsButtonSync = new DesktopLyricsButtonSync(ui.playback);
    const playbackQueueSyncService = new PlaybackQueueSyncService({
        playback: playbackController,
        queue: ui.queue
    });
    playbackQueueSyncService.start();

    const shortcutController = new ShortcutController({
        app: hostPorts.shortcuts,
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
        app: hostPorts.fileImport,
        integrations: {
            openDirectory: () => mediaFileDialogService.openDirectory(),
            openDirectoryDialog: () => mediaFileDialogService.openDirectoryDialog(),
            openFiles: () => mediaFileDialogService.openFiles(),
            loadTrack: (filePath) => playbackController.loadTrack(filePath),
            play: () => playbackController.play()
        }
    });

    const pluginBootstrap = new PluginBootstrap({
        app: hostPorts.pluginBootstrap,
        legacyApp: hostPorts.legacyPluginApp as any,
        legacyComponents: components
    });

    const libraryController = new LibraryAppController({
        app: hostPorts.library,
        integrations: {
            getCurrentPlaybackTrack: () => playbackController.getCurrentTrackSnapshot(),
            getPlaybackPlaylist: () => playbackController.getPlaylist(),
            getCurrentPlaybackIndex: () => playbackController.getCurrentIndex(),
            setPlaybackPlaylist: (tracks, startIndex) => playbackController.setPlaylist(tracks, startIndex)
        },
        ui: {
            setTrackListTracks: (tracks) => ui.content.setTrackListTracks(tracks),
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
        app: hostPorts.playback,
        integrations: {
            getLibraryTracks: () => libraryDataService.getTracks(),
            setPlaylist: (tracks, startIndex) => playbackController.setPlaylist(tracks, startIndex),
            loadTrack: (filePath) => playbackController.loadTrack(filePath),
            play: () => playbackController.play(),
            setPosition: (position) => playbackController.setPosition(position),
            setPlayMode: (mode) => playbackController.setPlayMode(mode),
            getPlaybackSnapshot: () => playbackController.getPlaybackSnapshot()
        }
    });

    const playlistController = new PlaylistController({
        app: hostPorts.playlist,
        playback: {
            setPlaylist: (tracks, startIndex) => playbackController.setPlaylist(tracks, startIndex),
            getCurrentIndex: () => playbackController.getCurrentIndex(),
            getPlaylist: () => playbackController.getPlaylist(),
            pause: () => playbackController.pause()
        },
        ui: {
            showAddToPlaylistDialog: (track) => ui.dialogs.showAddToPlaylistDialog(track),
            showPlaylistDetail: (playlist) => ui.content.showPlaylistDetail(playlist),
            showMusicLibrarySelectionDialog: (playlist) => ui.dialogs.showMusicLibrarySelectionDialog(playlist),
            reloadPlaylistDetailTracks: () => ui.content.reloadPlaylistDetailTracks(),
            updateNavigationPlaylistInfo: (playlist) => ui.content.updateNavigationPlaylistInfo(playlist),
            refreshNavigationPlaylists: () => ui.content.refreshNavigationPlaylists()
        }
    });
    const networkDriveRouteController = new NetworkDriveRouteController({
        app: hostPorts.networkDriveRoute,
        library: libraryController,
        content: ui.content,
        viewRouter
    });

    configureSharedFeatureDependencies();
    appShellRuntimeHost.bindApp(hostPorts.appShellRuntime);
    extensionHostService.bindApp(hostPorts.extensionHost);

    const lifecycleController = new AppLifecycleController({
        app: hostPorts.lifecycle,
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
        playbackQueueSyncService,
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
