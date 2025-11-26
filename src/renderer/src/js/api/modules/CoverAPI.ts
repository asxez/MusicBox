/**
 * 封面 API
 * 提供封面获取、缓存等功能
 * 支持多种封面来源：内嵌→本地→网络
 */

import {embeddedCoverManager} from '@services/cover/EmbeddedCoverManager';
import {localCoverManager} from '@services/cover/LocalCoverManager';
import {urlValidator} from '@utils/URLValidator';
import {BaseAPI, Logger, Validator} from "@api/core";
import {CoverResult, ImageFormat} from "@api/types";
import {networkAPI} from "@api/modules/NetworkAPI";

/**
 * 封面 API 类
 */
export class CoverAPI extends BaseAPI {
    constructor() {
        super('CoverAPI');
    }

    /**
     * 获取封面（按优先级：内嵌→本地→网络）
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @param filePath - 音频文件路径
     * @param forceRefresh - 是否强制刷新
     * @returns 封面信息
     */
    async getCover(
        title: string,
        artist: string,
        album: string = '',
        filePath: string | null = null,
        forceRefresh: boolean = false
    ): Promise<CoverResult> {
        Validator.assertString(title, 'title');
        Validator.assertString(artist, 'artist');

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
                await this.saveCoverToLocalCache(title, artist, album, networkCover.imageData!);
                return networkCover;
            }

            return {success: false, error: '未找到封面'};
        } catch (error) {
            this.logError(`封面获取失败: ${title}`, error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 获取内嵌封面
     * @param filePath - 音频文件路径
     * @returns 封面信息
     */
    async getEmbeddedCoverAPI(filePath: string): Promise<CoverResult> {
        Validator.assertFilePath(filePath, 'filePath');

        try {
            const embeddedResult: any = await embeddedCoverManager.getEmbeddedCover(filePath);
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
                    const isValidUrl = urlValidator
                        ? await urlValidator.isValidUrl(embeddedResult.url)
                        : true;
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
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 获取本地缓存封面
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @returns 封面信息
     */
    async getLocalCover(title: string, artist: string, album: string = ''): Promise<CoverResult> {
        const localCoverResult: any = await localCoverManager.checkLocalCover(title, artist, album);
        if (localCoverResult.success) {
            return {
                success: true,
                imageUrl: `file://${localCoverResult.filePath}`,
                type: 'local-file',
                source: 'local-cache',
                filePath: localCoverResult.filePath
            };
        } else {
            return {success: false, error: '获取本地缓存封面失败'};
        }
    }

    /**
     * 从网络获取封面
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @returns 封面信息
     */
    async getNetworkCover(title: string, artist: string, album: string = ''): Promise<CoverResult> {
        try {
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/cover?${params.toString()}`;
            const response = await networkAPI.fetchWithRetry(url);

            let result: CoverResult;
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

            Logger.cover(`成功获取网络封面: ${title}`);
            return result;
        } catch (error) {
            this.logError('网络封面获取失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 保存封面到本地缓存
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @param imageData - 图片数据
     */
    private async saveCoverToLocalCache(
        title: string,
        artist: string,
        album: string,
        imageData: any
    ): Promise<void> {
        try {
            if (!localCoverManager.getCoverDirectory()) {
                this.logWarn('未设置封面缓存目录，跳过本地缓存保存');
                return;
            }

            // 确定图片格式
            let imageFormat: ImageFormat = 'jpg';
            if (imageData instanceof Blob) {
                Logger.cover(`Blob MIME类型 - ${imageData.type}`);
                if (imageData.type.includes('png')) imageFormat = 'png';
                else if (imageData.type.includes('webp')) imageFormat = 'webp';
                else if (imageData.type.includes('gif')) imageFormat = 'gif';
                else if (imageData.type.includes('jpeg') || imageData.type.includes('jpg'))
                    imageFormat = 'jpg';
            } else if (typeof imageData === 'string') {
                if (imageData.includes('.png') || imageData.includes('png')) imageFormat = 'png';
                else if (imageData.includes('.webp') || imageData.includes('webp'))
                    imageFormat = 'webp';
                else if (imageData.includes('.gif') || imageData.includes('gif'))
                    imageFormat = 'gif';
            }

            await localCoverManager.saveCoverToCache(title, artist, album, imageData, imageFormat);
            Logger.cache(`封面已保存到本地缓存: ${title} - ${artist}`);
        } catch (error) {
            this.logError('保存封面到本地缓存时发生错误', error as Error);
        }
    }

    /**
     * 清除指定文件的封面缓存
     * @param filePath - 文件路径
     */
    clearCacheForFile(filePath: string): void {
        Validator.assertFilePath(filePath, 'filePath');
        embeddedCoverManager.clearCacheForFile(filePath);
    }

    /**
     * 清除指定音乐的封面缓存
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     */
    clearCacheForTrack(title: string, artist: string, album: string = ''): void {
        localCoverManager.clearCacheForTrack(title, artist, album);
    }

    /**
     * 清除所有封面缓存
     */
    clearAllCache(): void {
        if (typeof (embeddedCoverManager as any).clearAllCache === 'function') {
            (embeddedCoverManager as any).clearAllCache();
        }
        if (typeof (localCoverManager as any).clearAllCache === 'function') {
            (localCoverManager as any).clearAllCache();
        }
        Logger.success('已清除所有封面缓存');
    }
}

export const coverAPI = new CoverAPI();
