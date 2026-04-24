import {ElectronNamespaceAdapter} from './ElectronBridge';

class ElectronLibraryAdapter extends ElectronNamespaceAdapter {
    constructor() {
        super('library');
    }

    scanDirectory(path) {
        return this.call('scanDirectory', path);
    }

    scanNetworkDrive(driveId, relativePath) {
        return this.call('scanNetworkDrive', driveId, relativePath);
    }

    addTrackToLibrary(audioFile) {
        return this.call('addTrackToLibrary', audioFile);
    }

    loadCachedTracks() {
        return this.call('loadCachedTracks');
    }

    validateCache() {
        return this.call('validateCache');
    }

    clearCache() {
        return this.call('clearCache');
    }

    updatePlaylistCover(playlistId, imagePath) {
        return this.call('updatePlaylistCover', playlistId, imagePath);
    }

    getPlaylistCover(playlistId) {
        return this.call('getPlaylistCover', playlistId);
    }

    removePlaylistCover(playlistId) {
        return this.call('removePlaylistCover', playlistId);
    }

    removeTrack(fileId) {
        return this.call('removeTrack', fileId);
    }

    onLibraryUpdated(handler) {
        return this.on('onLibraryUpdated', handler);
    }

    onScanProgress(handler) {
        return this.on('onScanProgress', handler);
    }

    onCacheValidationProgress(handler) {
        return this.on('onCacheValidationProgress', handler);
    }
}

export const electronLibraryAdapter = new ElectronLibraryAdapter();

