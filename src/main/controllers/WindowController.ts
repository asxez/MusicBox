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

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, Math.round(value)));
    }

    private fitBoundsToDisplay(
        bounds: Electron.Rectangle,
        minWidth = 400,
        minHeight = 120
    ): Electron.Rectangle {
        const display = screen.getDisplayMatching(bounds);
        const {workArea} = display;
        const widthMin = Math.min(minWidth, workArea.width);
        const heightMin = Math.min(minHeight, workArea.height);
        const width = this.clamp(bounds.width, widthMin, workArea.width);
        const height = this.clamp(bounds.height, heightMin, workArea.height);
        const x = this.clamp(bounds.x, workArea.x, workArea.x + Math.max(0, workArea.width - width));
        const y = this.clamp(bounds.y, workArea.y, workArea.y + Math.max(0, workArea.height - height));

        return {x, y, width, height};
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
                win.setBounds(this.fitBoundsToDisplay({ x, y, width: targetWidth, height: targetHeight }));
                setTimeout(() => {
                    if (!win || win.isDestroyed()) return;
                    const [afterWidth, afterHeight] = win.getSize();
                    if (afterWidth !== targetWidth || afterHeight !== targetHeight) {
                        try {
                            win.setBounds(this.fitBoundsToDisplay({
                                ...win.getBounds(),
                                width: targetWidth,
                                height: targetHeight
                            }));
                        } catch { }
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
                const fittedBounds = this.fitBoundsToDisplay({
                    ...win.getBounds(),
                    width: Math.round(width),
                    height: Math.round(height)
                });
                win.setBounds(fittedBounds);
                return {success: true, width: fittedBounds.width, height: fittedBounds.height};
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
                win.setBounds(this.fitBoundsToDisplay(bounds));
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
                win.setBounds(this.fitBoundsToDisplay({x, y, width, height}, width, height));
                win.setResizable(false);
                win.setSkipTaskbar(true);
                win.setAlwaysOnTop(true);
            } else {
                const display = screen.getDisplayMatching(win.getBounds());
                const {workArea} = display;
                const minWidth = Math.min(1080, workArea.width);
                const minHeight = Math.min(720, workArea.height);
                const maxWidth = Math.max(3840, workArea.width);
                const maxHeight = Math.max(2160, workArea.height);
                const width = this.clamp(Math.round(options.width ?? 1440), minWidth, workArea.width);
                const height = this.clamp(Math.round(options.height ?? 900), minHeight, workArea.height);
                const fittedBounds = this.fitBoundsToDisplay(
                    {...win.getBounds(), width, height},
                    minWidth,
                    minHeight
                );

                this.cachedOriginalSize = null;
                win.setResizable(true);
                win.setMaximizable(true);
                win.setMinimumSize(1, 1);
                win.setMaximumSize(maxWidth, maxHeight);
                win.setMinimumSize(minWidth, minHeight);
                win.setSkipTaskbar(false);
                win.setAlwaysOnTop(false);
                win.setBounds(fittedBounds);
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
                const fittedBounds = this.fitBoundsToDisplay({
                    ...win.getBounds(),
                    x: Math.round(x),
                    y: Math.round(y)
                });
                win.setBounds(fittedBounds);
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
