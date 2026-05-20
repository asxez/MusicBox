/**
 * 缓存管理器 - 用于缓存封面和歌词数据
 * 提供内存缓存和本地存储缓存功能
 */

import {hex_md5} from "@utils/md5";

interface MemoryCacheEntry<T = any> {
    data: T;
}

interface LocalCacheEntry<T = any> {
    data: T;
}

interface LyricsCacheData {
    success?: boolean;
    cachedAt?: number;
    cacheSource?: string;
    [key: string]: unknown;
}

class CacheManager {
    private readonly memoryCache: Map<string, MemoryCacheEntry>;
    private readonly maxMemorySize: number;
    private readonly storagePrefix: string;

    constructor() {
        this.memoryCache = new Map();
        this.maxMemorySize = 5;
        this.storagePrefix = 'musicbox_cache_';
    }

    // 生成缓存键
    generateKey(type: string, title: string, artist: string, album = ''): string {
        return hex_md5((type + title + artist + album).toString());
    }

    // 内存缓存操作
    setMemoryCache<T = any>(key: string, data: T): void {
        // 如果缓存已满，删除最旧的条目
        if (this.memoryCache.size >= this.maxMemorySize) {
            const firstKey = this.memoryCache.keys().next().value;
            if (firstKey) {
                this.memoryCache.delete(firstKey);
            }
        }

        this.memoryCache.set(key, {
            data: data,
        });
    }

    getMemoryCache<T = any>(key: string): T | null {
        const cached = this.memoryCache.get(key);
        if (cached) {
            return cached.data as T;
        }
        return null;
    }

    // 本地存储缓存操作
    setLocalCache<T = any>(key: string, data: T): void {
        try {
            const cacheData: LocalCacheEntry<T> = {
                data: data,
            };
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存设置失败:', error);
        }
    }

    getLocalCache<T = any>(key: string): T | null {
        try {
            const cached = localStorage.getItem(this.storagePrefix + key);
            if (!cached) return null;
            const cacheData = JSON.parse(cached) as LocalCacheEntry<T>;
            return cacheData.data;
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存读取失败:', error);
            return null;
        }
    }

    removeLocalCache(key: string): void {
        localStorage.removeItem(this.storagePrefix + key);
    }

    // 歌词缓存方法
    setLyricsCache(title: string, artist: string, album: string, lyricsData: LyricsCacheData): void {
        const key = this.generateKey('lyrics', title, artist, album);
        this.setMemoryCache(key, lyricsData);
        if (lyricsData.success) {
            // 为本地歌词添加额外的元数据
            const cacheData = {
                ...lyricsData,
                cachedAt: Date.now(),
                cacheSource: 'cache-manager'
            };
            this.setLocalCache(key, cacheData);
        }
    }

    getLyricsCache<T extends LyricsCacheData = LyricsCacheData>(title: string, artist: string, album: string): T | null {
        const key = this.generateKey('lyrics', title, artist, album);
        let cached = this.getMemoryCache<T>(key);
        if (cached) {
            return cached;
        }

        cached = this.getLocalCache<T>(key);
        if (cached) {
            this.setMemoryCache(key, cached);
            return cached;
        }
        return null;
    }

    // 清空内存缓存
    clearMemoryCache(): void {
        this.memoryCache.clear();
    }

    // 清空所有缓存
    clearAllCache(): void {
        this.memoryCache.clear();
        try {
            const keys = Object.keys(localStorage);
            let removedCount = 0;
            for (const key of keys) {
                if (key.startsWith(this.storagePrefix)) {
                    localStorage.removeItem(key);
                    removedCount++;
                }
            }
        } catch (error) {
            console.warn('❌ CacheManager: 清空缓存失败:', error);
        }
    }
}

const cacheManager = new CacheManager();
export {cacheManager};
