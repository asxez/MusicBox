import {trayAPI, updateAPI, windowAPI} from '@api/modules';
import {networkDriveGateway, settingsSystemGateway, windowGateway} from '@js/infrastructure/electron';
import {systemGateway} from '@js/infrastructure/electron/SystemGateway';
import type {Result, Unsubscribe} from '@api/types/common';
import type {
    MountedNetworkDrive,
    NetworkDriveConfig,
    NetworkDriveDirectoryResult,
    NetworkDriveStatus
} from '@api/types/electron';
import type {WindowBounds} from '@api/types/window';

type WindowBoundsResult = {
    height: number;
    width: number;
    x: number;
    y: number;
};

type SetBoundsResult = {
    success: boolean;
    bounds?: WindowBoundsResult;
    error?: string;
};

type MiniModeWindowStateOptions = {
    enabled: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

type MiniModeWindowStateResult = {
    success: boolean;
    data?: {
        size?: number[];
        minimumSize?: number[];
        maximumSize?: number[];
    };
    error?: string;
};

type FolderSelectionResult = {
    filePaths: string[];
    canceled: boolean;
};

type TraySettings = {
    enabled?: boolean;
    closeToTray?: boolean;
    startMinimized?: boolean;
};

type MainSettingsPayload = {
    musicFolders?: string[];
    autoScanEnabled?: boolean;
    enabled?: boolean;
    scanFrequency?: string;
    frequency?: string;
    [key: string]: unknown;
};

type SettingsUpdateResult = {
    success: boolean;
    settings?: MainSettingsPayload;
    error?: string;
};

type PathResult = {
    success?: boolean;
    path?: string;
    error?: string;
};

type OperationResult = {
    success?: boolean;
    error?: string;
};

type ShellActionResult = {
    success: boolean;
    error?: string;
};

type HardwareAccelerationSettingsResult = {
    success?: boolean;
    settings?: {
        enabled?: boolean;
    };
    error?: string;
};

class AppShellController {
    initWindowStateManagement(): void {
        windowAPI.initWindowStateManagement();
    }

    disposeWindowStateManagement(): void {
        windowAPI.disposeWindowStateManagement();
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return windowAPI.onMaximizedChanged(handler);
    }

    async minimizeWindow(): Promise<void> {
        await windowAPI.minimize();
    }

    async toggleMaximizeWindow(): Promise<void> {
        await windowAPI.maximize();
    }

    async closeWindow(): Promise<void> {
        await windowAPI.close();
    }

    async isWindowMaximized(): Promise<boolean> {
        return await windowAPI.isMaximized();
    }

    async unmaximizeWindow(): Promise<void> {
        await windowAPI.unmaximize();
    }

    async getWindowBounds(): Promise<WindowBoundsResult | null> {
        return await windowAPI.getBounds();
    }

    async setWindowBounds(bounds: WindowBounds): Promise<SetBoundsResult> {
        return await windowAPI.setBounds(bounds);
    }

    async setMiniModeWindowState(options: MiniModeWindowStateOptions): Promise<MiniModeWindowStateResult> {
        return await windowAPI.setMiniModeWindowState(options);
    }

    async getWindowPosition(): Promise<[number, number]> {
        return await windowGateway.getPosition();
    }

    async getWindowSize(): Promise<[number, number]> {
        return await windowGateway.getSize();
    }

    async setWindowSize(width: number, height: number): Promise<Result> {
        return await windowGateway.setSize(width, height);
    }

    async initSystemTray(): Promise<void> {
        await trayAPI.initSystemTray();
    }

    async updateTraySettings(settings: TraySettings): Promise<void> {
        await settingsSystemGateway.tray.updateSettings(settings);
    }

    async getHardwareAccelerationSettings(): Promise<HardwareAccelerationSettingsResult> {
        return await settingsSystemGateway.hardwareAcceleration.getSettings() as HardwareAccelerationSettingsResult;
    }

    async updateHardwareAccelerationSettings(enabled: boolean): Promise<OperationResult> {
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

    async getVersion(): Promise<string> {
        return await systemGateway.getVersion();
    }

    async getPlatform(): Promise<string> {
        return await systemGateway.getPlatform();
    }

    async getAppPath(): Promise<string> {
        return await systemGateway.getAppPath();
    }

    async getUserDataPath(): Promise<string> {
        return await systemGateway.getUserDataPath();
    }

    async getTempPath(): Promise<string> {
        return await systemGateway.getTempPath();
    }

    async openPath(path: string): Promise<ShellActionResult> {
        return await systemGateway.openPath(path);
    }

    async openExternal(url: string): Promise<ShellActionResult> {
        return await systemGateway.openExternal(url);
    }

    async autoCheckForUpdates(): Promise<void> {
        await updateAPI.autoCheckForUpdates();
    }

    onShowUpdateDetails(handler: () => void): Unsubscribe {
        return updateAPI.onShowUpdateDetails(handler);
    }

    async openReleasePage(): Promise<void> {
        await updateAPI.openReleasePage();
    }

    async openDownloadPage(url: string): Promise<Result> {
        return await updateAPI.openDownloadPage(url);
    }

    async testNetworkDriveConnection(config: NetworkDriveConfig): Promise<boolean> {
        return await networkDriveGateway.testConnection(config);
    }

    async mountNetworkDrive(config: NetworkDriveConfig): Promise<boolean> {
        if (config.type === 'smb') {
            return await networkDriveGateway.mountSMB(config);
        }

        if (config.type === 'webdav') {
            return await networkDriveGateway.mountWebDAV(config);
        }

        return false;
    }

    async getMountedNetworkDrives(): Promise<MountedNetworkDrive[]> {
        return await networkDriveGateway.getMountedDrives();
    }

    async getNetworkDriveStatus(driveId: string): Promise<NetworkDriveStatus | null> {
        return await networkDriveGateway.getStatus(driveId);
    }

    async getNetworkDriveDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult> {
        return await networkDriveGateway.getDirectoryStructure(driveId, path);
    }

    async refreshNetworkDriveConnection(driveId: string): Promise<boolean> {
        return await networkDriveGateway.refreshConnection(driveId);
    }

    async refreshNetworkDriveConnections(): Promise<boolean> {
        return await networkDriveGateway.refreshConnections();
    }

    async unmountNetworkDrive(driveId: string): Promise<boolean> {
        return await networkDriveGateway.unmount(driveId);
    }

    onNetworkDriveConnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onConnected(handler);
    }

    onNetworkDriveDisconnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onDisconnected(handler);
    }

    onNetworkDriveError(handler: (driveId: string, error: string) => void): Unsubscribe {
        return networkDriveGateway.onError(handler);
    }

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

export const appShellController = new AppShellController();
export {AppShellController};
export type {
    FolderSelectionResult,
    HardwareAccelerationSettingsResult,
    MainSettingsPayload,
    MiniModeWindowStateOptions,
    MiniModeWindowStateResult,
    OperationResult,
    PathResult,
    SetBoundsResult,
    SettingsUpdateResult,
    ShellActionResult,
    TraySettings,
    WindowBoundsResult
};
