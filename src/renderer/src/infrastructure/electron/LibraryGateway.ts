import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Result, Unsubscribe} from '@api/types/common';
import type {CacheStatistics, GetTracksOptions, Playlist, Track} from '@api/types/library';
import type {CacheValidationResult, ScanProgress} from '@api/types/events';

export interface PlaylistResult {
    success: boolean;
    playlist?: Playlist;
    error?: string;
}

class LibraryGateway extends ElectronNamespaceAdapter<'library'> {
    constructor() {
        super('library');
    }

    getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return this.call('getTracks', options);
    }

    scanDirectory(path: string): Promise<boolean> {
        return this.call('scanDirectory', path);
    }

    getTracksByDrive(driveId: string): Promise<Track[]> {
        return this.call('getTracksByDrive', driveId);
    }

    getPlaylists(): Promise<Playlist[]> {
        return this.call('getPlaylists');
    }

    search(query: string): Promise<Track[]> {
        return this.call('search', query);
    }

    getTrackMetadata(filePath: string): Promise<Track | null> {
        return this.call('getTrackMetadata', filePath);
    }

    getTrackPlaybackMetadata(filePath: string): Promise<Track | null> {
        return this.call('getTrackPlaybackMetadata', filePath);
    }

    updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return this.call('updateTrackMetadata', data);
    }

    getCacheStatistics(): Promise<CacheStatistics | null> {
        return this.call('getCacheStatistics');
    }

    loadCachedTracks(): Promise<Track[]> {
        return this.call('loadCachedTracks');
    }

    clearCache(): Promise<boolean> {
        return this.call('clearCache');
    }

    clearIgnoreList(): Promise<Result> {
        return this.call('clearIgnoreList');
    }

    createPlaylist(name: string, description = ''): Promise<PlaylistResult> {
        return this.call('createPlaylist', name, description);
    }

    deletePlaylist(playlistId: string): Promise<Result> {
        return this.call('deletePlaylist', playlistId);
    }

    renamePlaylist(playlistId: string, newName: string): Promise<PlaylistResult> {
        return this.call('renamePlaylist', playlistId, newName);
    }

    addToPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return this.call('addToPlaylist', playlistId, trackIds);
    }

    addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return this.call('addTrackToLibrary', audioFile);
    }

    removeTrack(trackFileId: string): Promise<Result> {
        return this.call('removeTrack', trackFileId);
    }

    removeTracksByDrive(driveId: string): Promise<Result> {
        return this.call('removeTracksByDrive', driveId);
    }

    scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return this.call('scanNetworkDrive', driveId, relativePath);
    }

    scanSingleFile(networkPath: string): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return this.call('scanSingleFile', networkPath);
    }

    scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}> {
        return this.call('scanDirectoryForFiles', path);
    }

    removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        return this.call('removeFromPlaylist', playlistId, trackIds);
    }

    getPlaylistDetail(playlistId: string): Promise<{success: boolean; playlist?: Playlist; tracks?: Track[]; error?: string}> {
        return this.call('getPlaylistDetail', playlistId);
    }

    updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        return this.call('updatePlaylistCover', playlistId, imagePath);
    }

    getPlaylistCover(playlistId: string): Promise<{success: boolean; coverPath?: string; error?: string}> {
        return this.call('getPlaylistCover', playlistId);
    }

    removePlaylistCover(playlistId: string): Promise<Result> {
        return this.call('removePlaylistCover', playlistId);
    }

    validateCache(): Promise<CacheValidationResult> {
        return this.call('validateCache');
    }

    onLibraryUpdated(handler: (tracks: Track[]) => void): Unsubscribe {
        return this.on('onLibraryUpdated', (_event: unknown, tracks: Track[]) => handler(tracks));
    }

    onScanProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return this.on('onScanProgress', (_event: unknown, progress: ScanProgress) => handler(progress));
    }

    onCacheValidationProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return this.on('onCacheValidationProgress', handler);
    }

    onCoverUpdated(handler: (data: unknown) => void): Unsubscribe {
        return this.on('onCoverUpdated', handler);
    }
}

export const libraryGateway = new LibraryGateway();
