import {settingsSystemGateway, trayGateway, windowGateway} from '@js/infrastructure/electron';
import {systemGateway} from '@js/infrastructure/electron/SystemGateway';
import {networkDriveDetailService, networkDriveManagementService} from '@js/features/networkDrive/service';
import {cacheManager} from '@js/shared/cache';
import {showToast} from '@js/utils';
import {type GitHubRelease, updateService} from './UpdateService';
import {windowShellService} from './WindowShellService';
import type {Result, Unsubscribe} from '@api/types/common';
import type {
    MountedNetworkDrive,
    NetworkDriveConfig,
    NetworkDriveDirectoryResult,
    NetworkDriveStatus
} from '@api/types/electron';
import type {WindowBounds} from '@api/types/window';

export type WindowBoundsResult = {
    height: number;
    width: number;
    x: number;
    y: number;
};

export type SetBoundsResult = {
    success: boolean;
    bounds?: WindowBoundsResult;
    error?: string;
};

export type MiniModeWindowStateOptions = {
    enabled: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

export type MiniModeWindowStateResult = {
    success: boolean;
    data?: {
        size?: number[];
        minimumSize?: number[];
        maximumSize?: number[];
    };
    error?: string;
};

export type FolderSelectionResult = {
    filePaths: string[];
    canceled: boolean;
};

export type TraySettings = {
    enabled?: boolean;
    closeToTray?: boolean;
    startMinimized?: boolean;
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

export type OperationResult = {
    success?: boolean;
    error?: string;
};

export type ShellActionResult = {
    success: boolean;
    error?: string;
};

export type HardwareAccelerationSettingsResult = {
    success?: boolean;
    settings?: {
        enabled?: boolean;
    };
    error?: string;
};

type ShowUpdateDetailsHandler = () => void;

export class AppShellService {
    private readonly showUpdateDetailsHandlers = new Set<ShowUpdateDetailsHandler>();

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
        await windowShellService.maximize();
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
        return await windowGateway.getPosition();
    }

    async getWindowSize(): Promise<[number, number]> {
        return await windowGateway.getSize();
    }

    async setWindowSize(width: number, height: number): Promise<Result> {
        return await windowGateway.setSize(width, height);
    }

    async initSystemTray(): Promise<void> {
        try {
            const settings = cacheManager.getLocalCache<Record<string, unknown>>('musicbox-settings') || {};
            const trayEnabled = Object.prototype.hasOwnProperty.call(settings, 'systemTray')
                ? settings.systemTray
                : true;

            if (trayEnabled) {
                await trayGateway.create();
                await trayGateway.updateSettings({
                    enabled: true,
                    closeToTray: Object.prototype.hasOwnProperty.call(settings, 'trayCloseBehavior')
                        ? settings.trayCloseBehavior === 'minimize'
                        : false,
                    startMinimized: Object.prototype.hasOwnProperty.call(settings, 'trayStartMinimized')
                        ? Boolean(settings.trayStartMinimized)
                        : false
                });
            }

            trayGateway.onQuit(() => {
                window.close();
            });
        } catch (error) {
            console.error('❌ AppShellService: 初始化系统托盘失败', error);
        }
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
        try {
            const {currentVersion, latestVersion, releaseInfo, hasUpdate} = await updateService.checkForUpdates();

            if (hasUpdate) {
                this.showUpdateNotification(currentVersion, latestVersion, releaseInfo);
            }
        } catch (error) {
            console.error('❌ AppShellService: 检查更新失败', error);
            showToast('检查更新失败，请检查网络连接', 'error');
        }
    }

    onShowUpdateDetails(handler: () => void): Unsubscribe {
        this.showUpdateDetailsHandlers.add(handler);
        return () => {
            this.showUpdateDetailsHandlers.delete(handler);
        };
    }

    async openReleasePage(): Promise<void> {
        try {
            const releaseInfo = await updateService.getLatestRelease();
            await this.openDownloadPage(releaseInfo.html_url || updateService.getFallbackReleaseUrl());
        } catch (error) {
            console.error('❌ AppShellService: 打开 Release 页面失败', error);
            await updateService.openReleasePage();
        }
    }

    async openDownloadPage(url: string): Promise<Result> {
        return await updateService.openReleasePage(url);
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

    private showUpdateNotification(
        currentVersion: string,
        latestVersion: string,
        releaseInfo?: GitHubRelease
    ): void {
        const message = `发现新版本 v${latestVersion}（当前版本：v${currentVersion}）`;
        const toastElement = document.createElement('div');
        toastElement.className = 'update-notification-toast';
        toastElement.innerHTML = `
            <div class="update-toast-content">
                <div class="update-toast-header">
                    <div class="update-toast-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.41,10.09L6,11.5L11,16.5Z"/>
                        </svg>
                    </div>
                    <div class="update-toast-text">
                        <div class="update-toast-title">发现新版本</div>
                        <div class="update-toast-message">${message}</div>
                    </div>
                    <button class="update-toast-close">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="update-toast-actions">
                    <button class="update-toast-btn update-toast-btn-primary">查看详情</button>
                    <button class="update-toast-btn update-toast-btn-secondary">稍后提醒</button>
                </div>
            </div>
        `;

        const removeToast = () => {
            if (!toastElement.parentNode) {
                return;
            }

            toastElement.classList.remove('show');
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.remove();
                }
            }, 300);
        };

        toastElement.querySelector('.update-toast-close')?.addEventListener('click', removeToast);
        toastElement.querySelector('.update-toast-btn-secondary')?.addEventListener('click', removeToast);
        toastElement.querySelector('.update-toast-btn-primary')?.addEventListener('click', () => {
            if (this.showUpdateDetailsHandlers.size > 0) {
                this.showUpdateDetailsHandlers.forEach(handler => handler());
            } else if (releaseInfo) {
                updateService.openReleasePage(releaseInfo.html_url).catch(error => {
                    console.error('❌ AppShellService: 打开 Release 页面失败', error);
                });
            }
            removeToast();
        });

        document.body.appendChild(toastElement);
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });
        setTimeout(removeToast, 8000);
    }
}

export const appShellService = new AppShellService();
