/**
 * 本地封面文件管理器
 * 负责本地封面文件的缓存、检索和管理逻辑
 */

class LocalCoverManager {
    constructor() {
        this.coverDirectory = null;
        this.cache = new Map();
        this.maxCacheSize = 10;
        this.supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    }

    /**
     * 设置本地封面缓存目录
     * @param {string} directory - 封面缓存目录路径
     */
    setCoverDirectory(directory) {
        this.coverDirectory = directory;
        this.cache.clear(); // 清空缓存
        console.log(`📁 LocalCoverManager: 设置封面缓存目录为 ${directory}`);
    }

    /**
     * 获取当前封面缓存目录
     * @returns {string|null} 当前设置的封面缓存目录
     */
    getCoverDirectory() {
        return this.coverDirectory;
    }

    /**
     * 生成封面文件名
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {string} 封面文件名（不含扩展名）
     */
    generateCoverFileName(title, artist, album = '') {
        // 清理文件名中的非法字符
        const cleanString = (str) => {
            if (str == null) return '';
            return String(str)
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, '_')
                .substring(0, 100); // 限制长度
        };

        const cleanTitle = cleanString(title);
        const cleanArtist = cleanString(artist);
        const cleanAlbum = cleanString(album);

        // Album-only 命名：当没有标题时，使用 艺术家_专辑__ALBUM 做强区分
        if (!cleanTitle && cleanAlbum) {
            return `${cleanArtist}_${cleanAlbum}__ALBUM`;
        }
        // 优先使用 艺术家_歌曲_专辑 格式，如果没有专辑则使用 艺术家_歌曲
        if (cleanAlbum) {
            return `${cleanArtist}_${cleanTitle}_${cleanAlbum}`;
        } else {
            return `${cleanArtist}_${cleanTitle}`;
        }
    }

    /**
     * 生成缓存键
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {string} 缓存键
     */
    generateCacheKey(title, artist, album = '') {
        const s = (v) => (v == null ? '' : String(v)).toLowerCase();
        if (!title) {
            // Album-only 缓存键前缀，避免与单曲封面混淆
            return `album|${s(artist)}|${s(album)}`;
        }
        return `${s(artist)}|${s(title)}|${s(album)}`;
    }

    /**
     * 检查本地封面缓存是否存在
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {Promise<Object>} 检查结果
     */
    async checkLocalCover(title, artist, album = '') {
        try {
            if (!this.coverDirectory) {
                return {success: false, error: '未设置封面缓存目录'};
            }

            const cacheKey = this.generateCacheKey(title, artist, album);
            if (this.cache.has(cacheKey)) {
                const cachedPath = this.cache.get(cacheKey);
                console.log(`✅ LocalCoverManager: 内存缓存命中 - ${title}`);
                return {
                    success: true,
                    filePath: cachedPath,
                    source: 'memory-cache'
                };
            }

            // console.log(`🔍 LocalCoverManager: 检查本地封面缓存 - ${title} by ${artist}`);

            // 搜索匹配的封面文件
            const isAlbum = !title;
            const searchResult = await window.electronAPI.covers.checkLocalCover(
                this.coverDirectory, title, artist, album, isAlbum
            );

            if (searchResult.success && searchResult.filePath) {
                // Album-only 查询时，仅接受专辑命名规范的文件，避免误命中单曲封面
                if (!title) {
                    const expectedBase = this.generateCoverFileName('', artist, album); // artist_album__ALBUM
                    const ok = searchResult.fileName && searchResult.fileName.startsWith(`${expectedBase}.`);
                    if (!ok) {
                        return {success: false, error: '未找到本地封面缓存（album-only 过滤）'};
                    }
                }
                // 添加到内存缓存
                this.addToCache(cacheKey, searchResult.filePath);
                // console.log(`✅ LocalCoverManager: 找到本地封面缓存 - ${searchResult.fileName}`);
                return {
                    success: true,
                    filePath: searchResult.filePath,
                    fileName: searchResult.fileName,
                    source: 'local-cache'
                };
            } else {
                console.log(`❌ LocalCoverManager: 未找到本地封面缓存 - ${title}`);
                return {success: false, error: '未找到本地封面缓存'};
            }
        } catch (error) {
            console.error('❌ LocalCoverManager: 检查本地封面缓存失败:', error);
            return {success: false, error: error.message};
        }
    }

    /**
     * 保存封面到本地缓存
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @param {string|Blob} imageData - 图片数据（URL或Blob）
     * @param {string} imageFormat - 图片格式（jpg, png等）
     * @returns {Promise<Object>} 保存结果
     */
    async saveCoverToCache(title, artist, album = '', imageData, imageFormat = 'jpg') {
        try {
            if (!this.coverDirectory) {
                return {success: false, error: '未设置封面缓存目录'};
            }
            console.log(`💾 LocalCoverManager: 保存封面到本地缓存 - ${title} by ${artist}`);

            // 生成文件名
            const fileName = this.generateCoverFileName(title, artist, album);
            let fullFileName = `${fileName}.${imageFormat}`;

            // 处理不同类型的图片数据
            let processedImageData;
            let dataType;

            if (imageData instanceof Blob) {
                // 将Blob转换为ArrayBuffer以便IPC传输
                console.log(`🔄 LocalCoverManager: 转换Blob数据为ArrayBuffer - ${imageData.type}`);
                processedImageData = await imageData.arrayBuffer();
                dataType = 'arrayBuffer';

                // 从Blob的MIME类型推断图片格式
                if (imageData.type.includes('png')) imageFormat = 'png';
                else if (imageData.type.includes('webp')) imageFormat = 'webp';
                else if (imageData.type.includes('gif')) imageFormat = 'gif';
                else if (imageData.type.includes('jpeg') || imageData.type.includes('jpg')) imageFormat = 'jpg';

                // 更新文件名
                const baseFileName = this.generateCoverFileName(title, artist, album);
                fullFileName = `${baseFileName}.${imageFormat}`;

            } else if (typeof imageData === 'string') {
                // 字符串类型（URL或base64）
                processedImageData = imageData;
                dataType = 'string';
            } else {
                return {success: false, error: '不支持的图片数据格式'};
            }

            // 调用主进程保存文件
            const saveResult = await window.electronAPI.covers.saveCoverFile(
                this.coverDirectory, fullFileName, processedImageData, dataType
            );

            if (saveResult.success) {
                // 添加到内存缓存
                const cacheKey = this.generateCacheKey(title, artist, album);
                this.addToCache(cacheKey, saveResult.filePath);
                console.log(`✅ LocalCoverManager: 封面保存成功 - ${fullFileName}`);
                return {
                    success: true,
                    filePath: saveResult.filePath,
                    fileName: fullFileName,
                    source: 'saved-to-cache'
                };
            } else {
                console.error(`❌ LocalCoverManager: 封面保存失败 - ${saveResult.error}`);
                return {success: false, error: saveResult.error};
            }
        } catch (error) {
            console.error('❌ LocalCoverManager: 保存封面到本地缓存失败:', error);
            return {success: false, error: error.message};
        }
    }

    /**
     * 添加到内存缓存
     * @param {string} key - 缓存键
     * @param {string} filePath - 文件路径
     */
    addToCache(key, filePath) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, filePath);
    }

    /**
     * 清空内存缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 LocalCoverManager: 内存缓存已清空');
    }

    /**
     * 清理特定歌曲的封面缓存
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     */
    clearCacheForTrack(title, artist, album = '') {
        const cacheKey = this.generateCacheKey(title, artist, album);
        if (this.cache.has(cacheKey)) {
            this.cache.delete(cacheKey);
            console.log(`🧹 LocalCoverManager: 清理歌曲缓存 - ${title} by ${artist}`);
            return true;
        }
        return false;
    }

    /**
     * 强制刷新特定歌曲的封面
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {Promise<Object>} 刷新结果
     */
    async refreshCoverForTrack(title, artist, album = '') {
        console.log(`🔄 LocalCoverManager: 强制刷新封面 - ${title} by ${artist}`);

        // 清理缓存
        this.clearCacheForTrack(title, artist, album);

        // 重新检查封面
        return await this.checkLocalCover(title, artist, album);
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 缓存统计信息
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            directory: this.coverDirectory,
            supportedFormats: this.supportedFormats
        };
    }

    /**
     * 预加载常用封面文件
     * @param {Array} trackList - 歌曲列表
     */
    async preloadCovers(trackList) {
        if (!this.coverDirectory || !Array.isArray(trackList)) {
            return;
        }
        let loadedCount = 0;
        for (const track of trackList.slice(0, 12)) { // 限制预加载数量
            try {
                await this.checkLocalCover(track.title, track.artist, track.album);
                loadedCount++;
            } catch (error) {
            }
        }
    }

    /**
     * 获取默认封面路径
     * @returns {string} 默认封面路径
     */
    getDefaultCoverPath() {
        return 'assets/images/default-cover.svg';
    }
}

window.localCoverManager = new LocalCoverManager();
