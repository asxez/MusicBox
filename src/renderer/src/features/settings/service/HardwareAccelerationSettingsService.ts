import {hardwareAccelerationShellService} from "@/features/appShell/service";

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
        const result = await hardwareAccelerationShellService.getSettings() as HardwareAccelerationSettingsResult;
        if (!result.success) {
            return true;
        }

        return result.settings?.enabled !== false;
    }

    updateEnabled(enabled: boolean): Promise<OperationResult> {
        return hardwareAccelerationShellService.updateSettings(enabled) as Promise<OperationResult>;
    }

    restartApplication(): Promise<void> {
        return hardwareAccelerationShellService.restartApplication();
    }

    openUserDataFolder(): Promise<OperationResult> {
        return hardwareAccelerationShellService.openUserDataFolder() as Promise<OperationResult>;
    }

    openDevTools(): Promise<OperationResult> {
        return hardwareAccelerationShellService.openDevTools() as Promise<OperationResult>;
    }
}

export const hardwareAccelerationSettingsService = new HardwareAccelerationSettingsService();
