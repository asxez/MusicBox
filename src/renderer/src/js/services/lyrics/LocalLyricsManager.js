/**
 * 本地歌词文件管理器
 * 负责本地歌词文件的搜索、匹配和读取逻辑
 */

class LocalLyricsManager {
    constructor() {
        this.lyricsDirectory = null;
        this.cache = new Map();
        this.maxCacheSize = 5;
    }

    /**
     * 设置本地歌词目录
     * @param {string} directory - 歌词文件目录路径
     */
    setLyricsDirectory(directory) {
        this.lyricsDirectory = directory;
        this.cache.clear();
        console.log(`📁 LocalLyricsManager: 设置歌词目录为 ${directory}`);
    }

    /**
     * 获取当前歌词目录
     * @returns {string|null} 当前设置的歌词目录
     */
    getLyricsDirectory() {
        return this.lyricsDirectory;
    }

    /**
     * 搜索并获取本地歌词
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {Promise<Object>} 歌词获取结果
     */
    async getLyrics(title, artist, album = '') {
        try {
            if (!this.lyricsDirectory) {
                return {success: false, error: '未设置本地歌词目录'};
            }

            const cacheKey = this.generateCacheKey(title, artist, album);
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            console.log(`🔍 LocalLyricsManager: 搜索本地歌词 - ${title} by ${artist}`);

            // 搜索匹配的歌词文件
            const searchResult = await window.electronAPI.lyrics.searchLocalFiles(
                this.lyricsDirectory, title, artist, album
            );

            if (!searchResult.success) {
                const result = {success: false, error: searchResult.error};
                this.setCache(cacheKey, result);
                return result;
            }

            // 读取歌词文件内容
            const readResult = await window.electronAPI.lyrics.readLocalFile(searchResult.filePath);
            if (!readResult.success) {
                const result = {success: false, error: readResult.error};
                this.setCache(cacheKey, result);
                return result;
            }

            // 验证歌词格式
            const lrcContent = this.validateAndCleanLyrics(readResult.content);
            const result = {
                success: true,
                lrc: lrcContent,
                source: 'local',
                filePath: searchResult.filePath,
                fileName: searchResult.fileName
            };

            // 缓存结果
            this.setCache(cacheKey, result);
            console.log(`✅ LocalLyricsManager: 成功获取本地歌词 - ${searchResult.fileName}`);
            return result;
        } catch (error) {
            console.error('❌ LocalLyricsManager: 获取本地歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    /**
     * 验证和清理歌词内容
     * @param {string} content - 原始歌词内容
     * @returns {string} 清理后的歌词内容
     */
    validateAndCleanLyrics(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // 移除BOM标记
        let cleanContent = content.replace(/^\uFEFF/, '');
        // 统一换行符
        cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // 移除空行过多的情况
        cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n');
        if (!cleanContent.trim()) {
            throw new Error('歌词文件内容为空');
        }
        return cleanContent.trim();
    }

    /**
     * 生成缓存键
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {string} 缓存键
     */
    generateCacheKey(title, artist, album = '') {
        return `${title}_${artist}_${album}`.toLowerCase().replace(/\s+/g, '_');
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {Object} data - 缓存数据
     */
    setCache(key, data) {
        // 如果缓存已满，删除最旧的条目
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            ...data,
        });
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ LocalLyricsManager: 缓存已清空');
    }
}

let localLyricsManager = new LocalLyricsManager();
export {localLyricsManager};
