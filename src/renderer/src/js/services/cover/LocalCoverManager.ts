/**
 * 本地封面文件管理器
 * 负责本地封面文件的缓存、检索和管理逻辑
 */

import type {Track} from "@api/types/track";

export interface LocalCoverResult {
    success: boolean;
    error?: string;
    filePath?: string;
    fileName?: string;
    source?: string;
}

type CoverImageData = string | Blob;
type CoverImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | string;

class LocalCoverManager {
    private coverDirectory: string | null;
    private readonly cache: Map<string, string>;
    private readonly maxCacheSize: number;

    constructor() {
        this.coverDirectory = null;
        this.cache = new Map();
        this.maxCacheSize = 5;
    }

    /**
     * 设置本地封面缓存目录
     * @param {string} directory - 封面缓存目录路径
     */
    setCoverDirectory(directory: string): void {
        this.coverDirectory = directory;
        this.cache.clear(); // 清空缓存
    }

    /**
     * 获取当前封面缓存目录
     * @returns {string|null} 当前设置的封面缓存目录
     */
    getCoverDirectory(): string | null {
        return this.coverDirectory;
    }

    /**
     * 生成封面文件名
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     * @returns {string} 封面文件名（不含扩展名）
     */
    generateCoverFileName(title: string, artist: string, album = ''): string {
        // 清理文件名中的非法字符
        const cleanString = (str: unknown): string => {
            if (str == null) return '';
            return String(str)
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, '_')
                .substring(0, 100); // 限制长度
        };

        const cleanTitle = cleanString(title);
        const cleanArtist = cleanString(artist);
        const cleanAlbum = cleanString(album);

        // Artist-only 命名：当没有标题和专辑时，使用 艺术家__ARTIST 做强区分
        if (!cleanTitle && !cleanAlbum) {
            return `${cleanArtist}__ARTIST`;
        }
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
    generateCacheKey(title: string, artist: string, album = ''): string {
        const s = (v: unknown): string => (v == null ? '' : String(v)).toLowerCase();
        if (!title && !album) {
            // Artist-only 缓存键前缀，避免与单曲/专辑封面混淆
            return `artist|${s(artist)}`;
        }
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
    async checkLocalCover(title: string, artist: string, album = ''): Promise<LocalCoverResult> {
        try {
            if (!this.coverDirectory) {
                return {success: false, error: '未设置封面缓存目录'};
            }

            const cacheKey = this.generateCacheKey(title, artist, album);
            if (this.cache.has(cacheKey)) {
                const cachedPath = this.cache.get(cacheKey)!;
                return {
                    success: true,
                    filePath: cachedPath,
                    source: 'memory-cache'
                };
            }

            // 搜索匹配的封面文件
            const isAlbum = !title;
            const searchResult = await window.electronAPI.covers.checkLocalCover(
                this.coverDirectory, title, artist, album, isAlbum
            );

            if (searchResult.success && searchResult.filePath) {
                // 当没有标题时，需要验证文件命名规范以避免误命中
                if (!title) {
                    const expectedBase = this.generateCoverFileName('', artist, album);
                    const ok = searchResult.fileName && searchResult.fileName.startsWith(`${expectedBase}.`);
                    if (!ok) {
                        // 根据是否有专辑名称确定错误类型
                        const errorType = album ? 'album-only' : 'artist-only';
                        return {success: false, error: `未找到本地封面缓存（${errorType} 过滤）`};
                    }
                }
                // 添加到内存缓存
                this.addToCache(cacheKey, searchResult.filePath);
                return {
                    success: true,
                    filePath: searchResult.filePath,
                    fileName: searchResult.fileName,
                    source: 'local-cache'
                };
            } else {
                console.log(`❌ LocalCoverManager: 未找到本地封面缓存`, {
                    title: title || '(专辑模式)',
                    artist,
                    album,
                    error: searchResult.error
                });
                return {success: false, error: '未找到本地封面缓存'};
            }
        } catch (error) {
            console.error('❌ LocalCoverManager: 检查本地封面缓存失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
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
    async saveCoverToCache(
        title: string,
        artist: string,
        album = '',
        imageData: CoverImageData,
        imageFormat: CoverImageFormat = 'jpg'
    ): Promise<LocalCoverResult> {
        try {
            if (!this.coverDirectory) {
                return {success: false, error: '未设置封面缓存目录'};
            }
            console.log(`💾 LocalCoverManager: 保存封面到本地缓存 - ${title} by ${artist}`);

            // 生成文件名
            const fileName = this.generateCoverFileName(title, artist, album);
            let fullFileName = `${fileName}.${imageFormat}`;

            // 处理不同类型的图片数据
            let processedImageData: string | ArrayBuffer;
            let dataType: 'arrayBuffer' | 'string';

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
                this.addToCache(cacheKey, saveResult.filePath!);
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
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    /**
     * 添加到内存缓存
     * @param {string} key - 缓存键
     * @param {string} filePath - 文件路径
     */
    addToCache(key: string, filePath: string): void {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, filePath);
    }

    /**
     * 清空内存缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 清理特定歌曲的封面缓存
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑名称
     */
    clearCacheForTrack(title: string, artist: string, album = ''): boolean {
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
    async refreshCoverForTrack(title: string, artist: string, album = ''): Promise<LocalCoverResult> {
        // 清理缓存
        this.clearCacheForTrack(title, artist, album);

        // 重新检查封面
        return await this.checkLocalCover(title, artist, album);
    }

    /**
     * 预加载常用封面文件
     * @param {Array} trackList - 歌曲列表
     */
    async preloadCovers(trackList: Track[]): Promise<void> {
        if (!this.coverDirectory || !Array.isArray(trackList)) {
            return;
        }
        for (const track of trackList.slice(0, 6)) { // 预加载数量
            try {
                await this.checkLocalCover(track.title, track.artist, track.album || '');
            } catch (error) {
            }
        }
    }
}

const localCoverManager = new LocalCoverManager();
export {localCoverManager};
