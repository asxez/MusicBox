/**
 * 缓存管理器 - 用于缓存封面和歌词数据
 * 提供内存缓存和本地存储缓存功能
 */

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.maxMemorySize = 100; // 最大内存缓存条目数
        this.storagePrefix = 'musicbox_cache_';
        this.cacheVersion = '1.0';
        
        console.log('🗄️ CacheManager: 缓存管理器初始化完成');
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
            timestamp: Date.now()
        });
        
        console.log(`🗄️ CacheManager: 内存缓存已设置 - ${key}`);
    }

    getMemoryCache(key) {
        const cached = this.memoryCache.get(key);
        if (cached) {
            console.log(`✅ CacheManager: 内存缓存命中 - ${key}`);
            return cached.data;
        }
        return null;
    }

    // 本地存储缓存操作
    setLocalCache(key, data, expireHours = 24) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now(),
                expireTime: Date.now() + (expireHours * 60 * 60 * 1000),
                version: this.cacheVersion
            };
            
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(cacheData));
            console.log(`🗄️ CacheManager: 本地缓存已设置 - ${key}`);
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存设置失败:', error);
        }
    }

    getLocalCache(key) {
        try {
            const cached = localStorage.getItem(this.storagePrefix + key);
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            
            // 检查版本
            if (cacheData.version !== this.cacheVersion) {
                this.removeLocalCache(key);
                return null;
            }
            
            // 检查是否过期
            if (Date.now() > cacheData.expireTime) {
                this.removeLocalCache(key);
                return null;
            }
            
            console.log(`✅ CacheManager: 本地缓存命中 - ${key}`);
            return cacheData.data;
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存读取失败:', error);
            return null;
        }
    }

    removeLocalCache(key) {
        try {
            localStorage.removeItem(this.storagePrefix + key);
            console.log(`🗑️ CacheManager: 本地缓存已删除 - ${key}`);
        } catch (error) {
            console.warn('❌ CacheManager: 本地缓存删除失败:', error);
        }
    }

    // 封面缓存方法
    setCoverCache(title, artist, album, coverData) {
        const key = this.generateKey('cover', title, artist, album);
        this.setMemoryCache(key, coverData);
        
        // 只缓存成功的封面URL，不缓存blob数据到本地存储
        if (coverData.success && coverData.type === 'url') {
            this.setLocalCache(key, coverData, 168); // 7天过期
        }
    }

    getCoverCache(title, artist, album) {
        const key = this.generateKey('cover', title, artist, album);
        
        // 先检查内存缓存
        let cached = this.getMemoryCache(key);
        if (cached) return cached;
        
        // 再检查本地缓存
        cached = this.getLocalCache(key);
        if (cached) {
            // 将本地缓存加载到内存缓存
            this.setMemoryCache(key, cached);
            return cached;
        }
        
        return null;
    }

    // 歌词缓存方法
    setLyricsCache(title, artist, album, lyricsData) {
        const key = this.generateKey('lyrics', title, artist, album);
        this.setMemoryCache(key, lyricsData);
        
        // 缓存成功的歌词到本地存储
        if (lyricsData.success) {
            this.setLocalCache(key, lyricsData, 168); // 7天过期
        }
    }

    getLyricsCache(title, artist, album) {
        const key = this.generateKey('lyrics', title, artist, album);
        
        // 先检查内存缓存
        let cached = this.getMemoryCache(key);
        if (cached) return cached;
        
        // 再检查本地缓存
        cached = this.getLocalCache(key);
        if (cached) {
            // 将本地缓存加载到内存缓存
            this.setMemoryCache(key, cached);
            return cached;
        }
        
        return null;
    }

    // 清理过期缓存
    cleanExpiredCache() {
        try {
            const keys = Object.keys(localStorage);
            let cleanedCount = 0;
            
            for (const key of keys) {
                if (key.startsWith(this.storagePrefix)) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(key));
                        if (Date.now() > cached.expireTime) {
                            localStorage.removeItem(key);
                            cleanedCount++;
                        }
                    } catch (error) {
                        // 删除损坏的缓存条目
                        localStorage.removeItem(key);
                        cleanedCount++;
                    }
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 CacheManager: 清理了 ${cleanedCount} 个过期缓存条目`);
            }
        } catch (error) {
            console.warn('❌ CacheManager: 清理缓存失败:', error);
        }
    }

    // 清空所有缓存
    clearAllCache() {
        // 清空内存缓存
        this.memoryCache.clear();
        
        // 清空本地缓存
        try {
            const keys = Object.keys(localStorage);
            let removedCount = 0;
            
            for (const key of keys) {
                if (key.startsWith(this.storagePrefix)) {
                    localStorage.removeItem(key);
                    removedCount++;
                }
            }
            
            console.log(`🧹 CacheManager: 清空了所有缓存 (${removedCount} 个条目)`);
        } catch (error) {
            console.warn('❌ CacheManager: 清空缓存失败:', error);
        }
    }

    // 获取缓存统计信息
    getCacheStats() {
        const memorySize = this.memoryCache.size;
        
        let localSize = 0;
        try {
            const keys = Object.keys(localStorage);
            localSize = keys.filter(key => key.startsWith(this.storagePrefix)).length;
        } catch (error) {
            console.warn('❌ CacheManager: 获取本地缓存统计失败:', error);
        }
        
        return {
            memorySize,
            localSize,
            maxMemorySize: this.maxMemorySize
        };
    }
}

// 创建全局缓存管理器实例
const cacheManager = new CacheManager();

// 暴露到全局作用域
window.cacheManager = cacheManager;

// 定期清理过期缓存
// setInterval(() => {
//     cacheManager.cleanExpiredCache();
// }, 60 * 60 * 1000);
