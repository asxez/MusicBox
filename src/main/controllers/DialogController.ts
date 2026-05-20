// 对话框控制器

import * as fs from 'fs';
import * as path from 'path';
import {dialog} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

const IMAGE_MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp'
};

@Controller('dialog')
export class DialogController extends BaseController {
    constructor(private windowManager: WindowManager) {
        super();
    }

    @IpcHandle('dialog:openDirectory')
    async openDirectory(): Promise<string | null> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showOpenDialog(win as any, {
            properties: ['openDirectory'],
            title: 'Select Music Folder'
        });
        return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
    }

    @IpcHandle('dialog:selectFolder')
    async selectFolder(): Promise<{ filePaths: string[]; canceled: boolean }> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showOpenDialog(win as any, {
            properties: ['openDirectory'],
            title: 'Select Folder'
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return {filePaths: result.filePaths, canceled: result.canceled};
        }
        return {filePaths: [], canceled: true};
    }

    @IpcHandle('dialog:openFiles')
    async openFiles(): Promise<string[]> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showOpenDialog(win as any, {
            properties: ['openFile', 'multiSelections'],
            filters: [{name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma']}],
            title: 'Select Music Files'
        });
        return result.canceled ? [] : result.filePaths;
    }

    @IpcHandle('dialog:openFile')
    async openFile(options: Electron.OpenDialogOptions): Promise<{
        success: boolean;
        filePaths: string[];
        canceled: boolean
    }> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showOpenDialog(win as any, options);
        return {success: !result.canceled, filePaths: result.filePaths || [], canceled: result.canceled};
    }

    @IpcHandle('dialog:saveFile')
    async saveFile(options: Electron.SaveDialogOptions): Promise<{
        success: boolean;
        filePath: string | null;
        canceled: boolean
    }> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showSaveDialog(win as any, options);
        return {success: !result.canceled, filePath: result.filePath || null, canceled: result.canceled};
    }

    @IpcHandle('dialog:openImageFile')
    async openImageFile(): Promise<string | null> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showOpenDialog(win as any, {
            properties: ['openFile'],
            filters: [{name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']}],
            title: 'Select Image'
        });
        return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
    }

    @IpcHandle('dialog:showOpenDialog')
    async showOpenDialog(options: Electron.OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }> {
        const win = this.windowManager.getMainWindow();
        const result: any = await dialog.showOpenDialog(win as any, options);
        return {canceled: result.canceled, filePaths: result.filePaths || []};
    }

    @IpcHandle('media:selectImageData')
    async selectImageData(maxSizeBytes = 5 * 1024 * 1024): Promise<{
        success: boolean;
        canceled?: boolean;
        fileName?: string;
        filePath?: string;
        data?: number[];
        mimeType?: string;
        error?: string;
    }> {
        try {
            const win = this.windowManager.getMainWindow();
            const result: any = await dialog.showOpenDialog(win as any, {
                title: '选择专辑封面',
                filters: [{name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']}],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) {
                return {success: false, canceled: true};
            }

            const filePath = result.filePaths[0];
            const mimeType = IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()];
            if (!mimeType) {
                return {success: false, error: '不支持的封面图片格式'};
            }

            const stats = await fs.promises.stat(filePath);
            if (stats.size > maxSizeBytes) {
                return {success: false, error: '封面文件大小不能超过5MB'};
            }

            const buffer = await fs.promises.readFile(filePath);
            return {
                success: true,
                filePath,
                fileName: path.basename(filePath),
                data: Array.from(buffer),
                mimeType
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
