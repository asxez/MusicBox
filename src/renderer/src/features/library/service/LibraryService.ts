import type {Result} from '@api/types/common';
import type {CacheValidationResult, MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {CacheStatistics, GetTracksOptions, Playlist, Track} from '@api/types/library';
import {appEventService} from '@/features/events/service/AppEventService';
import {libraryGateway} from '@/infrastructure/electron';
import {LibraryBridge} from './LibraryBridge';
import {libraryDataService} from './LibraryDataService';

type Emit = <K extends keyof MusicBoxAPIEvents>(event: K, data: MusicBoxAPIEvents[K]) => void;
type LibraryUpdatedHandler = (tracks: Track[]) => void | Promise<void>;
type ScanProgressHandler = (progress: ScanProgress) => void;
type CoverUpdatedHandler = (data: unknown) => void | Promise<void>;
type Unsubscribe = () => void;

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

export class LibraryService {
    private readonly bridge: LibraryBridge;

    constructor() {
        this.bridge = new LibraryBridge({
            emit: ((event, data) => appEventService.emit(event, data)) as Emit
        });
    }

    async getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return await libraryDataService.getTracks(options);
    }

    async hasCachedLibrary(): Promise<boolean> {
        return await libraryDataService.hasCachedLibrary();
    }

    async loadCachedTracks(): Promise<Track[]> {
        return await this.bridge.loadCachedTracks();
    }

    async getCacheStatistics(): Promise<CacheStatistics | null> {
        return await libraryDataService.getCacheStatistics();
    }

    async searchLibrary(query: string): Promise<Track[]> {
        return await libraryDataService.searchLibrary(query);
    }

    async scanDirectory(directoryPath: string): Promise<boolean> {
        return await this.bridge.scanDirectory(directoryPath);
    }

    onLibraryUpdated(handler: LibraryUpdatedHandler): Unsubscribe {
        return libraryGateway.onLibraryUpdated(handler);
    }

    onScanProgress(handler: ScanProgressHandler): Unsubscribe {
        return libraryGateway.onScanProgress(handler);
    }

    onCoverUpdated(handler: CoverUpdatedHandler): Unsubscribe {
        return libraryGateway.onCoverUpdated(handler);
    }

    async getTrackMetadata(filePath: string): Promise<Partial<Track> | null> {
        return await libraryDataService.getTrackMetadata(filePath);
    }

    async addTrackToLibrary(track: Partial<Track> | unknown): Promise<AddTrackResult> {
        return await this.bridge.addTrackToLibrary(track) as AddTrackResult;
    }

    async removeTrack(trackFileId: string): Promise<Result> {
        return await libraryDataService.removeTrack(trackFileId);
    }

    async validateCache(): Promise<CacheValidationResult | null> {
        return await this.bridge.validateCache();
    }

    async clearCache(): Promise<boolean> {
        return await this.bridge.clearCache();
    }

    emitLibraryUpdated(tracks: Track[] = []): void {
        appEventService.emit('libraryUpdated', tracks);
    }

    async clearIgnoreList(): Promise<Result> {
        return await libraryDataService.clearIgnoreList();
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

    async removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return await libraryDataService.removeFromPlaylist(playlistId, trackIds);
    }

    async getPlaylistDetail(playlistId: string): Promise<{success: boolean; playlist?: Playlist; tracks?: Track[]; error?: string}> {
        return await libraryDataService.getPlaylistDetail(playlistId);
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return await this.bridge.scanNetworkDrive(driveId, relativePath);
    }

    async scanSingleFile(networkPath: string): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return await libraryDataService.scanSingleFile(networkPath);
    }

    async scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}> {
        return await libraryDataService.scanDirectoryForFiles(path);
    }

    async getTracksByDrive(driveId: string): Promise<Track[]> {
        return await libraryDataService.getTracksByDrive(driveId);
    }

    async removeTracksByDrive(driveId: string): Promise<Result> {
        return await libraryDataService.removeTracksByDrive(driveId);
    }

    async updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return await libraryDataService.updateTrackMetadata(data);
    }

    async getPlaylistCover(playlistId: string): Promise<PlaylistCoverResult> {
        return await this.bridge.getPlaylistCover(playlistId);
    }

    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        return await this.bridge.updatePlaylistCover(playlistId, imagePath);
    }

    async removePlaylistCover(playlistId: string): Promise<Result> {
        return await this.bridge.removePlaylistCover(playlistId);
    }
}

export const libraryService = new LibraryService();
