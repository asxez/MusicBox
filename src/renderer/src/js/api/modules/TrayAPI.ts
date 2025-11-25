/**
 * 托盘 API
 * 提供系统托盘管理功能
 */

import {cacheManager} from '@services/CacheManager';
import {BaseAPI} from "@api/core";

/**
 * 托盘设置
 */
interface TraySettings {
    enabled: boolean;
    closeToTray: boolean;
    startMinimized: boolean;
}

/**
 * 托盘 API 类
 */
export class TrayAPI extends BaseAPI {
    constructor() {
        super('TrayAPI');
    }

    /**
     * 初始化系统托盘
     */
    async initSystemTray(): Promise<void> {
        try {
            // 获取托盘设置
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            const trayEnabled = settings.hasOwnProperty('systemTray') ? settings.systemTray : true;

            if (trayEnabled) {
                this.log('初始化系统托盘');

                // 创建托盘
                await this.wrapIPC(
                    () => window.electronAPI.tray.create(),
                    'tray.create'
                );

                // 更新托盘设置
                const traySettings: TraySettings = {
                    enabled: true,
                    closeToTray: settings.hasOwnProperty('trayCloseBehavior')
                        ? settings.trayCloseBehavior === 'minimize'
                        : false,
                    startMinimized: settings.hasOwnProperty('trayStartMinimized')
                        ? settings.trayStartMinimized || false
                        : false
                };

                await this.wrapIPC(
                    () => window.electronAPI.tray.updateSettings(traySettings),
                    'tray.updateSettings'
                );

                this.log('系统托盘初始化完成');
            }

            this.setupTrayEventListeners();
        } catch (error) {
            this.logError('初始化系统托盘失败', error as Error);
        }
    }

    /**
     * 设置托盘事件监听器
     */
    private setupTrayEventListeners(): void {
        try {
            // 退出应用
            window.electronAPI.tray.onQuit(() => {
                this.log('托盘退出事件触发');
                window.close();
            });
        } catch (error) {
            this.logError('设置托盘事件监听器失败', error as Error);
        }
    }

    /**
     * 创建系统托盘
     */
    async create(): Promise<void> {
        return this.wrapIPC(
            () => window.electronAPI.tray.create(),
            'tray.create'
        );
    }

    /**
     * 销毁系统托盘
     */
    async destroy(): Promise<void> {
        return this.wrapIPC(
            () => window.electronAPI.tray.destroy(),
            'tray.destroy'
        );
    }

    /**
     * 更新托盘设置
     * @param settings - 托盘设置
     */
    async updateSettings(settings: Partial<TraySettings>): Promise<void> {
        return this.wrapIPC(
            () => window.electronAPI.tray.updateSettings(settings),
            'tray.updateSettings'
        );
    }
}

export const trayAPI = new TrayAPI();
