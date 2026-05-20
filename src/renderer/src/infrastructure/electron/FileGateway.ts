import type {Unsubscribe} from '@api/types/common';
import {getElectronAPI} from './ElectronBridge';

type OpenDialogOptions = Record<string, unknown>;

export interface DialogFileResult {
    canceled: boolean;
    filePaths: string[];
    bookmarks?: string[];
}

export interface DialogOpenFileResult {
    success: boolean;
    filePaths: string[];
    canceled: boolean;
}

export interface DialogSaveFileResult {
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    cancelled?: boolean;
}

export interface FileStatResult {
    size: number;
    mtime: unknown;
    isFile: boolean;
    isDirectory: boolean;
}

/**
 * @deprecated Phase 5 migration shim.
 * Prefer domain gateways/services such as media, mediaAssets, lyrics, plugin storage or app shell APIs.
 * Keep this gateway only for compatibility while generic fs/path/os preload capabilities are being retired.
 */
class FileGateway {
    openDirectory(): Promise<string | null> {
        return getElectronAPI().openDirectory();
    }

    openFiles(): Promise<string[]> {
        return getElectronAPI().openFiles();
    }

    selectFolder(): Promise<{filePaths: string[]; canceled: boolean}> {
        return getElectronAPI().selectFolder();
    }

    openImageFile(): Promise<string | null> {
        return getElectronAPI().openImageFile();
    }

    showOpenDialog(options: OpenDialogOptions): Promise<DialogFileResult> {
        return getElectronAPI().dialog.showOpenDialog(options);
    }

    openFile(options: OpenDialogOptions): Promise<DialogOpenFileResult> {
        return getElectronAPI().dialog.openFile(options);
    }

    async saveFile(options: OpenDialogOptions): Promise<DialogSaveFileResult> {
        const result = await getElectronAPI().dialog.saveFile(options);
        const filePath = Array.isArray(result.filePath) ? result.filePath[0] : result.filePath;

        return {
            ...result,
            filePath
        };
    }

    stat(filePath: string): Promise<FileStatResult> {
        void filePath;
        return Promise.reject(new Error('FileGateway.stat is deprecated; use a domain-specific gateway'));
    }

    /**
     * @deprecated Use a domain-specific reader instead of generic fs.readFile.
     */
    readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        void filePath;
        void encoding;
        return Promise.reject(new Error('FileGateway.readFile is deprecated; use a domain-specific gateway'));
    }

    /**
     * @deprecated Use a domain-specific writer instead of generic fs.writeFile.
     */
    writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        void filePath;
        void data;
        void encoding;
        return Promise.reject(new Error('FileGateway.writeFile is deprecated; use a domain-specific gateway'));
    }

    readAudioFile(filePath: string): Promise<ArrayBuffer> {
        void filePath;
        return Promise.reject(new Error('FileGateway.readAudioFile is deprecated; use mediaGateway.readAudioFile'));
    }

    onUnsupported(): Unsubscribe {
        return () => {};
    }
}

export const fileGateway = new FileGateway();
