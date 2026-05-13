class SettingsPanelVisibilityService {
    toggleTraySettings(
        trayCloseBehaviorItem: HTMLElement | null | undefined,
        trayStartMinimizedItem: HTMLElement | null | undefined,
        enabled: boolean
    ): void {
        this.setDisplay(trayCloseBehaviorItem, enabled, 'flex');
        this.setDisplay(trayStartMinimizedItem, enabled, 'flex');
    }

    toggleWasapiModeSelector(wasapiShareModeItem: HTMLElement | null | undefined, enabled: boolean): void {
        this.setDisplay(wasapiShareModeItem, enabled, 'flex');
    }

    showWasapiUnavailable(
        exclusiveModeItem: HTMLElement | null | undefined,
        wasapiShareModeItem: HTMLElement | null | undefined
    ): void {
        this.setDisplay(exclusiveModeItem, false);
        this.setDisplay(wasapiShareModeItem, false);
    }

    showWasapiAvailable(exclusiveModeItem: HTMLElement | null | undefined): void {
        this.setDisplay(exclusiveModeItem, true, 'flex');
    }

    toggleNetworkDriveConfig(networkDriveConfig: HTMLElement | null | undefined, enabled: boolean): void {
        this.setDisplay(networkDriveConfig, enabled, 'block');
    }

    toggleScanFrequency(scanFrequencyContainer: HTMLElement | null | undefined, visible: boolean): void {
        this.setDisplay(scanFrequencyContainer, visible, 'flex');
    }

    private setDisplay(element: HTMLElement | null | undefined, visible: boolean, display = 'none'): void {
        if (!element) {
            return;
        }

        element.style.display = visible ? display : 'none';
    }
}

export const settingsPanelVisibilityService = new SettingsPanelVisibilityService();
