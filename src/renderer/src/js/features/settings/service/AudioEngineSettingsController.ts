import {showToast} from "@utils/index.js";
import type {MusicBoxSettings, WasapiShareMode} from "@api/types/settings";
import {audioEngineSettingsService} from "./AudioEngineSettingsService";
import {settingsPanelVisibilityService} from "./SettingsPanelVisibilityService";
import type {SettingValue} from "./SettingsStore";
import type {SettingsListenerScope} from "./SettingsListenerScope";

interface ExclusiveModeChangeResult {
    checked: boolean;
}

export interface AudioEngineSettingsElements {
    exclusiveModeToggle: HTMLInputElement | null;
    exclusiveModeItem: HTMLElement | null;
    wasapiShareModeSelect: HTMLSelectElement | null;
    wasapiShareModeItem: HTMLElement | null;
}

interface AudioEngineSettingsCallbacks {
    updateSetting: (key: string, value: SettingValue) => void;
}

class AudioEngineSettingsController {
    initialize(elements: AudioEngineSettingsElements, callbacks: AudioEngineSettingsCallbacks, scope: SettingsListenerScope): void {
        scope.listen(elements.exclusiveModeToggle, 'change', async () => {
            const enabled = Boolean(elements.exclusiveModeToggle?.checked);
            callbacks.updateSetting('exclusiveMode', enabled);
            this.toggleWasapiModeSelector(elements, enabled);

            const result = await this.switchExclusiveMode(enabled);
            if (elements.exclusiveModeToggle) {
                elements.exclusiveModeToggle.checked = result.checked;
            }
            callbacks.updateSetting('exclusiveMode', result.checked);
            this.toggleWasapiModeSelector(elements, result.checked);
        });

        scope.listen(elements.wasapiShareModeSelect, 'change', async () => {
            const mode = this.getSelectedShareMode(elements);
            callbacks.updateSetting('wasapiShareMode', mode);
            await this.switchWasapiShareMode(mode);
        });
    }

    initializeExclusiveModeSettings(settings: MusicBoxSettings, elements: AudioEngineSettingsElements): void {
        const exclusiveModeSettings = this.getExclusiveModeSettings(settings);

        if (!exclusiveModeSettings.available) {
            settingsPanelVisibilityService.showWasapiUnavailable(elements.exclusiveModeItem, elements.wasapiShareModeItem);
            console.log('ℹ️ Settings: 非Windows平台，WASAPI引擎不可用');
            return;
        }

        settingsPanelVisibilityService.showWasapiAvailable(elements.exclusiveModeItem);

        if (elements.exclusiveModeToggle) {
            elements.exclusiveModeToggle.checked = exclusiveModeSettings.enabled;
        }

        if (elements.wasapiShareModeSelect) {
            elements.wasapiShareModeSelect.value = exclusiveModeSettings.shareMode;
        }

        this.toggleWasapiModeSelector(elements, exclusiveModeSettings.enabled);
        console.log(`🎵 Settings: WASAPI引擎初始化完成，状态: ${exclusiveModeSettings.enabled ? '启用' : '禁用'}，模式: ${exclusiveModeSettings.shareMode}`);
    }

    getExclusiveModeSettings(settings: MusicBoxSettings) {
        return audioEngineSettingsService.getExclusiveModeSettings(settings);
    }

    async switchExclusiveMode(enabled: boolean): Promise<ExclusiveModeChangeResult> {
        console.log(`🎵 Settings: WASAPI引擎${enabled ? '启用' : '禁用'}`);

        const result = await audioEngineSettingsService.switchExclusiveMode(enabled);
        if (result.success) {
            showToast(result.message || '音频引擎已切换', 'info');
            return {checked: enabled};
        }

        console.error('❌ Settings: 音频引擎切换失败:', result.error);
        showToast(result.error || '音频引擎切换失败', 'error');
        return {checked: !enabled};
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<void> {
        console.log(`🎵 Settings: WASAPI模式切换到${mode === 'exclusive' ? '独占' : '共享'}模式`);

        const result = await audioEngineSettingsService.switchWasapiShareMode(mode);
        if (result.success) {
            showToast(result.message || 'WASAPI模式已切换', 'info');
            return;
        }

        console.error('❌ Settings: WASAPI模式切换失败:', result.error);
        showToast(result.error || 'WASAPI模式切换失败', 'error');
    }

    private toggleWasapiModeSelector(elements: AudioEngineSettingsElements, enabled: boolean): void {
        settingsPanelVisibilityService.toggleWasapiModeSelector(elements.wasapiShareModeItem, enabled);
    }

    private getSelectedShareMode(elements: AudioEngineSettingsElements): WasapiShareMode {
        return elements.wasapiShareModeSelect?.value === 'shared' ? 'shared' : 'exclusive';
    }
}

export const audioEngineSettingsController = new AudioEngineSettingsController();
