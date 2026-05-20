/**
 * 歌词 API
 * 兼容入口，业务流程由 mediaAssets feature 持有。
 */

import {lyricsLookupService} from '@/features/mediaAssets/service/LyricsLookupService';
import {BaseAPI, Validator} from "@api/core";
import type {LyricLine, LyricsFormat, LyricsResult, NetworkLyricsSearchResult} from "@api/types";

export class LyricsAPI extends BaseAPI {
    constructor() {
        super('LyricsAPI');
    }

    async getLyrics(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null
    ): Promise<LyricsResult> {
        Validator.assertString(title, 'title');
        Validator.assertString(artist, 'artist');
        return await lyricsLookupService.getLyrics(title, artist, album, filePath);
    }

    async getEmbeddedLyricsAPI(filePath: string): Promise<LyricsResult> {
        Validator.assertFilePath(filePath, 'filePath');
        return await lyricsLookupService.getEmbeddedLyrics(filePath);
    }

    async getLocalLyrics(title: string, artist: string, album = ''): Promise<LyricsResult> {
        return await lyricsLookupService.getLocalLyrics(title, artist, album);
    }

    async searchTTMLLyrics(title: string): Promise<NetworkLyricsSearchResult[]> {
        Validator.assertString(title, 'title');
        return await lyricsLookupService.searchTTMLLyrics(title);
    }

    matchBestLyrics(
        results: NetworkLyricsSearchResult[],
        title: string,
        artist: string,
        album = ''
    ): NetworkLyricsSearchResult | null {
        return lyricsLookupService.matchBestLyrics(results, title, artist, album);
    }

    async downloadTTMLLyrics(platform: string, file: string): Promise<string> {
        Validator.assertString(platform, 'platform');
        Validator.assertString(file, 'file');
        return await lyricsLookupService.downloadTTMLLyrics(platform, file);
    }

    async getNetworkTTMLLyrics(title: string, artist: string, album = ''): Promise<LyricsResult> {
        return await lyricsLookupService.getNetworkTTMLLyrics(title, artist, album);
    }

    async getNetworkLRCLyrics(title: string, artist: string, album = ''): Promise<LyricsResult> {
        return await lyricsLookupService.getNetworkLRCLyrics(title, artist, album);
    }

    cacheLyrics(title: string, artist: string, album: string, lyricsData: Record<string, unknown>): void {
        lyricsLookupService.cacheLyrics(title, artist, album, lyricsData);
    }

    parseLRC(lrcText: string): LyricLine[] {
        return lyricsLookupService.parseLRC(lrcText);
    }

    parseTTML(ttmlText: string): LyricLine[] {
        return lyricsLookupService.parseTTML(ttmlText);
    }

    parse(lyricsText: string, format: LyricsFormat | null = null): LyricLine[] {
        return lyricsLookupService.parse(lyricsText, format);
    }
}

export const lyricsAPI = new LyricsAPI();
