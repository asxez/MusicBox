import {showToast} from "@utils/index.js";
import {displayModeSettingsController} from "./DisplayModeSettingsController";
import {appModalService} from "@js/features/appShell/service";
import {settingsPanelVisibilityService} from "./SettingsPanelVisibilityService";
import type {SettingValue} from "./SettingsStore";
import type {SettingsListenerScope} from "./SettingsListenerScope";

export interface GeneralSettingsElements {
    navButtons: Iterable<HTMLElement>;
    closeButton: HTMLElement | null;
    languageSelect: HTMLSelectElement | null;
    autoplayToggle: HTMLInputElement | null;
    rememberPositionToggle: HTMLInputElement | null;
    desktopLyricsToggle: HTMLInputElement | null;
    statisticsToggle: HTMLInputElement | null;
    recentPlayToggle: HTMLInputElement | null;
    artistsPageToggle: HTMLInputElement | null;
    albumsPageToggle: HTMLInputElement | null;
    showTrackCoversToggle: HTMLInputElement | null;
    gaplessPlaybackToggle: HTMLInputElement | null;
    networkDriveToggle: HTMLInputElement | null;
    networkDriveConfig: HTMLElement | null;
    checkUpdatesButton: HTMLElement | null;
    addNetworkDriveButton: HTMLElement | null;
}

interface GeneralSettingsCallbacks {
    hide: () => void;
    switchToSection: (sectionName: string) => void;
    updateSetting: (key: string, value: SettingValue) => void;
    emit: (eventName: string, ...args: unknown[]) => void;
}

class GeneralSettingsController {
    initialize(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks, scope: SettingsListenerScope): void {
        this.bindShellEvents(elements, callbacks, scope);
        this.bindSimpleSettings(elements, callbacks, scope);
        this.bindFeatureToggles(elements, callbacks, scope);
    }

    private bindShellEvents(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks, scope: SettingsListenerScope): void {
        Array.from(elements.navButtons).forEach((button) => {
            scope.listen(button, 'click', (event: Event) => {
                const section = (event.currentTarget as HTMLElement).dataset.section || 'appearance';
                callbacks.switchToSection(section);
            });
        });

        scope.listen(elements.closeButton, 'click', callbacks.hide);

        scope.listen(elements.checkUpdatesButton, 'click', () => {
            callbacks.emit('checkUpdates');
        });
    }

    private bindSimpleSettings(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.languageSelect, 'change', () => {
            const value = elements.languageSelect?.value || 'zh-CN';
            callbacks.updateSetting('language', value);
            callbacks.emit('languageChanged', value);
        });

        this.bindCheckedSetting(elements.autoplayToggle, 'autoplay', callbacks, scope);
        this.bindCheckedSetting(elements.rememberPositionToggle, 'rememberPosition', callbacks, scope);
    }

    private bindFeatureToggles(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks, scope: SettingsListenerScope): void {
        this.bindDesktopLyricsToggle(elements, callbacks, scope);
        this.bindCheckedSetting(elements.statisticsToggle, 'statistics', callbacks, scope, 'statisticsEnabled');
        this.bindCheckedSetting(elements.recentPlayToggle, 'recentPlay', callbacks, scope, 'recentPlayEnabled');
        this.bindCheckedSetting(elements.artistsPageToggle, 'artistsPage', callbacks, scope, 'artistsPageEnabled');
        this.bindCheckedSetting(elements.albumsPageToggle, 'albumsPage', callbacks, scope, 'albumsPageEnabled');
        this.bindCheckedSetting(elements.showTrackCoversToggle, 'showTrackCovers', callbacks, scope, 'showTrackCoversEnabled');
        this.bindCheckedSetting(elements.gaplessPlaybackToggle, 'gaplessPlayback', callbacks, scope, 'gaplessPlaybackEnabled');
        this.bindNetworkDriveToggle(elements, callbacks, scope);
        this.bindNetworkDriveModal(elements, scope);
    }

    private bindDesktopLyricsToggle(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.desktopLyricsToggle, 'change', async () => {
            const enabled = Boolean(elements.desktopLyricsToggle?.checked);
            callbacks.updateSetting('desktopLyrics', enabled);
            callbacks.emit('desktopLyricsEnabled', enabled);

            if (!enabled) {
                await displayModeSettingsController.hideDesktopLyrics();
            }
        });
    }

    private bindNetworkDriveToggle(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.networkDriveToggle, 'change', () => {
            const enabled = Boolean(elements.networkDriveToggle?.checked);
            callbacks.updateSetting('networkDriveEnabled', enabled);
            settingsPanelVisibilityService.toggleNetworkDriveConfig(elements.networkDriveConfig, enabled);
            callbacks.emit('networkDriveEnabled', enabled);
        });
    }

    private bindNetworkDriveModal(elements: GeneralSettingsElements, scope: SettingsListenerScope): void {
        scope.listen(elements.addNetworkDriveButton, 'click', () => {
            if (!appModalService.showNetworkDriveModal()) {
                showToast('网络磁盘功能不可用', 'error');
            }
        });
    }

    private bindCheckedSetting(
        element: HTMLInputElement | null,
        settingKey: string,
        callbacks: GeneralSettingsCallbacks,
        scope: SettingsListenerScope,
        eventName?: string
    ): void {
        if (!element) {
            return;
        }

        scope.listen(element, 'change', () => {
            const enabled = element.checked;
            callbacks.updateSetting(settingKey, enabled);

            if (eventName) {
                callbacks.emit(eventName, enabled);
            }
        });
    }
}

export const generalSettingsController = new GeneralSettingsController();
