import {appShellController} from "@js/features/appShell";

class TraySettingsService {
    updateEnabled(enabled: boolean): Promise<void> {
        return appShellController.updateTraySettings({enabled});
    }

    updateCloseBehavior(behavior: string): Promise<void> {
        return appShellController.updateTraySettings({
            closeToTray: behavior === 'minimize'
        });
    }

    updateStartMinimized(startMinimized: boolean): Promise<void> {
        return appShellController.updateTraySettings({startMinimized});
    }
}

export const traySettingsService = new TraySettingsService();
