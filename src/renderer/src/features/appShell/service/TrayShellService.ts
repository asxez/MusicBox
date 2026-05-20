import {trayGateway} from '@/infrastructure/electron';
import {cacheManager} from '@/shared/cache';
import type {Unsubscribe} from '@api/types/common';

export type TraySettings = {
    enabled?: boolean;
    closeToTray?: boolean;
    startMinimized?: boolean;
};

export class TrayShellService {
    private quitUnsubscribe: Unsubscribe | null = null;

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

            if (!this.quitUnsubscribe) {
                this.quitUnsubscribe = trayGateway.onQuit(() => {
                    window.close();
                });
            }
        } catch (error) {
            console.error('❌ TrayShellService: 初始化系统托盘失败', error);
        }
    }

    async updateSettings(settings: TraySettings): Promise<void> {
        await trayGateway.updateSettings(settings);
    }
}

export const trayShellService = new TrayShellService();
