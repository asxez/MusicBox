/**
 * 音乐库缓存管理器
 * 负责音乐文件元数据的持久化存储、文件有效性验证和增量更新
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LibraryCacheManager {
    constructor() {
        this.cacheVersion = '1.0.0';
        this.cacheFileName = 'music-library-cache.json';
        this.cacheFilePath = null;
        this.cache = {
            version: this.cacheVersion,
            lastUpdated: Date.now(),
            scannedDirectories: [], // 已扫描的目录列表
            tracks: [], // 音乐文件缓存
            statistics: {
                totalTracks: 0,
                totalSize: 0,
                lastScanTime: 0,
                scanDuration: 0
            }
        };
        
        this.initializeCacheFile();
        console.log('🗄️ LibraryCacheManager: 音乐库缓存管理器初始化完成');
    }

    // 初始化缓存文件路径
    initializeCacheFile() {
        try {
            const { app } = require('electron');
            const userDataPath = app.getPath('userData');
            this.cacheFilePath = path.join(userDataPath, this.cacheFileName);
            console.log(`🗄️ LibraryCacheManager: 缓存文件路径 - ${this.cacheFilePath}`);
        } catch (error) {
            // 如果在非Electron环境中运行，使用当前目录
            this.cacheFilePath = path.join(process.cwd(), this.cacheFileName);
            console.warn('⚠️ LibraryCacheManager: 非Electron环境，使用当前目录作为缓存路径');
        }
    }

    // 生成文件唯一标识符
    generateFileId(filePath, stats) {
        const data = `${filePath}_${stats.size}_${stats.mtime.getTime()}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }

    // 加载缓存数据
    async loadCache() {
        try {
            if (!fs.existsSync(this.cacheFilePath)) {
                console.log('🗄️ LibraryCacheManager: 缓存文件不存在，使用空缓存');
                return this.cache;
            }

            const cacheData = fs.readFileSync(this.cacheFilePath, 'utf8');
            const parsedCache = JSON.parse(cacheData);

            // 检查缓存版本
            if (parsedCache.version !== this.cacheVersion) {
                console.log(`🔄 LibraryCacheManager: 缓存版本不匹配 (${parsedCache.version} -> ${this.cacheVersion})，重置缓存`);
                return this.cache;
            }

            this.cache = parsedCache;
            console.log(`✅ LibraryCacheManager: 缓存加载成功，包含 ${this.cache.tracks.length} 个音乐文件`);
            return this.cache;

        } catch (error) {
            console.error('❌ LibraryCacheManager: 缓存加载失败:', error);
            return this.cache;
        }
    }

    // 保存缓存数据
    async saveCache() {
        try {
            this.cache.lastUpdated = Date.now();
            this.cache.statistics.totalTracks = this.cache.tracks.length;
            this.cache.statistics.totalSize = this.cache.tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0);

            const cacheData = JSON.stringify(this.cache, null, 2);
            fs.writeFileSync(this.cacheFilePath, cacheData, 'utf8');
            
            console.log(`✅ LibraryCacheManager: 缓存保存成功，包含 ${this.cache.tracks.length} 个音乐文件`);
            return true;

        } catch (error) {
            console.error('❌ LibraryCacheManager: 缓存保存失败:', error);
            return false;
        }
    }

    // 验证音乐文件是否仍然有效
    async validateTrack(track) {
        try {
            if (!fs.existsSync(track.filePath)) {
                return { valid: false, reason: 'file_not_found' };
            }

            const stats = fs.statSync(track.filePath);
            const currentId = this.generateFileId(track.filePath, stats);

            if (currentId !== track.fileId) {
                return { valid: false, reason: 'file_modified', stats };
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, reason: 'access_error', error: error.message };
        }
    }

    // 批量验证缓存的音乐文件
    async validateCachedTracks(progressCallback = null) {
        const validTracks = [];
        const invalidTracks = [];
        const modifiedTracks = [];

        console.log(`🔍 LibraryCacheManager: 开始验证 ${this.cache.tracks.length} 个缓存文件`);

        for (let i = 0; i < this.cache.tracks.length; i++) {
            const track = this.cache.tracks[i];
            const validation = await this.validateTrack(track);

            if (validation.valid) {
                validTracks.push(track);
            } else {
                if (validation.reason === 'file_modified') {
                    modifiedTracks.push({ track, stats: validation.stats });
                } else {
                    invalidTracks.push({ track, reason: validation.reason });
                }
            }

            // 报告进度
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: this.cache.tracks.length,
                    valid: validTracks.length,
                    invalid: invalidTracks.length,
                    modified: modifiedTracks.length
                });
            }
        }

        console.log(`✅ LibraryCacheManager: 验证完成 - 有效: ${validTracks.length}, 无效: ${invalidTracks.length}, 已修改: ${modifiedTracks.length}`);

        return {
            valid: validTracks,
            invalid: invalidTracks,
            modified: modifiedTracks
        };
    }

    // 添加音乐文件到缓存
    addTrack(trackData, filePath, stats) {
        const fileId = this.generateFileId(filePath, stats);
        
        const cacheTrack = {
            fileId,
            filePath,
            fileName: path.basename(filePath),
            fileSize: stats.size,
            lastModified: stats.mtime.getTime(),
            addedToCache: Date.now(),
            ...trackData
        };

        // 检查是否已存在
        const existingIndex = this.cache.tracks.findIndex(track => track.filePath === filePath);
        if (existingIndex !== -1) {
            this.cache.tracks[existingIndex] = cacheTrack;
            console.log(`🔄 LibraryCacheManager: 更新缓存文件 - ${trackData.title}`);
        } else {
            this.cache.tracks.push(cacheTrack);
            console.log(`➕ LibraryCacheManager: 添加缓存文件 - ${trackData.title}`);
        }

        return cacheTrack;
    }

    // 批量添加音乐文件
    addTracks(tracksData) {
        const addedTracks = [];
        
        for (const { trackData, filePath, stats } of tracksData) {
            const cacheTrack = this.addTrack(trackData, filePath, stats);
            addedTracks.push(cacheTrack);
        }

        console.log(`✅ LibraryCacheManager: 批量添加 ${addedTracks.length} 个音乐文件到缓存`);
        return addedTracks;
    }

    // 移除无效的缓存条目
    removeInvalidTracks(invalidTracks) {
        const removedCount = invalidTracks.length;
        const invalidPaths = invalidTracks.map(item => item.track.filePath);
        
        this.cache.tracks = this.cache.tracks.filter(track => 
            !invalidPaths.includes(track.filePath)
        );

        console.log(`🗑️ LibraryCacheManager: 移除 ${removedCount} 个无效缓存条目`);
        return removedCount;
    }

    // 添加已扫描目录
    addScannedDirectory(directoryPath) {
        if (!this.cache.scannedDirectories.includes(directoryPath)) {
            this.cache.scannedDirectories.push(directoryPath);
            console.log(`📁 LibraryCacheManager: 添加已扫描目录 - ${directoryPath}`);
        }
    }

    // 获取缓存统计信息
    getCacheStatistics() {
        return {
            ...this.cache.statistics,
            totalTracks: this.cache.tracks.length,
            totalSize: this.cache.tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0),
            scannedDirectories: this.cache.scannedDirectories.length,
            cacheAge: Date.now() - this.cache.lastUpdated
        };
    }

    // 清空缓存
    clearCache() {
        this.cache = {
            version: this.cacheVersion,
            lastUpdated: Date.now(),
            scannedDirectories: [],
            tracks: [],
            statistics: {
                totalTracks: 0,
                totalSize: 0,
                lastScanTime: 0,
                scanDuration: 0
            }
        };
        
        console.log('🧹 LibraryCacheManager: 缓存已清空');
        return this.saveCache();
    }

    // 获取所有缓存的音乐文件
    getAllTracks() {
        return [...this.cache.tracks];
    }

    // 根据条件搜索缓存的音乐文件
    searchTracks(query) {
        if (!query || query.trim() === '') {
            return this.getAllTracks();
        }

        const searchTerm = query.toLowerCase();
        return this.cache.tracks.filter(track => {
            return (track.title && track.title.toLowerCase().includes(searchTerm)) ||
                   (track.artist && track.artist.toLowerCase().includes(searchTerm)) ||
                   (track.album && track.album.toLowerCase().includes(searchTerm)) ||
                   (track.fileName && track.fileName.toLowerCase().includes(searchTerm));
        });
    }
}

module.exports = LibraryCacheManager;
