import type {
    DesktopLyricsDisplaySettings,
    DisplaySettingValue,
    MiniModeDisplaySettings
} from "@services/settings/DisplayModeSettingsService";

export interface DesktopLyricsSettingsElements {
    displayModeSelect: HTMLSelectElement | null;
    layoutModeSelect: HTMLSelectElement | null;
    themeColorInput: HTMLInputElement | null;
    themeColorValue: HTMLElement | null;
    opacitySlider: HTMLInputElement | null;
    opacityValue: HTMLElement | null;
    fontSizeSlider: HTMLInputElement | null;
    fontSizeValue: HTMLElement | null;
    fontColorInput: HTMLInputElement | null;
    fontColorValue: HTMLElement | null;
}

export interface MiniModeSettingsElements {
    fontColorInput: HTMLInputElement | null;
    fontColorValue: HTMLElement | null;
    highlightColorInput: HTMLInputElement | null;
    highlightColorValue: HTMLElement | null;
    fontSizeSlider: HTMLInputElement | null;
    fontSizeValue: HTMLElement | null;
}

class DisplayModeSettingsRenderer {
    initializeDesktopLyricsSettings(elements: DesktopLyricsSettingsElements, settings: DesktopLyricsDisplaySettings): void {
        this.setSelectValue(elements.displayModeSelect, settings.displayMode);
        this.setSelectValue(elements.layoutModeSelect, settings.layoutMode);
        this.updateDesktopLyricsValue(elements, 'themeColor', settings.themeColor);
        this.updateDesktopLyricsValue(elements, 'opacity', settings.opacity);
        this.updateDesktopLyricsValue(elements, 'fontSize', settings.fontSize);
        this.updateDesktopLyricsValue(elements, 'fontColor', settings.fontColor);
    }

    updateDesktopLyricsValue(elements: DesktopLyricsSettingsElements, key: string, value: DisplaySettingValue): void {
        switch (key) {
            case 'themeColor':
                this.setInputValue(elements.themeColorInput, String(value));
                this.setText(elements.themeColorValue, String(value));
                break;
            case 'opacity':
                this.setInputValue(elements.opacitySlider, String(value));
                this.setText(elements.opacityValue, `${Math.round(Number(value) * 100)}%`);
                break;
            case 'fontSize':
                this.setInputValue(elements.fontSizeSlider, String(value));
                this.setText(elements.fontSizeValue, `${value}px`);
                break;
            case 'fontColor':
                this.setInputValue(elements.fontColorInput, String(value));
                this.setText(elements.fontColorValue, String(value));
                break;
        }
    }

    initializeMiniModeSettings(elements: MiniModeSettingsElements, settings: MiniModeDisplaySettings): void {
        this.updateMiniModeValue(elements, 'fontColor', settings.fontColor);
        this.updateMiniModeValue(elements, 'highlightColor', settings.highlightColor);
        this.updateMiniModeValue(elements, 'fontSize', settings.fontSize);
    }

    updateMiniModeValue(elements: MiniModeSettingsElements, key: string, value: DisplaySettingValue): void {
        switch (key) {
            case 'fontColor':
                this.setInputValue(elements.fontColorInput, String(value));
                this.setText(elements.fontColorValue, String(value));
                break;
            case 'highlightColor':
                this.setInputValue(elements.highlightColorInput, String(value));
                this.setText(elements.highlightColorValue, String(value));
                break;
            case 'fontSize':
                this.setInputValue(elements.fontSizeSlider, String(value));
                this.setText(elements.fontSizeValue, `${value}px`);
                break;
        }
    }

    private setSelectValue(element: HTMLSelectElement | null, value: string): void {
        if (element) {
            element.value = value;
        }
    }

    private setInputValue(element: HTMLInputElement | null, value: string): void {
        if (element) {
            element.value = value;
        }
    }

    private setText(element: HTMLElement | null, value: string): void {
        if (element) {
            element.textContent = value;
        }
    }
}

export const displayModeSettingsRenderer = new DisplayModeSettingsRenderer();
