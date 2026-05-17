import type {Result} from '@api/types/common';
import type {CacheValidationResult, ScanProgress} from '@api/types/events';
import type {CacheStatistics, GetTracksOptions, Playlist} from '@api/types/library';
import type {Track} from '@api/types/library';
import {libraryService} from './service';
import type {AddTrackResult, PlaylistCoverResult} from './service';

type LibraryUpdatedHandler = (tracks: Track[]) => void | Promise<void>;
type ScanProgressHandler = (progress: ScanProgress) => void;
type CoverUpdatedHandler = (data: unknown) => void | Promise<void>;
type Unsubscribe = () => void;

class LibraryController {
    async getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return await libraryService.getTracks(options);
    }

    async hasCachedLibrary(): Promise<boolean> {
        return await libraryService.hasCachedLibrary();
    }

    async loadCachedTracks(): Promise<Track[]> {
        return await libraryService.loadCachedTracks();
    }

    async getCacheStatistics(): Promise<CacheStatistics | null> {
        return await libraryService.getCacheStatistics();
    }

    async searchLibrary(query: string): Promise<Track[]> {
        return await libraryService.searchLibrary(query);
    }

    async scanDirectory(directoryPath: string): Promise<boolean> {
        return await libraryService.scanDirectory(directoryPath);
    }

    onLibraryUpdated(handler: LibraryUpdatedHandler): Unsubscribe {
        return libraryService.onLibraryUpdated(handler);
    }

    onScanProgress(handler: ScanProgressHandler): Unsubscribe {
        return libraryService.onScanProgress(handler);
    }

    onCoverUpdated(handler: CoverUpdatedHandler): Unsubscribe {
        return libraryService.onCoverUpdated(handler);
    }

    async getTrackMetadata(filePath: string): Promise<Partial<Track> | null> {
        return await libraryService.getTrackMetadata(filePath);
    }

    async addTrackToLibrary(track: Partial<Track> | unknown): Promise<AddTrackResult> {
        return await libraryService.addTrackToLibrary(track);
    }

    async removeTrack(trackFileId: string): Promise<Result> {
        return await libraryService.removeTrack(trackFileId);
    }

    async validateCache(): Promise<CacheValidationResult | null> {
        return await libraryService.validateCache();
    }

    async clearCache(): Promise<boolean> {
        return await libraryService.clearCache();
    }

    async clearIgnoreList(): Promise<Result> {
        return await libraryService.clearIgnoreList();
    }

    emitLibraryUpdated(tracks?: Track[]): void {
        libraryService.emitLibraryUpdated(tracks);
    }

    async getPlaylists(): Promise<Playlist[]> {
        return await libraryService.getPlaylists();
    }

    async createPlaylist(name: string, description = ''): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        return await libraryService.createPlaylist(name, description);
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        return await libraryService.deletePlaylist(playlistId);
    }

    async renamePlaylist(playlistId: string, newName: string): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        return await libraryService.renamePlaylist(playlistId, newName);
    }

    async addToPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryService.addToPlaylist(playlistId, trackIds);
    }

    async removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryService.removeFromPlaylist(playlistId, trackIds);
    }

    async getPlaylistDetail(playlistId: string): Promise<{success: boolean; playlist?: Playlist; tracks?: Track[]; error?: string}> {
        return await libraryService.getPlaylistDetail(playlistId);
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return await libraryService.scanNetworkDrive(driveId, relativePath);
    }

    async scanSingleFile(networkPath: string): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return await libraryService.scanSingleFile(networkPath);
    }

    async scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}> {
        return await libraryService.scanDirectoryForFiles(path);
    }

    async getTracksByDrive(driveId: string): Promise<Track[]> {
        return await libraryService.getTracksByDrive(driveId);
    }

    async removeTracksByDrive(driveId: string): Promise<Result> {
        return await libraryService.removeTracksByDrive(driveId);
    }

    async updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return await libraryService.updateTrackMetadata(data);
    }

    async getPlaylistCover(playlistId: string): Promise<PlaylistCoverResult> {
        return await libraryService.getPlaylistCover(playlistId);
    }

    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        return await libraryService.updatePlaylistCover(playlistId, imagePath);
    }

    async removePlaylistCover(playlistId: string): Promise<Result> {
        return await libraryService.removePlaylistCover(playlistId);
    }
}

export const libraryController = new LibraryController();
export {LibraryController};
