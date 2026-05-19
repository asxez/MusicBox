import type {AppComponentPort, AppNotificationPort} from "@js/app/runtime/AppRuntimePorts";
import type {ComponentMap} from "@js/app/runtime/components/ComponentTypes";
import type {AppUIPorts} from "@js/app/runtime/ui/AppUIPorts";
import {updateNotificationService} from "@js/features/appShell/service";
import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import {playbackService} from "@js/features/playback/service/PlaybackService";
import {trackCoverDisplayPreferenceService} from "@js/features/settings/service";
import {settingsExtensionNavigationService} from "@js/features/settings/service";
import {
    type ComponentBindingContext,
    type ComponentEventName,
    notifyComponentEvent
} from "./bindings/ComponentBindingTypes";
import {bindNavigationComponentEvents} from "./bindings/NavigationComponentBindings";
import {PageComponentBindings} from "./bindings/PageComponentBindings";
import {bindPlaybackComponentEvents, type PlaybackComponentBindingHost} from "@js/features/playback/ui-bindings";
import {bindPlaylistComponentEvents, type PlaylistComponentBindingHost} from "@js/features/playlists/ui-bindings";
import {bindSettingsComponentEvents, type SettingsComponentBindingHost} from "@js/features/settings/ui-bindings";
import type {NavigationComponentBindingHost, PageComponentBindingHost} from "./bindings/ComponentBindingTypes";

export interface ComponentBindingPorts {
    navigation: NavigationComponentBindingHost;
    pages: PageComponentBindingHost;
    playback: PlaybackComponentBindingHost;
    playlists: PlaylistComponentBindingHost;
    settings: SettingsComponentBindingHost;
    notifications: AppNotificationPort;
}

interface ComponentEventBinderOptions {
    ports: ComponentBindingPorts;
    components: AppComponentPort;
    ui: AppUIPorts;
}

export class ComponentEventBinder {
    private readonly ports: ComponentBindingPorts;
    private readonly components: ComponentMap;
    private readonly ui: AppUIPorts;
    private readonly context: ComponentBindingContext;
    private readonly pageBindings: PageComponentBindings;

    constructor({ports, components, ui}: ComponentEventBinderOptions) {
        this.ports = ports;
        this.components = components.components;
        this.ui = ui;
        this.context = {
            components: this.components,
            content: this.ui.content,
            dialogs: this.ui.dialogs,
            playback: this.ui.playback,
            queue: this.ui.queue,
            notify: (data) => notifyComponentEvent(this.ports.notifications, data)
        };
        this.pageBindings = new PageComponentBindings({
            ...this.context,
            app: this.ports.pages
        });
    }

    bindInitialComponentEvents(): void {
        bindNavigationComponentEvents({
            ...this.context,
            app: this.ports.navigation
        });
        bindPlaybackComponentEvents({
            app: this.ports.playback,
            components: this.components,
            integrations: {
                getCurrentTrackSnapshot: () => playbackUiStateService.getCurrentTrackSnapshot()
            },
            ui: {
                showContextMenu: (x, y, track, index, selectedTracks) => {
                    this.ui.content.showContextMenu(x, y, track, index, selectedTracks);
                },
                toggleQueue: () => {
                    this.ui.queue.toggleQueue();
                },
                toggleLyricsForTrack: (track) => this.ui.playback.toggleLyricsForTrack(track)
            }
        });
        bindPlaylistComponentEvents({
            app: this.ports.playlists,
            components: this.components,
            notify: this.context.notify,
            ui: {
                showCreatePlaylistDialog: (track) => {
                    this.ui.dialogs.showCreatePlaylistDialog(track);
                },
                syncQueueTracks: (tracks, currentIndex) => {
                    this.ui.queue.syncQueueTracks(tracks, currentIndex);
                },
                showContextMenu: (x, y, track, index, selectedTracks) => {
                    this.ui.content.showContextMenu(x, y, track, index, selectedTracks);
                }
            }
        });
        bindSettingsComponentEvents({
            app: this.ports.settings,
            components: this.components,
            integrations: {
                onShowUpdateDetails: (handler) => {
                    updateNotificationService.onShowUpdateDetails(handler);
                },
                onNavigateToSettingsSection: (handler) => {
                    settingsExtensionNavigationService.onNavigate(handler);
                },
                setGaplessPlayback: (enabled) => {
                    playbackService.setGaplessPlayback(enabled);
                },
                setTrackCoverDisplayPreference: (enabled) => {
                    trackCoverDisplayPreferenceService.setEnabled(enabled);
                }
            },
            ui: {
                showUpdateModal: () => {
                    this.ui.dialogs.showUpdateModal();
                },
                switchSettingsSection: (sectionName) => {
                    this.ui.dialogs.switchSettingsSection(sectionName);
                },
                updateDesktopLyricsButtonVisibility: (enabled) => {
                    return this.ui.playback.updateDesktopLyricsButtonVisibility(enabled);
                },
                updateStatisticsButtonVisibility: (enabled) => {
                    this.ui.content.updateStatisticsButtonVisibility(enabled);
                },
                updateRecentPlayButtonVisibility: (enabled) => {
                    this.ui.content.updateRecentPlayButtonVisibility(enabled);
                },
                updateArtistsPageButtonVisibility: (enabled) => {
                    this.ui.content.updateArtistsPageButtonVisibility(enabled);
                },
                updateAlbumsPageButtonVisibility: (enabled) => {
                    this.ui.content.updateAlbumsPageButtonVisibility(enabled);
                }
            }
        });
        this.pageBindings.setupComponentEvents();
    }

    setupComponentEvents(componentName: ComponentEventName | null = null): void {
        this.pageBindings.setupComponentEvents(componentName);
    }

    setupSingleComponentEvents(componentName: ComponentEventName | string): void {
        this.pageBindings.setupSingleComponentEvents(componentName);
    }
}
