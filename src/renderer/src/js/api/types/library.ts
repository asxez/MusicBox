/**
 * 音乐库 API 类型定义
 */


import {FilePath, QueryOptions} from "@api/types/common";

/**
 * 音乐元数据
 */
export interface Track {
    id?: string;
    fileId?: string;
    title: string;
    artist: string;
    album?: string;
    albumArtist?: string;
    year?: number;
    genre?: string;
    duration?: number;
    trackNumber?: number;
    diskNumber?: number;
    filePath: FilePath;
    path?: FilePath;
    fileName?: string;
    fileSize?: number;
    bitrate?: number;
    sampleRate?: number;
    format?: string;
    codec?: string;
    lossless?: boolean;
    addedAt?: number;
    modifiedAt?: number;
    playCount?: number;
    lastPlayedAt?: number;
    rating?: number;
    favorite?: boolean;
    lyrics?: string;
    cover?: string;

    [key: string]: any;
}

/**
 * 播放列表
 */
export interface Playlist {
    id: string;
    name: string;
    description?: string;
    cover?: string;
    trackCount?: number;
    duration?: number;
    tracks: Track[];
    createdAt?: number;
    modifiedAt?: number;
}

/**
 * 音乐库统计信息
 */
export interface LibraryStatistics {
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
    totalSize: number;
    lastScanTime?: number;
    cacheSize?: number;
}

/**
 * 获取音乐选项
 */
export interface GetTracksOptions extends QueryOptions {
    albumId?: string;
    artistId?: string;
    genre?: string;
    year?: number;
    favorite?: boolean;
}

/**
 * 缓存统计信息
 */
export interface CacheStatistics extends LibraryStatistics {
    cacheVersion?: string;
    cacheDate?: number;
}
