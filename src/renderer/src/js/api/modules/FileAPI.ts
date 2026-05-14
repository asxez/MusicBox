/**
 * 文件 API
 * 提供文件和目录选择对话框功能
 */


import {BaseAPI} from "@api/core";
import {fileGateway} from "@js/infrastructure/electron";
import {DirectoryResult, ImageFileResult} from "@api/types";

/**
 * 文件 API 类
 */
export class FileAPI extends BaseAPI {
    constructor() {
        super('FileAPI');
    }

    /**
     * 打开目录选择对话框
     * @returns 选中的目录路径或 null
     */
    async openDirectory(): Promise<string | null> {
        return this.wrapIPC(async () => {
            const result = await fileGateway.openDirectory();
            return result || null;
        }, 'openDirectory', null);
    }

    /**
     * 打开目录选择对话框（别名，保持向后兼容）
     * @returns 选中的目录路径或 null
     */
    async openDirectoryDialog(): Promise<string | null> {
        return this.openDirectory();
    }

    /**
     * 打开文件选择对话框
     * @returns 选中的文件路径数组
     */
    async openFiles(): Promise<string[]> {
        return this.wrapIPC(async () => {
            const result = await fileGateway.openFiles();
            return result || [];
        }, 'openFiles', []);
    }

    /**
     * 选择音乐文件夹（用于设置页面）
     * @returns 选择结果
     */
    async selectMusicFolder(): Promise<DirectoryResult> {
        try {
            const result = await this.wrapIPC(
                () => fileGateway.selectFolder(),
                'selectFolder'
            );

            if (result && result.filePaths && result.filePaths.length > 0 && !result.canceled) {
                return {path: result.filePaths[0], success: true};
            }

            return {success: false};
        } catch (error) {
            this.logError('选择音乐文件夹失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 选择图片文件（用于歌单封面等）
     * @returns 选择结果
     */
    async selectImageFile(): Promise<ImageFileResult> {
        try {
            const imagePath = await this.wrapIPC(
                () => fileGateway.openImageFile(),
                'openImageFile'
            );
            if (imagePath) {
                return {path: imagePath, success: true};
            }
            return {success: false};
        } catch (error) {
            this.logError('选择图像文件失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    async readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        return this.wrapIPC(
            () => fileGateway.readFile(filePath, encoding),
            'fs.readFile',
            ''
        );
    }

    async stat(filePath: string): Promise<{size: number; mtime: unknown; isFile: boolean; isDirectory: boolean}> {
        return this.wrapIPC(
            () => fileGateway.stat(filePath),
            'fs.stat'
        );
    }

    async showOpenDialog(options: Record<string, unknown>): Promise<{canceled: boolean; filePaths: string[]; bookmarks?: string[]}> {
        return this.wrapIPC(
            () => fileGateway.showOpenDialog(options),
            'dialog.showOpenDialog',
            {canceled: true, filePaths: []}
        );
    }

    async openFile(options: Record<string, unknown>): Promise<{success: boolean; filePaths: string[]; canceled: boolean}> {
        return this.wrapIPC(
            () => fileGateway.openFile(options),
            'dialog.openFile',
            {success: false, filePaths: [], canceled: true}
        );
    }

    async saveFile(options: Record<string, unknown>): Promise<{success: boolean; filePath?: string; canceled?: boolean; cancelled?: boolean}> {
        return this.wrapIPC(
            () => fileGateway.saveFile(options),
            'dialog.saveFile',
            {success: false, canceled: true}
        );
    }

    async writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        return this.wrapIPC(
            () => fileGateway.writeFile(filePath, data, encoding),
            'fs.writeFile',
            false
        );
    }

    async readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return this.wrapIPC(
            () => fileGateway.readAudioFile(filePath),
            'readAudioFile'
        );
    }
}

export const fileAPI = new FileAPI();
