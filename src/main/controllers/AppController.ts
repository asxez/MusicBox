// App 基础信息控制器

import {app, shell} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

@Controller('app')
export class AppController extends BaseController {
    constructor(private windowManager: WindowManager) {
        super();
    }

    @IpcHandle('app:getVersion')
    getVersion(): string {
        return app.getVersion();
    }

    @IpcHandle('app:getPlatform')
    getPlatform(): string {
        return process.platform;
    }

    @IpcHandle('app:restart')
    async restart(): Promise<{ success: boolean }> {
        app.relaunch();
        app.exit(0);
        return {success: true};
    }

    @IpcHandle('app:getUserDataPath')
    getUserDataPath(): string {
        return app.getPath('userData');
    }

    @IpcHandle('app:getAppPath')
    getAppPath(): string {
        return app.getAppPath();
    }

    @IpcHandle('app:getTempPath')
    getTempPath(): string {
        return app.getPath('temp');
    }

    @IpcHandle('app:openUserDataFolder')
    async openUserDataFolder(): Promise<{ success: boolean; error?: string }> {
        try {
            await shell.openPath(app.getPath('userData'));
            return {success: true};
        } catch (error: any) {
            console.error('❌ 打开应用数据文件夹失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('app:openPath')
    async openPath(filePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            await shell.openPath(filePath);
            return {success: true};
        } catch (error: any) {
            console.error('❌ 打开文件夹失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('app:openExternal')
    async openExternal(url: string): Promise<{ success: boolean; error?: string }> {
        try {
            const parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return {success: false, error: '不支持的外部链接协议'};
            }

            await shell.openExternal(parsedUrl.toString());
            return {success: true};
        } catch (error: any) {
            console.error('❌ 打开外部链接失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('app:getDefaultCoverCachePath')
    getDefaultCoverCachePath(): { success: boolean; path?: string; error?: string } {
        try {
            return {success: true, path: path.join(app.getPath('userData'), 'CoverCache')};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('app:ensureDirectoryExists')
    async ensureDirectoryExists(dirPath: string): Promise<{ success: boolean; path?: string; error?: string }> {
        try {
            await fs.promises.mkdir(dirPath, {recursive: true});
            return {success: true, path: dirPath};
        } catch (error: any) {
            console.error('❌ 创建目录失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('app:openDevTools')
    async openDevTools(): Promise<{ success: boolean; error?: string }> {
        try {
            const win = this.windowManager.getMainWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.openDevTools({mode: 'detach'});
                return {success: true};
            }
            return {success: false, error: '主窗口不可用'};
        } catch (error: any) {
            console.error('❌ 打开开发者工具失败:', error);
            return {success: false, error: error.message};
        }
    }
}
