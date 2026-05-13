// 窗口控制器

import { ipcMain, screen } from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

@Controller('window')
export class WindowController extends BaseController {
    private cachedOriginalSize: { width: number; height: number } | null = null;

    constructor(private windowManager: WindowManager) {
        super();
    }

    override register(): void {
        super.register();
        // custom-adsorption and clear-size-cache use ipcMain.on (not decorated)
        ipcMain.on('custom-adsorption', (_event, res) => {
            const win = this.windowManager.getMainWindow();
            if (win && !win.isMaximized()) {
                if (res.originalWidth && res.originalHeight) {
                    this.cachedOriginalSize = { width: res.originalWidth, height: res.originalHeight };
                }
                const x = Math.round(res.appX);
                const y = Math.round(res.appY);
                const targetWidth = this.cachedOriginalSize ? this.cachedOriginalSize.width : win.getSize()[0];
                const targetHeight = this.cachedOriginalSize ? this.cachedOriginalSize.height : win.getSize()[1];
                win.setBounds({ x, y, width: targetWidth, height: targetHeight });
                setTimeout(() => {
                    if (!win || win.isDestroyed()) return;
                    const [afterWidth, afterHeight] = win.getSize();
                    if (afterWidth !== targetWidth || afterHeight !== targetHeight) {
                        try { win.setSize(targetWidth, targetHeight); } catch { }
                    }
                }, 0);
            }
        });
        ipcMain.on('clear-size-cache', () => {
            this.cachedOriginalSize = null;
        });
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

    @IpcHandle('window:setMaximizable')
    setMaximizable(maximizable: boolean): boolean {
        const win = this.windowManager.getMainWindow();
        if (win) {
            win.setMaximizable(maximizable);
            return true;
        }
        return false;
    }

    @IpcHandle('window:setMaximumSize')
    setMaximumSize(width: number, height: number): boolean {
        const win = this.windowManager.getMainWindow();
        if (win) {
            try {
                win.setMaximumSize(width, height);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    @IpcHandle('window:setMiniModeWindowState')
    setMiniModeWindowState(options: {
        enabled: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): { success: boolean; size?: number[]; minimumSize?: number[]; maximumSize?: number[]; error?: string } {
        const win = this.windowManager.getMainWindow();
        if (!win) {
            return {success: false, error: '窗口不可用'};
        }

        try {
            if (win.isMaximized()) {
                win.unmaximize();
            }

            if (options.enabled) {
                const x = Math.round(options.x ?? win.getBounds().x);
                const y = Math.round(options.y ?? win.getBounds().y);
                const width = 400;
                const height = 145;

                this.cachedOriginalSize = null;
                win.setResizable(true);
                win.setMaximizable(false);
                win.setMinimumSize(width, height);
                win.setMaximumSize(width, height);
                win.setBounds({x, y, width, height});
                win.setResizable(false);
                win.setSkipTaskbar(true);
                win.setAlwaysOnTop(true);
            } else {
                const display = screen.getDisplayMatching(win.getBounds());
                const maxWidth = Math.max(3840, display.workAreaSize.width);
                const maxHeight = Math.max(2160, display.workAreaSize.height);
                const width = Math.max(1080, Math.min(maxWidth, Math.round(options.width ?? 1440)));
                const height = Math.max(720, Math.min(maxHeight, Math.round(options.height ?? 900)));
                const bounds = win.getBounds();

                this.cachedOriginalSize = null;
                win.setResizable(true);
                win.setMaximizable(true);
                win.setMinimumSize(1, 1);
                win.setMaximumSize(maxWidth, maxHeight);
                win.setMinimumSize(1080, 720);
                win.setSkipTaskbar(false);
                win.setAlwaysOnTop(false);
                win.setBounds({x: bounds.x, y: bounds.y, width, height});
            }

            return {
                success: true,
                size: win.getSize(),
                minimumSize: win.getMinimumSize(),
                maximumSize: win.getMaximumSize()
            };
        } catch (error: any) {
            return {success: false, error: error.message};
        }
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
