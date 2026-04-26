import {libraryGateway, settingsSystemGateway} from "@js/infrastructure/electron";

export interface AutoScanSettingsView {
    enabled: boolean;
    frequency: string;
}

interface MainSettingsPayload {
    musicFolders?: string[];
    autoScanEnabled?: boolean;
    enabled?: boolean;
    scanFrequency?: string;
    frequency?: string;
    [key: string]: unknown;
}

interface SettingsUpdateResult {
    success: boolean;
    settings?: MainSettingsPayload;
    error?: string;
}

export interface MusicFoldersUpdateResult {
    success: boolean;
    folders: string[];
    error?: string;
}

class MusicFolderSettingsService {
    async getMusicFolders(): Promise<string[]> {
        return settingsSystemGateway.settings.getMusicFolders();
    }

    async getAutoScanSettings(): Promise<AutoScanSettingsView> {
        const settings = await settingsSystemGateway.settings.getAutoScanSettings() as MainSettingsPayload;
        return this.normalizeAutoScanSettings(settings);
    }

    async addMusicFolder(folderPath: string): Promise<MusicFoldersUpdateResult> {
        const result = await settingsSystemGateway.settings.addMusicFolder(folderPath) as SettingsUpdateResult;
        return this.normalizeFoldersResult(result);
    }

    async removeMusicFolder(folderPath: string): Promise<MusicFoldersUpdateResult> {
        const result = await settingsSystemGateway.settings.removeMusicFolder(folderPath) as SettingsUpdateResult;
        return this.normalizeFoldersResult(result);
    }

    async updateAutoScanEnabled(enabled: boolean): Promise<SettingsUpdateResult> {
        return settingsSystemGateway.settings.updateAutoScanSettings({
            autoScanEnabled: enabled,
            enabled
        }) as Promise<SettingsUpdateResult>;
    }

    async updateScanFrequency(frequency: string): Promise<SettingsUpdateResult> {
        return settingsSystemGateway.settings.updateAutoScanSettings({
            scanFrequency: frequency,
            frequency
        }) as Promise<SettingsUpdateResult>;
    }

    scanDirectory(folderPath: string): Promise<boolean> {
        return libraryGateway.scanDirectory(folderPath);
    }

    private normalizeAutoScanSettings(settings: MainSettingsPayload | null | undefined): AutoScanSettingsView {
        return {
            enabled: Boolean(settings?.autoScanEnabled ?? settings?.enabled ?? false),
            frequency: String(settings?.scanFrequency ?? settings?.frequency ?? 'on_startup')
        };
    }

    private normalizeFoldersResult(result: SettingsUpdateResult): MusicFoldersUpdateResult {
        return {
            success: result.success,
            folders: result.settings?.musicFolders || [],
            error: result.error
        };
    }
}

export const musicFolderSettingsService = new MusicFolderSettingsService();
