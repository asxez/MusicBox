import type {DirectoryResult, ImageFileResult} from '@api/types/file';
import {fileGateway} from '@js/infrastructure/electron';

export type OpenDialogResult = {
    canceled: boolean;
    filePaths: string[];
    bookmarks?: string[];
};

export type OpenFileResult = {
    success: boolean;
    filePaths: string[];
    canceled: boolean;
};

export type SaveFileResult = {
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    cancelled?: boolean;
};

export class MediaFileDialogService {
    async openDirectory(): Promise<string | null> {
        return await this.wrapFileOperation(() => fileGateway.openDirectory(), null);
    }

    async openDirectoryDialog(): Promise<string | null> {
        return await this.openDirectory();
    }

    async openFiles(): Promise<string[]> {
        return await this.wrapFileOperation(() => fileGateway.openFiles(), []);
    }

    async selectMusicFolder(): Promise<DirectoryResult> {
        try {
            const result = await fileGateway.selectFolder();
            if (result && result.filePaths && result.filePaths.length > 0 && !result.canceled) {
                return {path: result.filePaths[0], success: true};
            }

            return {success: false};
        } catch (error) {
            return {success: false, error: getErrorMessage(error)};
        }
    }

    async selectImageFile(): Promise<ImageFileResult> {
        try {
            const imagePath = await fileGateway.openImageFile();
            if (imagePath) {
                return {path: imagePath, success: true};
            }

            return {success: false};
        } catch (error) {
            return {success: false, error: getErrorMessage(error)};
        }
    }

    async showOpenDialog(options: Record<string, unknown>): Promise<OpenDialogResult> {
        return await this.wrapFileOperation(
            () => fileGateway.showOpenDialog(options),
            {canceled: true, filePaths: []}
        );
    }

    async openFile(options: Record<string, unknown>): Promise<OpenFileResult> {
        return await this.wrapFileOperation(
            () => fileGateway.openFile(options),
            {success: false, filePaths: [], canceled: true}
        );
    }

    async saveFile(options: Record<string, unknown>): Promise<SaveFileResult> {
        return await this.wrapFileOperation(
            () => fileGateway.saveFile(options),
            {success: false, canceled: true}
        );
    }

    private async wrapFileOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            console.error('❌ MediaFileDialogService: 文件对话框操作失败', error);
            return fallback;
        }
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export const mediaFileDialogService = new MediaFileDialogService();
