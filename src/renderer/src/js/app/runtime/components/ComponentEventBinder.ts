import {AppUIFacade, type ComponentMap, type RendererAppContext} from "@js/app/runtime";
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
import {bindPlaybackComponentEvents} from "@js/features/playback/ui-bindings";
import {bindPlaylistComponentEvents} from "@js/features/playlists/ui-bindings";
import {bindSettingsComponentEvents} from "@js/features/settings/ui-bindings";

interface ComponentEventBinderOptions {
    app: RendererAppContext;
}

export class ComponentEventBinder {
    private readonly app: RendererAppContext;
    private readonly components: ComponentMap;
    private readonly ui: AppUIFacade;
    private readonly context: ComponentBindingContext;
    private readonly pageBindings: PageComponentBindings;

    constructor({app}: ComponentEventBinderOptions) {
        this.app = app;
        this.components = app.components;
        this.ui = new AppUIFacade(app);
        this.context = {
            app: this.app,
            components: this.components,
            ui: this.ui,
            notify: (data) => notifyComponentEvent(this.app, data)
        };
        this.pageBindings = new PageComponentBindings(this.context);
    }

    bindInitialComponentEvents(): void {
        bindNavigationComponentEvents(this.context);
        bindPlaybackComponentEvents(this.context);
        bindPlaylistComponentEvents(this.context);
        bindSettingsComponentEvents({
            ...this.context,
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
