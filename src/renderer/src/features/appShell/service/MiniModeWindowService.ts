import {cacheManager} from '@/shared/cache';
import {windowShellService} from './WindowShellService';

interface WindowSizeCache {
    width?: number;
    height?: number;
}

export interface RestoredMainWindowSize {
    width: number;
    height: number;
}

export class MiniModeWindowService {
    private resizeHandler: (() => void) | null = null;
    private resizeGuardTimer: ReturnType<typeof setTimeout> | null = null;
    private active = false;

    getPersistedMiniModeEnabled(): boolean {
        return cacheManager.getLocalCache('miniModeEnabled') === true;
    }

    setPersistedMiniModeEnabled(enabled: boolean): void {
        cacheManager.setLocalCache('miniModeEnabled', enabled);
    }

    getRestoredMainWindowSize(): RestoredMainWindowSize {
        const savedSize = cacheManager.getLocalCache<WindowSizeCache | [number, number]>('mainWindow-size');
        const width = Array.isArray(savedSize) ? savedSize[0] : savedSize?.width;
        const height = Array.isArray(savedSize) ? savedSize[1] : savedSize?.height;

        if (typeof width === 'number' && typeof height === 'number' && width >= 1080 && height >= 720) {
            return {width, height};
        }

        if (savedSize) {
            cacheManager.removeLocalCache('mainWindow-size');
        }

        return {width: 1440, height: 900};
    }

    async enterMiniMode(): Promise<void> {
        const currentBounds = await windowShellService.getBounds();
        const result = await windowShellService.setMiniModeWindowState({
            enabled: true,
            x: currentBounds?.x ?? 0,
            y: currentBounds?.y ?? 0
        });

        if (!result.success) {
            throw new Error(result.error || '设置迷你模式窗口状态失败');
        }

        this.active = true;
        this.startResizeGuard();
        await this.enforceWindowBounds();
    }

    async exitMiniMode(): Promise<void> {
        this.active = false;
        this.stopResizeGuard();

        const {width, height} = this.getRestoredMainWindowSize();
        const restoreResult = await windowShellService.setMiniModeWindowState({
            enabled: false,
            width,
            height
        });

        if (!restoreResult.success) {
            throw new Error(restoreResult.error || '恢复主窗口状态失败');
        }
    }

    startResizeGuard(): void {
        this.stopResizeGuard();

        this.resizeHandler = () => {
            if (!this.active) {
                return;
            }

            if (this.resizeGuardTimer) {
                clearTimeout(this.resizeGuardTimer);
            }

            this.resizeGuardTimer = setTimeout(() => {
                void this.enforceWindowBounds();
            }, 80);
        };

        window.addEventListener('resize', this.resizeHandler);
    }

    stopResizeGuard(): void {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.resizeGuardTimer) {
            clearTimeout(this.resizeGuardTimer);
            this.resizeGuardTimer = null;
        }
    }

    async enforceWindowBounds(): Promise<void> {
        if (!this.active) {
            return;
        }

        try {
            if (await windowShellService.isMaximized()) {
                await windowShellService.unmaximize();
            }

            const bounds = await windowShellService.getBounds();
            const x = bounds?.x ?? 0;
            const y = bounds?.y ?? 0;

            if (!bounds || bounds.width !== 400 || bounds.height !== 145) {
                await windowShellService.setBounds({x, y, width: 400, height: 145});
            }
        } catch (error) {
            console.warn('⚠️ MiniModeWindowService: 迷你模式窗口尺寸守卫失败:', error);
        }
    }
}

export const miniModeWindowService = new MiniModeWindowService();
