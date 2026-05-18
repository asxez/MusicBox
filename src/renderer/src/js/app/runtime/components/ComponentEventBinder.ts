import {AppUIFacade} from "@js/app/runtime/AppUIFacade";
import type {AppComponentPort, AppNotificationPort, ComponentMap} from "@js/app/runtime/AppRuntimeTypes";
import {appShellController} from "@js/features/appShell";
import {playbackController} from "@js/features/playback";
import {trackCoverDisplayPreferenceService} from "@services/preferences/TrackCoverDisplayPreferenceService";
import {settingsExtensionNavigationService} from "@services/settings/SettingsExtensionNavigationService";
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
}

export class ComponentEventBinder {
    private readonly ports: ComponentBindingPorts;
    private readonly components: ComponentMap;
    private readonly ui: AppUIFacade;
    private readonly context: ComponentBindingContext;
    private readonly pageBindings: PageComponentBindings;

    constructor({ports, components}: ComponentEventBinderOptions) {
        this.ports = ports;
        this.components = components.components;
        this.ui = new AppUIFacade(components);
        this.context = {
            components: this.components,
            ui: this.ui,
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
            ...this.context,
            app: this.ports.playback
        });
        bindPlaylistComponentEvents({
            ...this.context,
            app: this.ports.playlists
        });
        bindSettingsComponentEvents({
            ...this.context,
            app: this.ports.settings,
            integrations: {
                onShowUpdateDetails: (handler) => {
                    appShellController.onShowUpdateDetails(handler);
                },
                onNavigateToSettingsSection: (handler) => {
                    settingsExtensionNavigationService.onNavigate(handler);
                },
                setGaplessPlayback: (enabled) => {
                    playbackController.setGaplessPlayback(enabled);
                },
                setTrackCoverDisplayPreference: (enabled) => {
                    trackCoverDisplayPreferenceService.setEnabled(enabled);
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
