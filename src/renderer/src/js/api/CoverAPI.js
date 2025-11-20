import {embeddedCoverManager} from "@services/cover/EmbeddedCoverManager";
import {localCoverManager} from "@services/cover/LocalCoverManager";
import {urlValidator} from "@utils/URLValidator";
import {networkAPI} from "@api/NetworkAPI";

class CoverAPI {

    /**
     * 获取封面（按优先级：内嵌→本地→网络）
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @param {string || null} filePath - 文件路径
     * @param {boolean} forceRefresh - 是否强制刷新
     * @returns {Promise<Object>} - 封面信息
     */
    async getCover(title, artist, album, filePath = null, forceRefresh = false) {
        try {
            // 如果强制刷新，先清理缓存
            if (forceRefresh) {
                if (filePath) {
                    embeddedCoverManager.clearCacheForFile(filePath);
                    localCoverManager.clearCacheForTrack(title, artist, album);
                }
            }

            // 优先级1: 检查内嵌封面
            if (filePath) {
                const embeddedCover = await this.getEmbeddedCoverAPI(filePath);
                if (embeddedCover.success) {
                    return embeddedCover;
                }
            }

            // 优先级2: 检查本地封面缓存
            const localCover = await this.getLocalCover(title, artist, album);
            if (localCover.success) {
                return localCover;
            }

            // 优先级3: 从第三方API获取封面
            const networkCover = await this.getNetworkCover(title, artist, album);
            if (networkCover.success) {
                // 保存到本地缓存
                await this.saveCoverToLocalCache(title, artist, album, networkCover.imageData);
                return networkCover;
            }

            return {success: false, error: '未找到封面'};
        } catch (error) {
            console.error(`封面获取失败: ${title} - ${error.message}`);
            return {success: false, error: error.message};
        }
    }

    /**
     * 获取内嵌封面
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} - 封面信息
     */
    async getEmbeddedCoverAPI(filePath) {
        try {
            const embeddedResult = await embeddedCoverManager.getEmbeddedCover(filePath);
            if (embeddedResult.success && embeddedResult.url) {
                // 对于blob URL，跳过验证以避免过早释放
                // URL验证会在DOM加载时自然进行
                if (embeddedResult.url.startsWith('blob:')) {
                    return {
                        success: true,
                        imageUrl: embeddedResult.url,
                        type: 'embedded',
                        source: 'embedded-cover',
                        format: embeddedResult.format,
                        size: embeddedResult.size,
                        mimeType: embeddedResult.mimeType
                    };
                } else {
                    // 对于非blob URL，进行验证
                    const isValidUrl = urlValidator ?
                        await urlValidator.isValidUrl(embeddedResult.url) : true;
                    if (isValidUrl) {
                        return {
                            success: true,
                            imageUrl: embeddedResult.url,
                            type: 'embedded',
                            source: 'embedded-cover',
                            format: embeddedResult.format,
                            size: embeddedResult.size,
                            mimeType: embeddedResult.mimeType
                        };
                    }
                }
            }
            return {success: false};
        } catch (embeddedError) {
            return {success: false, error: embeddedError.message};
        }
    }

    /**
     * 获取本地缓存封面
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Promise<Object>} - 封面信息
     */
    async getLocalCover(title, artist, album) {
        const localCoverResult = await localCoverManager.checkLocalCover(title, artist, album);
        if (localCoverResult.success) {
            return {
                success: true,
                imageUrl: `file://${localCoverResult.filePath}`,
                type: 'local-file',
                source: 'local-cache',
                filePath: localCoverResult.filePath
            };
        } else {
            return {success: false, error: "获取本地缓存封面失败"};
        }
    }

    /**
     * 从网络获取封面
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Promise<Object>} - 封面信息
     */
    async getNetworkCover(title, artist, album) {
        try {
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/cover?${params.toString()}`;
            const response = await networkAPI.fetchWithRetry(url);

            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                // 直接返回图片数据
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                result = {
                    success: true,
                    imageUrl,
                    type: 'blob',
                    source: 'api',
                    imageData: blob
                };
            } else if (response.redirected) {
                // 处理重定向
                result = {
                    success: true,
                    imageUrl: response.url,
                    type: 'url',
                    source: 'api',
                    imageData: response.url
                };
            } else {
                // 尝试解析为JSON或文本
                const text = await response.text();
                if (text.startsWith('http')) {
                    result = {
                        success: true,
                        imageUrl: text.trim(),
                        type: 'url',
                        source: 'api',
                        imageData: text.trim()
                    };
                } else {
                    throw new Error('无效的封面响应格式');
                }
            }

            return result;
        } catch (error) {
            console.error('网络封面获取失败:', error.message);
            return {success: false, error: error.message};
        }
    }

    // 保存封面到本地
    async saveCoverToLocalCache(title, artist, album, imageData) {
        try {
            if (!localCoverManager.getCoverDirectory()) {
                console.log('⚠️ 未设置封面缓存目录，跳过本地缓存保存');
                return;
            }

            // 确定图片格式
            let imageFormat = 'jpg';
            if (imageData instanceof Blob) {
                console.log(`🔍 API: Blob MIME类型 - ${imageData.type}`);
                if (imageData.type.includes('png')) imageFormat = 'png';
                else if (imageData.type.includes('webp')) imageFormat = 'webp';
                else if (imageData.type.includes('gif')) imageFormat = 'gif';
                else if (imageData.type.includes('jpeg') || imageData.type.includes('jpg')) imageFormat = 'jpg';
            } else if (typeof imageData === 'string') {
                if (imageData.includes('.png') || imageData.includes('png')) imageFormat = 'png';
                else if (imageData.includes('.webp') || imageData.includes('webp')) imageFormat = 'webp';
                else if (imageData.includes('.gif') || imageData.includes('gif')) imageFormat = 'gif';
            }

            await localCoverManager.saveCoverToCache(
                title, artist, album, imageData, imageFormat
            );
        } catch (error) {
            console.error('❌ 保存封面到本地缓存时发生错误:', error);
        }
    }
}

let coverAPI = new CoverAPI();
export {coverAPI};
