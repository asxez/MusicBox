import {settingsShellService} from "@/features/appShell/service";
import {libraryDataService} from "@/features/library/service/LibraryDataService";

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
        return settingsShellService.getMusicFolders();
    }

    async getAutoScanSettings(): Promise<AutoScanSettingsView> {
        const settings = await settingsShellService.getAutoScanSettings() as MainSettingsPayload;
        return this.normalizeAutoScanSettings(settings);
    }

    async selectMusicFolder(): Promise<string | null> {
        const result = await settingsShellService.selectFolder();
        if (!result || !result.filePaths || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    }

    async addMusicFolder(folderPath: string): Promise<MusicFoldersUpdateResult> {
        const result = await settingsShellService.addMusicFolder(folderPath) as SettingsUpdateResult;
        return this.normalizeFoldersResult(result);
    }

    async removeMusicFolder(folderPath: string): Promise<MusicFoldersUpdateResult> {
        const result = await settingsShellService.removeMusicFolder(folderPath) as SettingsUpdateResult;
        return this.normalizeFoldersResult(result);
    }

    async updateAutoScanEnabled(enabled: boolean): Promise<SettingsUpdateResult> {
        return settingsShellService.updateAutoScanSettings({
            autoScanEnabled: enabled,
            enabled
        }) as Promise<SettingsUpdateResult>;
    }

    async updateScanFrequency(frequency: string): Promise<SettingsUpdateResult> {
        return settingsShellService.updateAutoScanSettings({
            scanFrequency: frequency,
            frequency
        }) as Promise<SettingsUpdateResult>;
    }

    scanDirectory(folderPath: string): Promise<boolean> {
        return libraryDataService.scanDirectory(folderPath);
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
