import type {MusicBoxSettings} from "@api/types/settings";

interface RgbColor {
    r: number;
    g: number;
    b: number;
}

export interface LyricsAppearanceSettings {
    highlightOpacity: number;
    highlightColor: string;
}

class LyricsAppearanceSettingsService {
    getSettings(settings: MusicBoxSettings): LyricsAppearanceSettings {
        return {
            highlightOpacity: typeof settings.lyricsHighlightOpacity === 'number'
                ? settings.lyricsHighlightOpacity
                : 1.0,
            highlightColor: typeof settings.lyricsHighlightColor === 'string'
                ? settings.lyricsHighlightColor
                : '#335eea'
        };
    }

    applyHighlightOpacity(opacity: number): void {
        document.documentElement.style.setProperty('--lyrics-highlight-opacity', String(opacity));
    }

    applyHighlightColor(color: string): void {
        const rgb = this.hexToRgb(color);
        if (!rgb) {
            return;
        }

        document.documentElement.style.setProperty('--lyrics-highlight-color', color);
        document.documentElement.style.setProperty('--lyrics-highlight-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }

    private hexToRgb(hex: string): RgbColor | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

export const lyricsAppearanceSettingsService = new LyricsAppearanceSettingsService();
