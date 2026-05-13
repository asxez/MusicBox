import {settingsSystemGateway} from "@js/infrastructure/electron";

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
        const result = await settingsSystemGateway.hardwareAcceleration.getSettings() as HardwareAccelerationSettingsResult;
        if (!result.success) {
            return true;
        }

        return result.settings?.enabled !== false;
    }

    updateEnabled(enabled: boolean): Promise<OperationResult> {
        return settingsSystemGateway.hardwareAcceleration.updateSettings({enabled}) as Promise<OperationResult>;
    }

    restartApplication(): Promise<void> {
        return settingsSystemGateway.app.restart();
    }

    openUserDataFolder(): Promise<OperationResult> {
        return settingsSystemGateway.openUserDataFolder() as Promise<OperationResult>;
    }

    openDevTools(): Promise<OperationResult> {
        return settingsSystemGateway.openDevTools() as Promise<OperationResult>;
    }
}

export const hardwareAccelerationSettingsService = new HardwareAccelerationSettingsService();
