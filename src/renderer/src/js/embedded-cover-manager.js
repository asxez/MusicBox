/**
 * 内嵌封面管理器
 * 负责内嵌封面的提取、格式转换和缓存管理
 */

class EmbeddedCoverManager {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 5;
        this.objectUrls = new Set(); // 跟踪创建的Object URLs
        this.urlReferences = new Map(); // URL引用计数
        this.pendingReleases = new Map(); // 待释放的URL
        this.processingFiles = new Set(); // 跟踪正在处理的文件，避免重复处理
    }

    /**
     * 获取内嵌封面
     * @param {string} filePath - 音频文件路径
     * @returns {Promise<Object>} 封面获取结果
     */
    async getEmbeddedCover(filePath) {
        try {
            // 参数验证
            if (!filePath || typeof filePath !== 'string') {
                console.error('❌ EmbeddedCoverManager: 无效的文件路径参数');
                return {success: false, error: '无效的文件路径参数'};
            }

            // 检查API可用性
            if (!window.electronAPI || !window.electronAPI.library || !window.electronAPI.library.getTrackMetadata) {
                console.error('❌ EmbeddedCoverManager: 元数据API不可用');
                return {success: false, error: '元数据API不可用'};
            }

            // 检查缓存
            const cacheKey = this.generateCacheKey(filePath);
            if (this.cache.has(cacheKey)) {
                const cachedResult = this.cache.get(cacheKey);
                // 对于成功的缓存结果，增加URL引用计数
                if (cachedResult.success && cachedResult.url && cachedResult.url.startsWith('blob:')) {
                    const currentCount = this.urlReferences.get(cachedResult.url) || 0;
                    this.urlReferences.set(cachedResult.url, currentCount + 1);
                }
                return cachedResult;
            }

            // 防止重复处理同一文件
            if (this.processingFiles.has(filePath)) {
                // console.log(`⏳ EmbeddedCoverManager: 文件正在处理中，等待结果 - ${filePath}`);
                // 等待处理完成
                return new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (!this.processingFiles.has(filePath)) {
                            clearInterval(checkInterval);
                            // 递归调用获取缓存结果
                            resolve(this.getEmbeddedCover(filePath));
                        }
                    }, 50);

                    // 超时保护
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve({success: false, error: '处理超时'});
                    }, 5000);
                });
            }

            this.processingFiles.add(filePath);
            // console.log(`🔍 EmbeddedCoverManager: 获取内嵌封面 - ${filePath}`);

            // 从主进程获取元数据（包括封面）
            const metadata = await window.electronAPI.library.getTrackMetadata(filePath);

            if (!metadata || typeof metadata !== 'object') {
                const errorResult = {success: false, error: '主进程返回无效响应'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            if (!metadata.cover) {
                const errorResult = {success: false, error: '音频文件中未找到内嵌封面'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            // 验证封面数据
            if (!metadata.cover.data || !metadata.cover.format) {
                const errorResult = {success: false, error: '内嵌封面数据格式无效'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            // 转换封面数据为可用的URL
            const convertedCover = this.convertCoverToUrl(metadata.cover);
            if (!convertedCover.success) {
                const errorResult = {success: false, error: `封面格式转换失败: ${convertedCover.error}`};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            // 验证转换后的URL格式
            if (typeof convertedCover.url !== 'string') {
                const errorResult = {success: false, error: '封面URL格式无效'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            const finalResult = {
                success: true,
                url: convertedCover.url,
                mimeType: convertedCover.mimeType,
                format: metadata.cover.format,
                size: convertedCover.size,
                source: 'embedded',
                // originalData: metadata.cover
            };

            // 缓存结果
            this.setCache(cacheKey, finalResult);
            this.processingFiles.delete(filePath);
            return finalResult;
        } catch (error) {
            console.error('❌ EmbeddedCoverManager: 获取内嵌封面失败:', error);

            // 清理处理状态
            this.processingFiles.delete(filePath);

            // 提供更具体的错误信息
            let errorMessage = error.message || '未知错误';
            if (error.name === 'TypeError') {
                errorMessage = '数据类型错误，可能是API响应格式不正确';
            } else if (error.name === 'NetworkError') {
                errorMessage = '网络错误，无法与主进程通信';
            }

            const errorResult = {success: false, error: errorMessage};

            // 对于某些错误，不缓存结果（如网络错误）
            if (!error.name || error.name !== 'NetworkError') {
                const cacheKey = this.generateCacheKey(filePath);
                this.setCache(cacheKey, errorResult);
            }

            return errorResult;
        }
    }

    /**
     * 将封面数据转换为可用的URL
     * @param {Object} coverData - 封面数据对象
     * @returns {Object} 转换结果
     */
    convertCoverToUrl(coverData) {
        try {
            if (!coverData || !coverData.data) {
                throw new Error('封面数据无效');
            }

            let imageData = coverData.data;
            const format = coverData.format || 'jpeg';

            // 处理不同类型的数据
            if (imageData instanceof ArrayBuffer) {
                imageData = new Uint8Array(imageData);
                console.log('🔄 EmbeddedCoverManager: 转换ArrayBuffer为Uint8Array');
            } else if (Array.isArray(imageData)) {
                imageData = new Uint8Array(imageData);
                console.log('🔄 EmbeddedCoverManager: 转换Array为Uint8Array');
            } else if (imageData instanceof Uint8Array) {
                console.log('✅ EmbeddedCoverManager: 数据已是Uint8Array格式');
            } else if (this.isBufferLike(imageData)) {
                imageData = new Uint8Array(imageData);
                console.log('🔄 EmbeddedCoverManager: 转换Buffer-like对象为Uint8Array');
            } else {
                // 降级处理
                console.warn('⚠️ EmbeddedCoverManager: 未知数据类型，尝试降级处理', {
                    type: typeof imageData,
                    constructor: imageData.constructor ? imageData.constructor.name : 'unknown',
                    hasLength: 'length' in imageData
                });

                if (imageData.length && typeof imageData.length === 'number') {
                    imageData = new Uint8Array(imageData);
                    console.log('✅ EmbeddedCoverManager: 降级转换成功');
                } else {
                    throw new Error('无法转换数据类型');
                }
            }

            // 验证数据长度
            if (!imageData.length || imageData.length === 0) {
                throw new Error('封面数据长度为0');
            }

            // console.log(`✅ EmbeddedCoverManager: 数据转换完成，长度: ${imageData.length}`);

            // 创建Blob
            const mimeType = `image/${format.toLowerCase()}`;
            const blob = new Blob([imageData], {type: mimeType});

            // 验证Blob
            if (blob.size === 0) {
                throw new Error('创建的Blob大小为0');
            }

            // console.log(`✅ EmbeddedCoverManager: Blob创建成功，大小: ${blob.size}, 类型: ${mimeType}`);

            // 创建Object URL
            const objectUrl = URL.createObjectURL(blob);
            // console.log('✅ EmbeddedCoverManager: Object URL创建成功', objectUrl);

            // 验证创建的URL
            if (typeof objectUrl !== 'string' || !objectUrl.startsWith('blob:')) {
                console.error('❌ EmbeddedCoverManager: 创建的Object URL格式无效', {
                    type: typeof objectUrl,
                    value: objectUrl
                });
                throw new Error('创建的Object URL格式无效');
            }

            // 记录URL用于后续清理
            this.objectUrls.add(objectUrl);

            // 初始化引用计数为2，因为会被缓存和DOM同时引用
            this.urlReferences.set(objectUrl, 2);

            return {
                success: true,
                url: objectUrl,
                mimeType: mimeType,
                size: blob.size
            };
        } catch (error) {
            console.error('❌ EmbeddedCoverManager: 封面URL转换失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 检查是否为类似Buffer的对象
     * @param {*} obj - 要检查的对象
     * @returns {boolean} 是否为Buffer-like对象
     */
    isBufferLike(obj) {
        if (!obj) return false;

        // 检查是否有Buffer的特征
        if (typeof obj === 'object' &&
            typeof obj.length === 'number' &&
            typeof obj.constructor === 'function') {

            // 检查构造函数名称
            const constructorName = obj.constructor.name;
            if (constructorName === 'Buffer') {
                return true;
            }

            // 检查是否有Buffer的方法
            if (typeof obj.slice === 'function' &&
                typeof obj.toString === 'function' &&
                obj.length >= 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * 生成缓存键
     * @param {string} filePath - 文件路径
     * @returns {string} 缓存键
     */
    generateCacheKey(filePath) {
        return `cover_${filePath}`;
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {Object} data - 缓存数据
     */
    setCache(key, data) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            const oldData = this.cache.get(firstKey);

            // 清理旧的Object URL - 使用引用计数安全释放
            if (oldData && oldData.url && oldData.url.startsWith('blob:')) {
                this.releaseUrlReference(oldData.url);
            }

            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            ...data,
            cachedAt: Date.now()
        });
    }

    /**
     * 清空缓存
     */
    clearCache() {
        // 清理所有Object URLs
        this.objectUrls.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.objectUrls.clear();
        this.urlReferences.clear();
        this.processingFiles.clear();

        // 清理待释放的URL
        this.pendingReleases.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.pendingReleases.clear();

        this.cache.clear();
        console.log('🗑️ EmbeddedCoverManager: 缓存已清空');
    }

    /**
     * 减少URL引用计数，如果计数为0则安全释放
     * @param {string} url - blob URL
     */
    releaseUrlReference(url) {
        if (!url || !url.startsWith('blob:')) return;

        const currentCount = this.urlReferences.get(url) || 0;
        if (currentCount <= 1) {
            // 延迟释放，给DOM更新留出时间
            this.scheduleUrlRelease(url);
        } else {
            this.urlReferences.set(url, currentCount - 1);
            console.log(`📉 EmbeddedCoverManager: URL引用计数减少 - ${url.substring(0, 50)}... (${currentCount - 1})`);
        }
    }

    /**
     * 安排URL延迟释放
     * @param {string} url - blob URL
     */
    scheduleUrlRelease(url) {
        if (this.pendingReleases.has(url)) {
            console.log(`⏳ EmbeddedCoverManager: URL已在待释放队列 - ${url.substring(0, 50)}...`);
            return;
        }

        console.log(`⏰ EmbeddedCoverManager: 安排URL延迟释放 - ${url.substring(0, 50)}...`);
        const timeoutId = setTimeout(() => {
            this.safeReleaseUrl(url);
            this.pendingReleases.delete(url);
        }, 3000); // 3秒延迟释放

        this.pendingReleases.set(url, timeoutId);
    }

    /**
     * 安全释放URL
     * @param {string} url - blob URL
     */
    safeReleaseUrl(url) {
        try {
            if (this.objectUrls.has(url)) {
                URL.revokeObjectURL(url);
                this.objectUrls.delete(url);
                this.urlReferences.delete(url);
                console.log(`🗑️ EmbeddedCoverManager: 安全释放blob URL - ${url.substring(0, 50)}...`);
            }
        } catch (error) {
            console.warn('⚠️ EmbeddedCoverManager: 释放blob URL失败:', error);
        }
    }

    /**
     * 清理特定文件的封面缓存
     * @param {string} filePath - 文件路径
     */
    clearCacheForFile(filePath) {
        if (!filePath) return false;

        const cacheKey = this.generateCacheKey(filePath);
        if (this.cache.has(cacheKey)) {
            const cachedResult = this.cache.get(cacheKey);
            if (cachedResult.success && cachedResult.url && cachedResult.url.startsWith('blob:')) {
                // 使用安全的引用计数释放
                this.releaseUrlReference(cachedResult.url);
            }

            this.cache.delete(cacheKey);
            console.log(`🧹 EmbeddedCoverManager: 清理文件缓存 - ${filePath}`);
            return true;
        }

        return false;
    }

    /**
     * 检查blob URL是否仍然有效
     * @param {string} url - blob URL
     * @returns {boolean} URL是否有效
     */
    isBlobUrlValid(url) {
        if (!url || !url.startsWith('blob:')) {
            return false;
        }

        return this.objectUrls.has(url) && this.urlReferences.has(url);
    }

    /**
     * 强制刷新特定文件的封面
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 刷新结果
     */
    async refreshCoverForFile(filePath) {
        console.log(`🔄 EmbeddedCoverManager: 刷新封面 - ${filePath}`);

        try {
            // 1. 先获取新的封面
            const cacheKey = this.generateCacheKey(filePath);
            const oldCachedResult = this.cache.get(cacheKey);

            // 清理处理状态
            this.processingFiles.delete(filePath);

            // 临时清除缓存以强制重新获取
            this.cache.delete(cacheKey);

            // 2. 获取新封面
            const newResult = await this.getEmbeddedCover(filePath);

            // 3. 如果成功获取新封面，再安全释放旧的
            if (newResult.success && oldCachedResult && oldCachedResult.url) {
                this.releaseUrlReference(oldCachedResult.url);
            }

            return newResult;
        } catch (error) {
            console.error('❌ EmbeddedCoverManager: 安全刷新失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

window.embeddedCoverManager = new EmbeddedCoverManager();
