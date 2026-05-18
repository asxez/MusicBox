import {appShellController} from "@js/features/appShell";

interface HardwareAccelerationSettingsResult {
    success?: boolean;
    settings?: {
        enabled?: boolean;
    };
    error?: string;
}

interface OperationResult {
    success?: boolean;
    error?: string;
}

class HardwareAccelerationSettingsService {
    async getEnabled(): Promise<boolean> {
        const result = await appShellController.getHardwareAccelerationSettings() as HardwareAccelerationSettingsResult;
        if (!result.success) {
            return true;
        }

        return result.settings?.enabled !== false;
    }

    updateEnabled(enabled: boolean): Promise<OperationResult> {
        return appShellController.updateHardwareAccelerationSettings(enabled) as Promise<OperationResult>;
    }

    restartApplication(): Promise<void> {
        return appShellController.restartApplication();
    }

    openUserDataFolder(): Promise<OperationResult> {
        return appShellController.openUserDataFolder() as Promise<OperationResult>;
    }

    openDevTools(): Promise<OperationResult> {
        return appShellController.openDevTools() as Promise<OperationResult>;
    }
}

export const hardwareAccelerationSettingsService = new HardwareAccelerationSettingsService();
