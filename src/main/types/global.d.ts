import {IpcMain, BrowserWindow} from 'electron';
import type {Stats} from 'fs';

// 音频引擎状态
export interface AudioEngineState {
    isInitialized: boolean;
    currentTrack: string | null;
    isPlaying: boolean;
    volume: number;
    position: number;
    duration: number;
    playlist: string[];
    currentIndex: number;
}

// 音轨元数据
export interface TrackMetadata {
    title: string;
    artist: string;
    album: string;
    albumArtist?: string;
    year?: number;
    genre: string[];
    duration: number;
    bitrate: number;
    sampleRate: number;
    trackNumber?: number;
    diskNumber?: number;
    comment?: string;
    lyrics?: string;
    cover?: {
        data: Buffer;
        format: string;
    };
    embeddedLyrics?: any;

    [key: string]: any;
}

// 网络路径类型
export type NetworkPath = `network://${string}`;
export type LocalPath = string;
export type FilePath = NetworkPath | LocalPath;

// 缓存音轨
export interface CacheTrack extends TrackMetadata {
    id: string;
    filePath: FilePath;
    fileSize: number;
    modifiedTime: number;
    addedTime: number;
}

// 播放列表
export interface Playlist {
    id: string;
    name: string;
    tracks: string[]; // track IDs
    createdTime: number;
    modifiedTime: number;
}

// 缓存数据结构
export interface CacheData {
    lastUpdated: number;
    scannedDirectories: string[];
    tracks: CacheTrack[];
    playlists: Playlist[];
    ignoredFiles: string[];
    statistics: {
        totalTracks: number;
        totalSize: number;
        totalPlaylists: number;
        lastScanTime: number;
        scanDuration: number;
    };
}

// IPC 处理器依赖注入
export interface IpcHandlerDependencies {
    ipcMain: IpcMain;
    mainWindow: BrowserWindow;
    audioEngineState: AudioEngineState;
    libraryCacheManager: any; // 暂时使用 any，后续会替换为具体类型
    networkDriveManager: any;
    networkFileAdapter: any;
    parseMetadata: (filePath: string) => Promise<TrackMetadata>;
}

// 文件统计信息扩展
export interface FileStats extends Stats {
    // 可以添加额外的属性
}
