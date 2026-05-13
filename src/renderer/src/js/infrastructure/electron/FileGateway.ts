import type {Unsubscribe} from '@api/types/common';

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

function getElectronAPI(): Window['electronAPI'] {
    if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
    }

    return window.electronAPI;
}

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
        return getElectronAPI().fs.stat(filePath);
    }

    readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        return getElectronAPI().fs.readFile(filePath, encoding) as Promise<string | ArrayLike<number>>;
    }

    writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        return getElectronAPI().fs.writeFile(filePath, data, encoding);
    }

    readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return getElectronAPI().readAudioFile(filePath);
    }

    onUnsupported(): Unsubscribe {
        return () => {};
    }
}

export const fileGateway = new FileGateway();
