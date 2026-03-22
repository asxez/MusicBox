// 系统托盘控制器

import * as fs from 'fs';
import * as path from 'path';
import {app, Tray, Menu, nativeImage} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

interface TraySettings {
    enabled: boolean;
    closeToTray: boolean;
    startMinimized: boolean;
}

@Controller('tray')
export class TrayController extends BaseController {
    private tray: Tray | null = null;
    private settings: TraySettings = {enabled: true, closeToTray: false, startMinimized: false};
    private settingsFilePath: string;

    constructor(private windowManager: WindowManager) {
        super();
        this.settingsFilePath = path.join(app.getPath('userData'), 'tray-settings.json');
    }

    private async createTrayIcon(): Promise<Electron.NativeImage> {
        const iconPaths = [
            path.join(app.getAppPath(), 'resources', 'icons', 'icon.png'),
            path.join(app.getAppPath(), 'public', 'icon.png'),
            path.join(__dirname, '../../../resources/icons/icon.png'),
            path.join(__dirname, '../../../public/favicon.ico')
        ];
        for (const iconPath of iconPaths) {
            try {
                await fs.promises.access(iconPath);
                const icon = nativeImage.createFromPath(iconPath);
                if (!icon.isEmpty()) return icon.resize({width: 16, height: 16});
            } catch {
            }
        }
        return nativeImage.createEmpty();
    }

    private updateTrayMenu(): void {
        if (!this.tray) return;
        const menu = Menu.buildFromTemplate([
            {type: 'separator'},
            {label: '显示主窗口', click: () => this.showMainWindow()},
            {type: 'separator'},
            {
                label: '退出', click: () => {
                    this.windowManager.sendToMainWindow('tray:quit');
                    setTimeout(() => app.quit(), 300);
                }
            }
        ]);
        this.tray.setContextMenu(menu);
    }

    private showMainWindow(): void {
        const win = this.windowManager.getMainWindow();
        if (win) {
            win.show();
            win.focus();
        }
    }

    private async createTrayInstance(): Promise<void> {
        if (this.tray) return;
        const icon = await this.createTrayIcon();
        this.tray = new Tray(icon);
        this.tray.setToolTip('MusicBox');
        this.updateTrayMenu();
        this.tray.on('click', () => {
            const win = this.windowManager.getMainWindow();
            if (!win) return;
            if (win.isVisible()) {
                if (win.isFocused()) win.hide();
                else {
                    win.show();
                    win.focus();
                }
            } else {
                this.showMainWindow();
            }
        });
    }

    private destroyTrayInstance(): void {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }

    private async saveTraySettings(): Promise<void> {
        await fs.promises.writeFile(this.settingsFilePath, JSON.stringify(this.settings, null, 2), 'utf8');
    }

    @IpcHandle('tray:create')
    async create(): Promise<{ success: boolean; error?: string }> {
        try {
            await this.createTrayInstance();
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('tray:destroy')
    destroy(): { success: boolean; error?: string } {
        try {
            this.destroyTrayInstance();
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('tray:updateSettings')
    async updateSettings(settings: Partial<TraySettings>): Promise<{ success: boolean; error?: string }> {
        try {
            this.settings = {...this.settings, ...settings};
            await this.saveTraySettings();
            if (settings.enabled === false) this.destroyTrayInstance();
            else if (settings.enabled === true && !this.tray) await this.createTrayInstance();
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('tray:getSettings')
    getSettings(): TraySettings {
        return this.settings;
    }
}
