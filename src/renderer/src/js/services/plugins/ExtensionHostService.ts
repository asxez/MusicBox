import {api} from "@api/api";
import {libraryAPI} from "@api/modules";
import {cacheManager} from "@services/CacheManager";
import type {Track as ApiTrack} from "@api/types/track";
import type {RendererAppContext} from "@core/types/app";

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
    private app: RendererAppContext | null = null;

    bindApp(app: RendererAppContext): void {
        this.app = app;
    }

    on(eventName: string, callback: AppEventHandler): void {
        this.requireApp().on(eventName, callback);
    }

    off(eventName: string, callback: AppEventHandler): void {
        this.requireApp().off(eventName, callback);
    }

    emit(eventName: string, data?: any): void {
        this.requireApp().emit(eventName, data);
    }

    removeAllListeners(eventName?: string): void {
        this.requireApp().removeAllListeners(eventName);
    }

    getLibraryTracks(): ExtensionTrack[] {
        const app = this.requireApp();
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

    async addTrack(track: unknown): Promise<void> {
        await api.addTrackToLibrary(track as ExtensionTrack);
    }

    async removeTrack(trackId: string, index: number): Promise<void> {
        const track = this.getTrackById(trackId) || this.getLibraryTracks()[index] || ({id: trackId} as ExtensionTrack);
        await this.requireApp().handleDeleteTrack(track, index);
    }

    updateTrack(trackId: string, updates: Record<string, unknown>): boolean {
        const track = this.getTrackById(trackId);
        if (!track) {
            return false;
        }

        Object.assign(track, updates);
        this.requireApp().emit('libraryUpdated');
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

    savePlaylists(playlists: unknown[]): void {
        cacheManager.setLocalCache('playlists', playlists);
    }

    navigateToView(viewId: string): void {
        const app = this.requireApp();
        const navigation = app.components.navigation;
        if (!navigation) {
            throw new Error('导航组件不可用');
        }

        navigation.navigateToView(viewId);
    }

    getCurrentView(): string | null {
        const app = this.requireApp();
        return app.currentView || null;
    }

    async loadAndPlayFile(filePath: string): Promise<void> {
        const app = this.requireApp();
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

    private requireApp(): RendererAppContext {
        if (!this.app) {
            throw new Error('插件宿主服务尚未绑定 App 上下文');
        }

        return this.app;
    }
}

export const extensionHostService = new ExtensionHostService();
