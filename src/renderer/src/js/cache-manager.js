/**
 * 缓存管理器 - 用于缓存封面和歌词数据
 * 提供内存缓存和本地存储缓存功能
 */

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.maxMemorySize = 100; // 最大内存缓存条目数
        this.storagePrefix = 'musicbox_cache_';
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
    setLocalCache(key, data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now(),
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
            this.setLocalCache(key, coverData);
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

        if (lyricsData.success) {
            // 为本地歌词添加额外的元数据
            const cacheData = {
                ...lyricsData,
                cachedAt: Date.now(),
                cacheSource: 'cache-manager'
            };
            this.setLocalCache(key, cacheData);
            console.log(`🗄️ CacheManager: 歌词已缓存 - ${title} (来源: ${lyricsData.source || 'unknown'})`);
        }
    }

    getLyricsCache(title, artist, album) {
        const key = this.generateKey('lyrics', title, artist, album);

        let cached = this.getMemoryCache(key);
        if (cached) {
            // 验证本地歌词缓存的有效性
            if (cached.source === 'local' && cached.filePath) {
                // 这里可以添加文件存在性检查，但为了性能考虑暂时跳过
                console.log(`✅ CacheManager: 内存缓存命中 - ${title} (本地歌词)`);
            }
            return cached;
        }

        cached = this.getLocalCache(key);
        if (cached) {
            // 验证本地歌词缓存
            if (cached.source === 'local' && cached.filePath) {
                console.log(`✅ CacheManager: 本地缓存命中 - ${title} (本地歌词文件: ${cached.fileName || '未知'})`);
            }
            this.setMemoryCache(key, cached);
            return cached;
        }
        return null;
    }

    // 获取歌词缓存统计信息
    getLyricsCacheStats() {
        try {
            const stats = {
                total: 0,
                local: 0,
                network: 0,
                memory: this.memoryCache.size
            };

            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key.startsWith(this.storagePrefix)) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(key));
                        if (cached && cached.data && cached.data.success) {
                            stats.total++;
                            if (cached.data.source === 'local') {
                                stats.local++;
                            } else if (cached.data.source === 'network') {
                                stats.network++;
                            }
                        }
                    } catch (e) {
                    }
                }
            }

            return stats;
        } catch (error) {
            console.warn('❌ CacheManager: 获取缓存统计失败:', error);
            return { total: 0, local: 0, network: 0, memory: 0 };
        }
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

window.cacheManager = new CacheManager();
