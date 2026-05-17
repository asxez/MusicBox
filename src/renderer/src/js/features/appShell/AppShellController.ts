import type {Result, Unsubscribe} from '@api/types/common';
import type {
    MountedNetworkDrive,
    NetworkDriveConfig,
    NetworkDriveDirectoryResult,
    NetworkDriveStatus
} from '@api/types/electron';
import type {WindowBounds} from '@api/types/window';
import {appShellService} from './service';
import type {
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
} from './service';

class AppShellController {
    initWindowStateManagement(): void {
        appShellService.initWindowStateManagement();
    }

    disposeWindowStateManagement(): void {
        appShellService.disposeWindowStateManagement();
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return appShellService.onWindowMaximizedChanged(handler);
    }

    async minimizeWindow(): Promise<void> {
        await appShellService.minimizeWindow();
    }

    async toggleMaximizeWindow(): Promise<void> {
        await appShellService.toggleMaximizeWindow();
    }

    async closeWindow(): Promise<void> {
        await appShellService.closeWindow();
    }

    async isWindowMaximized(): Promise<boolean> {
        return await appShellService.isWindowMaximized();
    }

    async unmaximizeWindow(): Promise<void> {
        await appShellService.unmaximizeWindow();
    }

    async getWindowBounds(): Promise<WindowBoundsResult | null> {
        return await appShellService.getWindowBounds();
    }

    async setWindowBounds(bounds: WindowBounds): Promise<SetBoundsResult> {
        return await appShellService.setWindowBounds(bounds);
    }

    async setMiniModeWindowState(options: MiniModeWindowStateOptions): Promise<MiniModeWindowStateResult> {
        return await appShellService.setMiniModeWindowState(options);
    }

    async getWindowPosition(): Promise<[number, number]> {
        return await appShellService.getWindowPosition();
    }

    async getWindowSize(): Promise<[number, number]> {
        return await appShellService.getWindowSize();
    }

    async setWindowSize(width: number, height: number): Promise<Result> {
        return await appShellService.setWindowSize(width, height);
    }

    async initSystemTray(): Promise<void> {
        await appShellService.initSystemTray();
    }

    async updateTraySettings(settings: TraySettings): Promise<void> {
        await appShellService.updateTraySettings(settings);
    }

    async getHardwareAccelerationSettings(): Promise<HardwareAccelerationSettingsResult> {
        return await appShellService.getHardwareAccelerationSettings();
    }

    async updateHardwareAccelerationSettings(enabled: boolean): Promise<OperationResult> {
        return await appShellService.updateHardwareAccelerationSettings(enabled);
    }

    async restartApplication(): Promise<void> {
        await appShellService.restartApplication();
    }

    async openUserDataFolder(): Promise<OperationResult> {
        return await appShellService.openUserDataFolder();
    }

    async openDevTools(): Promise<OperationResult> {
        return await appShellService.openDevTools();
    }

    async getVersion(): Promise<string> {
        return await appShellService.getVersion();
    }

    async getPlatform(): Promise<string> {
        return await appShellService.getPlatform();
    }

    async getAppPath(): Promise<string> {
        return await appShellService.getAppPath();
    }

    async getUserDataPath(): Promise<string> {
        return await appShellService.getUserDataPath();
    }

    async getTempPath(): Promise<string> {
        return await appShellService.getTempPath();
    }

    async openPath(path: string): Promise<ShellActionResult> {
        return await appShellService.openPath(path);
    }

    async openExternal(url: string): Promise<ShellActionResult> {
        return await appShellService.openExternal(url);
    }

    async autoCheckForUpdates(): Promise<void> {
        await appShellService.autoCheckForUpdates();
    }

    onShowUpdateDetails(handler: () => void): Unsubscribe {
        return appShellService.onShowUpdateDetails(handler);
    }

    async openReleasePage(): Promise<void> {
        await appShellService.openReleasePage();
    }

    async openDownloadPage(url: string): Promise<Result> {
        return await appShellService.openDownloadPage(url);
    }

    async testNetworkDriveConnection(config: NetworkDriveConfig): Promise<boolean> {
        return await appShellService.testNetworkDriveConnection(config);
    }

    async mountNetworkDrive(config: NetworkDriveConfig): Promise<boolean> {
        return await appShellService.mountNetworkDrive(config);
    }

    async getMountedNetworkDrives(): Promise<MountedNetworkDrive[]> {
        return await appShellService.getMountedNetworkDrives();
    }

    async getNetworkDriveStatus(driveId: string): Promise<NetworkDriveStatus | null> {
        return await appShellService.getNetworkDriveStatus(driveId);
    }

    async getNetworkDriveDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult> {
        return await appShellService.getNetworkDriveDirectoryStructure(driveId, path);
    }

    async refreshNetworkDriveConnection(driveId: string): Promise<boolean> {
        return await appShellService.refreshNetworkDriveConnection(driveId);
    }

    async refreshNetworkDriveConnections(): Promise<boolean> {
        return await appShellService.refreshNetworkDriveConnections();
    }

    async unmountNetworkDrive(driveId: string): Promise<boolean> {
        return await appShellService.unmountNetworkDrive(driveId);
    }

    onNetworkDriveConnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return appShellService.onNetworkDriveConnected(handler);
    }

    onNetworkDriveDisconnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return appShellService.onNetworkDriveDisconnected(handler);
    }

    onNetworkDriveError(handler: (driveId: string, error: string) => void): Unsubscribe {
        return appShellService.onNetworkDriveError(handler);
    }

    async getMusicFolders(): Promise<string[]> {
        return await appShellService.getMusicFolders();
    }

    async getAutoScanSettings(): Promise<MainSettingsPayload> {
        return await appShellService.getAutoScanSettings();
    }

    async getSetting<T = unknown>(key: string): Promise<T | null> {
        return await appShellService.getSetting<T>(key);
    }

    async setSetting<T = unknown>(key: string, value: T): Promise<void> {
        await appShellService.setSetting(key, value);
    }

    async selectFolder(): Promise<FolderSelectionResult> {
        return await appShellService.selectFolder();
    }

    async addMusicFolder(folderPath: string): Promise<SettingsUpdateResult> {
        return await appShellService.addMusicFolder(folderPath);
    }

    async removeMusicFolder(folderPath: string): Promise<SettingsUpdateResult> {
        return await appShellService.removeMusicFolder(folderPath);
    }

    async updateAutoScanSettings(settings: MainSettingsPayload): Promise<SettingsUpdateResult> {
        return await appShellService.updateAutoScanSettings(settings);
    }

    async getDefaultCoverCachePath(): Promise<PathResult> {
        return await appShellService.getDefaultCoverCachePath();
    }

    async ensureDirectoryExists(directoryPath: string): Promise<PathResult> {
        return await appShellService.ensureDirectoryExists(directoryPath);
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
