/**
 * 缓存管理器 - 用于缓存封面和歌词数据
 * 提供内存缓存和本地存储缓存功能
 */

import {hex_md5} from "@utils/md5";

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.maxMemorySize = 5;
        this.storagePrefix = 'musicbox_cache_';
    }

    // 生成缓存键
    generateKey(type, title, artist, album = '') {
        return hex_md5((type + title + artist + album).toString());
    }

    // 内存缓存操作
    setMemoryCache(key, data) {
        // 如果缓存已满，删除最旧的条目
        if (this.memoryCache.size >= this.maxMemorySize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }

        this.memoryCache.set(key, {
            data: data,
        });

        // console.log(`🗄️ CacheManager: 内存缓存已设置 - ${key}`);
    }

    getMemoryCache(key) {
        const cached = this.memoryCache.get(key);
        if (cached) {
            // console.log(`✅ CacheManager: 内存缓存命中 - ${key}`);
            return cached.data;
        }
        return null;
    }

    // 本地存储缓存操作
    setLocalCache(key, data) {
        try {
            const cacheData = {
                data: data,
            };
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(cacheData));
            // console.log(`🗄️ CacheManager: 本地缓存已设置 - ${key}`);
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存设置失败:', error);
        }
    }

    getLocalCache(key) {
        try {
            const cached = localStorage.getItem(this.storagePrefix + key);
            if (!cached) return null;
            const cacheData = JSON.parse(cached);
            // console.log(`✅ CacheManager: 本地缓存命中 - ${key}`);
            return cacheData.data;
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存读取失败:', error);
            return null;
        }
    }

    removeLocalCache(key) {
        localStorage.removeItem(this.storagePrefix + key);
    }

    // 歌词缓存方法
    setLyricsCache(title, artist, album, lyricsData) {
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
            // console.log(`🗄️ CacheManager: 歌词已缓存 - ${title} (来源: ${lyricsData.source || 'unknown'})`);
        }
    }

    getLyricsCache(title, artist, album) {
        const key = this.generateKey('lyrics', title, artist, album);
        let cached = this.getMemoryCache(key);
        if (cached) {
            return cached;
        }

        cached = this.getLocalCache(key);
        if (cached) {
            this.setMemoryCache(key, cached);
            return cached;
        }
        return null;
    }

    // 清空内存缓存
    clearMemoryCache() {
        this.memoryCache.clear();
    }

    // 清空所有缓存
    clearAllCache() {
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
            // console.log(`🧹 CacheManager: 清空了所有缓存 (${removedCount} 个条目)`);
        } catch (error) {
            console.warn('❌ CacheManager: 清空缓存失败:', error);
        }
    }
}

let cacheManager = new CacheManager();
export { cacheManager };
