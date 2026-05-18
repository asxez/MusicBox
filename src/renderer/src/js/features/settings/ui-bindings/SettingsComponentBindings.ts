interface ComponentEventSource {
    on(event: string, handler: (...args: any[]) => void | Promise<void>): void;
}

interface SettingsBindingComponents {
    settings: ComponentEventSource;
}

interface SettingsBindingApp {
    isInitialized: boolean;
    initializeComponent(componentName: string): void;
    destroyComponent(componentName: string): void;
    preloadTrackCovers(): Promise<void>;
}

interface SettingsBindingUI {
    showUpdateModal(): void;
    switchSettingsSection(sectionName: string): void;
    updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void>;
    updateStatisticsButtonVisibility(enabled: boolean): void;
    updateRecentPlayButtonVisibility(enabled: boolean): void;
    updateArtistsPageButtonVisibility(enabled: boolean): void;
    updateAlbumsPageButtonVisibility(enabled: boolean): void;
}

interface SettingsComponentBindingContext {
    app: SettingsBindingApp;
    components: SettingsBindingComponents;
    integrations: SettingsBindingIntegrations;
    ui: SettingsBindingUI;
}

interface SettingsBindingIntegrations {
    onShowUpdateDetails(handler: () => void): void;
    onNavigateToSettingsSection(handler: (sectionName: string) => void): void;
    setGaplessPlayback(enabled: boolean): void;
    setTrackCoverDisplayPreference(enabled: boolean): void;
}

export function bindSettingsComponentEvents({
    app,
    components,
    integrations,
    ui
}: SettingsComponentBindingContext): void {
    components.settings.on('shortcutsUpdated', () => {
        console.log('🎹 快捷键配置已更新');
    });

    components.settings.on('checkUpdates', () => {
        ui.showUpdateModal();
    });

    integrations.onShowUpdateDetails(() => {
        ui.showUpdateModal();
    });

    integrations.onNavigateToSettingsSection((sectionName) => {
        ui.switchSettingsSection(sectionName);
    });

    components.settings.on('desktopLyricsEnabled', async (enabled: boolean) => {
        await ui.updateDesktopLyricsButtonVisibility(enabled);
    });

    components.settings.on('networkDriveEnabled', (enabled: boolean) => {
        if (enabled) {
            app.initializeComponent('networkDiskModal');
        } else {
            app.destroyComponent('networkDiskModal');
        }
    });

    components.settings.on('statisticsEnabled', (enabled: boolean) => {
        ui.updateStatisticsButtonVisibility(enabled);

        if (enabled) {
            app.initializeComponent('statisticsPage');
        } else {
            app.destroyComponent('statisticsPage');
        }
    });

    components.settings.on('recentPlayEnabled', (enabled: boolean) => {
        ui.updateRecentPlayButtonVisibility(enabled);

        if (enabled) {
            app.initializeComponent('recentPage');
        } else {
            app.destroyComponent('recentPage');
        }
    });

    components.settings.on('artistsPageEnabled', (enabled: boolean) => {
        ui.updateArtistsPageButtonVisibility(enabled);

        if (enabled) {
            app.initializeComponent('artistsPage');
        } else {
            app.destroyComponent('artistsPage');
        }
    });

    components.settings.on('albumsPageEnabled', (enabled: boolean) => {
        ui.updateAlbumsPageButtonVisibility(enabled);

        if (enabled) {
            app.initializeComponent('albumsPage');
        } else {
            app.destroyComponent('albumsPage');
        }
    });

    components.settings.on('showTrackCoversEnabled', async (enabled: boolean) => {
        integrations.setTrackCoverDisplayPreference(enabled);
        if (enabled && app.isInitialized) {
            await app.preloadTrackCovers();
        }
    });

    components.settings.on('gaplessPlaybackEnabled', (enabled: boolean) => {
        integrations.setGaplessPlayback(enabled);
    });
}
