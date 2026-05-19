import {settingsSystemGateway} from '@js/infrastructure/electron';

export type FolderSelectionResult = {
    filePaths: string[];
    canceled: boolean;
};

export type MainSettingsPayload = {
    musicFolders?: string[];
    autoScanEnabled?: boolean;
    enabled?: boolean;
    scanFrequency?: string;
    frequency?: string;
    [key: string]: unknown;
};

export type SettingsUpdateResult = {
    success: boolean;
    settings?: MainSettingsPayload;
    error?: string;
};

export type PathResult = {
    success?: boolean;
    path?: string;
    error?: string;
};

export class SettingsShellService {
    async getMusicFolders(): Promise<string[]> {
        return await settingsSystemGateway.settings.getMusicFolders();
    }

    async getAutoScanSettings(): Promise<MainSettingsPayload> {
        return await settingsSystemGateway.settings.getAutoScanSettings() as MainSettingsPayload;
    }

    async getSetting<T = unknown>(key: string): Promise<T | null> {
        return await settingsSystemGateway.settings.get<T>(key);
    }

    async setSetting<T = unknown>(key: string, value: T): Promise<void> {
        await settingsSystemGateway.settings.set(key, value);
    }

    async selectFolder(): Promise<FolderSelectionResult> {
        return await settingsSystemGateway.selectFolder();
    }

    async addMusicFolder(folderPath: string): Promise<SettingsUpdateResult> {
        return await settingsSystemGateway.settings.addMusicFolder(folderPath) as SettingsUpdateResult;
    }

    async removeMusicFolder(folderPath: string): Promise<SettingsUpdateResult> {
        return await settingsSystemGateway.settings.removeMusicFolder(folderPath) as SettingsUpdateResult;
    }

    async updateAutoScanSettings(settings: MainSettingsPayload): Promise<SettingsUpdateResult> {
        return await settingsSystemGateway.settings.updateAutoScanSettings(settings) as SettingsUpdateResult;
    }

    async getDefaultCoverCachePath(): Promise<PathResult> {
        return await settingsSystemGateway.getDefaultCoverCachePath() as PathResult;
    }

    async ensureDirectoryExists(directoryPath: string): Promise<PathResult> {
        return await settingsSystemGateway.ensureDirectoryExists(directoryPath) as PathResult;
    }
}

export const settingsShellService = new SettingsShellService();
