import {windowGateway} from '@js/infrastructure/electron';
import {cacheManager} from '@js/shared/cache';
import type {Result, Unsubscribe} from '@api/types/common';
import type {WindowBounds, WindowSize} from '@api/types/window';

interface WindowSizeData extends WindowSize {
    timestamp: number;
}

export type WindowShellBoundsResult = {
    height: number;
    width: number;
    x: number;
    y: number;
};

export type WindowShellSetBoundsResult = {
    success: boolean;
    bounds?: WindowShellBoundsResult;
    error?: string;
};

export type WindowShellMiniModeOptions = {
    enabled: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

export type WindowShellMiniModeResult = {
    success: boolean;
    data?: {
        size?: number[];
        minimumSize?: number[];
        maximumSize?: number[];
    };
    error?: string;
};

class WindowInputError extends Error {
    constructor(paramName: string, expectedType: string, actualValue: unknown) {
        super(`参数 "${paramName}" 验证失败: 期望 ${expectedType}, 实际收到 ${typeof actualValue}`);
        this.name = 'WindowInputError';
    }
}

export class WindowShellService {
    private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    private resizeHandler: (() => void) | null = null;
    private maximizedChangedUnsubscribe: Unsubscribe | null = null;
    private readonly minWidth = 440;
    private readonly minHeight = 120;
    private readonly normalMinWidth = 1080;
    private readonly normalMinHeight = 720;
    private readonly maxWidth = 3840;
    private readonly maxHeight = 2160;

    initWindowStateManagement(): void {
        if (this.resizeHandler || this.maximizedChangedUnsubscribe) {
            this.log('窗口状态管理已初始化，跳过重复绑定');
            return;
        }

        this.log('初始化窗口状态管理');

        this.resizeHandler = () => {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(async () => {
                await this.saveWindowSize();
            }, 1500);
        };
        window.addEventListener('resize', this.resizeHandler);

        this.maximizedChangedUnsubscribe = windowGateway.onMaximizedChanged((isMaximized: boolean) => {
            if (!isMaximized) {
                setTimeout(async () => {
                    await this.restoreWindowSize();
                }, 100);
            }
        });

        this.log('窗口状态管理初始化完成');
    }

    disposeWindowStateManagement(): void {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
            void this.saveWindowSize();
        }

        if (this.maximizedChangedUnsubscribe) {
            this.maximizedChangedUnsubscribe();
            this.maximizedChangedUnsubscribe = null;
        }
    }

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
            this.logError('保存窗口尺寸失败', error);
        }
    }

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
            this.logError('恢复窗口尺寸失败', error);
        }
    }

    isValidWindowSize(width: number, height: number): boolean {
        return (
            width >= this.minWidth &&
            width <= this.maxWidth &&
            height >= this.minHeight &&
            height <= this.maxHeight
        );
    }

    isValidNormalWindowSize(width: number, height: number): boolean {
        return (
            width >= this.normalMinWidth &&
            width <= this.maxWidth &&
            height >= this.normalMinHeight &&
            height <= this.maxHeight
        );
    }

    async getSize(): Promise<[number, number] | null> {
        return await this.callGateway(
            () => windowGateway.getSize(),
            'window.getSize',
            null
        );
    }

    async getPosition(): Promise<[number, number]> {
        return await this.callGateway(
            () => windowGateway.getPosition(),
            'window.getPosition'
        );
    }

    async setSize(width: number, height: number): Promise<Result> {
        this.assertNumber(width, 'width');
        this.assertNumber(height, 'height');

        if (!this.isValidWindowSize(width, height)) {
            throw new Error(`无效的窗口尺寸: ${width}x${height}`);
        }

        return await this.callGateway(
            () => windowGateway.setSize(width, height),
            'window.setSize'
        );
    }

    async getBounds(): Promise<WindowShellBoundsResult | null> {
        return await this.callGateway(
            () => windowGateway.getBounds(),
            'window.getBounds',
            null
        );
    }

    async setBounds(bounds: WindowBounds): Promise<WindowShellSetBoundsResult> {
        this.assertObject(bounds, 'bounds');

        return await this.callGateway(
            () => windowGateway.setBounds(bounds),
            'window.setBounds'
        );
    }

    async isMaximized(): Promise<boolean> {
        return await this.callGateway(
            () => windowGateway.isMaximized(),
            'window.isMaximized',
            false
        );
    }

    async maximize(): Promise<void> {
        await this.callGateway(
            () => windowGateway.maximize(),
            'window.maximize'
        );
    }

    async unmaximize(): Promise<void> {
        await this.callGateway(
            () => windowGateway.unmaximize(),
            'window.unmaximize'
        );
    }

    async minimize(): Promise<void> {
        await this.callGateway(
            () => windowGateway.minimize(),
            'window.minimize'
        );
    }

    async toggleMaximize(): Promise<void> {
        const maximized = await this.isMaximized();
        if (maximized) {
            await this.unmaximize();
        } else {
            await this.maximize();
        }
    }

    async close(): Promise<void> {
        await this.callGateway(
            () => windowGateway.close(),
            'window.close'
        );
    }

    onMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return windowGateway.onMaximizedChanged(handler);
    }

    async setAlwaysOnTop(flag: boolean): Promise<boolean> {
        this.assertBoolean(flag, 'flag');

        return await this.callGateway(
            () => windowGateway.setAlwaysOnTop(flag),
            'window.setAlwaysOnTop'
        );
    }

    async setBackgroundThrottling(allowed: boolean): Promise<void> {
        this.assertBoolean(allowed, 'allowed');

        await this.callGateway(
            () => windowGateway.setBackgroundThrottling(allowed),
            'window.setBackgroundThrottling'
        );
    }

    async setResizable(resizable: boolean): Promise<boolean> {
        this.assertBoolean(resizable, 'resizable');

        return await this.callGateway(
            () => windowGateway.setResizable(resizable),
            'window.setResizable'
        );
    }

    async setMaximizable(maximizable: boolean): Promise<boolean> {
        this.assertBoolean(maximizable, 'maximizable');

        return await this.callGateway(
            () => windowGateway.setMaximizable(maximizable),
            'window.setMaximizable'
        );
    }

    async setMaximumSize(width: number, height: number): Promise<boolean> {
        this.assertNumber(width, 'width');
        this.assertNumber(height, 'height');

        return await this.callGateway(
            () => windowGateway.setMaximumSize(width, height),
            'window.setMaximumSize'
        );
    }

    async setMiniModeWindowState(options: WindowShellMiniModeOptions): Promise<WindowShellMiniModeResult> {
        this.assertBoolean(options.enabled, 'enabled');

        return await this.callGateway(
            () => windowGateway.setMiniModeWindowState(options),
            'window.setMiniModeWindowState'
        );
    }

    async setSkipTaskbar(skip: boolean): Promise<boolean> {
        this.assertBoolean(skip, 'skip');

        return await this.callGateway(
            () => windowGateway.setSkipTaskbar(skip),
            'window.setSkipTaskbar'
        );
    }

    async setMinimumSize(width: number, height: number): Promise<boolean> {
        this.assertNumber(width, 'width');
        this.assertNumber(height, 'height');

        return await this.callGateway(
            () => windowGateway.setMinimumSize(width, height),
            'window.setMinimumSize'
        );
    }

    private async callGateway<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T>;
    private async callGateway<T>(
        operation: () => Promise<T>,
        operationName: string,
        fallbackValue: T
    ): Promise<T>;
    private async callGateway<T>(
        operation: () => Promise<T>,
        operationName: string,
        fallbackValue?: T
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logError(`${operationName} 失败`, error);

            if (arguments.length >= 3) {
                return fallbackValue as T;
            }

            throw error;
        }
    }

    private assertNumber(value: unknown, paramName: string): asserts value is number {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new WindowInputError(paramName, 'valid number', value);
        }
    }

    private assertBoolean(value: unknown, paramName: string): asserts value is boolean {
        if (typeof value !== 'boolean') {
            throw new WindowInputError(paramName, 'boolean', value);
        }
    }

    private assertObject(value: unknown, paramName: string): asserts value is object {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new WindowInputError(paramName, 'object', value);
        }
    }

    private log(message: string): void {
        console.log(`🔌 API: [WindowShellService] ${message}`);
    }

    private logWarn(message: string): void {
        console.warn(`⚠️ [WindowShellService] ${message}`);
    }

    private logError(message: string, error: unknown): void {
        console.error(`❌ WindowShellService: ${message}`, error);
    }
}

export const windowShellService = new WindowShellService();
