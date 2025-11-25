/**
 * Library API - 音乐库管理 API
 * 提供音乐库的增删改查、搜索、播放列表管理等功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotAvailableError} from '@extensions/api/common/errors';
import {cacheManager} from '@services/CacheManager';
import {app} from '@core/app';
import {libraryAPI} from "@js/api";
import {api} from "@api/api";
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
                if (app && app.library) {
                    return [...app.library];
                }
                return [];
            }, 'library.getAllTracks');
        },

        getTrackById(trackId: string): Track | null {
            Validator.assertNonEmptyString(trackId, 'trackId');

            return ErrorUtils.wrapSync(() => {
                if (app && app.library) {
                    return app.library.find((track: Track) =>
                        track.fileId === trackId || track.id === trackId
                    ) || null;
                }
                return null;
            }, 'library.getTrackById');
        },

        async searchTracks(query: string): Promise<Track[]> {
            Validator.assertString(query, 'query');

            return await ErrorUtils.wrapAsync(async () => {
                if (typeof libraryAPI.searchLibrary === 'function') {
                    return await libraryAPI.searchLibrary(query);
                }
                // 简单的搜索实现
                if (app.library) {
                    const lowerQuery = query.toLowerCase();
                    return app.library.filter((track: Track) => {
                        return (
                            track.title?.toLowerCase().includes(lowerQuery) ||
                            track.artist?.toLowerCase().includes(lowerQuery) ||
                            track.album?.toLowerCase().includes(lowerQuery)
                        );
                    });
                }
                return [];
            }, 'library.searchTracks');
        },

        async addTrack(track: Track): Promise<boolean> {
            Validator.assertObject(track, 'track');

            return ErrorUtils.wrapAsync(async () => {
                if (api && typeof api.addTrackToLibrary === 'function') {
                    await api.addTrackToLibrary(track);
                    return true;
                }
                throw new NotAvailableError('library.addTrack', 'API 未实现');
            }, 'library.addTrack');
        },

        async removeTrack(track: string, index: number): Promise<void> {
            Validator.assertNonEmptyString(track, 'track');
            Validator.assertType(index, 'number', 'index');

            return ErrorUtils.wrapAsync(async () => {
                await app.handleDeleteTrack(track, index);
            }, 'library.removeTrack');
        },

        async updateTrack(trackId: string, updates: Partial<Track>): Promise<boolean> {
            Validator.assertNonEmptyString(trackId, 'trackId');
            Validator.assertObject(updates, 'updates');

            return ErrorUtils.wrapAsync(async () => {
                if (app && app.library) {
                    const track = app.library.find((t: Track) =>
                        t.fileId === trackId || t.id === trackId
                    );
                    if (track) {
                        Object.assign(track, updates);
                        // 触发更新事件
                        if (app.emit) {
                            app.emit('libraryUpdated');
                        }
                        return true;
                    }
                }
                return false;
            }, 'library.updateTrack');
        },

        getAlbums(): Album[] {
            return ErrorUtils.wrapSync(() => {
                if (app && app.library) {
                    const albumsMap = new Map<string, Album>();
                    app.library.forEach((track: Track) => {
                        if (track.album) {
                            if (!albumsMap.has(track.album)) {
                                albumsMap.set(track.album, {
                                    name: track.album,
                                    artist: track.artist || '未知艺术家',
                                    cover: track.cover || null,
                                    tracks: []
                                });
                            }
                            albumsMap.get(track.album)!.tracks.push(track);
                        }
                    });
                    return Array.from(albumsMap.values());
                }
                return [];
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
                if (app && app.library) {
                    const artistsMap = new Map<string, Artist>();
                    app.library.forEach((track: Track) => {
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
                return [];
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
                if (cacheManager && typeof cacheManager.getLocalCache === 'function') {
                    return cacheManager.getLocalCache('playlists') || [];
                }
                return [];
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

                if (cacheManager && typeof cacheManager.setLocalCache === 'function') {
                    cacheManager.setLocalCache('playlists', playlists);
                }

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

                    if (cacheManager && typeof cacheManager.setLocalCache === 'function') {
                        cacheManager.setLocalCache('playlists', playlists);
                    }
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

                    if (cacheManager && typeof cacheManager.setLocalCache === 'function') {
                        cacheManager.setLocalCache('playlists', playlists);
                    }
                    return true;
                }
                return false;
            }, 'library.deletePlaylist');
        }
    };
}
