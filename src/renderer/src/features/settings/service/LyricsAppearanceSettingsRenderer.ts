import type {LyricsAppearanceSettings} from "./LyricsAppearanceSettingsService";

export interface LyricsAppearanceSettingsElements {
    highlightOpacitySlider: HTMLInputElement | null;
    highlightOpacityValue: HTMLElement | null;
    highlightColorInput: HTMLInputElement | null;
    highlightColorValue: HTMLElement | null;
}

class LyricsAppearanceSettingsRenderer {
    initialize(elements: LyricsAppearanceSettingsElements, settings: LyricsAppearanceSettings): void {
        this.updateOpacity(elements, settings.highlightOpacity);
        this.updateColor(elements, settings.highlightColor);
    }

    updateOpacity(elements: LyricsAppearanceSettingsElements, opacity: number): void {
        if (elements.highlightOpacitySlider) {
            elements.highlightOpacitySlider.value = String(opacity);
        }

        if (elements.highlightOpacityValue) {
            elements.highlightOpacityValue.textContent = opacity.toFixed(1);
        }
    }

    updateColor(elements: LyricsAppearanceSettingsElements, color: string): void {
        if (elements.highlightColorInput) {
            elements.highlightColorInput.value = color;
        }

        if (elements.highlightColorValue) {
            elements.highlightColorValue.textContent = color;
        }
    }
}

export const lyricsAppearanceSettingsRenderer = new LyricsAppearanceSettingsRenderer();
