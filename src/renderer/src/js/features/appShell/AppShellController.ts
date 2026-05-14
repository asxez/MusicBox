import {trayAPI, updateAPI, windowAPI} from '@api/modules';
import type {Result, Unsubscribe} from '@api/types/common';
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

    async initSystemTray(): Promise<void> {
        await trayAPI.initSystemTray();
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
}

export const appShellController = new AppShellController();
export {AppShellController};
export type {MiniModeWindowStateOptions, MiniModeWindowStateResult, SetBoundsResult, WindowBoundsResult};
