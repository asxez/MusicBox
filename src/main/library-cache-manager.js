/**
 * 音乐库缓存管理器
 * 负责音乐文件元数据的持久化存储、文件有效性验证和增量更新
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LibraryCacheManager {
    constructor() {
        this.cacheFileName = 'music-library-cache.json';
        this.cacheFilePath = null;
        this.cache = {
            lastUpdated: Date.now(),
            scannedDirectories: [], // 已扫描的目录列表
            tracks: [], // 音乐文件缓存
            playlists: [], // 用户创建的歌单
            statistics: {
                totalTracks: 0,
                totalSize: 0,
                totalPlaylists: 0,
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
            const {app} = require('electron');
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

            // 验证和修复缓存数据结构
            this.cache = this.validateAndFixCacheData(parsedCache);

            console.log(`✅ LibraryCacheManager: 缓存加载成功，包含 ${this.cache.tracks.length} 个音乐文件和 ${this.cache.playlists.length} 个歌单`);
            return this.cache;

        } catch (error) {
            console.error('❌ LibraryCacheManager: 缓存加载失败:', error);
            console.log('🔄 LibraryCacheManager: 使用默认空缓存');
            return this.cache;
        }
    }

    // 验证和修复缓存数据结构
    validateAndFixCacheData(cacheData) {
        const defaultCache = {
            lastUpdated: Date.now(),
            scannedDirectories: [],
            tracks: [],
            playlists: [],
            statistics: {
                totalTracks: 0,
                totalSize: 0,
                totalPlaylists: 0,
                lastScanTime: 0,
                scanDuration: 0
            }
        };

        // 确保所有必需的字段都存在
        const validatedCache = {
            lastUpdated: cacheData.lastUpdated || defaultCache.lastUpdated,
            scannedDirectories: Array.isArray(cacheData.scannedDirectories) ? cacheData.scannedDirectories : defaultCache.scannedDirectories,
            tracks: Array.isArray(cacheData.tracks) ? cacheData.tracks : defaultCache.tracks,
            playlists: Array.isArray(cacheData.playlists) ? cacheData.playlists : defaultCache.playlists,
            statistics: {
                totalTracks: (cacheData.statistics && typeof cacheData.statistics.totalTracks === 'number') ? cacheData.statistics.totalTracks : defaultCache.statistics.totalTracks,
                totalSize: (cacheData.statistics && typeof cacheData.statistics.totalSize === 'number') ? cacheData.statistics.totalSize : defaultCache.statistics.totalSize,
                totalPlaylists: (cacheData.statistics && typeof cacheData.statistics.totalPlaylists === 'number') ? cacheData.statistics.totalPlaylists : defaultCache.statistics.totalPlaylists,
                lastScanTime: (cacheData.statistics && typeof cacheData.statistics.lastScanTime === 'number') ? cacheData.statistics.lastScanTime : defaultCache.statistics.lastScanTime,
                scanDuration: (cacheData.statistics && typeof cacheData.statistics.scanDuration === 'number') ? cacheData.statistics.scanDuration : defaultCache.statistics.scanDuration
            }
        };

        // 验证歌单数据结构
        validatedCache.playlists = validatedCache.playlists.filter(playlist => {
            return playlist &&
                typeof playlist.id === 'string' &&
                typeof playlist.name === 'string' &&
                Array.isArray(playlist.trackIds);
        });

        console.log(`🔍 LibraryCacheManager: 缓存数据验证完成，修复了数据结构`);
        return validatedCache;
    }

    // 保存缓存数据
    async saveCache() {
        try {
            // 确保所有字段都存在且为正确类型
            if (!Array.isArray(this.cache.tracks)) {
                this.cache.tracks = [];
            }
            if (!Array.isArray(this.cache.playlists)) {
                this.cache.playlists = [];
            }
            if (!this.cache.statistics || typeof this.cache.statistics !== 'object') {
                this.cache.statistics = {
                    totalTracks: 0,
                    totalSize: 0,
                    totalPlaylists: 0,
                    lastScanTime: 0,
                    scanDuration: 0
                };
            }

            this.cache.lastUpdated = Date.now();
            this.cache.statistics.totalTracks = this.cache.tracks.length;
            this.cache.statistics.totalPlaylists = this.cache.playlists.length;
            this.cache.statistics.totalSize = this.cache.tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0);

            const cacheData = JSON.stringify(this.cache, null, 2);
            fs.writeFileSync(this.cacheFilePath, cacheData, 'utf8');
            console.log('✅ LibraryCacheManager缓存路径：', this.cacheFilePath);
            console.log(`✅ LibraryCacheManager: 缓存保存成功，包含 ${this.cache.tracks.length} 个音乐文件和 ${this.cache.playlists.length} 个歌单`);
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
                return {valid: false, reason: 'file_not_found'};
            }

            const stats = fs.statSync(track.filePath);
            const currentId = this.generateFileId(track.filePath, stats);

            if (currentId !== track.fileId) {
                return {valid: false, reason: 'file_modified', stats};
            }
            return {valid: true};
        } catch (error) {
            return {valid: false, reason: 'access_error', error: error.message};
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
                    modifiedTracks.push({track, stats: validation.stats});
                } else {
                    invalidTracks.push({track, reason: validation.reason});
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

        for (const {trackData, filePath, stats} of tracksData) {
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
        // 确保所有字段都存在且为正确类型
        const tracks = Array.isArray(this.cache.tracks) ? this.cache.tracks : [];
        const playlists = Array.isArray(this.cache.playlists) ? this.cache.playlists : [];
        const scannedDirectories = Array.isArray(this.cache.scannedDirectories) ? this.cache.scannedDirectories : [];
        const statistics = this.cache.statistics || {};

        return {
            ...statistics,
            totalTracks: tracks.length,
            totalPlaylists: playlists.length,
            totalSize: tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0),
            scannedDirectories: scannedDirectories.length,
            cacheAge: Date.now() - (this.cache.lastUpdated || Date.now())
        };
    }

    // 清空缓存
    clearCache() {
        this.cache = {
            lastUpdated: Date.now(),
            scannedDirectories: [],
            tracks: [],
            playlists: [],
            statistics: {
                totalTracks: 0,
                totalSize: 0,
                totalPlaylists: 0,
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

    // 歌单管理方法
    // 创建新歌单
    createPlaylist(name, description = '') {
        if (!name || name.trim() === '') {
            throw new Error('歌单名称不能为空');
        }
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
        }

        // 检查歌单名称是否已存在
        const existingPlaylist = this.cache.playlists.find(p => p.name === name.trim());
        if (existingPlaylist) {
            throw new Error('歌单名称已存在');
        }

        const playlist = {
            id: this.generatePlaylistId(),
            name: name.trim(),
            description: description.trim(),
            trackIds: [], // 存储音乐文件的fileId
            createdAt: Date.now(),
            updatedAt: Date.now(),
            coverImage: null // 歌单封面
        };
        this.cache.playlists.push(playlist);
        console.log(`✅ LibraryCacheManager: 创建歌单 - ${playlist.name} (ID: ${playlist.id})`);
        return playlist;
    }

    // 生成歌单唯一ID
    generatePlaylistId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `playlist_${timestamp}_${random}`;
    }

    // 获取所有歌单
    getAllPlaylists() {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
        }
        return [...this.cache.playlists];
    }

    // 根据ID获取歌单
    getPlaylistById(playlistId) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
            return null;
        }
        return this.cache.playlists.find(p => p.id === playlistId);
    }

    // 删除歌单
    deletePlaylist(playlistId) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
            throw new Error('歌单不存在');
        }

        const index = this.cache.playlists.findIndex(p => p.id === playlistId);
        if (index === -1) {
            throw new Error('歌单不存在');
        }

        const playlist = this.cache.playlists[index];
        this.cache.playlists.splice(index, 1);
        console.log(`🗑️ LibraryCacheManager: 删除歌单 - ${playlist.name}`);

        return true;
    }

    // 重命名歌单
    renamePlaylist(playlistId, newName) {
        if (!newName || newName.trim() === '') {
            throw new Error('歌单名称不能为空');
        }

        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
            throw new Error('歌单不存在');
        }

        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) {
            throw new Error('歌单不存在');
        }

        // 检查新名称是否与其他歌单重复
        const existingPlaylist = this.cache.playlists.find(p => p.id !== playlistId && p.name === newName.trim());
        if (existingPlaylist) {
            throw new Error('歌单名称已存在');
        }

        const oldName = playlist.name;
        playlist.name = newName.trim();
        playlist.updatedAt = Date.now();

        console.log(`✏️ LibraryCacheManager: 重命名歌单 - ${oldName} -> ${playlist.name}`);
        return playlist;
    }

    // 添加歌曲到歌单
    addTrackToPlaylist(playlistId, trackFileId) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
        }
        if (!Array.isArray(this.cache.tracks)) {
            console.warn('⚠️ LibraryCacheManager: tracks 不是数组，重置为空数组');
            this.cache.tracks = [];
        }

        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) {
            throw new Error('歌单不存在');
        }

        // 检查歌曲是否存在
        const track = this.cache.tracks.find(t => t.fileId === trackFileId);
        if (!track) {
            throw new Error('歌曲不存在');
        }

        if (!Array.isArray(playlist.trackIds)) {
            playlist.trackIds = [];
        }

        if (playlist.trackIds.includes(trackFileId)) {
            throw new Error('歌曲已在歌单中');
        }

        playlist.trackIds.push(trackFileId);
        playlist.updatedAt = Date.now();

        console.log(`➕ LibraryCacheManager: 添加歌曲到歌单 - ${track.title} -> ${playlist.name}`);
        return playlist;
    }

    // 从歌单移除歌曲
    removeTrackFromPlaylist(playlistId, trackFileId) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
        }
        if (!Array.isArray(this.cache.tracks)) {
            console.warn('⚠️ LibraryCacheManager: tracks 不是数组，重置为空数组');
            this.cache.tracks = [];
        }

        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) {
            throw new Error('歌单不存在');
        }

        if (!Array.isArray(playlist.trackIds)) {
            playlist.trackIds = [];
            throw new Error('歌曲不在歌单中');
        }

        const index = playlist.trackIds.indexOf(trackFileId);
        if (index === -1) {
            throw new Error('歌曲不在歌单中');
        }

        playlist.trackIds.splice(index, 1);
        playlist.updatedAt = Date.now();

        const track = this.cache.tracks.find(t => t.fileId === trackFileId);
        console.log(`➖ LibraryCacheManager: 从歌单移除歌曲 - ${track?.title || trackFileId} <- ${playlist.name}`);

        return playlist;
    }


    // 获取歌单中的歌曲详情
    getPlaylistTracks(playlistId) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
        }
        if (!Array.isArray(this.cache.tracks)) {
            console.warn('⚠️ LibraryCacheManager: tracks 不是数组，重置为空数组');
            this.cache.tracks = [];
        }

        const playlist = this.getPlaylistById(playlistId);
        if (!playlist) {
            throw new Error('歌单不存在');
        }

        if (!Array.isArray(playlist.trackIds)) {
            playlist.trackIds = [];
        }

        const tracks = [];
        for (const trackId of playlist.trackIds) {
            const track = this.cache.tracks.find(t => t.fileId === trackId);
            if (track) {
                tracks.push(track);
            } else {
                console.warn(`⚠️ LibraryCacheManager: 歌单中的歌曲不存在 - ${trackId}`);
            }
        }

        return tracks;
    }

    // 清理歌单中无效的歌曲引用
    cleanupPlaylistTracks() {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，重置为空数组');
            this.cache.playlists = [];
            return 0;
        }
        if (!Array.isArray(this.cache.tracks)) {
            console.warn('⚠️ LibraryCacheManager: tracks 不是数组，重置为空数组');
            this.cache.tracks = [];
            return 0;
        }

        let cleanedCount = 0;
        const validTrackIds = new Set(this.cache.tracks.map(t => t.fileId));

        for (const playlist of this.cache.playlists) {
            if (!Array.isArray(playlist.trackIds)) {
                playlist.trackIds = [];
                continue;
            }

            const originalLength = playlist.trackIds.length;
            playlist.trackIds = playlist.trackIds.filter(trackId => validTrackIds.has(trackId));

            if (playlist.trackIds.length !== originalLength) {
                const removedCount = originalLength - playlist.trackIds.length;
                cleanedCount += removedCount;
                playlist.updatedAt = Date.now();
                console.log(`🧹 LibraryCacheManager: 清理歌单 ${playlist.name} 中的 ${removedCount} 个无效歌曲引用`);
            }
        }

        if (cleanedCount > 0) {
            console.log(`✅ LibraryCacheManager: 总共清理了 ${cleanedCount} 个无效歌曲引用`);
        }

        return cleanedCount;
    }

    // 更新歌单封面
    updatePlaylistCover(playlistId, coverImagePath) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，无法更新封面');
            return false;
        }

        const playlist = this.cache.playlists.find(p => p.id === playlistId);
        if (!playlist) {
            console.error(`❌ LibraryCacheManager: 找不到歌单 ID: ${playlistId}`);
            return false;
        }

        playlist.coverImage = coverImagePath;
        playlist.updatedAt = Date.now();
        console.log(`✅ LibraryCacheManager: 更新歌单封面 - ${playlist.name} (封面: ${coverImagePath})`);
        return true;
    }

    // 获取歌单封面
    getPlaylistCover(playlistId) {
        if (!Array.isArray(this.cache.playlists)) {
            return null;
        }

        const playlist = this.cache.playlists.find(p => p.id === playlistId);
        return playlist ? playlist.coverImage : null;
    }

    // 移除歌单封面
    removePlaylistCover(playlistId) {
        if (!Array.isArray(this.cache.playlists)) {
            console.warn('⚠️ LibraryCacheManager: playlists 不是数组，无法移除封面');
            return false;
        }

        const playlist = this.cache.playlists.find(p => p.id === playlistId);
        if (!playlist) {
            console.error(`❌ LibraryCacheManager: 找不到歌单 ID: ${playlistId}`);
            return false;
        }

        playlist.coverImage = null;
        playlist.updatedAt = Date.now();
        console.log(`✅ LibraryCacheManager: 移除歌单封面 - ${playlist.name}`);
        return true;
    }
}

module.exports = LibraryCacheManager;
