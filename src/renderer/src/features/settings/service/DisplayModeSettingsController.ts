import type {MusicBoxSettings} from "@api/types/settings";
import {
    displayModeSettingsService,
    type DesktopLyricsDisplaySettings,
    type DisplaySettingValue,
    type DisplaySettingsMap,
    type MiniModeDisplaySettings
} from "./DisplayModeSettingsService";

class DisplayModeSettingsController {
    private desktopLyricsSyncTimer: ReturnType<typeof setTimeout> | null = null;

    getDesktopLyricsSettings(settings: MusicBoxSettings): DesktopLyricsDisplaySettings {
        return displayModeSettingsService.getDesktopLyricsSettings(settings);
    }

    updateDesktopLyricsSetting(settings: MusicBoxSettings, key: string, value: DisplaySettingValue): DisplaySettingsMap {
        const desktopLyricsSettings = displayModeSettingsService.updateDesktopLyricsSetting(settings, key, value);
        this.syncDesktopLyricsSettings({[key]: value});
        return desktopLyricsSettings;
    }

    scheduleDesktopLyricsSync(settings: DesktopLyricsDisplaySettings): void {
        this.clearDesktopLyricsSyncTimer();
        this.desktopLyricsSyncTimer = setTimeout(() => {
            this.desktopLyricsSyncTimer = null;
            this.syncDesktopLyricsSettings(settings);
        }, 100);
    }

    dispose(): void {
        this.clearDesktopLyricsSyncTimer();
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

    private clearDesktopLyricsSyncTimer(): void {
        if (!this.desktopLyricsSyncTimer) {
            return;
        }

        clearTimeout(this.desktopLyricsSyncTimer);
        this.desktopLyricsSyncTimer = null;
    }
}

export const displayModeSettingsController = new DisplayModeSettingsController();
