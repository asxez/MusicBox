/**
 * 本地歌词文件管理器
 * 负责本地歌词文件的搜索、匹配和读取逻辑
 */

import {lyricsGateway} from "@js/infrastructure/electron";

type LyricsFormat = 'lrc' | 'ttml';

interface LocalLyricsResult {
    success: boolean;
    error?: string;
    content?: string;
    format?: LyricsFormat;
    source?: 'local';
    filePath?: string;
    fileName?: string;
}

class LocalLyricsManager {
    private lyricsDirectory: string | null;
    private readonly cache: Map<string, LocalLyricsResult>;
    private readonly maxCacheSize: number;

    constructor() {
        this.lyricsDirectory = null;
        this.cache = new Map();
        this.maxCacheSize = 5;
    }

    /**
     * 设置本地歌词目录
     * @param {string} directory - 歌词文件目录路径
     */
    setLyricsDirectory(directory: string): void {
        this.lyricsDirectory = directory;
        this.cache.clear();
        console.log(`📁 LocalLyricsManager: 设置歌词目录为 ${directory}`);
    }

    /**
     * 获取当前歌词目录
     * @returns {string|null} 当前设置的歌词目录
     */
    getLyricsDirectory(): string | null {
        return this.lyricsDirectory;
    }

    /**
     * 搜索并获取本地歌词
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {Promise<Object>} 歌词获取结果
     */
    async getLyrics(title: string, artist: string, album = ''): Promise<LocalLyricsResult> {
        try {
            if (!this.lyricsDirectory) {
                return {success: false, error: '未设置本地歌词目录'};
            }

            const cacheKey = this.generateCacheKey(title, artist, album);
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey)!;
            }
            console.log(`🔍 LocalLyricsManager: 搜索本地歌词 - ${title} by ${artist}`);

            // 优先搜索TTML格式歌词
            const ttmlResult = await lyricsGateway.searchLocalFiles(
                this.lyricsDirectory, title, artist, album, '.ttml'
            );

            if (ttmlResult.success) {
                const readResult = await lyricsGateway.readLocalFile(ttmlResult.filePath!);
                if (readResult.success) {
                    const ttmlContent = this.validateAndCleanLyrics(readResult.content);
                    const result: LocalLyricsResult = {
                        success: true,
                        content: ttmlContent,
                        format: 'ttml',
                        source: 'local',
                        filePath: ttmlResult.filePath,
                        fileName: ttmlResult.fileName
                    };
                    this.setCache(cacheKey, result);
                    console.log(`✅ LocalLyricsManager: 成功获取本地TTML歌词 - ${ttmlResult.fileName}`);
                    return result;
                }
            }

            // 回退到LRC格式
            const lrcResult = await lyricsGateway.searchLocalFiles(
                this.lyricsDirectory, title, artist, album, '.lrc'
            );

            if (!lrcResult.success) {
                const result: LocalLyricsResult = {success: false, error: lrcResult.error};
                this.setCache(cacheKey, result);
                return result;
            }

            // 读取歌词文件内容
            const readResult = await lyricsGateway.readLocalFile(lrcResult.filePath!);
            if (!readResult.success) {
                const result: LocalLyricsResult = {success: false, error: readResult.error};
                this.setCache(cacheKey, result);
                return result;
            }

            // 验证歌词格式
            const lrcContent = this.validateAndCleanLyrics(readResult.content);
            const result: LocalLyricsResult = {
                success: true,
                content: lrcContent,
                format: 'lrc',
                source: 'local',
                filePath: lrcResult.filePath,
                fileName: lrcResult.fileName
            };

            // 缓存结果
            this.setCache(cacheKey, result);
            console.log(`✅ LocalLyricsManager: 成功获取本地LRC歌词 - ${lrcResult.fileName}`);
            return result;
        } catch (error) {
            console.error('❌ LocalLyricsManager: 获取本地歌词失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    /**
     * 验证和清理歌词内容
     * @param {string} content - 原始歌词内容
     * @returns {string} 清理后的歌词内容
     */
    validateAndCleanLyrics(content?: string): string {
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
    generateCacheKey(title: string, artist: string, album = ''): string {
        return `${title}_${artist}_${album}`.toLowerCase().replace(/\s+/g, '_');
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {Object} data - 缓存数据
     */
    setCache(key: string, data: LocalLyricsResult): void {
        // 如果缓存已满，删除最旧的条目
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            ...data,
        });
    }

    /**
     * 保存歌词到本地
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @param {string} content - 歌词内容
     * @param {string} format - 歌词格式 (lrc/ttml)
     * @returns {Promise<Object>} 保存结果
     */
    async saveLyrics(title: string, artist: string, album = '', content: string, format: LyricsFormat = 'lrc'): Promise<{
        success: boolean;
        filePath?: string;
        fileName?: string;
        error?: string;
    }> {
        try {
            if (!this.lyricsDirectory) {
                return {success: false, error: '未设置本地歌词目录'};
            }

            console.log(`💾 LocalLyricsManager: 保存歌词到本地 - ${title} by ${artist} (格式: ${format})`);

            const result = await lyricsGateway.saveToLocal(
                this.lyricsDirectory,
                title,
                artist,
                album,
                content,
                format
            );

            if (result.success) {
                console.log(`✅ LocalLyricsManager: 歌词已保存 - ${result.fileName}`);

                // 清除缓存，确保下次获取时读取新保存的文件
                const cacheKey = this.generateCacheKey(title, artist, album);
                this.cache.delete(cacheKey);
            }

            return result;
        } catch (error) {
            console.error('❌ LocalLyricsManager: 保存歌词失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
        this.cache.clear();
        console.log('🗑️ LocalLyricsManager: 缓存已清空');
    }
}

const localLyricsManager = new LocalLyricsManager();
export {localLyricsManager};
