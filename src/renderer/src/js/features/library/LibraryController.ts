import {api} from '@api/api';
import {libraryAPI} from '@api/modules';
import type {Result} from '@api/types/common';
import type {CacheValidationResult} from '@api/types/events';
import type {CacheStatistics, GetTracksOptions, Playlist} from '@api/types/library';
import type {Track} from '@api/types/library';

export type AddTrackResult = {
    success: boolean;
    track?: Track;
    error?: string;
    isNew?: boolean;
};

export type PlaylistCoverResult = {
    success: boolean;
    coverPath?: string;
    error?: string;
};

class LibraryController {
    async getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return await libraryAPI.getTracks(options);
    }

    async hasCachedLibrary(): Promise<boolean> {
        return await libraryAPI.hasCachedLibrary();
    }

    async loadCachedTracks(): Promise<Track[]> {
        return await api.loadCachedTracks();
    }

    async getCacheStatistics(): Promise<CacheStatistics | null> {
        return await libraryAPI.getCacheStatistics();
    }

    async searchLibrary(query: string): Promise<Track[]> {
        return await libraryAPI.searchLibrary(query);
    }

    async scanDirectory(directoryPath: string): Promise<boolean> {
        return await api.scanDirectory(directoryPath);
    }

    async getTrackMetadata(filePath: string): Promise<Partial<Track> | null> {
        return await libraryAPI.getTrackMetadata(filePath);
    }

    async addTrackToLibrary(track: Partial<Track> | unknown): Promise<AddTrackResult> {
        return await api.addTrackToLibrary(track);
    }

    async removeTrack(trackFileId: string): Promise<Result> {
        return await libraryAPI.removeTrack(trackFileId);
    }

    async validateCache(): Promise<CacheValidationResult | null> {
        return await api.validateCache();
    }

    async clearCache(): Promise<boolean> {
        return await api.clearCache();
    }

    emitLibraryUpdated(tracks?: Track[]): void {
        api.emit('libraryUpdated', tracks);
    }

    async getPlaylists(): Promise<Playlist[]> {
        return await libraryAPI.getPlaylists();
    }

    async createPlaylist(name: string, description = ''): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        return await libraryAPI.createPlaylist(name, description);
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        return await libraryAPI.deletePlaylist(playlistId);
    }

    async renamePlaylist(playlistId: string, newName: string): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        return await libraryAPI.renamePlaylist(playlistId, newName);
    }

    async addToPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryAPI.addToPlaylist(playlistId, trackIds);
    }

    async removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryAPI.removeFromPlaylist(playlistId, trackIds);
    }

    async getPlaylistDetail(playlistId: string): Promise<{success: boolean; playlist?: Playlist; tracks?: Track[]; error?: string}> {
        return await libraryAPI.getPlaylistDetail(playlistId);
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return await libraryAPI.scanNetworkDrive(driveId, relativePath);
    }

    async scanSingleFile(networkPath: string): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return await libraryAPI.scanSingleFile(networkPath);
    }

    async scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}> {
        return await libraryAPI.scanDirectoryForFiles(path);
    }

    async getTracksByDrive(driveId: string): Promise<Track[]> {
        return await libraryAPI.getTracksByDrive(driveId);
    }

    async removeTracksByDrive(driveId: string): Promise<Result> {
        return await libraryAPI.removeTracksByDrive(driveId);
    }

    async updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return await libraryAPI.updateTrackMetadata(data);
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
