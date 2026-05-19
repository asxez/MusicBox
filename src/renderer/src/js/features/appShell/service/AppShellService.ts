import {networkDriveDetailService, networkDriveManagementService} from '@js/features/networkDrive/service';
import {hardwareAccelerationShellService} from './HardwareAccelerationShellService';
import {settingsShellService} from './SettingsShellService';
import {systemShellService} from './SystemShellService';
import {trayShellService} from './TrayShellService';
import {updateNotificationService} from './UpdateNotificationService';
import {windowShellService} from './WindowShellService';
import type {Result, Unsubscribe} from '@api/types/common';
import type {
    MountedNetworkDrive,
    NetworkDriveConfig,
    NetworkDriveDirectoryResult,
    NetworkDriveStatus
} from '@api/types/electron';
import type {WindowBounds} from '@api/types/window';
import type {
    HardwareAccelerationSettingsResult,
    OperationResult
} from './HardwareAccelerationShellService';
import type {
    FolderSelectionResult,
    MainSettingsPayload,
    PathResult,
    SettingsUpdateResult
} from './SettingsShellService';
import type {ShellActionResult} from './SystemShellService';
import type {TraySettings} from './TrayShellService';
import type {
    WindowShellBoundsResult,
    WindowShellMiniModeOptions,
    WindowShellMiniModeResult,
    WindowShellSetBoundsResult
} from './WindowShellService';

export type WindowBoundsResult = WindowShellBoundsResult;
export type SetBoundsResult = WindowShellSetBoundsResult;
export type MiniModeWindowStateOptions = WindowShellMiniModeOptions;
export type MiniModeWindowStateResult = WindowShellMiniModeResult;

export class AppShellService {
    initWindowStateManagement(): void {
        windowShellService.initWindowStateManagement();
    }

    disposeWindowStateManagement(): void {
        windowShellService.disposeWindowStateManagement();
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return windowShellService.onMaximizedChanged(handler);
    }

    async minimizeWindow(): Promise<void> {
        await windowShellService.minimize();
    }

    async toggleMaximizeWindow(): Promise<void> {
        await windowShellService.toggleMaximize();
    }

    async closeWindow(): Promise<void> {
        await windowShellService.close();
    }

    async isWindowMaximized(): Promise<boolean> {
        return await windowShellService.isMaximized();
    }

    async unmaximizeWindow(): Promise<void> {
        await windowShellService.unmaximize();
    }

    async getWindowBounds(): Promise<WindowBoundsResult | null> {
        return await windowShellService.getBounds();
    }

    async setWindowBounds(bounds: WindowBounds): Promise<SetBoundsResult> {
        return await windowShellService.setBounds(bounds);
    }

    async setMiniModeWindowState(options: MiniModeWindowStateOptions): Promise<MiniModeWindowStateResult> {
        return await windowShellService.setMiniModeWindowState(options);
    }

    async getWindowPosition(): Promise<[number, number]> {
        return await windowShellService.getPosition();
    }

    async getWindowSize(): Promise<[number, number]> {
        const size = await windowShellService.getSize();
        return size ?? [0, 0];
    }

    async setWindowSize(width: number, height: number): Promise<Result> {
        return await windowShellService.setSize(width, height);
    }

    async initSystemTray(): Promise<void> {
        await trayShellService.initSystemTray();
    }

    async updateTraySettings(settings: TraySettings): Promise<void> {
        await trayShellService.updateSettings(settings);
    }

    async getHardwareAccelerationSettings(): Promise<HardwareAccelerationSettingsResult> {
        return await hardwareAccelerationShellService.getSettings();
    }

    async updateHardwareAccelerationSettings(enabled: boolean): Promise<OperationResult> {
        return await hardwareAccelerationShellService.updateSettings(enabled);
    }

    async restartApplication(): Promise<void> {
        await hardwareAccelerationShellService.restartApplication();
    }

    async openUserDataFolder(): Promise<OperationResult> {
        return await hardwareAccelerationShellService.openUserDataFolder();
    }

    async openDevTools(): Promise<OperationResult> {
        return await hardwareAccelerationShellService.openDevTools();
    }

    async getVersion(): Promise<string> {
        return await systemShellService.getVersion();
    }

    async getPlatform(): Promise<string> {
        return await systemShellService.getPlatform();
    }

    async getAppPath(): Promise<string> {
        return await systemShellService.getAppPath();
    }

    async getUserDataPath(): Promise<string> {
        return await systemShellService.getUserDataPath();
    }

    async getTempPath(): Promise<string> {
        return await systemShellService.getTempPath();
    }

    async openPath(path: string): Promise<ShellActionResult> {
        return await systemShellService.openPath(path);
    }

    async openExternal(url: string): Promise<ShellActionResult> {
        return await systemShellService.openExternal(url);
    }

    async autoCheckForUpdates(): Promise<void> {
        await updateNotificationService.autoCheckForUpdates();
    }

    onShowUpdateDetails(handler: () => void): Unsubscribe {
        return updateNotificationService.onShowUpdateDetails(handler);
    }

    async openReleasePage(): Promise<void> {
        await updateNotificationService.openReleasePage();
    }

    async openDownloadPage(url: string): Promise<Result> {
        return await updateNotificationService.openDownloadPage(url);
    }

    async testNetworkDriveConnection(config: NetworkDriveConfig): Promise<boolean> {
        return await networkDriveManagementService.testConnection(config);
    }

    async mountNetworkDrive(config: NetworkDriveConfig): Promise<boolean> {
        return await networkDriveManagementService.mount(config);
    }

    async getMountedNetworkDrives(): Promise<MountedNetworkDrive[]> {
        return await networkDriveManagementService.getMountedDrives();
    }

    async getNetworkDriveStatus(driveId: string): Promise<NetworkDriveStatus | null> {
        return await networkDriveDetailService.getStatus(driveId);
    }

    async getNetworkDriveDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult> {
        return await networkDriveDetailService.getDirectoryStructure(driveId, path);
    }

    async refreshNetworkDriveConnection(driveId: string): Promise<boolean> {
        return await networkDriveManagementService.refreshConnection(driveId);
    }

    async refreshNetworkDriveConnections(): Promise<boolean> {
        return await networkDriveManagementService.refreshConnections();
    }

    async unmountNetworkDrive(driveId: string): Promise<boolean> {
        return await networkDriveManagementService.unmount(driveId);
    }

    onNetworkDriveConnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return networkDriveManagementService.onConnected(handler);
    }

    onNetworkDriveDisconnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return networkDriveManagementService.onDisconnected(handler);
    }

    onNetworkDriveError(handler: (driveId: string, error: string) => void): Unsubscribe {
        return networkDriveManagementService.onError(handler);
    }

    async getMusicFolders(): Promise<string[]> {
        return await settingsShellService.getMusicFolders();
    }

    async getAutoScanSettings(): Promise<MainSettingsPayload> {
        return await settingsShellService.getAutoScanSettings();
    }

    async getSetting<T = unknown>(key: string): Promise<T | null> {
        return await settingsShellService.getSetting<T>(key);
    }

    async setSetting<T = unknown>(key: string, value: T): Promise<void> {
        await settingsShellService.setSetting(key, value);
    }

    async selectFolder(): Promise<FolderSelectionResult> {
        return await settingsShellService.selectFolder();
    }

    async addMusicFolder(folderPath: string): Promise<SettingsUpdateResult> {
        return await settingsShellService.addMusicFolder(folderPath);
    }

    async removeMusicFolder(folderPath: string): Promise<SettingsUpdateResult> {
        return await settingsShellService.removeMusicFolder(folderPath);
    }

    async updateAutoScanSettings(settings: MainSettingsPayload): Promise<SettingsUpdateResult> {
        return await settingsShellService.updateAutoScanSettings(settings);
    }

    async getDefaultCoverCachePath(): Promise<PathResult> {
        return await settingsShellService.getDefaultCoverCachePath();
    }

    async ensureDirectoryExists(directoryPath: string): Promise<PathResult> {
        return await settingsShellService.ensureDirectoryExists(directoryPath);
    }
}

export const appShellService = new AppShellService();
export type {
    FolderSelectionResult,
    HardwareAccelerationSettingsResult,
    MainSettingsPayload,
    OperationResult,
    PathResult,
    SettingsUpdateResult,
    ShellActionResult,
    TraySettings
};
