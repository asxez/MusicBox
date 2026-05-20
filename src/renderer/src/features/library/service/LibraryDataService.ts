import {libraryGateway} from '@/infrastructure/electron';
import type {Result} from '@api/types/common';
import type {CacheStatistics, GetTracksOptions, Playlist, Track} from '@api/types/library';

export type PlaylistMutationResult = {
    success: boolean;
    playlist?: Playlist;
    error?: string;
};

export type LibraryTrackMutationResult = {
    success: boolean;
    track?: Track;
    error?: string;
    isNew?: boolean;
};

export type LibraryScanDirectoryResult = {
    success: boolean;
    files: unknown[];
    error?: string;
};

export type PlaylistDetailResult = {
    success: boolean;
    playlist?: Playlist;
    tracks?: Track[];
    error?: string;
};

export type PlaylistCoverDataResult = {
    success: boolean;
    coverPath?: string;
    error?: string;
};

class LibraryInputError extends Error {
    constructor(paramName: string, expectedType: string, actualValue: unknown) {
        super(`参数 "${paramName}" 验证失败: 期望 ${expectedType}, 实际收到 ${typeof actualValue}`);
        this.name = 'LibraryInputError';
    }
}

export class LibraryDataService {
    async getTracks(options: GetTracksOptions = {}): Promise<Track[]> {
        return await this.callGateway(
            () => libraryGateway.getTracks(options),
            'library.getTracks',
            []
        );
    }

    async loadCachedTracks(): Promise<Track[]> {
        return await this.callGateway(
            () => libraryGateway.loadCachedTracks(),
            'library.loadCachedTracks',
            []
        );
    }

    async searchLibrary(query: string): Promise<Track[]> {
        this.assertString(query, 'query');

        return await this.callGateway(
            () => libraryGateway.search(query),
            'library.search',
            []
        );
    }

    async getTrackMetadata(filePath: string): Promise<Track | null> {
        this.assertFilePath(filePath, 'filePath');

        return await this.callGateway(
            () => libraryGateway.getTrackMetadata(filePath),
            'library.getTrackMetadata',
            null
        );
    }

    async updateTrackMetadata(data: unknown): Promise<Result & {updatedMetadata?: Track}> {
        return await this.callGateway(
            () => libraryGateway.updateTrackMetadata(data),
            'library.updateTrackMetadata',
            {success: false, error: '更新歌曲信息失败'}
        );
    }

    async getCacheStatistics(): Promise<CacheStatistics | null> {
        try {
            const stats = await this.callGateway(
                () => libraryGateway.getCacheStatistics(),
                'library.getCacheStatistics'
            );

            return stats || null;
        } catch (error) {
            this.logError('获取缓存统计失败', error);
            return null;
        }
    }

    async hasCachedLibrary(): Promise<boolean> {
        try {
            const stats = await this.getCacheStatistics();
            return stats !== null && stats.totalTracks > 0;
        } catch (error) {
            this.logError('检查缓存状态失败', error);
            return false;
        }
    }

    async clearCache(): Promise<boolean> {
        return await this.callGateway(
            () => libraryGateway.clearCache(),
            'library.clearCache'
        );
    }

    async clearIgnoreList(): Promise<Result> {
        return await this.callGateway(
            () => libraryGateway.clearIgnoreList(),
            'library.clearIgnoreList',
            {success: false, error: '清空忽略列表失败'}
        );
    }

    async getPlaylists(): Promise<Playlist[]> {
        return await this.callGateway(
            () => libraryGateway.getPlaylists(),
            'library.getPlaylists',
            []
        );
    }

    async createPlaylist(name: string, description = ''): Promise<PlaylistMutationResult> {
        this.assertNonEmptyString(name, 'name');

        return await this.callGateway(
            () => libraryGateway.createPlaylist(name, description),
            'library.createPlaylist',
            {success: false, error: '创建歌单失败'}
        );
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        this.assertNonEmptyString(playlistId, 'playlistId');

        return await this.callGateway(
            () => libraryGateway.deletePlaylist(playlistId),
            'library.deletePlaylist',
            {success: false, error: '删除歌单失败'}
        );
    }

    async renamePlaylist(playlistId: string, newName: string): Promise<PlaylistMutationResult> {
        this.assertNonEmptyString(playlistId, 'playlistId');
        this.assertNonEmptyString(newName, 'newName');

        return await this.callGateway(
            () => libraryGateway.renamePlaylist(playlistId, newName),
            'library.renamePlaylist',
            {success: false, error: '重命名歌单失败'}
        );
    }

    async addToPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        this.assertNonEmptyString(playlistId, 'playlistId');

        return await this.callGateway(
            () => libraryGateway.addToPlaylist(playlistId, trackIds),
            'library.addToPlaylist',
            {success: false, error: '添加到歌单失败'}
        );
    }

    async removeFromPlaylist(playlistId: string, trackIds: string | string[]): Promise<Result> {
        this.assertNonEmptyString(playlistId, 'playlistId');

        return await this.callGateway(
            () => libraryGateway.removeFromPlaylist(playlistId, trackIds),
            'library.removeFromPlaylist',
            {success: false, error: '从歌单移除失败'}
        );
    }

    async removeTrack(trackFileId: string): Promise<Result> {
        this.assertNonEmptyString(trackFileId, 'trackFileId');

        return await this.callGateway(
            () => libraryGateway.removeTrack(trackFileId),
            'library.removeTrack',
            {success: false, error: '删除歌曲失败'}
        );
    }

    async scanDirectory(path: string): Promise<boolean> {
        this.assertNonEmptyString(path, 'path');

        return await this.callGateway(
            () => libraryGateway.scanDirectory(path),
            'library.scanDirectory',
            false
        );
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        return await this.callGateway(
            () => libraryGateway.scanNetworkDrive(driveId, relativePath),
            'library.scanNetworkDrive',
            false
        );
    }

    async scanSingleFile(networkPath: string): Promise<LibraryTrackMutationResult> {
        this.assertNonEmptyString(networkPath, 'networkPath');

        return await this.callGateway(
            () => libraryGateway.scanSingleFile(networkPath),
            'library.scanSingleFile',
            {success: false, error: '扫描单个文件失败'}
        );
    }

    async scanDirectoryForFiles(path: string): Promise<LibraryScanDirectoryResult> {
        this.assertNonEmptyString(path, 'path');

        return await this.callGateway(
            () => libraryGateway.scanDirectoryForFiles(path),
            'library.scanDirectoryForFiles',
            {success: false, files: [], error: '扫描目录失败'}
        );
    }

    async addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<LibraryTrackMutationResult> {
        return await this.callGateway(
            () => libraryGateway.addTrackToLibrary(audioFile),
            'library.addTrackToLibrary',
            {success: false, error: '添加歌曲到音乐库失败'}
        );
    }

    async getTracksByDrive(driveId: string): Promise<Track[]> {
        this.assertNonEmptyString(driveId, 'driveId');

        return await this.callGateway(
            () => libraryGateway.getTracksByDrive(driveId),
            'library.getTracksByDrive',
            []
        );
    }

    async removeTracksByDrive(driveId: string): Promise<Result> {
        this.assertNonEmptyString(driveId, 'driveId');

        return await this.callGateway(
            () => libraryGateway.removeTracksByDrive(driveId),
            'library.removeTracksByDrive',
            {success: false, error: '移除网络磁盘音乐失败'}
        );
    }

    async getPlaylistDetail(playlistId: string): Promise<PlaylistDetailResult> {
        this.assertNonEmptyString(playlistId, 'playlistId');

        return await this.callGateway(
            () => libraryGateway.getPlaylistDetail(playlistId),
            'library.getPlaylistDetail',
            {success: false, error: '获取歌单详情失败'}
        );
    }

    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        this.assertNonEmptyString(playlistId, 'playlistId');
        this.assertFilePath(imagePath, 'imagePath');

        return await this.callGateway(
            () => libraryGateway.updatePlaylistCover(playlistId, imagePath),
            'library.updatePlaylistCover',
            {success: false, error: '更新歌单封面失败'}
        );
    }

    async getPlaylistCover(playlistId: string): Promise<PlaylistCoverDataResult> {
        this.assertNonEmptyString(playlistId, 'playlistId');

        return await this.callGateway(
            () => libraryGateway.getPlaylistCover(playlistId),
            'library.getPlaylistCover',
            {success: false, error: '获取歌单封面失败'}
        );
    }

    async removePlaylistCover(playlistId: string): Promise<Result> {
        this.assertNonEmptyString(playlistId, 'playlistId');

        return await this.callGateway(
            () => libraryGateway.removePlaylistCover(playlistId),
            'library.removePlaylistCover',
            {success: false, error: '移除歌单封面失败'}
        );
    }

    async getTracksByAlbum(albumId: string): Promise<Track[]> {
        this.assertNonEmptyString(albumId, 'albumId');
        return await this.getTracks({albumId});
    }

    async getTracksByArtist(artistId: string): Promise<Track[]> {
        this.assertNonEmptyString(artistId, 'artistId');
        return await this.getTracks({artistId});
    }

    async getFavoriteTracks(): Promise<Track[]> {
        return await this.getTracks({favorite: true});
    }

    async getTracksByGenre(genre: string): Promise<Track[]> {
        this.assertNonEmptyString(genre, 'genre');
        return await this.getTracks({genre});
    }

    async getTracksByYear(year: number): Promise<Track[]> {
        this.assertNumber(year, 'year');
        return await this.getTracks({year});
    }

    async getRecentlyAddedTracks(limit: number = 50): Promise<Track[]> {
        this.assertNumber(limit, 'limit');

        const tracks = await this.getTracks();
        return tracks
            .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
            .slice(0, limit);
    }

    async getRecentlyPlayedTracks(limit: number = 50): Promise<Track[]> {
        this.assertNumber(limit, 'limit');

        const tracks = await this.getTracks();
        return tracks
            .filter(track => track.lastPlayedAt)
            .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
            .slice(0, limit);
    }

    async getMostPlayedTracks(limit: number = 50): Promise<Track[]> {
        this.assertNumber(limit, 'limit');

        const tracks = await this.getTracks();
        return tracks
            .filter(track => track.playCount && track.playCount > 0)
            .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
            .slice(0, limit);
    }

    private async callGateway<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T>;
    private async callGateway<T>(
        operation: () => Promise<T>,
        operationName: string,
        fallbackValue: T
    ): Promise<T>;
    private async callGateway<T>(
        operation: () => Promise<T>,
        operationName: string,
        fallbackValue?: T
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logError(`${operationName} 失败`, error);

            if (arguments.length >= 3) {
                return fallbackValue as T;
            }

            throw error;
        }
    }

    private assertString(value: unknown, paramName: string): asserts value is string {
        if (typeof value !== 'string') {
            throw new LibraryInputError(paramName, 'string', value);
        }
    }

    private assertNonEmptyString(value: unknown, paramName: string): asserts value is string {
        this.assertString(value, paramName);
        if (value.trim().length === 0) {
            throw new LibraryInputError(paramName, 'non-empty string', value);
        }
    }

    private assertNumber(value: unknown, paramName: string): asserts value is number {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new LibraryInputError(paramName, 'valid number', value);
        }
    }

    private assertFilePath(value: unknown, paramName: string): asserts value is string {
        this.assertNonEmptyString(value, paramName);
        if (value.includes('\0')) {
            throw new LibraryInputError(paramName, 'valid file path', value);
        }
    }

    private logError(message: string, error: unknown): void {
        console.error(`❌ LibraryDataService: ${message}`, error);
    }
}

export const libraryDataService = new LibraryDataService();
