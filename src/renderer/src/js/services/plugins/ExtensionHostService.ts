import {cacheManager} from "@services/CacheManager";
import {libraryController} from "@js/features/library";
import {playbackController} from "@js/features/playback";
import type {Track as ApiTrack} from "@api/types/track";
import type {
    Album as ExtensionAlbum,
    Artist as ExtensionArtist,
    Playlist as ExtensionPlaylist,
    Track as ExtensionTrack
} from "@extensions/api/types/library";

type AppEventHandler = (...args: unknown[]) => void;
type HostTrack = ApiTrack & ExtensionTrack & {
    fileId?: string;
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    cover?: string | null;
    path?: string;
};

interface ExtensionHostApp {
    components: {
        navigation?: {navigateToView(viewId: string): void} | null;
    };
    currentView: string;
    library: ApiTrack[];
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    removeAllListeners(event?: string): void;
    handleDeleteTrack(track: ApiTrack, index: number): Promise<void>;
    loadAndPlayFile?(filePath: string): Promise<void>;
}

class ExtensionHostService {
    private app: ExtensionHostApp | null = null;

    bindApp(app: ExtensionHostApp): void {
        this.app = app;
    }

    on(eventName: string, callback: AppEventHandler): void {
        this.requireApp().on(eventName, callback);
    }

    off(eventName: string, callback: AppEventHandler): void {
        this.requireApp().off(eventName, callback);
    }

    emit(eventName: string, data?: unknown): void {
        this.requireApp().emit(eventName, data);
    }

    removeAllListeners(eventName?: string): void {
        this.requireApp().removeAllListeners(eventName);
    }

    getLibraryTracks(): HostTrack[] {
        const app = this.requireApp();
        return [...(app.library || [])] as HostTrack[];
    }

    getTrackById(trackId: string): HostTrack | null {
        return this.getLibraryTracks().find((track) => (
            track.fileId === trackId || track.id === trackId
        )) || null;
    }

    async searchTracks(query: string): Promise<HostTrack[]> {
        const results = await libraryController.searchLibrary(query);
        if (results.length > 0) {
            return results as HostTrack[];
        }

        const lowerQuery = query.toLowerCase();
        return this.getLibraryTracks().filter((track) => (
            track.title?.toLowerCase().includes(lowerQuery) ||
            track.artist?.toLowerCase().includes(lowerQuery) ||
            track.album?.toLowerCase().includes(lowerQuery)
        ));
    }

    async addTrack(track: unknown): Promise<void> {
        await libraryController.addTrackToLibrary(track as HostTrack);
    }

    async removeTrack(trackId: string, index: number): Promise<void> {
        const track = this.getTrackById(trackId) || this.getLibraryTracks()[index] || ({id: trackId} as HostTrack);
        await this.requireApp().handleDeleteTrack(track, index);
    }

    updateTrack(trackId: string, updates: Partial<HostTrack>): boolean {
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

    getPlaybackContext(): {isPlaying: boolean; currentTrack: HostTrack | null} {
        return {
            isPlaying: playbackController.isPlaying(),
            currentTrack: playbackController.getCurrentTrackSnapshot() as HostTrack | null
        };
    }

    private requireApp(): ExtensionHostApp {
        if (!this.app) {
            throw new Error('插件宿主服务尚未绑定 App 上下文');
        }

        return this.app;
    }
}

export const extensionHostService = new ExtensionHostService();
