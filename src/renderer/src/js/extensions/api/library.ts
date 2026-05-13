/**
 * Library API - 音乐库管理 API
 * 提供音乐库的增删改查、搜索、播放列表管理等功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotAvailableError} from '@extensions/api/common/errors';
import {extensionHostService} from "@services/plugins/ExtensionHostService";
import {ExtensionContext} from "@extensions/core";
import {Album, Artist, LibraryAPI, Playlist} from "@extensions/api/types/library";
import {Track} from "@extensions/api/types/player";

/**
 * 创建音乐库 API
 * @param _context - 扩展上下文
 * @returns 音乐库 API 实例
 */
export function createLibraryAPI(_context: ExtensionContext): LibraryAPI {
    return {
        getAllTracks(): Track[] {
            return ErrorUtils.wrapSync(() => {
                return extensionHostService.getLibraryTracks() as Track[];
            }, 'library.getAllTracks');
        },

        getTrackById(trackId: string): Track | null {
            Validator.assertNonEmptyString(trackId, 'trackId');

            return ErrorUtils.wrapSync(() => {
                return extensionHostService.getTrackById(trackId) as Track | null;
            }, 'library.getTrackById');
        },

        async searchTracks(query: string): Promise<Track[]> {
            Validator.assertString(query, 'query');

            return await ErrorUtils.wrapAsync(async () => {
                return await extensionHostService.searchTracks(query) as Track[];
            }, 'library.searchTracks');
        },

        async addTrack(track: Track): Promise<boolean> {
            Validator.assertObject(track, 'track');

            return ErrorUtils.wrapAsync(async () => {
                try {
                    await extensionHostService.addTrack(track);
                    return true;
                } catch (_error) {
                    throw new NotAvailableError('library.addTrack', 'API 未实现');
                }
            }, 'library.addTrack');
        },

        async removeTrack(track: string, index: number): Promise<void> {
            Validator.assertNonEmptyString(track, 'track');
            Validator.assertType(index, 'number', 'index');

            return ErrorUtils.wrapAsync(async () => {
                await extensionHostService.removeTrack(track, index);
            }, 'library.removeTrack');
        },

        async updateTrack(trackId: string, updates: Partial<Track>): Promise<boolean> {
            Validator.assertNonEmptyString(trackId, 'trackId');
            Validator.assertObject(updates, 'updates');

            return ErrorUtils.wrapAsync(async () => {
                return extensionHostService.updateTrack(trackId, updates);
            }, 'library.updateTrack');
        },

        getAlbums(): Album[] {
            return ErrorUtils.wrapSync(() => {
                return extensionHostService.getAlbums() as Album[];
            }, 'library.getAlbums');
        },

        getAlbumByName(albumName: string): Album | null {
            Validator.assertNonEmptyString(albumName, 'albumName');

            return ErrorUtils.wrapSync(() => {
                const albums = this.getAlbums();
                return albums.find((album: Album) => album.name === albumName) || null;
            }, 'library.getAlbumByName');
        },

        getArtists(): Artist[] {
            return ErrorUtils.wrapSync(() => {
                return extensionHostService.getArtists() as Artist[];
            }, 'library.getArtists');
        },

        getArtistByName(artistName: string): Artist | null {
            Validator.assertNonEmptyString(artistName, 'artistName');

            return ErrorUtils.wrapSync(() => {
                const artists = this.getArtists();
                return artists.find((artist: Artist) => artist.name === artistName) || null;
            }, 'library.getArtistByName');
        },

        getPlaylists(): Playlist[] {
            return ErrorUtils.wrapSync(() => {
                return extensionHostService.getPlaylists() as Playlist[];
            }, 'library.getPlaylists');
        },

        getPlaylistById(playlistId: string): Playlist | null {
            Validator.assertNonEmptyString(playlistId, 'playlistId');

            return ErrorUtils.wrapSync(() => {
                const playlists = this.getPlaylists();
                return playlists.find((pl: Playlist) => pl.id === playlistId) || null;
            }, 'library.getPlaylistById');
        },

        async createPlaylist(name: string, tracks: Track[] = []): Promise<Playlist> {
            Validator.assertNonEmptyString(name, 'name');
            Validator.assertArray(tracks, 'tracks');

            return ErrorUtils.wrapAsync(async () => {
                const playlist: Playlist = {
                    id: `playlist_${Date.now()}`,
                    name,
                    tracks: [...tracks],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                const playlists = this.getPlaylists();
                playlists.push(playlist);

                extensionHostService.savePlaylists(playlists);

                return playlist;
            }, 'library.createPlaylist');
        },

        async updatePlaylist(playlistId: string, updates: Partial<Playlist>): Promise<boolean> {
            Validator.assertNonEmptyString(playlistId, 'playlistId');
            Validator.assertObject(updates, 'updates');

            return ErrorUtils.wrapAsync(async () => {
                const playlists = this.getPlaylists();
                const playlist = playlists.find((pl: Playlist) => pl.id === playlistId);

                if (playlist) {
                    Object.assign(playlist, updates);
                    playlist.updatedAt = Date.now();

                    extensionHostService.savePlaylists(playlists);
                    return true;
                }
                return false;
            }, 'library.updatePlaylist');
        },

        async deletePlaylist(playlistId: string): Promise<boolean> {
            Validator.assertNonEmptyString(playlistId, 'playlistId');

            return ErrorUtils.wrapAsync(async () => {
                const playlists = this.getPlaylists();
                const index = playlists.findIndex((pl: Playlist) => pl.id === playlistId);

                if (index !== -1) {
                    playlists.splice(index, 1);

                    extensionHostService.savePlaylists(playlists);
                    return true;
                }
                return false;
            }, 'library.deletePlaylist');
        }
    };
}
