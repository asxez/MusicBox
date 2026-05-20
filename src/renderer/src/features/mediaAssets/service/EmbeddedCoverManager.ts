/**
 * 内嵌封面管理器
 * 负责内嵌封面的提取、格式转换和缓存管理
 */

import {libraryDataService} from "@/features/library/service/LibraryDataService";

interface EmbeddedCoverResult {
    success: boolean;
    error?: string;
    url?: string;
    mimeType?: string;
    format?: string;
    size?: number;
    source?: 'embedded';
    cachedAt?: number;
}

interface EmbeddedCoverData {
    data: any;
    format?: string;
}

interface TrackMetadataWithCover {
    cover?: EmbeddedCoverData;
}

interface BufferLike {
    length: number;
    constructor?: {
        name?: string;
    };
    slice?: (...args: any[]) => unknown;
    toString?: (...args: any[]) => string;
}

interface CoverConversionResult {
    success: boolean;
    error?: string;
    url?: string;
    mimeType?: string;
    size?: number;
}

class EmbeddedCoverManager {
    private readonly cache: Map<string, EmbeddedCoverResult>;
    private readonly maxCacheSize: number;
    private readonly objectUrls: Set<string>;
    private readonly urlReferences: Map<string, number>;
    private readonly pendingReleases: Map<string, ReturnType<typeof setTimeout>>;
    private readonly processingFiles: Set<string>;

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
    async getEmbeddedCover(filePath: string): Promise<EmbeddedCoverResult> {
        try {
            // 参数验证
            if (!filePath || typeof filePath !== 'string') {
                console.error('❌ EmbeddedCoverManager: 无效的文件路径参数');
                return {success: false, error: '无效的文件路径参数'};
            }

            // 检查缓存
            const cacheKey = this.generateCacheKey(filePath);
            if (this.cache.has(cacheKey)) {
                const cachedResult = this.cache.get(cacheKey)!;
                // 对于成功的缓存结果，增加URL引用计数
                if (cachedResult.success && cachedResult.url && cachedResult.url.startsWith('blob:')) {
                    const currentCount = this.urlReferences.get(cachedResult.url) || 0;
                    this.urlReferences.set(cachedResult.url, currentCount + 1);
                }
                return cachedResult;
            }

            // 防止重复处理同一文件
            if (this.processingFiles.has(filePath)) {
                // 等待处理完成
                return new Promise<EmbeddedCoverResult>((resolve) => {
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

            // 从主进程获取元数据（包括封面）
            const metadata = await libraryDataService.getTrackMetadata(filePath) as TrackMetadataWithCover | null;
            if (!metadata || typeof metadata !== 'object') {
                const errorResult: EmbeddedCoverResult = {success: false, error: '主进程返回无效响应'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            if (!metadata.cover) {
                const errorResult: EmbeddedCoverResult = {success: false, error: '音频文件中未找到内嵌封面'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            // 验证封面数据
            if (!metadata.cover.data || !metadata.cover.format) {
                const errorResult: EmbeddedCoverResult = {success: false, error: '内嵌封面数据格式无效'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            // 转换封面数据为可用的URL
            const convertedCover = this.convertCoverToUrl(metadata.cover);
            if (!convertedCover.success) {
                const errorResult: EmbeddedCoverResult = {success: false, error: `封面格式转换失败: ${convertedCover.error}`};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            // 验证转换后的URL格式
            if (typeof convertedCover.url !== 'string') {
                const errorResult: EmbeddedCoverResult = {success: false, error: '封面URL格式无效'};
                this.setCache(cacheKey, errorResult);
                this.processingFiles.delete(filePath);
                return errorResult;
            }

            const finalResult: EmbeddedCoverResult = {
                success: true,
                url: convertedCover.url,
                mimeType: convertedCover.mimeType,
                format: metadata.cover.format,
                size: convertedCover.size,
                source: 'embedded',
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
            const caughtError = error instanceof Error ? error : new Error(String(error));
            let errorMessage = caughtError.message || '未知错误';
            if (caughtError.name === 'TypeError') {
                errorMessage = '数据类型错误，可能是API响应格式不正确';
            } else if (caughtError.name === 'NetworkError') {
                errorMessage = '网络错误，无法与主进程通信';
            }

            const errorResult: EmbeddedCoverResult = {success: false, error: errorMessage};

            // 对于某些错误，不缓存结果（如网络错误）
            if (!caughtError.name || caughtError.name !== 'NetworkError') {
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
    convertCoverToUrl(coverData: EmbeddedCoverData): CoverConversionResult {
        try {
            if (!coverData || !coverData.data) {
                throw new Error('封面数据无效');
            }

            let imageData: any = coverData.data;
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
                imageData = new Uint8Array(imageData as any);
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

            // 创建Blob
            const mimeType = `image/${format.toLowerCase()}`;
            const blob = new Blob([imageData as BlobPart], {type: mimeType});

            // 验证Blob
            if (blob.size === 0) {
                throw new Error('创建的Blob大小为0');
            }

            // 创建Object URL
            const objectUrl = URL.createObjectURL(blob);

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
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 检查是否为类似Buffer的对象
     * @param {*} obj - 要检查的对象
     * @returns {boolean} 是否为Buffer-like对象
     */
    isBufferLike(obj: unknown): obj is BufferLike {
        if (!obj) return false;
        const candidate = obj as any;

        // 检查是否有Buffer的特征
        if (typeof candidate === 'object' &&
            typeof candidate.length === 'number' &&
            typeof candidate.constructor === 'function') {

            // 检查构造函数名称
            const constructorName = candidate.constructor.name;
            if (constructorName === 'Buffer') {
                return true;
            }

            // 检查是否有Buffer的方法
            if (typeof candidate.slice === 'function' &&
                typeof candidate.toString === 'function' &&
                candidate.length >= 0) {
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
    generateCacheKey(filePath: string): string {
        return `cover_${filePath}`;
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {Object} data - 缓存数据
     */
    setCache(key: string, data: EmbeddedCoverResult): void {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            const oldData = firstKey ? this.cache.get(firstKey) : null;

            // 清理旧的Object URL - 使用引用计数安全释放
            if (oldData && oldData.url && oldData.url.startsWith('blob:')) {
                this.releaseUrlReference(oldData.url);
            }

            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            ...data,
            cachedAt: Date.now()
        });
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
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
    }

    /**
     * 减少URL引用计数，如果计数为0则安全释放
     * @param {string} url - blob URL
     */
    releaseUrlReference(url: string): void {
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
    scheduleUrlRelease(url: string): void {
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
    safeReleaseUrl(url: string): void {
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
    clearCacheForFile(filePath: string): boolean {
        if (!filePath) return false;

        const cacheKey = this.generateCacheKey(filePath);
        if (this.cache.has(cacheKey)) {
            const cachedResult = this.cache.get(cacheKey);
            if (cachedResult?.success && cachedResult.url && cachedResult.url.startsWith('blob:')) {
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
    isBlobUrlValid(url: string): boolean {
        if (!url || !url.startsWith('blob:')) {
            return false;
        }

        return this.objectUrls.has(url) && this.urlReferences.has(url);
    }
}

const embeddedCoverManager = new EmbeddedCoverManager();
export {embeddedCoverManager};
