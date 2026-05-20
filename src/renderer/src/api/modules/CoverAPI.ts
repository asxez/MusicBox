/**
 * 封面 API
 * 兼容入口，业务流程由 mediaAssets feature 持有。
 */

import {coverLookupService} from '@/features/mediaAssets/service/CoverLookupService';
import {BaseAPI, Validator} from "@api/core";
import type {CoverResult} from "@api/types";

export class CoverAPI extends BaseAPI {
    constructor() {
        super('CoverAPI');
    }

    async getCover(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null,
        forceRefresh = false
    ): Promise<CoverResult> {
        Validator.assertString(title, 'title');
        Validator.assertString(artist, 'artist');
        return await coverLookupService.getCover(title, artist, album, filePath, forceRefresh);
    }

    async getEmbeddedCoverAPI(filePath: string): Promise<CoverResult> {
        Validator.assertFilePath(filePath, 'filePath');
        return await coverLookupService.getEmbeddedCover(filePath);
    }

    async getLocalCover(title: string, artist: string, album = ''): Promise<CoverResult> {
        return await coverLookupService.getLocalCover(title, artist, album);
    }

    async getNetworkCover(title: string, artist: string, album = ''): Promise<CoverResult> {
        return await coverLookupService.getNetworkCover(title, artist, album);
    }

    clearCacheForFile(filePath: string): void {
        Validator.assertFilePath(filePath, 'filePath');
        coverLookupService.clearCacheForFile(filePath);
    }

    clearCacheForTrack(title: string, artist: string, album = ''): void {
        coverLookupService.clearCacheForTrack(title, artist, album);
    }

    clearAllCache(): void {
        coverLookupService.clearAllCache();
    }
}

export const coverAPI = new CoverAPI();
