import {api} from "@api/api";
import {app} from "@core/app";
import {libraryAPI} from "@js/api";
import {cacheManager} from "@services/CacheManager";
import type {Track as ApiTrack} from "@api/types/track";

type AppEventHandler = (...args: any[]) => void;
type ExtensionTrack = ApiTrack & {
    fileId?: string;
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    cover?: string | null;
    path?: string;
    [key: string]: any;
};

interface ExtensionAlbum {
    name: string;
    artist: string;
    cover: string | null;
    tracks: ExtensionTrack[];
}

interface ExtensionArtist {
    name: string;
    tracks: ExtensionTrack[];
}

interface ExtensionPlaylist {
    id: string;
    name: string;
    tracks: ExtensionTrack[];
    createdAt: number;
    updatedAt: number;
    [key: string]: any;
}

class ExtensionHostService {
    on(eventName: string, callback: AppEventHandler): void {
        app.on(eventName, callback);
    }

    off(eventName: string, callback: AppEventHandler): void {
        app.off(eventName, callback);
    }

    emit(eventName: string, data?: any): void {
        app.emit(eventName, data);
    }

    removeAllListeners(eventName?: string): void {
        app.removeAllListeners(eventName);
    }

    getLibraryTracks(): ExtensionTrack[] {
        return [...(app.library || [])] as ExtensionTrack[];
    }

    getTrackById(trackId: string): ExtensionTrack | null {
        return this.getLibraryTracks().find((track) => (
            track.fileId === trackId || track.id === trackId
        )) || null;
    }

    async searchTracks(query: string): Promise<ExtensionTrack[]> {
        if (typeof libraryAPI.searchLibrary === 'function') {
            return await libraryAPI.searchLibrary(query) as ExtensionTrack[];
        }

        const lowerQuery = query.toLowerCase();
        return this.getLibraryTracks().filter((track) => (
            track.title?.toLowerCase().includes(lowerQuery) ||
            track.artist?.toLowerCase().includes(lowerQuery) ||
            track.album?.toLowerCase().includes(lowerQuery)
        ));
    }

    async addTrack(track: ExtensionTrack): Promise<void> {
        await api.addTrackToLibrary(track);
    }

    async removeTrack(trackId: string, index: number): Promise<void> {
        const track = this.getTrackById(trackId) || this.getLibraryTracks()[index] || ({id: trackId} as ExtensionTrack);
        await app.handleDeleteTrack(track, index);
    }

    updateTrack(trackId: string, updates: Partial<ExtensionTrack>): boolean {
        const track = this.getTrackById(trackId);
        if (!track) {
            return false;
        }

        Object.assign(track, updates);
        app.emit('libraryUpdated');
        return true;
    }

    getAlbums(): ExtensionAlbum[] {
        const albumsMap = new Map<string, ExtensionAlbum>();

        this.getLibraryTracks().forEach((track) => {
            if (!track.album) {
                return;
            }

            if (!albumsMap.has(track.album)) {
                albumsMap.set(track.album, {
                    name: track.album,
                    artist: track.artist || '未知艺术家',
                    cover: track.cover || null,
                    tracks: []
                });
            }

            albumsMap.get(track.album)!.tracks.push(track);
        });

        return Array.from(albumsMap.values());
    }

    getArtists(): ExtensionArtist[] {
        const artistsMap = new Map<string, ExtensionArtist>();

        this.getLibraryTracks().forEach((track) => {
            const artistName = track.artist || '未知艺术家';
            if (!artistsMap.has(artistName)) {
                artistsMap.set(artistName, {
                    name: artistName,
                    tracks: []
                });
            }

            artistsMap.get(artistName)!.tracks.push(track);
        });

        return Array.from(artistsMap.values());
    }

    getPlaylists(): ExtensionPlaylist[] {
        return cacheManager.getLocalCache('playlists') || [];
    }

    savePlaylists(playlists: ExtensionPlaylist[]): void {
        cacheManager.setLocalCache('playlists', playlists);
    }

    navigateToView(viewId: string): void {
        const navigation = app.components.navigation;
        if (!navigation) {
            throw new Error('导航组件不可用');
        }

        navigation.navigateToView(viewId);
    }

    getCurrentView(): string | null {
        return app.currentView || null;
    }

    async loadAndPlayFile(filePath: string): Promise<void> {
        if (typeof app.loadAndPlayFile !== 'function') {
            throw new Error('app 未初始化');
        }

        await app.loadAndPlayFile(filePath);
    }

    getPlaybackContext(): {isPlaying: boolean; currentTrack: ExtensionTrack | null} {
        return {
            isPlaying: api.isPlaying || false,
            currentTrack: (api.currentTrack || null) as ExtensionTrack | null
        };
    }
}

export const extensionHostService = new ExtensionHostService();
