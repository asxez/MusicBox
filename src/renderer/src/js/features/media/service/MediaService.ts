import {coverLookupService, lyricsLookupService} from '@js/features/mediaAssets/service';
import {fileGateway} from '@js/infrastructure/electron';
import type {LyricsFormat} from '@api/types/common';
import type {CoverResult} from '@api/types/cover';
import type {DirectoryResult, ImageFileResult} from '@api/types/file';
import type {LyricLine, LyricsResult} from '@api/types/lyrics';

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

export type FileStatResult = {
    size: number;
    mtime: unknown;
    isFile: boolean;
    isDirectory: boolean;
};

export class MediaService {
    async getCover(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null,
        forceRefresh = false
    ): Promise<CoverResult> {
        return await coverLookupService.getCover(title, artist, album, filePath, forceRefresh);
    }

    async getLyrics(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null
    ): Promise<LyricsResult> {
        return await lyricsLookupService.getLyrics(title, artist, album, filePath);
    }

    parseLyrics(content: string, format?: LyricsFormat | null): LyricLine[] {
        return lyricsLookupService.parse(content, format);
    }

    parseLRC(content: string): LyricLine[] {
        return lyricsLookupService.parseLRC(content);
    }

    parseTTML(content: string): LyricLine[] {
        return lyricsLookupService.parseTTML(content);
    }

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
            return {success: false, error: error instanceof Error ? error.message : String(error)};
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
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    async readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        return await this.wrapFileOperation(() => fileGateway.readFile(filePath, encoding), '');
    }

    async stat(filePath: string): Promise<FileStatResult> {
        return await fileGateway.stat(filePath);
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

    async writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        return await this.wrapFileOperation(() => fileGateway.writeFile(filePath, data, encoding), false);
    }

    async readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return await fileGateway.readAudioFile(filePath);
    }

    private async wrapFileOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            console.error('❌ MediaService: 文件操作失败', error);
            return fallback;
        }
    }
}

export const mediaService = new MediaService();
