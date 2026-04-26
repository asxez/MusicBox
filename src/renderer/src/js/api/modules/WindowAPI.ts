/**
 * 窗口 API
 * 提供窗口状态管理功能
 */

import {windowGateway} from '@js/infrastructure/electron';
import {cacheManager} from '@services/CacheManager';
import {BaseAPI, Validator} from "@api/core";
import {WindowBounds, WindowSize} from "@api/types";

/**
 * 窗口尺寸数据
 */
interface WindowSizeData extends WindowSize {
    timestamp: number;
}

/**
 * 窗口 API 类
 */
export class WindowAPI extends BaseAPI {
    private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly MIN_WIDTH = 440;
    private readonly MIN_HEIGHT = 120;
    private readonly NORMAL_MIN_WIDTH = 1080;
    private readonly NORMAL_MIN_HEIGHT = 720;
    private readonly MAX_WIDTH = 3840;
    private readonly MAX_HEIGHT = 2160;

    constructor() {
        super('WindowAPI');
    }

    /**
     * 初始化窗口状态管理
     */
    initWindowStateManagement(): void {
        this.log('初始化窗口状态管理');

        // 窗口尺寸变化监听
        window.addEventListener('resize', () => {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(async () => {
                await this.saveWindowSize();
            }, 1500);
        });

        // 窗口最大化状态变化监听
        windowGateway.onMaximizedChanged((isMaximized: boolean) => {
            if (!isMaximized) {
                setTimeout(async () => {
                    await this.restoreWindowSize();
                }, 100);
            }
        });

        this.log('窗口状态管理初始化完成');
    }

    /**
     * 保存窗口尺寸
     */
    async saveWindowSize(): Promise<void> {
        try {
            if (document.body.classList.contains('mini-mode')) {
                return;
            }

            const isMaximized = await this.isMaximized();
            if (isMaximized) {
                return;
            }

            const size = await this.getSize();
            if (size && Array.isArray(size) && size.length === 2) {
                const [width, height] = size;
                if (this.isValidNormalWindowSize(width, height)) {
                    const sizeData: WindowSizeData = {
                        width,
                        height,
                        timestamp: Date.now()
                    };
                    cacheManager.setLocalCache('mainWindow-size', sizeData);
                    this.log(`窗口尺寸已保存: ${width}x${height}`);
                }
            }
        } catch (error) {
            this.logError('保存窗口尺寸失败', error as Error);
        }
    }

    /**
     * 恢复窗口尺寸
     */
    async restoreWindowSize(): Promise<void> {
        try {
            const savedSize = cacheManager.getLocalCache('mainWindow-size') as WindowSizeData | null;
            if (!savedSize) {
                return;
            }

            const {width, height} = savedSize;
            if (this.isValidNormalWindowSize(width, height)) {
                const result = await this.setSize(width, height);
                if (!result || !result.success) {
                    cacheManager.removeLocalCache('mainWindow-size');
                    this.logWarn('恢复窗口尺寸失败，已清除缓存');
                } else {
                    this.log(`窗口尺寸已恢复: ${width}x${height}`);
                }
            } else {
                cacheManager.removeLocalCache('mainWindow-size');
                this.logWarn('无效的窗口尺寸，已清除缓存');
            }
        } catch (error) {
            this.logError('恢复窗口尺寸失败', error as Error);
        }
    }

    /**
     * 验证窗口尺寸有效性
     * @param width - 宽度
     * @param height - 高度
     * @returns 是否有效
     */
    isValidWindowSize(width: number, height: number): boolean {
        return (
            width >= this.MIN_WIDTH &&
            width <= this.MAX_WIDTH &&
            height >= this.MIN_HEIGHT &&
            height <= this.MAX_HEIGHT
        );
    }

    isValidNormalWindowSize(width: number, height: number): boolean {
        return (
            width >= this.NORMAL_MIN_WIDTH &&
            width <= this.MAX_WIDTH &&
            height >= this.NORMAL_MIN_HEIGHT &&
            height <= this.MAX_HEIGHT
        );
    }

    /**
     * 获取窗口尺寸
     * @returns 窗口尺寸 [width, height]
     */
    async getSize(): Promise<[number, number] | null> {
        return this.wrapIPC(
            () => windowGateway.getSize(),
            'window.getSize',
            null
        );
    }

    /**
     * 设置窗口尺寸
     * @param width - 宽度
     * @param height - 高度
     * @returns 操作结果
     */
    async setSize(width: number, height: number): Promise<{ success: boolean }> {
        Validator.assertNumber(width, 'width');
        Validator.assertNumber(height, 'height');

        if (!this.isValidWindowSize(width, height)) {
            throw new Error(`无效的窗口尺寸: ${width}x${height}`);
        }

        return this.wrapIPC(
            () => windowGateway.setSize(width, height),
            'window.setSize'
        );
    }

    /**
     * 获取窗口边界
     * @returns 窗口边界
     */
    async getBounds(): Promise<{ height: number, width: number, x: number, y: number } | null> {
        return this.wrapIPC(
            () => windowGateway.getBounds(),
            'window.getBounds',
            null
        );
    }

    /**
     * 设置窗口边界
     * @param bounds - 窗口边界
     */
    async setBounds(bounds: WindowBounds): Promise<{
        success: boolean,
        bounds?: {
            height: number;
            width: number;
            x: number;
            y: number;
        }
        error?: string
    }> {
        Validator.assertObject(bounds, 'bounds');

        return this.wrapIPC(
            () => windowGateway.setBounds(bounds),
            'window.setBounds'
        );
    }

    /**
     * 检查窗口是否最大化
     * @returns 是否最大化
     */
    async isMaximized(): Promise<boolean> {
        return this.wrapIPC(
            () => windowGateway.isMaximized(),
            'window.isMaximized',
            false
        );
    }

    /**
     * 最大化窗口
     */
    async maximize(): Promise<void> {
        return this.wrapIPC(
            () => windowGateway.maximize(),
            'window.maximize'
        );
    }

    /**
     * 取消最大化窗口
     */
    async unmaximize(): Promise<void> {
        return this.wrapIPC(
            () => windowGateway.unmaximize(),
            'window.unmaximize'
        );
    }

    /**
     * 最小化窗口
     */
    async minimize(): Promise<void> {
        return this.wrapIPC(
            () => windowGateway.minimize(),
            'window.minimize'
        );
    }

    /**
     * 关闭窗口
     */
    async close(): Promise<void> {
        return this.wrapIPC(
            () => windowGateway.close(),
            'window.close'
        );
    }

    /**
     * 设置窗口置顶
     * @param flag - 是否置顶
     */
    async setAlwaysOnTop(flag: boolean): Promise<boolean> {
        Validator.assertBoolean(flag, 'flag');

        return this.wrapIPC(
            () => windowGateway.setAlwaysOnTop(flag),
            'window.setAlwaysOnTop'
        );
    }

    /**
     * 设置窗口后台节流
     * @param allowed - 是否节流
     */
    async setBackgroundThrottling(allowed: boolean): Promise<void> {
        Validator.assertBoolean(allowed, 'allowed');

        return this.wrapIPC(
            () => windowGateway.setBackgroundThrottling(allowed),
            'window.setBackgroundThrottling'
        );
    }

    async setResizable(resizable: boolean): Promise<boolean> {
        Validator.assertBoolean(resizable, 'resizable');

        return this.wrapIPC(
            () => windowGateway.setResizable(resizable),
            'window.setResizable'
        );
    }

    async setMaximizable(maximizable: boolean): Promise<boolean> {
        Validator.assertBoolean(maximizable, 'maximizable');

        return this.wrapIPC(
            () => windowGateway.setMaximizable(maximizable),
            'window.setMaximizable'
        );
    }

    async setMaximumSize(width: number, height: number): Promise<boolean> {
        Validator.assertNumber(width, 'width');
        Validator.assertNumber(height, 'height');

        return this.wrapIPC(
            () => windowGateway.setMaximumSize(width, height),
            'window.setMaximumSize'
        );
    }

    async setMiniModeWindowState(options: {
        enabled: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): Promise<{success: boolean; data?: {size?: number[]; minimumSize?: number[]; maximumSize?: number[]}; error?: string}> {
        Validator.assertBoolean(options.enabled, 'enabled');

        return this.wrapIPC(
            () => windowGateway.setMiniModeWindowState(options),
            'window.setMiniModeWindowState'
        );
    }

    async setSkipTaskbar(skip: boolean): Promise<boolean> {
        Validator.assertBoolean(skip, 'skip');

        return this.wrapIPC(
            () => windowGateway.setSkipTaskbar(skip),
            'window.setSkipTaskbar'
        );
    }

    async setMinimumSize(width: number, height: number): Promise<boolean> {
        Validator.assertNumber(width, 'width');
        Validator.assertNumber(height, 'height');

        return this.wrapIPC(
            () => windowGateway.setMinimumSize(width, height),
            'window.setMinimumSize'
        );
    }
}

export const windowAPI = new WindowAPI();
