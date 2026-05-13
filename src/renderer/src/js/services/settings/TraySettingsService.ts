import {trayGateway} from "@js/infrastructure/electron";

class TraySettingsService {
    updateEnabled(enabled: boolean): Promise<void> {
        return trayGateway.updateSettings({enabled});
    }

    updateCloseBehavior(behavior: string): Promise<void> {
        return trayGateway.updateSettings({
            closeToTray: behavior === 'minimize'
        });
    }

    updateStartMinimized(startMinimized: boolean): Promise<void> {
        return trayGateway.updateSettings({startMinimized});
    }
}

export const traySettingsService = new TraySettingsService();
