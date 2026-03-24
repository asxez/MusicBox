/**
 * 音乐库缓存管理器
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {app} from 'electron';
import {NetworkFileAdapter} from '../network/NetworkFileAdapter';

export interface TrackData {
    title?: string;
    artist?: string;
    album?: string;
    year?: string | number;
    genre?: string;
    duration?: number;
    cover?: { data: any } | null;

    [key: string]: any;
}

export interface CachedTrack {
    fileId: string;
    filePath: string;
    fileName: string;
    fileSize: number;
    lastModified: number;
    addedToCache: number;
    hasCover: boolean;
    title?: string;
    artist?: string;
    album?: string;

    [key: string]: any;
}

export interface Playlist {
    id: string;
    name: string;
    description: string;
    trackIds: string[];
    createdAt: number;
    updatedAt: number;
    coverImagePath?: string;
}

interface CacheStatistics {
    totalTracks: number;
    totalSize: number;
    totalPlaylists: number;
    lastScanTime: number;
    scanDuration: number;
}

interface CacheData {
    lastUpdated: number;
    scannedDirectories: string[];
    tracks: CachedTrack[];
    playlists: Playlist[];
    ignoredFiles: string[];
    statistics: CacheStatistics;
}

interface ValidationResult {
    valid: boolean;
    reason?: string;
    stats?: any;
    error?: string;
}

interface ValidationProgress {
    current: number;
    total: number;
    valid: number;
    invalid: number;
    modified: number;
}

interface FileStat {
    size: number;
    mtime: Date;
}

const defaultCache: CacheData = {
    lastUpdated: Date.now(),
    scannedDirectories: [],
    tracks: [],
    playlists: [],
    ignoredFiles: [],
    statistics: {
        totalTracks: 0,
        totalSize: 0,
        totalPlaylists: 0,
        lastScanTime: 0,
        scanDuration: 0
    }
};

export class LibraryCacheManager {
    private cacheFileName = 'music-library-cache.json';
    private cacheFilePath: string;
    private networkFileAdapter: NetworkFileAdapter | null;
    private cache: CacheData;
    private _saveTimer: NodeJS.Timeout | null = null;
    private _pendingSave = false;

    constructor(networkFileAdapter: NetworkFileAdapter | null = null) {
        this.networkFileAdapter = networkFileAdapter;
        this.cache = {...defaultCache, statistics: {...defaultCache.statistics}};

        try {
            const userDataPath = app.getPath('userData');
            this.cacheFilePath = path.join(userDataPath, this.cacheFileName);
        } catch {
            this.cacheFilePath = path.join(process.cwd(), this.cacheFileName);
        }
    }

    generateFileId(filePath: string, stats: FileStat): string {
        let timestamp = stats.mtime.getTime();
        if (this.isNetworkPath(filePath)) {
            timestamp = Math.floor(timestamp / 1000) * 1000;
        }
        return crypto.createHash('md5').update(`${filePath}_${stats.size}_${timestamp}`).digest('hex');
    }

    isNetworkPath(filePath: string): boolean {
        return !!(filePath && filePath.startsWith('network://'));
    }

    async loadCache(): Promise<void> {
        try {
            try {
                await fs.promises.access(this.cacheFilePath);
            } catch {
                console.log('🔄 LibraryCacheManager: 缓存文件不存在，使用默认缓存');
                return;
            }

            const data = await fs.promises.readFile(this.cacheFilePath, 'utf8');
            const cacheData = JSON.parse(data);
            this.cache = this.validateCacheData(cacheData);
            console.log(`✅ LibraryCacheManager: 加载缓存成功，共 ${this.cache.tracks.length} 首歌曲`);
        } catch (error) {
            console.error('❌ LibraryCacheManager: 加载缓存失败:', error);
        }
    }

    private validateCacheData(cacheData: any): CacheData {
        return {
            lastUpdated: cacheData.lastUpdated || defaultCache.lastUpdated,
            scannedDirectories: Array.isArray(cacheData.scannedDirectories) ? cacheData.scannedDirectories : [],
            tracks: Array.isArray(cacheData.tracks) ? cacheData.tracks : [],
            playlists: Array.isArray(cacheData.playlists)
                ? cacheData.playlists.filter((p: any) =>
                    p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.trackIds)
                )
                : [],
            ignoredFiles: Array.isArray(cacheData.ignoredFiles) ? cacheData.ignoredFiles : [],
            statistics: {
                totalTracks: cacheData.statistics?.totalTracks ?? 0,
                totalSize: cacheData.statistics?.totalSize ?? 0,
                totalPlaylists: cacheData.statistics?.totalPlaylists ?? 0,
                lastScanTime: cacheData.statistics?.lastScanTime ?? 0,
                scanDuration: cacheData.statistics?.scanDuration ?? 0
            }
        };
    }

    async saveCache(): Promise<void> {
        if (!Array.isArray(this.cache.tracks)) this.cache.tracks = [];
        if (!Array.isArray(this.cache.playlists)) this.cache.playlists = [];
        if (!Array.isArray(this.cache.ignoredFiles)) this.cache.ignoredFiles = [];

        this.cache.statistics.totalTracks = this.cache.tracks.length;
        this.cache.statistics.totalPlaylists = this.cache.playlists.length;
        this.cache.lastUpdated = Date.now();

        try {
            await fs.promises.writeFile(this.cacheFilePath, JSON.stringify(this.cache), 'utf8');
        } catch (error) {
            console.error('❌ LibraryCacheManager: 保存缓存失败:', error);
            throw error;
        }
    }

    scheduleSave(delay = 2000): void {
        this._pendingSave = true;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(async () => {
            if (this._pendingSave) {
                this._pendingSave = false;
                await this.saveCache().catch(console.error);
            }
        }, delay);
    }

    private async validateTrack(track: CachedTrack): Promise<ValidationResult> {
        if (this.isNetworkPath(track.filePath)) {
            return this.validateNetworkTrack(track);
        }
        try {
            await fs.promises.access(track.filePath);
            const stats = await fs.promises.stat(track.filePath);
            const currentId = this.generateFileId(track.filePath, stats);
            if (currentId !== track.fileId) {
                return {valid: false, reason: 'file_modified', stats};
            }
            return {valid: true};
        } catch {
            return {valid: false, reason: 'file_not_found'};
        }
    }

    private async validateNetworkTrack(track: CachedTrack): Promise<ValidationResult> {
        try {
            if (!this.networkFileAdapter) {
                return {valid: true, reason: 'network_adapter_unavailable'};
            }
            const exists = await this.networkFileAdapter.exists(track.filePath);
            if (!exists) return {valid: false, reason: 'network_file_not_found'};

            const stats = await this.networkFileAdapter.stat(track.filePath);
            const currentId = this.generateFileId(track.filePath, stats as FileStat);
            if (currentId !== track.fileId) {
                return {valid: false, reason: 'network_file_modified', stats};
            }
            return {valid: true};
        } catch (error: any) {
            if (error.message?.includes('网络磁盘') && error.message?.includes('未连接')) {
                return {valid: true, reason: 'network_disconnected'};
            }
            return {valid: false, reason: 'network_access_error', error: error.message};
        }
    }

    async validateCachedTracks(
        progressCallback?: (p: ValidationProgress) => void
    ): Promise<{
        valid: CachedTrack[];
        invalid: { track: CachedTrack; reason: string }[];
        modified: { track: CachedTrack; stats: any }[]
    }> {
        const validTracks: CachedTrack[] = [];
        const invalidTracks: { track: CachedTrack; reason: string }[] = [];
        const modifiedTracks: { track: CachedTrack; stats: any }[] = [];
        const CONCURRENCY = 20;
        const tracks = this.cache.tracks;
        let completed = 0;

        for (let i = 0; i < tracks.length; i += CONCURRENCY) {
            const batch = tracks.slice(i, i + CONCURRENCY);
            const results = await Promise.all(batch.map(t => this.validateTrack(t)));

            for (let j = 0; j < batch.length; j++) {
                const track = batch[j];
                const v = results[j];
                if (v.valid) validTracks.push(track);
                else if (v.reason === 'file_modified' || v.reason === 'network_file_modified') {
                    modifiedTracks.push({track, stats: v.stats});
                } else {
                    invalidTracks.push({track, reason: v.reason!});
                }
                completed++;
                progressCallback?.({
                    current: completed,
                    total: tracks.length,
                    valid: validTracks.length,
                    invalid: invalidTracks.length,
                    modified: modifiedTracks.length
                });
            }
        }
        return {valid: validTracks, invalid: invalidTracks, modified: modifiedTracks};
    }

    addTrack(trackData: TrackData, filePath: string, stats: FileStat): CachedTrack | null {
        if (this.isFileIgnored(filePath)) return null;

        const fileId = this.generateFileId(filePath, stats);
        let lastModified = stats.mtime.getTime();
        if (this.isNetworkPath(filePath)) lastModified = Math.floor(lastModified / 1000) * 1000;

        const {cover, ...trackDataWithoutCover} = trackData;
        const cacheTrack: CachedTrack = {
            fileId,
            filePath,
            fileName: path.basename(filePath),
            fileSize: stats.size,
            lastModified,
            addedToCache: Date.now(),
            ...trackDataWithoutCover,
            hasCover: !!(cover && (cover as any).data)
        };

        const existingIndex = this.cache.tracks.findIndex(t => t.filePath === filePath);
        if (existingIndex !== -1) {
            this.cache.tracks[existingIndex] = cacheTrack;
        } else {
            this.cache.tracks.push(cacheTrack);
            console.log(`➕ LibraryCacheManager: 添加缓存文件 - ${trackData.title}`);
        }
        return cacheTrack;
    }

    addTracks(tracksData: { trackData: TrackData; filePath: string; stats: FileStat }[]): CachedTrack[] {
        const added: CachedTrack[] = [];
        for (const {trackData, filePath, stats} of tracksData) {
            const t = this.addTrack(trackData, filePath, stats);
            if (t) added.push(t);
        }
        return added;
    }

    removeInvalidTracks(invalidTracks: { track: CachedTrack }[]): number {
        const count = invalidTracks.length;
        const paths = new Set(invalidTracks.map(i => i.track.filePath));
        this.cache.tracks = this.cache.tracks.filter(t => !paths.has(t.filePath));
        return count;
    }

    removeTrack(trackFileId: string): CachedTrack {
        if (!Array.isArray(this.cache.tracks)) this.cache.tracks = [];
        const index = this.cache.tracks.findIndex(t => t.fileId === trackFileId);
        if (index === -1) throw new Error('歌曲不存在');

        const track = this.cache.tracks[index];
        this.cache.tracks.splice(index, 1);
        console.log(`🗑️ LibraryCacheManager: 从音乐库删除歌曲 - ${track.title}`);

        this.addToIgnoreList(track.filePath);

        if (Array.isArray(this.cache.playlists)) {
            for (const playlist of this.cache.playlists) {
                if (Array.isArray(playlist.trackIds)) {
                    const i = playlist.trackIds.indexOf(trackFileId);
                    if (i !== -1) {
                        playlist.trackIds.splice(i, 1);
                        playlist.updatedAt = Date.now();
                    }
                }
            }
        }
        return track;
    }

    parseDriveId(filePath: string): string | null {
        if (!this.isNetworkPath(filePath)) return null;
        const match = filePath.match(/^network:\/\/([^/]+)/);
        return match ? match[1] : null;
    }

    getTracksByDrive(driveId: string): CachedTrack[] {
        if (!Array.isArray(this.cache.tracks)) {
            this.cache.tracks = [];
            return [];
        }
        return this.cache.tracks.filter(t => this.parseDriveId(t.filePath) === driveId);
    }

    removeTracksByDrive(driveId: string): number {
        if (!Array.isArray(this.cache.tracks)) {
            this.cache.tracks = [];
            return 0;
        }
        const before = this.cache.tracks.length;
        const removed = this.cache.tracks.filter(t => this.parseDriveId(t.filePath) === driveId);
        const removedIds = new Set(removed.map(t => t.fileId));
        this.cache.tracks = this.cache.tracks.filter(t => this.parseDriveId(t.filePath) !== driveId);

        if (removed.length > 0) {
            for (const playlist of this.cache.playlists || []) {
                if (Array.isArray(playlist.trackIds)) {
                    const lenBefore = playlist.trackIds.length;
                    playlist.trackIds = playlist.trackIds.filter(id => !removedIds.has(id));
                    if (playlist.trackIds.length !== lenBefore) playlist.updatedAt = Date.now();
                }
            }
        }
        return before - this.cache.tracks.length;
    }

    getScannedDirectories(): string[] {
        return this.cache.scannedDirectories || [];
    }

    updateScannedDirectories(dirs: string[]): void {
        this.cache.scannedDirectories = dirs;
    }

    addScannedDirectory(directoryPath: string): void {
        if (!this.cache.scannedDirectories.includes(directoryPath)) {
            this.cache.scannedDirectories.push(directoryPath);
        }
    }

    updateScanStatistics(lastScanTime: number, scanDuration: number): void {
        if (!this.cache.statistics) {
            this.cache.statistics = {totalTracks: 0, totalSize: 0, totalPlaylists: 0, lastScanTime: 0, scanDuration: 0};
        }
        this.cache.statistics.lastScanTime = lastScanTime;
        this.cache.statistics.scanDuration = scanDuration;
    }

    clearCache(): Promise<void> {
        this.cache = {
            lastUpdated: Date.now(),
            scannedDirectories: [],
            tracks: [],
            playlists: this.cache.playlists || [],
            ignoredFiles: this.cache.ignoredFiles || [],
            statistics: {totalTracks: 0, totalSize: 0, totalPlaylists: 0, lastScanTime: 0, scanDuration: 0}
        };
        return this.saveCache();
    }

    getAllTracks(): CachedTrack[] {
        return this.cache.tracks;
    }

    updateTrackInCache(filePath: string, updatedData: Partial<CachedTrack>): boolean {
        const idx = this.cache.tracks.findIndex(t => t.filePath === filePath);
        if (idx === -1) return false;
        const track = this.cache.tracks[idx];
        Object.assign(track, updatedData);
        if (updatedData.lastModified !== undefined) {
            track.lastModified = this.isNetworkPath(filePath)
                ? Math.floor(updatedData.lastModified / 1000) * 1000
                : updatedData.lastModified;
        } else {
            track.lastModified = Date.now();
        }
        this.cache.lastUpdated = Date.now();
        return true;
    }

    searchTracks(query: string): CachedTrack[] {
        if (!query?.trim()) return this.getAllTracks();
        const term = query.toLowerCase();
        return this.cache.tracks.filter(t =>
            t.title?.toLowerCase().includes(term) ||
            t.artist?.toLowerCase().includes(term) ||
            t.album?.toLowerCase().includes(term) ||
            t.fileName?.toLowerCase().includes(term)
        );
    }

    updateStatistics(stats: Partial<CacheStatistics>): void {
        Object.assign(this.cache.statistics, stats);
    }

    getStatistics(): CacheStatistics {
        return this.cache.statistics;
    }

    getTrackByFileId(fileId: string): CachedTrack | undefined {
        return this.cache.tracks.find(t => t.fileId === fileId);
    }

    getTrackByPath(filePath: string): CachedTrack | undefined {
        return this.cache.tracks.find(t => t.filePath === filePath);
    }

    // 歌单管理
    createPlaylist(name: string, description = ''): Playlist {
        if (!name?.trim()) throw new Error('歌单名称不能为空');
        if (!Array.isArray(this.cache.playlists)) this.cache.playlists = [];
        if (this.cache.playlists.find(p => p.name === name.trim())) throw new Error('歌单名称已存在');

        const playlist: Playlist = {
            id: crypto.randomUUID(),
            name: name.trim(),
            description: description.trim(),
            trackIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.cache.playlists.push(playlist);
        console.log(`✅ LibraryCacheManager: 创建歌单 - ${playlist.name}`);
        return playlist;
    }

    deletePlaylist(playlistId: string): boolean {
        if (!Array.isArray(this.cache.playlists)) {
            this.cache.playlists = [];
            return false;
        }
        const idx = this.cache.playlists.findIndex(p => p.id === playlistId);
        if (idx === -1) throw new Error('歌单不存在');
        const name = this.cache.playlists[idx].name;
        this.cache.playlists.splice(idx, 1);
        console.log(`🗑️ LibraryCacheManager: 删除歌单 - ${name}`);
        return true;
    }

    renamePlaylist(playlistId: string, newName: string): Playlist {
        if (!newName?.trim()) throw new Error('歌单名称不能为空');
        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        if (this.cache.playlists.find(p => p.id !== playlistId && p.name === newName.trim())) throw new Error('歌单名称已存在');
        const oldName = playlist.name;
        playlist.name = newName.trim();
        playlist.updatedAt = Date.now();
        console.log(`✏️ LibraryCacheManager: 重命名歌单 - ${oldName} -> ${playlist.name}`);
        return playlist;
    }

    addTrackToPlaylist(playlistId: string, trackFileId: string): Playlist {
        if (!Array.isArray(this.cache.playlists)) this.cache.playlists = [];
        if (!Array.isArray(this.cache.tracks)) this.cache.tracks = [];
        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        const track = this.cache.tracks.find(t => t.fileId === trackFileId);
        if (!track) throw new Error('歌曲不存在');
        if (!Array.isArray(playlist.trackIds)) playlist.trackIds = [];
        if (playlist.trackIds.includes(trackFileId)) throw new Error('歌曲已在歌单中');
        playlist.trackIds.push(trackFileId);
        playlist.updatedAt = Date.now();
        console.log(`➕ LibraryCacheManager: 添加歌曲到歌单 - ${track.title} -> ${playlist.name}`);
        return playlist;
    }

    removeTrackFromPlaylist(playlistId: string, trackFileId: string): Playlist {
        if (!Array.isArray(this.cache.playlists)) this.cache.playlists = [];
        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        if (!Array.isArray(playlist.trackIds)) {
            playlist.trackIds = [];
            throw new Error('歌曲不在歌单中');
        }
        const idx = playlist.trackIds.indexOf(trackFileId);
        if (idx === -1) throw new Error('歌曲不在歌单中');
        playlist.trackIds.splice(idx, 1);
        playlist.updatedAt = Date.now();
        return playlist;
    }

    reorderPlaylistTracks(playlistId: string, trackIds: string[]): Playlist {
        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) throw new Error('歌单不存在');
        playlist.trackIds = trackIds;
        playlist.updatedAt = Date.now();
        return playlist;
    }

    getPlaylistById(playlistId: string): Playlist | undefined {
        return this.cache.playlists?.find(p => p.id === playlistId);
    }

    getAllPlaylists(): Playlist[] {
        return Array.isArray(this.cache.playlists) ? [...this.cache.playlists] : [];
    }

    updatePlaylistCover(playlistId: string, coverImagePath: string): boolean {
        const playlist = this.cache.playlists?.find(p => p.id === playlistId);
        if (!playlist) return false;
        (playlist as any).coverImage = coverImagePath;
        playlist.updatedAt = Date.now();
        return true;
    }

    getPlaylistCover(playlistId: string): string | null {
        const playlist = this.cache.playlists?.find(p => p.id === playlistId);
        return playlist ? ((playlist as any).coverImage ?? null) : null;
    }

    removePlaylistCover(playlistId: string): boolean {
        const playlist = this.cache.playlists?.find(p => p.id === playlistId);
        if (!playlist) return false;
        (playlist as any).coverImage = null;
        playlist.updatedAt = Date.now();
        return true;
    }

    getCacheStatistics(): any {
        const tracks = Array.isArray(this.cache.tracks) ? this.cache.tracks : [];
        const playlists = Array.isArray(this.cache.playlists) ? this.cache.playlists : [];
        const scannedDirectories = Array.isArray(this.cache.scannedDirectories) ? this.cache.scannedDirectories : [];
        const statistics = (this.cache as any).statistics || {};
        return {
            ...statistics,
            totalTracks: tracks.length,
            totalPlaylists: playlists.length,
            totalSize: tracks.reduce((sum, track) => sum + ((track as any).fileSize || 0), 0),
            scannedDirectories: scannedDirectories.length,
            cacheAge: Date.now() - (this.cache.lastUpdated || Date.now())
        };
    }

    cleanupPlaylistTracks(): number {
        return this.cleanupPlaylistReferences();
    }

    cleanupPlaylistReferences(): number {
        const validIds = new Set(this.cache.tracks.map(t => t.fileId));
        let cleaned = 0;
        for (const playlist of this.cache.playlists || []) {
            if (!Array.isArray(playlist.trackIds)) {
                playlist.trackIds = [];
                continue;
            }
            const before = playlist.trackIds.length;
            playlist.trackIds = playlist.trackIds.filter(id => validIds.has(id));
            const delta = before - playlist.trackIds.length;
            if (delta > 0) {
                cleaned += delta;
                playlist.updatedAt = Date.now();
            }
        }
        return cleaned;
    }

    // 忽略列表
    isFileIgnored(filePath: string): boolean {
        if (!Array.isArray(this.cache.ignoredFiles)) {
            this.cache.ignoredFiles = [];
            return false;
        }
        return this.cache.ignoredFiles.includes(filePath);
    }

    addToIgnoreList(filePath: string): void {
        if (!Array.isArray(this.cache.ignoredFiles)) this.cache.ignoredFiles = [];
        if (!this.cache.ignoredFiles.includes(filePath)) this.cache.ignoredFiles.push(filePath);
    }

    removeFromIgnoreList(filePath: string): boolean {
        if (!Array.isArray(this.cache.ignoredFiles)) {
            this.cache.ignoredFiles = [];
            return false;
        }
        const idx = this.cache.ignoredFiles.indexOf(filePath);
        if (idx !== -1) {
            this.cache.ignoredFiles.splice(idx, 1);
            return true;
        }
        return false;
    }

    clearIgnoreList(): void {
        this.cache.ignoredFiles = [];
    }

    getIgnoreList(): string[] {
        if (!Array.isArray(this.cache.ignoredFiles)) this.cache.ignoredFiles = [];
        return [...this.cache.ignoredFiles];
    }
}
