import {coversGateway, lyricsGateway} from '@/infrastructure/electron';
import type {EmbeddedLyricsData} from '@api/types/electron';

export interface LocalCoverFileResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
}

export interface CoverImageDataResult {
    success: boolean;
    data?: number[];
    mimeType?: string;
    error?: string;
}

export interface LocalLyricsFileResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
}

export interface LocalLyricsContentResult {
    success: boolean;
    content?: string;
    error?: string;
}

export interface EmbeddedLyricsResult {
    success: boolean;
    lyrics?: EmbeddedLyricsData;
    source?: string;
    error?: string;
}

export class MediaAssetsService {
    async checkLocalCover(
        coverDir: string,
        title: string,
        artist: string,
        album: string,
        isAlbum = false
    ): Promise<LocalCoverFileResult> {
        return await coversGateway.checkLocalCover(coverDir, title, artist, album, isAlbum);
    }

    async saveCoverFile(
        coverDir: string,
        fileName: string,
        imageData: unknown,
        dataType: string
    ): Promise<LocalCoverFileResult> {
        return await coversGateway.saveCoverFile(coverDir, fileName, imageData, dataType);
    }

    async readCoverImage(filePath: string): Promise<CoverImageDataResult> {
        return await coversGateway.readCoverImage(filePath);
    }

    async searchLocalLyrics(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        extension: string
    ): Promise<LocalLyricsFileResult> {
        return await lyricsGateway.searchLocalFiles(lyricsDir, title, artist, album, extension);
    }

    async readLocalLyricsFile(filePath: string): Promise<LocalLyricsContentResult> {
        return await lyricsGateway.readLocalFile(filePath);
    }

    async saveLyricsToLocal(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        content: string,
        format: string
    ): Promise<LocalLyricsFileResult> {
        return await lyricsGateway.saveToLocal(lyricsDir, title, artist, album, content, format);
    }

    async getEmbeddedLyrics(filePath: string): Promise<EmbeddedLyricsResult> {
        return await lyricsGateway.getEmbedded(filePath);
    }
}

export const mediaAssetsService = new MediaAssetsService();
