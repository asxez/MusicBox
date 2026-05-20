import {getElectronAPI} from './ElectronBridge';

class SettingsSystemGateway {
    readonly tray = {
        updateSettings: (settings: unknown): Promise<void> => getElectronAPI().tray.updateSettings(settings)
    };

    readonly hardwareAcceleration = {
        getSettings: (): Promise<unknown> => getElectronAPI().hardwareAcceleration.getSettings(),
        updateSettings: (settings: unknown): Promise<unknown> => getElectronAPI().hardwareAcceleration.updateSettings(settings)
    };

    readonly app = {
        restart: (): Promise<void> => getElectronAPI().app.restart()
    };

    readonly settings = {
        get: <T = unknown>(key: string): Promise<T | null> => getElectronAPI().settings.get<T>(key),
        set: <T = unknown>(key: string, value: T): Promise<void> => getElectronAPI().settings.set(key, value),
        getMusicFolders: (): Promise<string[]> => getElectronAPI().settings.getMusicFolders(),
        getAutoScanSettings: (): Promise<unknown> => getElectronAPI().settings.getAutoScanSettings(),
        addMusicFolder: (folderPath: string): Promise<unknown> => getElectronAPI().settings.addMusicFolder(folderPath),
        removeMusicFolder: (folderPath: string): Promise<unknown> => getElectronAPI().settings.removeMusicFolder(folderPath),
        updateAutoScanSettings: (settings: unknown): Promise<unknown> => getElectronAPI().settings.updateAutoScanSettings(settings)
    };

    readonly library = {
        scanDirectory: (folderPath: string): Promise<boolean> => getElectronAPI().library.scanDirectory(folderPath),
        clearIgnoreList: (): Promise<unknown> => getElectronAPI().library.clearIgnoreList()
    };

    selectFolder(): Promise<{filePaths: string[]; canceled: boolean}> {
        return getElectronAPI().selectFolder();
    }

    openFiles(): Promise<string[]> {
        return getElectronAPI().openFiles();
    }

    getDefaultCoverCachePath(): Promise<unknown> {
        return getElectronAPI().getDefaultCoverCachePath();
    }

    ensureDirectoryExists(directoryPath: string): Promise<unknown> {
        return getElectronAPI().ensureDirectoryExists(directoryPath);
    }

    openUserDataFolder(): Promise<unknown> {
        return getElectronAPI().openUserDataFolder();
    }

    openDevTools(): Promise<unknown> {
        return getElectronAPI().openDevTools();
    }
}

export const settingsSystemGateway = new SettingsSystemGateway();
