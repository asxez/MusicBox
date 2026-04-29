import {showToast} from "@utils/index.js";
import {displayModeSettingsController} from "@services/settings/DisplayModeSettingsController";
import {appInteractionService} from "@services/ui/AppInteractionService";
import {settingsPanelVisibilityService} from "@services/settings/SettingsPanelVisibilityService";
import type {SettingValue} from "@services/settings/SettingsStore";

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
    initialize(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks): void {
        this.bindShellEvents(elements, callbacks);
        this.bindSimpleSettings(elements, callbacks);
        this.bindFeatureToggles(elements, callbacks);
    }

    private bindShellEvents(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks): void {
        Array.from(elements.navButtons).forEach((button) => {
            button.addEventListener('click', (event: Event) => {
                const section = (event.currentTarget as HTMLElement).dataset.section || 'appearance';
                callbacks.switchToSection(section);
            });
        });

        elements.closeButton?.addEventListener('click', callbacks.hide);

        elements.checkUpdatesButton?.addEventListener('click', () => {
            callbacks.emit('checkUpdates');
        });
    }

    private bindSimpleSettings(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks): void {
        elements.languageSelect?.addEventListener('change', () => {
            const value = elements.languageSelect?.value || 'zh-CN';
            callbacks.updateSetting('language', value);
            callbacks.emit('languageChanged', value);
        });

        this.bindCheckedSetting(elements.autoplayToggle, 'autoplay', callbacks);
        this.bindCheckedSetting(elements.rememberPositionToggle, 'rememberPosition', callbacks);
    }

    private bindFeatureToggles(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks): void {
        this.bindDesktopLyricsToggle(elements, callbacks);
        this.bindCheckedSetting(elements.statisticsToggle, 'statistics', callbacks, 'statisticsEnabled');
        this.bindCheckedSetting(elements.recentPlayToggle, 'recentPlay', callbacks, 'recentPlayEnabled');
        this.bindCheckedSetting(elements.artistsPageToggle, 'artistsPage', callbacks, 'artistsPageEnabled');
        this.bindCheckedSetting(elements.albumsPageToggle, 'albumsPage', callbacks, 'albumsPageEnabled');
        this.bindCheckedSetting(elements.showTrackCoversToggle, 'showTrackCovers', callbacks, 'showTrackCoversEnabled');
        this.bindCheckedSetting(elements.gaplessPlaybackToggle, 'gaplessPlayback', callbacks, 'gaplessPlaybackEnabled');
        this.bindNetworkDriveToggle(elements, callbacks);
        this.bindNetworkDriveModal(elements);
    }

    private bindDesktopLyricsToggle(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks): void {
        elements.desktopLyricsToggle?.addEventListener('change', async () => {
            const enabled = Boolean(elements.desktopLyricsToggle?.checked);
            callbacks.updateSetting('desktopLyrics', enabled);
            callbacks.emit('desktopLyricsEnabled', enabled);

            if (!enabled) {
                await displayModeSettingsController.hideDesktopLyrics();
            }
        });
    }

    private bindNetworkDriveToggle(elements: GeneralSettingsElements, callbacks: GeneralSettingsCallbacks): void {
        elements.networkDriveToggle?.addEventListener('change', () => {
            const enabled = Boolean(elements.networkDriveToggle?.checked);
            callbacks.updateSetting('networkDriveEnabled', enabled);
            settingsPanelVisibilityService.toggleNetworkDriveConfig(elements.networkDriveConfig, enabled);
            callbacks.emit('networkDriveEnabled', enabled);
        });
    }

    private bindNetworkDriveModal(elements: GeneralSettingsElements): void {
        elements.addNetworkDriveButton?.addEventListener('click', () => {
            if (!appInteractionService.showNetworkDriveModal()) {
                showToast('网络磁盘功能不可用', 'error');
            }
        });
    }

    private bindCheckedSetting(
        element: HTMLInputElement | null,
        settingKey: string,
        callbacks: GeneralSettingsCallbacks,
        eventName?: string
    ): void {
        element?.addEventListener('change', () => {
            const enabled = element.checked;
            callbacks.updateSetting(settingKey, enabled);

            if (eventName) {
                callbacks.emit(eventName, enabled);
            }
        });
    }
}

export const generalSettingsController = new GeneralSettingsController();
