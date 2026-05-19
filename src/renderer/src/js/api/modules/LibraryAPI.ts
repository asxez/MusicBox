/**
 * 音乐库 API
 * 兼容入口，音乐库数据访问和查询流程由 library feature 持有。
 */

import {BaseAPI} from "@api/core";
import type {CacheStatistics, GetTracksOptions, Playlist, Result, Track} from "@api/types";
import {libraryDataService} from "@js/features/library/service/LibraryDataService";

export class LibraryAPI extends BaseAPI {
    constructor() {
        super('LibraryAPI');
    }

    async getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return await libraryDataService.getTracks(options);
    }

    async searchLibrary(query: string): Promise<Track[]> {
        return await libraryDataService.searchLibrary(query);
    }

    async getTrackMetadata(filePath: string): Promise<Track | null> {
        return await libraryDataService.getTrackMetadata(filePath);
    }

    async updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return await libraryDataService.updateTrackMetadata(data);
    }

    async getCacheStatistics(): Promise<CacheStatistics | null> {
        return await libraryDataService.getCacheStatistics();
    }

    async hasCachedLibrary(): Promise<boolean> {
        return await libraryDataService.hasCachedLibrary();
    }

    async clearCache(): Promise<boolean> {
        return await libraryDataService.clearCache();
    }

    async getPlaylists(): Promise<Playlist[]> {
        return await libraryDataService.getPlaylists();
    }

    async createPlaylist(name: string, description = ''): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        return await libraryDataService.createPlaylist(name, description);
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        return await libraryDataService.deletePlaylist(playlistId);
    }

    async renamePlaylist(playlistId: string, newName: string): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        return await libraryDataService.renamePlaylist(playlistId, newName);
    }

    async addToPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryDataService.addToPlaylist(playlistId, trackIds);
    }

    async removeTrack(trackFileId: string): Promise<Result> {
        return await libraryDataService.removeTrack(trackFileId);
    }

    async removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryDataService.removeFromPlaylist(playlistId, trackIds);
    }

    async getTracksByDrive(driveId: string): Promise<Track[]> {
        return await libraryDataService.getTracksByDrive(driveId);
    }

    async removeTracksByDrive(driveId: string): Promise<Result> {
        return await libraryDataService.removeTracksByDrive(driveId);
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return await libraryDataService.scanNetworkDrive(driveId, relativePath);
    }

    async scanSingleFile(networkPath: string): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return await libraryDataService.scanSingleFile(networkPath);
    }

    async scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}> {
        return await libraryDataService.scanDirectoryForFiles(path);
    }

    async addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return await libraryDataService.addTrackToLibrary(audioFile);
    }

    async getPlaylistDetail(playlistId: string): Promise<{success: boolean; playlist?: Playlist; tracks?: Track[]; error?: string}> {
        return await libraryDataService.getPlaylistDetail(playlistId);
    }

    async getTracksByAlbum(albumId: string): Promise<Track[]> {
        return await libraryDataService.getTracksByAlbum(albumId);
    }

    async getTracksByArtist(artistId: string): Promise<Track[]> {
        return await libraryDataService.getTracksByArtist(artistId);
    }

    async getFavoriteTracks(): Promise<Track[]> {
        return await libraryDataService.getFavoriteTracks();
    }

    async getTracksByGenre(genre: string): Promise<Track[]> {
        return await libraryDataService.getTracksByGenre(genre);
    }

    async getTracksByYear(year: number): Promise<Track[]> {
        return await libraryDataService.getTracksByYear(year);
    }

    async getRecentlyAddedTracks(limit: number = 50): Promise<Track[]> {
        return await libraryDataService.getRecentlyAddedTracks(limit);
    }

    async getRecentlyPlayedTracks(limit: number = 50): Promise<Track[]> {
        return await libraryDataService.getRecentlyPlayedTracks(limit);
    }

    async getMostPlayedTracks(limit: number = 50): Promise<Track[]> {
        return await libraryDataService.getMostPlayedTracks(limit);
    }
}

export const libraryAPI = new LibraryAPI();
