/**
 * 音乐库 API
 * 提供音乐库的查询、搜索、元数据管理等功能
 */


import {BaseAPI, Validator} from "@api/core";
import {libraryGateway} from "@js/infrastructure/electron";
import {CacheStatistics, GetTracksOptions, Playlist, Result, Track} from "@api/types";

/**
 * 音乐库 API 类
 */
export class LibraryAPI extends BaseAPI {
    constructor() {
        super('LibraryAPI');
    }

    /**
     * 获取所有音乐
     * @param options - 查询选项
     * @returns 音乐列表
     */
    async getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return this.wrapIPC(async () => {
            const tracks = await libraryGateway.getTracks(options);
            return tracks || [];
        }, 'library.getTracks', []);
    }

    /**
     * 搜索音乐库
     * @param query - 搜索关键词
     * @returns 搜索结果
     */
    async searchLibrary(query: string): Promise<Track[]> {
        Validator.assertString(query, 'query');

        return this.wrapIPC(async () => {
            const results = await libraryGateway.search(query);
            return results || [];
        }, 'library.search', []);
    }

    /**
     * 获取音乐元数据
     * @param filePath - 文件路径
     * @returns 元数据
     */
    async getTrackMetadata(filePath: string): Promise<Track | null> {
        Validator.assertFilePath(filePath, 'filePath');

        return this.wrapIPC(async () => {
            const metadata = await libraryGateway.getTrackMetadata(filePath);
            return metadata || null;
        }, 'library.getTrackMetadata', null);
    }

    async updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return this.wrapIPC(
            () => libraryGateway.updateTrackMetadata(data),
            'library.updateTrackMetadata',
            {success: false, error: '更新歌曲信息失败'}
        );
    }

    /**
     * 获取缓存统计信息
     * @returns 统计信息
     */
    async getCacheStatistics(): Promise<CacheStatistics | null> {
        try {
            const stats = await this.wrapIPC(
                () => libraryGateway.getCacheStatistics(),
                'library.getCacheStatistics'
            );

            if (stats) {
                return stats;
            }
            return null;
        } catch (error) {
            this.logError('获取缓存统计失败', error as Error);
            return null;
        }
    }

    /**
     * 检查是否有缓存的音乐库
     * @returns 是否有缓存
     */
    async hasCachedLibrary(): Promise<boolean> {
        try {
            const stats = await this.getCacheStatistics();
            return stats !== null && stats.totalTracks > 0;
        } catch (error) {
            this.logError('检查缓存状态失败', error as Error);
            return false;
        }
    }

    /**
     * 清空音乐库缓存
     */
    async clearCache(): Promise<boolean> {
        return this.wrapIPC(
            () => libraryGateway.clearCache(),
            'library.clearCache'
        );
    }

    async getPlaylists(): Promise<Playlist[]> {
        return this.wrapIPC(async () => {
            const playlists = await libraryGateway.getPlaylists();
            return playlists || [];
        }, 'library.getPlaylists', []);
    }

    async createPlaylist(name: string, description = ''): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        Validator.assertNonEmptyString(name, 'name');

        return this.wrapIPC(
            () => libraryGateway.createPlaylist(name, description),
            'library.createPlaylist',
            {success: false, error: '创建歌单失败'}
        );
    }

    async renamePlaylist(playlistId: string, newName: string): Promise<{success: boolean; playlist?: Playlist; error?: string}> {
        Validator.assertNonEmptyString(playlistId, 'playlistId');
        Validator.assertNonEmptyString(newName, 'newName');

        return this.wrapIPC(
            () => libraryGateway.renamePlaylist(playlistId, newName),
            'library.renamePlaylist',
            {success: false, error: '重命名歌单失败'}
        );
    }

    async addToPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        Validator.assertNonEmptyString(playlistId, 'playlistId');

        return this.wrapIPC(
            () => libraryGateway.addToPlaylist(playlistId, trackIds),
            'library.addToPlaylist',
            {success: false, error: '添加到歌单失败'}
        );
    }

    async removeTrack(trackFileId: string): Promise<Result> {
        Validator.assertNonEmptyString(trackFileId, 'trackFileId');

        return this.wrapIPC(
            () => libraryGateway.removeTrack(trackFileId),
            'library.removeTrack',
            {success: false, error: '删除歌曲失败'}
        );
    }

    async removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        Validator.assertNonEmptyString(playlistId, 'playlistId');

        return this.wrapIPC(
            () => libraryGateway.removeFromPlaylist(playlistId, trackIds),
            'library.removeFromPlaylist',
            {success: false, error: '从歌单移除失败'}
        );
    }

    async getTracksByDrive(driveId: string): Promise<Track[]> {
        Validator.assertNonEmptyString(driveId, 'driveId');

        return this.wrapIPC(async () => {
            const tracks = await libraryGateway.getTracksByDrive(driveId);
            return tracks || [];
        }, 'library.getTracksByDrive', []);
    }

    async removeTracksByDrive(driveId: string): Promise<Result> {
        Validator.assertNonEmptyString(driveId, 'driveId');

        return this.wrapIPC(
            () => libraryGateway.removeTracksByDrive(driveId),
            'library.removeTracksByDrive',
            {success: false, error: '移除网络磁盘音乐失败'}
        );
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return this.wrapIPC(
            () => libraryGateway.scanNetworkDrive(driveId, relativePath),
            'library.scanNetworkDrive',
            false
        );
    }

    async scanSingleFile(networkPath: string): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        Validator.assertNonEmptyString(networkPath, 'networkPath');

        return this.wrapIPC(
            () => libraryGateway.scanSingleFile(networkPath),
            'library.scanSingleFile',
            {success: false, error: '扫描单个文件失败'}
        );
    }

    async scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}> {
        Validator.assertNonEmptyString(path, 'path');

        return this.wrapIPC(
            () => libraryGateway.scanDirectoryForFiles(path),
            'library.scanDirectoryForFiles',
            {success: false, files: [], error: '扫描目录失败'}
        );
    }

    async addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        return this.wrapIPC(
            () => libraryGateway.addTrackToLibrary(audioFile),
            'library.addTrackToLibrary',
            {success: false, error: '添加歌曲到音乐库失败'}
        );
    }

    async getPlaylistDetail(playlistId: string): Promise<{success: boolean; playlist?: Playlist; tracks?: Track[]; error?: string}> {
        Validator.assertNonEmptyString(playlistId, 'playlistId');

        return this.wrapIPC(
            () => libraryGateway.getPlaylistDetail(playlistId),
            'library.getPlaylistDetail',
            {success: false, error: '获取歌单详情失败'}
        );
    }

    /**
     * 根据专辑ID获取音乐
     * @param albumId - 专辑ID
     * @returns 音乐列表
     */
    async getTracksByAlbum(albumId: string): Promise<Track[]> {
        Validator.assertNonEmptyString(albumId, 'albumId');

        return this.getTracks({albumId});
    }

    /**
     * 根据艺术家ID获取音乐
     * @param artistId - 艺术家ID
     * @returns 音乐列表
     */
    async getTracksByArtist(artistId: string): Promise<Track[]> {
        Validator.assertNonEmptyString(artistId, 'artistId');

        return this.getTracks({artistId});
    }

    /**
     * 获取收藏的音乐
     * @returns 收藏音乐列表
     */
    async getFavoriteTracks(): Promise<Track[]> {
        return this.getTracks({favorite: true});
    }

    /**
     * 根据流派获取音乐
     * @param genre - 流派
     * @returns 音乐列表
     */
    async getTracksByGenre(genre: string): Promise<Track[]> {
        Validator.assertNonEmptyString(genre, 'genre');

        return this.getTracks({genre});
    }

    /**
     * 根据年份获取音乐
     * @param year - 年份
     * @returns 音乐列表
     */
    async getTracksByYear(year: number): Promise<Track[]> {
        Validator.assertNumber(year, 'year');

        return this.getTracks({year});
    }

    /**
     * 获取最近添加的音乐
     * @param limit - 数量限制
     * @returns 音乐列表
     */
    async getRecentlyAddedTracks(limit: number = 50): Promise<Track[]> {
        Validator.assertNumber(limit, 'limit');

        const tracks = await this.getTracks();
        return tracks
            .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
            .slice(0, limit);
    }

    /**
     * 获取最近播放的音乐
     * @param limit - 数量限制
     * @returns 音乐列表
     */
    async getRecentlyPlayedTracks(limit: number = 50): Promise<Track[]> {
        Validator.assertNumber(limit, 'limit');

        const tracks = await this.getTracks();
        return tracks
            .filter(track => track.lastPlayedAt)
            .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
            .slice(0, limit);
    }

    /**
     * 获取播放次数最多的音乐
     * @param limit - 数量限制
     * @returns 音乐列表
     */
    async getMostPlayedTracks(limit: number = 50): Promise<Track[]> {
        Validator.assertNumber(limit, 'limit');

        const tracks = await this.getTracks();
        return tracks
            .filter(track => track.playCount && track.playCount > 0)
            .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
            .slice(0, limit);
    }
}

export const libraryAPI = new LibraryAPI();
