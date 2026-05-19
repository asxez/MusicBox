import {settingsSystemGateway} from '@js/infrastructure/electron';

export type OperationResult = {
    success?: boolean;
    error?: string;
};

export type HardwareAccelerationSettingsResult = {
    success?: boolean;
    settings?: {
        enabled?: boolean;
    };
    error?: string;
};

export class HardwareAccelerationShellService {
    async getSettings(): Promise<HardwareAccelerationSettingsResult> {
        return await settingsSystemGateway.hardwareAcceleration.getSettings() as HardwareAccelerationSettingsResult;
    }

    async updateSettings(enabled: boolean): Promise<OperationResult> {
        return await settingsSystemGateway.hardwareAcceleration.updateSettings({enabled}) as OperationResult;
    }

    async restartApplication(): Promise<void> {
        await settingsSystemGateway.app.restart();
    }

    async openUserDataFolder(): Promise<OperationResult> {
        return await settingsSystemGateway.openUserDataFolder() as OperationResult;
    }

    async openDevTools(): Promise<OperationResult> {
        return await settingsSystemGateway.openDevTools() as OperationResult;
    }
}

export const hardwareAccelerationShellService = new HardwareAccelerationShellService();
