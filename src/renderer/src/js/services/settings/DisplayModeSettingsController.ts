import type {MusicBoxSettings} from "@api/types/settings";
import {
    displayModeSettingsService,
    type DesktopLyricsDisplaySettings,
    type DisplaySettingValue,
    type DisplaySettingsMap,
    type MiniModeDisplaySettings
} from "@services/settings/DisplayModeSettingsService";

class DisplayModeSettingsController {
    getDesktopLyricsSettings(settings: MusicBoxSettings): DesktopLyricsDisplaySettings {
        return displayModeSettingsService.getDesktopLyricsSettings(settings);
    }

    updateDesktopLyricsSetting(settings: MusicBoxSettings, key: string, value: DisplaySettingValue): DisplaySettingsMap {
        const desktopLyricsSettings = displayModeSettingsService.updateDesktopLyricsSetting(settings, key, value);
        this.syncDesktopLyricsSettings({[key]: value});
        return desktopLyricsSettings;
    }

    scheduleDesktopLyricsSync(settings: DesktopLyricsDisplaySettings): void {
        setTimeout(() => {
            this.syncDesktopLyricsSettings(settings);
        }, 100);
    }

    async hideDesktopLyrics(): Promise<void> {
        try {
            await displayModeSettingsService.hideDesktopLyrics();
        } catch (error) {
            console.error('❌ Settings: 隐藏桌面歌词失败:', error);
        }
    }

    getMiniModeSettings(settings: MusicBoxSettings): MiniModeDisplaySettings {
        return displayModeSettingsService.getMiniModeSettings(settings);
    }

    updateMiniModeSetting(settings: MusicBoxSettings, key: string, value: DisplaySettingValue): DisplaySettingsMap {
        const miniModeSettings = displayModeSettingsService.updateMiniModeSetting(settings, key, value);
        this.applyMiniModeSetting(key, value);
        return miniModeSettings;
    }

    applyMiniModeSetting(key: string, value: DisplaySettingValue): void {
        displayModeSettingsService.applyMiniModeSetting(key, value);
    }

    private async syncDesktopLyricsSettings(settings: Partial<DesktopLyricsDisplaySettings> | DisplaySettingsMap): Promise<void> {
        try {
            await displayModeSettingsService.syncDesktopLyricsSettings(settings);
        } catch (error) {
            console.error('❌ Settings: 更新桌面歌词设置失败:', error);
        }
    }
}

export const displayModeSettingsController = new DisplayModeSettingsController();
