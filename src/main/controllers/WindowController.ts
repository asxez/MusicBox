// 窗口控制器

import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

@Controller('window')
export class WindowController extends BaseController {
    constructor(private windowManager: WindowManager) {
        super();
    }

    @IpcHandle('window:minimize')
    minimize(): void {
        this.windowManager.getMainWindow()?.minimize();
    }

    @IpcHandle('window:maximize')
    maximize(): void {
        const win = this.windowManager.getMainWindow();
        if (win) {
            win.isMaximized() ? win.unmaximize() : win.maximize();
        }
    }

    @IpcHandle('window:isMaximized')
    isMaximized(): boolean {
        return this.windowManager.getMainWindow()?.isMaximized() ?? false;
    }

    @IpcHandle('window:close')
    close(): void {
        this.windowManager.getMainWindow()?.close();
    }

    @IpcHandle('window:getPosition')
    getPosition(): number[] {
        const win = this.windowManager.getMainWindow();
        return win ? win.getPosition() : [0, 0];
    }

    @IpcHandle('window:getSize')
    getSize(): number[] {
        const win = this.windowManager.getMainWindow();
        return win ? win.getSize() : [1440, 900];
    }

    @IpcHandle('window:setSize')
    setSize(width: number, height: number): { success: boolean; width?: number; height?: number; error?: string } {
        const win = this.windowManager.getMainWindow();
        if (win && !win.isMaximized()) {
            try {
                const w = Math.max(400, Math.min(3840, Math.round(width)));
                const h = Math.max(120, Math.min(2160, Math.round(height)));
                win.setSize(w, h);
                return {success: true, width: w, height: h};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '窗口不可用或已最大化'};
    }

    @IpcHandle('window:setBounds')
    setBounds(bounds: { x: number; y: number; width: number; height: number }): { success: boolean; error?: string } {
        const win = this.windowManager.getMainWindow();
        if (win) {
            try {
                win.setBounds(bounds);
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '窗口不可用'};
    }

    @IpcHandle('window:getBounds')
    getBounds(): Electron.Rectangle | null {
        const win = this.windowManager.getMainWindow();
        return win ? win.getBounds() : null;
    }

    @IpcHandle('window:setResizable')
    setResizable(resizable: boolean): boolean {
        const win = this.windowManager.getMainWindow();
        if (win) {
            win.setResizable(resizable);
            return true;
        }
        return false;
    }

    @IpcHandle('window:setPosition')
    setPosition(x: number, y: number): { success: boolean; error?: string } {
        const win = this.windowManager.getMainWindow();
        if (win && !win.isMaximized()) {
            try {
                win.setPosition(Math.round(x), Math.round(y));
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '窗口不可用'};
    }

    @IpcHandle('window:setSkipTaskbar')
    setSkipTaskbar(skip: boolean): boolean {
        const win = this.windowManager.getMainWindow();
        if (win) {
            try {
                win.setSkipTaskbar(skip);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    @IpcHandle('window:setMinimumSize')
    setMinimumSize(width: number, height: number): boolean {
        const win = this.windowManager.getMainWindow();
        if (win) {
            try {
                win.setMinimumSize(width, height);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    @IpcHandle('window:setBackgroundThrottling')
    setBackgroundThrottling(flag: boolean): void {
        const win = this.windowManager.getMainWindow();
        if (win) {
            try {
                (win as any).setBackgroundThrottling(flag);
            } catch {
            }
        }
    }

    @IpcHandle('window:setAlwaysOnTop')
    setAlwaysOnTop(flag: boolean): boolean {
        const win = this.windowManager.getMainWindow();
        if (win) {
            win.setAlwaysOnTop(flag);
            return true;
        }
        return false;
    }

    @IpcHandle('window:isAlwaysOnTop')
    isAlwaysOnTop(): boolean {
        return this.windowManager.getMainWindow()?.isAlwaysOnTop() ?? false;
    }
}
