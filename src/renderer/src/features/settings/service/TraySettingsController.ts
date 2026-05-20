import {settingsPanelVisibilityService} from "./SettingsPanelVisibilityService";
import type {SettingValue} from "./SettingsStore";
import {traySettingsService} from "./TraySettingsService";
import type {SettingsListenerScope} from "./SettingsListenerScope";

export interface TraySettingsElements {
    systemTrayToggle: HTMLInputElement | null;
    trayCloseBehaviorSelect: HTMLSelectElement | null;
    trayStartMinimizedToggle: HTMLInputElement | null;
    trayCloseBehaviorItem: HTMLElement | null;
    trayStartMinimizedItem: HTMLElement | null;
}

interface TraySettingsCallbacks {
    updateSetting: (key: string, value: SettingValue) => void;
}

class TraySettingsController {
    initialize(elements: TraySettingsElements, callbacks: TraySettingsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.systemTrayToggle, 'change', async () => {
            const enabled = Boolean(elements.systemTrayToggle?.checked);
            callbacks.updateSetting('systemTray', enabled);
            this.toggleSettings(elements, enabled);
            await traySettingsService.updateEnabled(enabled);
        });

        scope.listen(elements.trayCloseBehaviorSelect, 'change', async () => {
            const behavior = elements.trayCloseBehaviorSelect?.value || 'exit';
            callbacks.updateSetting('trayCloseBehavior', behavior);
            await traySettingsService.updateCloseBehavior(behavior);
        });

        scope.listen(elements.trayStartMinimizedToggle, 'change', async () => {
            const startMinimized = Boolean(elements.trayStartMinimizedToggle?.checked);
            callbacks.updateSetting('trayStartMinimized', startMinimized);
            await traySettingsService.updateStartMinimized(startMinimized);
        });
    }

    toggleSettings(elements: TraySettingsElements, enabled: boolean): void {
        settingsPanelVisibilityService.toggleTraySettings(
            elements.trayCloseBehaviorItem,
            elements.trayStartMinimizedItem,
            enabled
        );
    }
}

export const traySettingsController = new TraySettingsController();
