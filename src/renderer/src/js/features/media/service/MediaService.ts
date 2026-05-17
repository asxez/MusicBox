import {coverAPI, fileAPI, lyricsAPI} from '@api/modules';
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
        return await coverAPI.getCover(title, artist, album, filePath, forceRefresh);
    }

    async getLyrics(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null
    ): Promise<LyricsResult> {
        return await lyricsAPI.getLyrics(title, artist, album, filePath);
    }

    parseLyrics(content: string, format?: LyricsFormat | null): LyricLine[] {
        return lyricsAPI.parse(content, format as any);
    }

    parseLRC(content: string): LyricLine[] {
        return lyricsAPI.parseLRC(content);
    }

    parseTTML(content: string): LyricLine[] {
        return lyricsAPI.parseTTML(content);
    }

    async openDirectory(): Promise<string | null> {
        return await fileAPI.openDirectory();
    }

    async openDirectoryDialog(): Promise<string | null> {
        return await fileAPI.openDirectoryDialog();
    }

    async openFiles(): Promise<string[]> {
        return await fileAPI.openFiles();
    }

    async selectMusicFolder(): Promise<DirectoryResult> {
        return await fileAPI.selectMusicFolder();
    }

    async selectImageFile(): Promise<ImageFileResult> {
        return await fileAPI.selectImageFile();
    }

    async readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        return await fileAPI.readFile(filePath, encoding);
    }

    async stat(filePath: string): Promise<FileStatResult> {
        return await fileAPI.stat(filePath);
    }

    async showOpenDialog(options: Record<string, unknown>): Promise<OpenDialogResult> {
        return await fileAPI.showOpenDialog(options);
    }

    async openFile(options: Record<string, unknown>): Promise<OpenFileResult> {
        return await fileAPI.openFile(options);
    }

    async saveFile(options: Record<string, unknown>): Promise<SaveFileResult> {
        return await fileAPI.saveFile(options);
    }

    async writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        return await fileAPI.writeFile(filePath, data, encoding);
    }

    async readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return await fileAPI.readAudioFile(filePath);
    }
}

export const mediaService = new MediaService();
