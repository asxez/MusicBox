// 音乐库控制器

import * as fs from 'fs';
import * as path from 'path';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {LibraryCacheManager, CachedTrack} from '../services/library/LibraryCacheManager';
import {MetadataHandler} from '../services/library/MetadataHandler';
import {NetworkFileAdapter} from '../services/network/NetworkFileAdapter';
import {NetworkDriveManager} from '../services/network/NetworkDriveManager';
import {WindowManager} from '../core/WindowManager';
import type {TrackMetadata} from '../types/global';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.ape'];
const BATCH_SIZE = 10;

@Controller('library')
export class LibraryController extends BaseController {
    // shared audio engine state (reference shared with AudioController)
    readonly audioEngineState: any;

    constructor(
        private libraryCacheManager: LibraryCacheManager,
        private metadataHandler: MetadataHandler,
        private networkDriveManager: NetworkDriveManager,
        private networkFileAdapter: NetworkFileAdapter,
        private windowManager: WindowManager,
        private parseMetadata: (filePath: string, adapter?: any, opts?: any) => Promise<TrackMetadata>,
        audioEngineState: any
    ) {
        super();
        this.audioEngineState = audioEngineState;
    }

    // ── 缓存 ──────────────────────────────────────────────

    @IpcHandle('library:loadCachedTracks')
    async loadCachedTracks(): Promise<CachedTrack[]> {
        try {
            const tracks = this.libraryCacheManager.getAllTracks();
            console.log(`✅ 从缓存加载 ${tracks.length} 个音乐文件`);
            return tracks;
        } catch (error) {
            console.error('❌ 加载缓存音乐库失败:', error);
            return [];
        }
    }

    @IpcHandle('library:validateCache')
    async validateCache(): Promise<any> {
        try {
            const mountedDrives = Array.from(this.networkDriveManager.getMountedDrives().keys());
            const result = await this.libraryCacheManager.validateCachedTracks((progress: any) => {
                this.windowManager.sendToMainWindow('library:cacheValidationProgress', progress);
            });

            const hasInvalid = result.invalid.length > 0;
            if (hasInvalid) {
                this.libraryCacheManager.removeInvalidTracks(result.invalid);
                await this.libraryCacheManager.saveCache();
            }

            console.log(`✅ 缓存验证完成 - 有效: ${result.valid.length}, 无效: ${result.invalid.length}, 已修改: ${result.modified.length}`);
            return {
                valid: result.valid.length,
                invalid: result.invalid.length,
                modified: result.modified.length,
                tracks: hasInvalid ? this.libraryCacheManager.getAllTracks() : undefined,
                mountedDrives,
            };
        } catch (error: any) {
            console.error('❌ 验证缓存失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:removeTrack')
    async removeTrack(trackFileId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const track = this.libraryCacheManager.removeTrack(trackFileId);
            await this.libraryCacheManager.saveCache();
            console.log(`🗑️ 从音乐库删除: ${track.title}`);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:removeTracksByDrive')
    async removeTracksByDrive(driveId: string): Promise<{ success: boolean; removedCount?: number; error?: string }> {
        try {
            const removedCount = this.libraryCacheManager.removeTracksByDrive(driveId);
            await this.libraryCacheManager.saveCache();
            return {success: true, removedCount};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:clearIgnoreList')
    async clearIgnoreList(): Promise<{ success: boolean; error?: string }> {
        try {
            this.libraryCacheManager.clearIgnoreList();
            await this.libraryCacheManager.saveCache();
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    // ── 查询 ──────────────────────────────────────────────

    @IpcHandle('library:getTracks')
    async getTracks(): Promise<any[]> {
        return this.libraryCacheManager.getAllTracks();
    }

    @IpcHandle('library:search')
    async search(query: string): Promise<any[]> {
        try {
            return this.libraryCacheManager.searchTracks(query);
        } catch (error) {
            console.error('❌ 搜索失败:', error);
            return [];
        }
    }

    // ── 歌单 ──────────────────────────────────────────────

    @IpcHandle('library:createPlaylist')
    async createPlaylist(name: string, description = ''): Promise<{
        success: boolean;
        playlist?: any;
        error?: string
    }> {
        try {
            const playlist = this.libraryCacheManager.createPlaylist(name, description);
            await this.libraryCacheManager.saveCache();
            return {success: true, playlist};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:getPlaylists')
    async getPlaylists(): Promise<any[]> {
        try {
            return this.libraryCacheManager.getAllPlaylists();
        } catch (error) {
            console.error('❌ 获取歌单列表失败:', error);
            return [];
        }
    }

    @IpcHandle('library:getPlaylistDetail')
    async getPlaylistDetail(playlistId: string): Promise<any> {
        try {
            const playlist = this.libraryCacheManager.getPlaylistById(playlistId);
            if (!playlist) return {success: false, error: '歌单不存在'};
            const allTracks = this.libraryCacheManager.getAllTracks();
            const tracks = playlist.trackIds
                .map((id: string) => allTracks.find((t: any) => t.fileId === id))
                .filter(Boolean);
            return {success: true, playlist, tracks};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:deletePlaylist')
    async deletePlaylist(playlistId: string): Promise<{ success: boolean; error?: string }> {
        try {
            this.libraryCacheManager.deletePlaylist(playlistId);
            await this.libraryCacheManager.saveCache();
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:renamePlaylist')
    async renamePlaylist(playlistId: string, newName: string): Promise<{
        success: boolean;
        playlist?: any;
        error?: string
    }> {
        try {
            const playlist = this.libraryCacheManager.renamePlaylist(playlistId, newName);
            await this.libraryCacheManager.saveCache();
            return {success: true, playlist};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:addTracksToPlaylist')
    async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<{
        success: boolean;
        results?: any[];
        error?: string
    }> {
        try {
            const results = trackIds.map(id => {
                try {
                    this.libraryCacheManager.addTrackToPlaylist(playlistId, id);
                    return {id, success: true};
                } catch (e: any) {
                    return {id, success: false, error: e.message};
                }
            });
            await this.libraryCacheManager.saveCache();
            return {success: true, results};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:removeTracksFromPlaylist')
    async removeTracksFromPlaylist(playlistId: string, trackIds: string[]): Promise<{
        success: boolean;
        results?: any[];
        error?: string
    }> {
        try {
            const results = trackIds.map(id => {
                try {
                    this.libraryCacheManager.removeTrackFromPlaylist(playlistId, id);
                    return {id, success: true};
                } catch (e: any) {
                    return {id, success: false, error: e.message};
                }
            });
            await this.libraryCacheManager.saveCache();
            return {success: true, results};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:cleanupPlaylists')
    async cleanupPlaylists(): Promise<{ success: boolean; cleanedCount?: number; error?: string }> {
        try {
            const cleanedCount = this.libraryCacheManager.cleanupPlaylistReferences();
            if (cleanedCount > 0) await this.libraryCacheManager.saveCache();
            return {success: true, cleanedCount};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    // ── 扫描 ──────────────────────────────────────────────

    @IpcHandle('library:scanDirectory')
    async scanDirectory(directoryPath: string): Promise<boolean> {
        try {
            const scanStartTime = Date.now();
            const isNetwork = this.networkFileAdapter.isNetworkPath(directoryPath);

            if (isNetwork) {
                return this.scanNetworkDirectory(directoryPath, scanStartTime);
            }

            const tracks: any[] = [];
            const tracksToCache: any[] = [];
            const fsPromises = fs.promises;

            const collectFiles = async (dir: string): Promise<{ path: string; stat: fs.Stats; name: string }[]> => {
                const files: any[] = [];
                try {
                    const items = await fsPromises.readdir(dir);
                    const itemPaths = items.map(i => path.join(dir, i));
                    const stats = await Promise.all(itemPaths.map(p => fsPromises.stat(p).catch(() => null)));
                    for (let i = 0; i < items.length; i++) {
                        const stat = stats[i];
                        if (!stat) continue;
                        if (stat.isDirectory()) files.push(...await collectFiles(itemPaths[i]));
                        else if (AUDIO_EXTENSIONS.includes(path.extname(items[i]).toLowerCase())) {
                            files.push({path: itemPaths[i], stat, name: items[i]});
                        }
                    }
                } catch (e: any) {
                    console.error(`扫描目录错误 ${dir}:`, e.message);
                }
                return files;
            };

            const files = await collectFiles(directoryPath);

            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                const results = await Promise.all(batch.map(async ({path: fp, stat, name}) => {
                    try {
                        const metadata = await this.parseMetadata(fp, null, {skipCover: true, skipLyrics: true});
                        return {
                            trackData: {
                                filePath: fp, fileName: name,
                                title: metadata.title, artist: metadata.artist, album: metadata.album,
                                duration: metadata.duration, bitrate: metadata.bitrate, sampleRate: metadata.sampleRate,
                                year: metadata.year, genre: metadata.genre,
                                track: (metadata as any).track, disc: (metadata as any).disc,
                                fileSize: stat.size, embeddedLyrics: metadata.embeddedLyrics
                            },
                            filePath: fp,
                            stats: stat
                        };
                    } catch (e: any) {
                        console.warn(`解析失败 ${fp}:`, e.message);
                        return null;
                    }
                }));

                for (const r of results) {
                    if (r) {
                        tracks.push(r.trackData);
                        tracksToCache.push(r);
                    }
                }

                const win = this.windowManager.getMainWindow();
                if (win && tracks.length > 0) {
                    win.webContents.send('library:scanProgress', {
                        current: i + batch.length,
                        total: files.length,
                        tracks: tracks.length
                    });
                }
            }

            if (tracksToCache.length > 0) {
                this.libraryCacheManager.addTracks(tracksToCache);
                this.libraryCacheManager.addScannedDirectory(directoryPath);
                const scanDuration = Date.now() - scanStartTime;
                this.libraryCacheManager.updateScanStatistics(scanStartTime, scanDuration);
                await this.libraryCacheManager.saveCache();
            }

            const allTracks = this.libraryCacheManager.getAllTracks();
            const win = this.windowManager.getMainWindow();
            if (win) win.webContents.send('library:updated', allTracks);
            return true;
        } catch (error: any) {
            console.error('❌ 扫描目录失败:', error);
            return false;
        }
    }

    private async scanNetworkDirectory(networkPath: string, scanStartTime: number): Promise<boolean> {
        const tracks: any[] = [];
        const tracksToCache: any[] = [];

        const collectNetworkFiles = async (dirPath: string): Promise<{ path: string; stat: any; name: string }[]> => {
            const files: any[] = [];
            try {
                const items = await this.networkFileAdapter.readdir(dirPath);
                const itemPaths = items.map(item => this.networkFileAdapter.joinNetworkPath(dirPath, item));
                const stats = await Promise.all(
                    itemPaths.map(p => this.networkFileAdapter.stat(p).catch(() => null))
                );
                for (let i = 0; i < items.length; i++) {
                    const stat = stats[i];
                    if (!stat) continue;
                    const isDir = typeof stat.isDirectory === 'function' ? stat.isDirectory() : false;
                    if (isDir) files.push(...await collectNetworkFiles(itemPaths[i]));
                    else if (AUDIO_EXTENSIONS.includes(path.extname(items[i]).toLowerCase())) {
                        files.push({path: itemPaths[i], stat, name: items[i]});
                    }
                }
            } catch (e: any) {
                console.error(`扫描网络目录错误 ${dirPath}:`, e.message);
            }
            return files;
        };

        const files = await collectNetworkFiles(networkPath);

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(async ({path: fp, stat, name}) => {
                try {
                    const metadata = await this.parseMetadata(fp, this.networkFileAdapter, {
                        skipCover: true,
                        skipLyrics: true
                    });
                    return {
                        trackData: {
                            filePath: fp, fileName: name,
                            title: metadata.title, artist: metadata.artist, album: metadata.album,
                            duration: metadata.duration, bitrate: metadata.bitrate, sampleRate: metadata.sampleRate,
                            year: metadata.year, genre: metadata.genre,
                            track: (metadata as any).track, disc: (metadata as any).disc,
                            fileSize: stat.size, embeddedLyrics: metadata.embeddedLyrics, isNetworkFile: true
                        },
                        filePath: fp,
                        stats: stat
                    };
                } catch (e: any) {
                    console.warn(`处理网络文件失败 ${fp}:`, e.message);
                    return null;
                }
            }));

            for (const r of results) {
                if (r) {
                    tracks.push(r.trackData);
                    tracksToCache.push(r);
                }
            }

            const win = this.windowManager.getMainWindow();
            if (win) win.webContents.send('library:scanProgress', {
                current: i + batch.length,
                total: files.length,
                tracks: tracks.length
            });
        }

        if (tracksToCache.length > 0) {
            this.libraryCacheManager.addTracks(tracksToCache);
            this.libraryCacheManager.addScannedDirectory(networkPath);
            const scanDuration = Date.now() - scanStartTime;
            this.libraryCacheManager.updateScanStatistics(scanStartTime, scanDuration);
            await this.libraryCacheManager.saveCache();
        }

        const allTracks = this.libraryCacheManager.getAllTracks();
        console.log(`✅ 网络扫描完成，找到 ${tracks.length} 个音频文件`);
        const win = this.windowManager.getMainWindow();
        if (win) win.webContents.send('library:updated', allTracks);
        return true;
    }

    // ── 元数据 ──────────────────────────────────────────────

    @IpcHandle('library:getTrackMetadata')
    async getTrackMetadata(filePath: string): Promise<any> {
        try {
            if (!filePath) {
                console.warn('⚠️ getTrackMetadata: 未提供文件路径');
                return null;
            }
            const metadata = await this.parseMetadata(filePath, this.networkFileAdapter.isNetworkPath(filePath) ? this.networkFileAdapter : undefined);
            return {
                filePath,
                title: metadata.title, artist: metadata.artist, album: metadata.album,
                duration: metadata.duration, bitrate: metadata.bitrate, sampleRate: metadata.sampleRate,
                year: metadata.year, genre: metadata.genre,
                track: (metadata as any).track, disc: (metadata as any).disc,
                cover: metadata.cover ? {format: metadata.cover.format, data: Array.from(metadata.cover.data)} : null,
                embeddedLyrics: metadata.embeddedLyrics
            };
        } catch (error: any) {
            console.error('❌ 获取元数据失败:', error);
            return null;
        }
    }

    @IpcHandle('library:updateMetadata')
    async updateMetadata(filePath: string, metadata: any): Promise<{ success: boolean; updatedMetadata?: any; coverUpdated?: boolean; error?: string }> {
        try {
            const isNetwork = this.networkFileAdapter.isNetworkPath(filePath);
            let result: any;

            if (isNetwork) {
                result = await this.updateNetworkFileMetadata(filePath, metadata);
            } else {
                if (!this.metadataHandler.isFormatSupported(filePath)) {
                    return {success: false, error: `不支持的格式: ${path.extname(filePath)}`};
                }
                result = await this.metadataHandler.updateMetadata(filePath, metadata);
            }

            if (result.success) {
                this.libraryCacheManager.updateTrackInCache(filePath, {
                    title: metadata.title, artist: metadata.artist,
                    album: metadata.album, year: metadata.year, genre: metadata.genre
                });
                await this.libraryCacheManager.saveCache();

                // 返回更新后的元数据
                return {
                    success: true,
                    updatedMetadata: {
                        filePath,
                        title: metadata.title,
                        artist: metadata.artist,
                        album: metadata.album,
                        year: metadata.year,
                        genre: metadata.genre
                    },
                    coverUpdated: !!metadata.cover
                };
            }
            return result;
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    // channel aliases for backward compat
    @IpcHandle('library:addToPlaylist')
    async addToPlaylist(playlistId: string, trackFileIds: string | string[]): Promise<any> {
        const trackIds = Array.isArray(trackFileIds) ? trackFileIds : [trackFileIds];
        return this.addTracksToPlaylist(playlistId, trackIds);
    }

    @IpcHandle('library:removeFromPlaylist')
    async removeFromPlaylist(playlistId: string, trackFileIds: string | string[]): Promise<any> {
        const trackIds = Array.isArray(trackFileIds) ? trackFileIds : [trackFileIds];
        return this.removeTracksFromPlaylist(playlistId, trackIds);
    }

    @IpcHandle('library:updateTrackMetadata')
    async updateTrackMetadata(data: any): Promise<any> {
        // 支持两种调用方式：
        // 1. updateTrackMetadata({ filePath, title, artist, ... })
        // 2. updateTrackMetadata(filePath, metadata) - 向后兼容
        if (typeof data === 'string') {
            // 旧的调用方式：第一个参数是 filePath 字符串
            const filePath = data;
            const metadata = arguments[1];
            return this.updateMetadata(filePath, metadata);
        } else if (data && typeof data === 'object' && data.filePath) {
            // 新的调用方式：传入包含 filePath 的对象
            const { filePath, ...metadata } = data;
            return this.updateMetadata(filePath, metadata);
        } else {
            return { success: false, error: '无效的参数格式' };
        }
    }

    @IpcHandle('library:getCacheStatistics')
    async getCacheStatistics(): Promise<any> {
        try {
            return this.libraryCacheManager.getCacheStatistics();
        } catch (error: any) {
            console.error('❌ 获取缓存统计失败:', error);
            return null;
        }
    }

    @IpcHandle('library:clearCache')
    async clearCache(): Promise<boolean> {
        try {
            await this.libraryCacheManager.clearCache();
            console.log('✅ 音乐库缓存已清空');
            return true;
        } catch (error: any) {
            console.error('❌ 清空缓存失败:', error);
            return false;
        }
    }

    @IpcHandle('library:getTracksByDrive')
    async getTracksByDrive(driveId: string): Promise<any[]> {
        try {
            const tracks = this.libraryCacheManager.getTracksByDrive(driveId);
            console.log(`📀 获取网络磁盘 ${driveId} 的歌曲: ${tracks.length} 首`);
            return tracks;
        } catch (error: any) {
            console.error('❌ 获取网络磁盘歌曲失败:', error);
            return [];
        }
    }

    @IpcHandle('library:updatePlaylistCover')
    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = this.libraryCacheManager.updatePlaylistCover(playlistId, imagePath);
            if (success) {
                await this.libraryCacheManager.saveCache();
                return {success: true};
            }
            return {success: false, error: '更新歌单封面失败'};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:getPlaylistCover')
    async getPlaylistCover(playlistId: string): Promise<{ success: boolean; coverPath?: string; error?: string }> {
        try {
            const coverPath = this.libraryCacheManager.getPlaylistCover(playlistId) ?? undefined;
            return {success: true, coverPath};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:removePlaylistCover')
    async removePlaylistCover(playlistId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = this.libraryCacheManager.removePlaylistCover(playlistId);
            if (success) {
                await this.libraryCacheManager.saveCache();
                return {success: true};
            }
            return {success: false, error: '移除歌单封面失败'};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:scanSingleFile')
    async scanSingleFile(networkPath: string): Promise<any> {
        try {
            const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.ape'];
            const existing = this.libraryCacheManager.getAllTracks().find((t: any) => t.filePath === networkPath);
            if (existing) return {success: true, track: existing, isNew: false};
            const ext = path.extname(networkPath).toLowerCase();
            if (!audioExtensions.includes(ext)) return {success: false, error: '不支持的音频格式'};
            const stats = await this.networkFileAdapter.stat(networkPath);
            const isDir = typeof stats.isDirectory === 'function' ? stats.isDirectory() : Boolean((stats as any).isDirectory);
            if (isDir) return {success: false, error: '这是一个文件夹，不是音频文件'};
            const metadata = await this.parseMetadata(networkPath, this.networkFileAdapter);
            const fileName = path.basename(networkPath);
            const trackData = {
                filePath: networkPath,
                fileName,
                title: metadata.title || path.basename(fileName, ext),
                artist: metadata.artist || '未知艺术家',
                album: metadata.album || '未知专辑',
                duration: metadata.duration || 0,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                year: metadata.year,
                genre: Array.isArray(metadata.genre) ? metadata.genre.join(', ') : (metadata.genre || ''),
                track: (metadata as any).track,
                disc: (metadata as any).disc,
                embeddedLyrics: metadata.embeddedLyrics,
                fileSize: stats.size || 0,
                isNetworkFile: true
            };
            const cacheTrack = {trackData, filePath: networkPath, stats};
            const addedTracks = this.libraryCacheManager.addTracks([cacheTrack]);
            await this.libraryCacheManager.saveCache();
            console.log(`✅ 单个文件扫描完成: ${trackData.title} - ${trackData.artist}`);
            const win = this.windowManager.getMainWindow();
            if (win) win.webContents.send('library:updated', [trackData]);
            return {success: true, track: addedTracks[0], isNew: true};
        } catch (error: any) {
            console.error('❌ 扫描单个文件失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('library:scanNetworkDrive')
    async scanNetworkDrive(driveId: string, relativePath = '/'): Promise<boolean> {
        try {
            const driveInfo = this.networkDriveManager.getDriveInfo(driveId);
            if (!driveInfo) throw new Error(`网络磁盘 ${driveId} 未找到`);
            const status = this.networkDriveManager.getDriveStatus(driveId);
            if (!status || !status.connected) throw new Error(`网络磁盘 ${driveId} 未连接`);
            const networkPath = this.networkFileAdapter.buildNetworkPath(driveId, relativePath);
            console.log(`🌐 扫描网络磁盘: ${driveInfo.config.displayName} - ${networkPath}`);
            return this.scanNetworkDirectory(networkPath, Date.now());
        } catch (error: any) {
            console.error('❌ 网络磁盘扫描失败:', error);
            return false;
        }
    }

    @IpcHandle('library:scanDirectoryForFiles')
    async scanDirectoryForFiles(directoryPath: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
        try {
            const audioExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.ape'];
            const audioFiles: any[] = [];
            const BATCH_SIZE = 20;
            const collectFiles = async (dir: string): Promise<{ path: string; stat: any; name: string }[]> => {
                const files: any[] = [];
                try {
                    const items = await fs.promises.readdir(dir);
                    const itemPaths = items.map(item => path.join(dir, item));
                    const stats = await Promise.all(itemPaths.map(p => fs.promises.stat(p).catch(() => null)));
                    for (let i = 0; i < items.length; i++) {
                        const stat = stats[i];
                        if (!stat) continue;
                        if (stat.isDirectory()) files.push(...await collectFiles(itemPaths[i]));
                        else if (audioExtensions.includes(path.extname(items[i]).toLowerCase()))
                            files.push({path: itemPaths[i], stat, name: items[i]});
                    }
                } catch (e: any) {
                    console.error(`扫描目录错误 ${dir}:`, e.message);
                }
                return files;
            };
            const files = await collectFiles(directoryPath);
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                const results = await Promise.all(batch.map(async ({path: fp, stat, name}) => {
                    try {
                        const metadata = await this.parseMetadata(fp, null, {skipCover: true, skipLyrics: true});
                        const ext = path.extname(name);
                        return {
                            filePath: fp, fileName: name, title: metadata.title || path.basename(name, ext),
                            artist: metadata.artist || '未知艺术家', album: metadata.album || '未知专辑',
                            duration: metadata.duration, bitrate: metadata.bitrate, sampleRate: metadata.sampleRate,
                            year: metadata.year, genre: metadata.genre, track: (metadata as any).track,
                            disc: (metadata as any).disc, fileSize: stat.size, embeddedLyrics: metadata.embeddedLyrics
                        };
                    } catch {
                        return {
                            filePath: fp, fileName: name, title: path.basename(name, path.extname(name)),
                            artist: '未知艺术家', album: '未知专辑', duration: 0, fileSize: stat.size
                        };
                    }
                }));
                audioFiles.push(...results);
            }
            return {success: true, files: audioFiles};
        } catch (error: any) {
            console.error('❌ 扫描文件夹失败:', error);
            return {success: false, error: error.message, files: []};
        }
    }

    @IpcHandle('library:addTrackToLibrary')
    async addTrackToLibrary(audioFile: any): Promise<{
        success: boolean;
        track?: any;
        isNew?: boolean;
        error?: string
    }> {
        try {
            const existing = this.libraryCacheManager.getAllTracks().find((t: any) => t.filePath === audioFile.filePath);
            if (existing) return {success: true, track: existing, isNew: false};
            const stats = await fs.promises.stat(audioFile.filePath);
            const trackData = {
                title: audioFile.title, artist: audioFile.artist, album: audioFile.album,
                duration: audioFile.duration, bitrate: audioFile.bitrate, sampleRate: audioFile.sampleRate,
                year: audioFile.year, genre: audioFile.genre, track: audioFile.track,
                disc: audioFile.disc, embeddedLyrics: audioFile.embeddedLyrics
            };
            const cacheTrack = this.libraryCacheManager.addTrack(trackData, audioFile.filePath, stats);
            await this.libraryCacheManager.saveCache();
            const win = this.windowManager.getMainWindow();
            if (win) win.webContents.send('library:updated', this.libraryCacheManager.getAllTracks());
            return {success: true, track: cacheTrack, isNew: true};
        } catch (error: any) {
            console.error('❌ 添加音频文件到音乐库失败:', error);
            return {success: false, error: error.message};
        }
    }

    private async updateNetworkFileMetadata(filePath: string, metadata: any): Promise<any> {
        const os = require('os');
        const tempFilePath = path.join(os.tmpdir(), `musicbox_net_${Date.now()}${path.extname(filePath)}`);
        try {
            const buffer = await this.networkFileAdapter.readFile(filePath);
            await fs.promises.writeFile(tempFilePath, buffer);
            const result = await this.metadataHandler.updateMetadata(tempFilePath, metadata);
            if (!result.success) throw new Error(result.error || '临时文件元数据更新失败');
            const modifiedBuffer = await fs.promises.readFile(tempFilePath);
            await this.networkFileAdapter.writeFile(filePath, modifiedBuffer);
            return {success: true, method: '网络文件临时编辑'};
        } catch (error: any) {
            console.error(`❌ 网络文件元数据更新失败: ${error.message}`);
            throw error;
        } finally {
            try {
                await fs.promises.unlink(tempFilePath);
            } catch {
            }
        }
    }
}
