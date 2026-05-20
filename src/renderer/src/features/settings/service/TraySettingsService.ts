import {trayShellService} from "@/features/appShell/service";

class TraySettingsService {
    updateEnabled(enabled: boolean): Promise<void> {
        return trayShellService.updateSettings({enabled});
    }

    updateCloseBehavior(behavior: string): Promise<void> {
        return trayShellService.updateSettings({
            closeToTray: behavior === 'minimize'
        });
    }

    updateStartMinimized(startMinimized: boolean): Promise<void> {
        return trayShellService.updateSettings({startMinimized});
    }
}

export const traySettingsService = new TraySettingsService();
