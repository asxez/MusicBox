import type {LyricsFormat} from '@api/types/common';
import type {CoverResult} from '@api/types/cover';
import type {DirectoryResult, ImageFileResult} from '@api/types/file';
import type {LyricLine, LyricsResult} from '@api/types/lyrics';
import {mediaService} from './service';
import type {FileStatResult, OpenDialogResult, OpenFileResult, SaveFileResult} from './service';

class MediaController {
    async getCover(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null,
        forceRefresh = false
    ): Promise<CoverResult> {
        return await mediaService.getCover(title, artist, album, filePath, forceRefresh);
    }

    async getLyrics(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null
    ): Promise<LyricsResult> {
        return await mediaService.getLyrics(title, artist, album, filePath);
    }

    parseLyrics(content: string, format?: LyricsFormat | null): LyricLine[] {
        return mediaService.parseLyrics(content, format);
    }

    parseLRC(content: string): LyricLine[] {
        return mediaService.parseLRC(content);
    }

    parseTTML(content: string): LyricLine[] {
        return mediaService.parseTTML(content);
    }

    async openDirectory(): Promise<string | null> {
        return await mediaService.openDirectory();
    }

    async openDirectoryDialog(): Promise<string | null> {
        return await mediaService.openDirectoryDialog();
    }

    async openFiles(): Promise<string[]> {
        return await mediaService.openFiles();
    }

    async selectMusicFolder(): Promise<DirectoryResult> {
        return await mediaService.selectMusicFolder();
    }

    async selectImageFile(): Promise<ImageFileResult> {
        return await mediaService.selectImageFile();
    }

    async readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        return await mediaService.readFile(filePath, encoding);
    }

    async stat(filePath: string): Promise<FileStatResult> {
        return await mediaService.stat(filePath);
    }

    async showOpenDialog(options: Record<string, unknown>): Promise<OpenDialogResult> {
        return await mediaService.showOpenDialog(options);
    }

    async openFile(options: Record<string, unknown>): Promise<OpenFileResult> {
        return await mediaService.openFile(options);
    }

    async saveFile(options: Record<string, unknown>): Promise<SaveFileResult> {
        return await mediaService.saveFile(options);
    }

    async writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        return await mediaService.writeFile(filePath, data, encoding);
    }

    async readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return await mediaService.readAudioFile(filePath);
    }
}

export const mediaController = new MediaController();
export {MediaController};
export type {FileStatResult, OpenDialogResult, OpenFileResult, SaveFileResult};
