import {mediaAssetsService} from './service';
import type {
    EmbeddedLyricsResult,
    LocalCoverFileResult,
    LocalLyricsContentResult,
    LocalLyricsFileResult
} from './service';

class MediaAssetsController {
    async checkLocalCover(
        coverDir: string,
        title: string,
        artist: string,
        album: string,
        isAlbum = false
    ): Promise<LocalCoverFileResult> {
        return await mediaAssetsService.checkLocalCover(coverDir, title, artist, album, isAlbum);
    }

    async saveCoverFile(
        coverDir: string,
        fileName: string,
        imageData: unknown,
        dataType: string
    ): Promise<LocalCoverFileResult> {
        return await mediaAssetsService.saveCoverFile(coverDir, fileName, imageData, dataType);
    }

    async searchLocalLyrics(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        extension: string
    ): Promise<LocalLyricsFileResult> {
        return await mediaAssetsService.searchLocalLyrics(lyricsDir, title, artist, album, extension);
    }

    async readLocalLyricsFile(filePath: string): Promise<LocalLyricsContentResult> {
        return await mediaAssetsService.readLocalLyricsFile(filePath);
    }

    async saveLyricsToLocal(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        content: string,
        format: string
    ): Promise<LocalLyricsFileResult> {
        return await mediaAssetsService.saveLyricsToLocal(lyricsDir, title, artist, album, content, format);
    }

    async getEmbeddedLyrics(filePath: string): Promise<EmbeddedLyricsResult> {
        return await mediaAssetsService.getEmbeddedLyrics(filePath);
    }
}

export const mediaAssetsController = new MediaAssetsController();
export {MediaAssetsController};
