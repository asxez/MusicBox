import {api} from '@api/api';
import {libraryAPI} from '@api/modules';
import type {Result} from '@api/types/common';
import type {CacheValidationResult} from '@api/types/events';
import type {Track} from '@api/types/library';

export type PlaylistCoverResult = {
    success: boolean;
    coverPath?: string;
    error?: string;
};

class LibraryController {
    async getTracks(): Promise<Track[]> {
        return await libraryAPI.getTracks();
    }

    async scanDirectory(directoryPath: string): Promise<boolean> {
        return await api.scanDirectory(directoryPath);
    }

    async validateCache(): Promise<CacheValidationResult | null> {
        return await api.validateCache();
    }

    async clearCache(): Promise<boolean> {
        return await api.clearCache();
    }

    async getPlaylistCover(playlistId: string): Promise<PlaylistCoverResult> {
        return await api.getPlaylistCover(playlistId);
    }

    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        return await api.updatePlaylistCover(playlistId, imagePath);
    }

    async removePlaylistCover(playlistId: string): Promise<Result> {
        return await api.removePlaylistCover(playlistId);
    }
}

export const libraryController = new LibraryController();
export {LibraryController};
