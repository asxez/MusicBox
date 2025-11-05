/**
 * Library API - 音乐库管理 API
 * 提供音乐库的增删改查、搜索、播放列表管理等功能
 */

import {Validator} from './common/validation.js';
import {NotAvailableError, ErrorUtils} from './common/errors.js';
import {cacheManager} from '@js/cache-manager';
import {app} from '@js/app';

/**
 * 创建音乐库 API
 * @param {Object} context - 扩展上下文
 * @returns {LibraryAPI} 音乐库 API 实例
 */
export function createLibraryAPI(context) {
    return {
        /**
         * 获取所有歌曲
         * @returns {Array<Object>} 歌曲列表
         */
        getAllTracks() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.library) {
                    return [...app.library];
                }
                return [];
            }, 'library.getAllTracks');
        },

        /**
         * 根据 ID 获取歌曲
         * @param {string} trackId - 歌曲 ID
         * @returns {Object|null} 歌曲对象
         */
        getTrackById(trackId) {
            Validator.assertNonEmptyString(trackId, 'trackId');

            return ErrorUtils.wrapSync(() => {
                if (app && app.library) {
                    return app.library.find(track =>
                        track.fileId === trackId || track.id === trackId
                    ) || null;
                }
                return null;
            }, 'library.getTrackById');
        },

        /**
         * 搜索歌曲
         * @param {string} query - 搜索关键词
         * @returns {Array<Object>} 搜索结果
         */
        searchTracks(query) {
            Validator.assertString(query, 'query');

            return ErrorUtils.wrapSync(() => {
                if (app && typeof app.searchLibrary === 'function') {
                    return app.searchLibrary(query);
                }
                // 简单的本地搜索实现
                if (app && app.library) {
                    const lowerQuery = query.toLowerCase();
                    return app.library.filter(track => {
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

        /**
         * 添加歌曲到库
         * @param {Object} track - 歌曲对象
         * @returns {Promise<boolean>} 是否成功
         */
        async addTrack(track) {
            Validator.assertObject(track, 'track');

            return ErrorUtils.wrapAsync(async () => {
                if (app && typeof app.addTrackToLibrary === 'function') {
                    await app.addTrackToLibrary(track);
                    return true;
                }
                throw new NotAvailableError('library.addTrack', 'API 未实现');
            }, 'library.addTrack');
        },

        /**
         * 从库中移除歌曲
         * @param {string} trackId - 歌曲 ID
         * @returns {Promise<boolean>} 是否成功
         */
        async removeTrack(trackId) {
            Validator.assertNonEmptyString(trackId, 'trackId');

            return ErrorUtils.wrapAsync(async () => {
                if (app && typeof app.removeTrackFromLibrary === 'function') {
                    await app.removeTrackFromLibrary(trackId);
                    return true;
                }
                throw new NotAvailableError('library.removeTrack', 'API 未实现');
            }, 'library.removeTrack');
        },

        /**
         * 更新歌曲信息
         * @param {string} trackId - 歌曲 ID
         * @param {Object} updates - 更新的字段
         * @returns {Promise<boolean>} 是否成功
         */
        async updateTrack(trackId, updates) {
            Validator.assertNonEmptyString(trackId, 'trackId');
            Validator.assertObject(updates, 'updates');

            return ErrorUtils.wrapAsync(async () => {
                if (app && app.library) {
                    const track = app.library.find(t =>
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

        /**
         * 获取所有专辑
         * @returns {Array<Object>} 专辑列表
         */
        getAlbums() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.library) {
                    const albumsMap = new Map();
                    app.library.forEach(track => {
                        if (track.album) {
                            if (!albumsMap.has(track.album)) {
                                albumsMap.set(track.album, {
                                    name: track.album,
                                    artist: track.artist || '未知艺术家',
                                    cover: track.cover || null,
                                    tracks: []
                                });
                            }
                            albumsMap.get(track.album).tracks.push(track);
                        }
                    });
                    return Array.from(albumsMap.values());
                }
                return [];
            }, 'library.getAlbums');
        },

        /**
         * 根据名称获取专辑
         * @param {string} albumName - 专辑名称
         * @returns {Object|null} 专辑对象
         */
        getAlbumByName(albumName) {
            Validator.assertNonEmptyString(albumName, 'albumName');

            return ErrorUtils.wrapSync(() => {
                const albums = this.getAlbums();
                return albums.find(album => album.name === albumName) || null;
            }, 'library.getAlbumByName');
        },

        /**
         * 获取所有艺术家
         * @returns {Array<Object>} 艺术家列表
         */
        getArtists() {
            return ErrorUtils.wrapSync(() => {
                if (app && app.library) {
                    const artistsMap = new Map();
                    app.library.forEach(track => {
                        const artistName = track.artist || '未知艺术家';
                        if (!artistsMap.has(artistName)) {
                            artistsMap.set(artistName, {
                                name: artistName,
                                tracks: []
                            });
                        }
                        artistsMap.get(artistName).tracks.push(track);
                    });
                    return Array.from(artistsMap.values());
                }
                return [];
            }, 'library.getArtists');
        },

        /**
         * 根据名称获取艺术家
         * @param {string} artistName - 艺术家名称
         * @returns {Object|null} 艺术家对象
         */
        getArtistByName(artistName) {
            Validator.assertNonEmptyString(artistName, 'artistName');

            return ErrorUtils.wrapSync(() => {
                const artists = this.getArtists();
                return artists.find(artist => artist.name === artistName) || null;
            }, 'library.getArtistByName');
        },

        /**
         * 获取所有播放列表
         * @returns {Array<Object>} 播放列表
         */
        getPlaylists() {
            return ErrorUtils.wrapSync(() => {
                if (cacheManager && typeof cacheManager.getLocalCache === 'function') {
                    return cacheManager.getLocalCache('playlists') || [];
                }
                return [];
            }, 'library.getPlaylists');
        },

        /**
         * 根据 ID 获取播放列表
         * @param {string} playlistId - 播放列表 ID
         * @returns {Object|null} 播放列表对象
         */
        getPlaylistById(playlistId) {
            Validator.assertNonEmptyString(playlistId, 'playlistId');

            return ErrorUtils.wrapSync(() => {
                const playlists = this.getPlaylists();
                return playlists.find(pl => pl.id === playlistId) || null;
            }, 'library.getPlaylistById');
        },

        /**
         * 创建播放列表
         * @param {string} name - 播放列表名称
         * @param {Array<Object>} [tracks=[]] - 初始歌曲列表
         * @returns {Promise<Object>} 创建的播放列表对象
         */
        async createPlaylist(name, tracks = []) {
            Validator.assertNonEmptyString(name, 'name');
            Validator.assertArray(tracks, 'tracks');

            return ErrorUtils.wrapAsync(async () => {
                const playlist = {
                    id: `playlist_${Date.now()}`,
                    name,
                    tracks: [...tracks],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                const playlists = this.getPlaylists();
                playlists.push(playlist);

                if (cacheManager && typeof cacheManager.setLocalCache === 'function') {
                    await cacheManager.setLocalCache('playlists', playlists);
                }

                return playlist;
            }, 'library.createPlaylist');
        },

        /**
         * 更新播放列表
         * @param {string} playlistId - 播放列表 ID
         * @param {Object} updates - 更新的字段
         * @returns {Promise<boolean>} 是否成功
         */
        async updatePlaylist(playlistId, updates) {
            Validator.assertNonEmptyString(playlistId, 'playlistId');
            Validator.assertObject(updates, 'updates');

            return ErrorUtils.wrapAsync(async () => {
                const playlists = this.getPlaylists();
                const playlist = playlists.find(pl => pl.id === playlistId);

                if (playlist) {
                    Object.assign(playlist, updates);
                    playlist.updatedAt = Date.now();

                    if (cacheManager && typeof cacheManager.setLocalCache === 'function') {
                        await cacheManager.setLocalCache('playlists', playlists);
                    }
                    return true;
                }
                return false;
            }, 'library.updatePlaylist');
        },

        /**
         * 删除播放列表
         * @param {string} playlistId - 播放列表 ID
         * @returns {Promise<boolean>} 是否成功
         */
        async deletePlaylist(playlistId) {
            Validator.assertNonEmptyString(playlistId, 'playlistId');

            return ErrorUtils.wrapAsync(async () => {
                const playlists = this.getPlaylists();
                const index = playlists.findIndex(pl => pl.id === playlistId);

                if (index !== -1) {
                    playlists.splice(index, 1);

                    if (cacheManager && typeof cacheManager.setLocalCache === 'function') {
                        await cacheManager.setLocalCache('playlists', playlists);
                    }
                    return true;
                }
                return false;
            }, 'library.deletePlaylist');
        }
    };
}
