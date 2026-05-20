import {desktopLyricsService} from "@/features/desktopLyrics/service/DesktopLyricsService";
import type {MusicBoxSettings} from "@api/types/settings";

export type DisplaySettingValue = string | number;
export type DisplaySettingsMap = Record<string, DisplaySettingValue>;

export interface DesktopLyricsDisplaySettings extends DisplaySettingsMap {
    displayMode: string;
    layoutMode: string;
    themeColor: string;
    fontColor: string;
    opacity: number;
    fontSize: number;
}

export interface MiniModeDisplaySettings extends DisplaySettingsMap {
    fontColor: string;
    highlightColor: string;
    fontSize: number;
}

class DisplayModeSettingsService {
    getDesktopLyricsSettings(settings: MusicBoxSettings): DesktopLyricsDisplaySettings {
        const desktopLyricsSettings = (settings.desktopLyricsSettings || {}) as DisplaySettingsMap;
        return {
            displayMode: String(desktopLyricsSettings.displayMode || 'default'),
            layoutMode: String(desktopLyricsSettings.layoutMode || 'default'),
            themeColor: String(desktopLyricsSettings.themeColor || '#64b5f6'),
            fontColor: String(desktopLyricsSettings.fontColor || '#000'),
            opacity: typeof desktopLyricsSettings.opacity === 'number' ? desktopLyricsSettings.opacity : 0.9,
            fontSize: typeof desktopLyricsSettings.fontSize === 'number' ? desktopLyricsSettings.fontSize : 48
        };
    }

    updateDesktopLyricsSetting(settings: MusicBoxSettings, key: string, value: DisplaySettingValue): DisplaySettingsMap {
        return {
            ...((settings.desktopLyricsSettings || {}) as DisplaySettingsMap),
            [key]: value
        };
    }

    syncDesktopLyricsSettings(settings: Partial<DesktopLyricsDisplaySettings> | DisplaySettingsMap): Promise<unknown> {
        return desktopLyricsService.updateSettings(settings);
    }

    hideDesktopLyrics(): Promise<unknown> {
        return desktopLyricsService.hide();
    }

    getMiniModeSettings(settings: MusicBoxSettings): MiniModeDisplaySettings {
        const miniModeSettings = (settings.miniModeSettings || {}) as DisplaySettingsMap;
        return {
            fontColor: String(miniModeSettings.fontColor || '#ffffff'),
            highlightColor: String(miniModeSettings.highlightColor || '#335eea'),
            fontSize: typeof miniModeSettings.fontSize === 'number' ? miniModeSettings.fontSize : 14
        };
    }

    updateMiniModeSetting(settings: MusicBoxSettings, key: string, value: DisplaySettingValue): DisplaySettingsMap {
        return {
            ...((settings.miniModeSettings || {}) as DisplaySettingsMap),
            [key]: value
        };
    }

    applyMiniModeSetting(key: string, value: DisplaySettingValue): void {
        switch (key) {
            case 'fontColor':
                document.documentElement.style.setProperty('--mini-mode-font-color', String(value));
                break;
            case 'highlightColor':
                document.documentElement.style.setProperty('--mini-mode-highlight-color', String(value));
                break;
            case 'fontSize':
                document.documentElement.style.setProperty('--mini-mode-font-size', `${value}px`);
                break;
        }
    }
}

export const displayModeSettingsService = new DisplayModeSettingsService();
