/**
 * 窗口 API
 * 兼容入口，窗口状态管理由 appShell feature 持有。
 */

import {BaseAPI} from "@api/core";
import type {Unsubscribe} from "@api/types/common";
import type {WindowBounds} from "@api/types/window";
import {windowShellService} from "@/features/appShell/service/WindowShellService";

export class WindowAPI extends BaseAPI {
    constructor() {
        super('WindowAPI');
    }

    initWindowStateManagement(): void {
        windowShellService.initWindowStateManagement();
    }

    disposeWindowStateManagement(): void {
        windowShellService.disposeWindowStateManagement();
    }

    async saveWindowSize(): Promise<void> {
        await windowShellService.saveWindowSize();
    }

    async restoreWindowSize(): Promise<void> {
        await windowShellService.restoreWindowSize();
    }

    isValidWindowSize(width: number, height: number): boolean {
        return windowShellService.isValidWindowSize(width, height);
    }

    isValidNormalWindowSize(width: number, height: number): boolean {
        return windowShellService.isValidNormalWindowSize(width, height);
    }

    async getSize(): Promise<[number, number] | null> {
        return await windowShellService.getSize();
    }

    async setSize(width: number, height: number): Promise<{success: boolean}> {
        return await windowShellService.setSize(width, height);
    }

    async getBounds(): Promise<{height: number, width: number, x: number, y: number} | null> {
        return await windowShellService.getBounds();
    }

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
        return await windowShellService.setBounds(bounds);
    }

    async isMaximized(): Promise<boolean> {
        return await windowShellService.isMaximized();
    }

    async maximize(): Promise<void> {
        await windowShellService.maximize();
    }

    async unmaximize(): Promise<void> {
        await windowShellService.unmaximize();
    }

    async minimize(): Promise<void> {
        await windowShellService.minimize();
    }

    async close(): Promise<void> {
        await windowShellService.close();
    }

    onMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return windowShellService.onMaximizedChanged(handler);
    }

    async setAlwaysOnTop(flag: boolean): Promise<boolean> {
        return await windowShellService.setAlwaysOnTop(flag);
    }

    async setBackgroundThrottling(allowed: boolean): Promise<void> {
        await windowShellService.setBackgroundThrottling(allowed);
    }

    async setResizable(resizable: boolean): Promise<boolean> {
        return await windowShellService.setResizable(resizable);
    }

    async setMaximizable(maximizable: boolean): Promise<boolean> {
        return await windowShellService.setMaximizable(maximizable);
    }

    async setMaximumSize(width: number, height: number): Promise<boolean> {
        return await windowShellService.setMaximumSize(width, height);
    }

    async setMiniModeWindowState(options: {
        enabled: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): Promise<{success: boolean; data?: {size?: number[]; minimumSize?: number[]; maximumSize?: number[]}; error?: string}> {
        return await windowShellService.setMiniModeWindowState(options);
    }

    async setSkipTaskbar(skip: boolean): Promise<boolean> {
        return await windowShellService.setSkipTaskbar(skip);
    }

    async setMinimumSize(width: number, height: number): Promise<boolean> {
        return await windowShellService.setMinimumSize(width, height);
    }
}

export const windowAPI = new WindowAPI();
