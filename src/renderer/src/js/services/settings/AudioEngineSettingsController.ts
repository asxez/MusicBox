import {showToast} from "@utils/index.js";
import type {MusicBoxSettings, WasapiShareMode} from "@api/types/settings";
import {audioEngineSettingsService} from "@services/settings/AudioEngineSettingsService";

interface ExclusiveModeChangeResult {
    checked: boolean;
}

class AudioEngineSettingsController {
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
}

export const audioEngineSettingsController = new AudioEngineSettingsController();
