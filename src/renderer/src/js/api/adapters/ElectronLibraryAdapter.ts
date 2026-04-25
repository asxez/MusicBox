import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Result, Unsubscribe} from "@api/types/common";
import type {CacheValidationResult, ScanProgress} from "@api/types/events";
import type {ElectronLibraryAPI} from "@api/types/electron";
import type {Track} from "@api/types/track";

class ElectronLibraryAdapter extends ElectronNamespaceAdapter<'library'> {
    constructor() {
        super('library');
    }

    scanDirectory(path: string): ReturnType<ElectronLibraryAPI['scanDirectory']> {
        return this.call('scanDirectory', path);
    }

    scanNetworkDrive(driveId: string | number, relativePath: string): ReturnType<ElectronLibraryAPI['scanNetworkDrive']> {
        return this.call('scanNetworkDrive', driveId, relativePath);
    }

    addTrackToLibrary(audioFile: Partial<Track> | unknown): ReturnType<ElectronLibraryAPI['addTrackToLibrary']> {
        return this.call('addTrackToLibrary', audioFile);
    }

    loadCachedTracks(): ReturnType<ElectronLibraryAPI['loadCachedTracks']> {
        return this.call('loadCachedTracks');
    }

    validateCache(): Promise<CacheValidationResult> {
        return this.call('validateCache');
    }

    clearCache(): ReturnType<ElectronLibraryAPI['clearCache']> {
        return this.call('clearCache');
    }

    updatePlaylistCover(playlistId: string, imagePath: string): ReturnType<ElectronLibraryAPI['updatePlaylistCover']> {
        return this.call('updatePlaylistCover', playlistId, imagePath);
    }

    getPlaylistCover(playlistId: string): ReturnType<ElectronLibraryAPI['getPlaylistCover']> {
        return this.call('getPlaylistCover', playlistId);
    }

    removePlaylistCover(playlistId: string): ReturnType<ElectronLibraryAPI['removePlaylistCover']> {
        return this.call('removePlaylistCover', playlistId);
    }

    removeTrack(fileId: string): Promise<Result> {
        return this.call('removeTrack', fileId);
    }

    onLibraryUpdated(handler: (event: unknown, data: Track[]) => void): Unsubscribe {
        return this.on('onLibraryUpdated', handler);
    }

    onScanProgress(handler: (event: unknown, progress: ScanProgress) => void): Unsubscribe {
        return this.on('onScanProgress', handler);
    }

    onCacheValidationProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return this.on('onCacheValidationProgress', handler);
    }
}

export const electronLibraryAdapter = new ElectronLibraryAdapter();

