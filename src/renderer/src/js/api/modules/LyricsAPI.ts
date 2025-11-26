/**
 * 歌词 API
 * 提供歌词获取、搜索、解析等功能
 * 支持多种歌词来源：内嵌→本地→网络TTML→网络LRC
 */

import {embeddedLyricsManager} from '@services/lyrics/EmbeddedLyricsManager';
import {localLyricsManager} from '@services/lyrics/LocalLyricsManager';
import {cacheManager} from '@services/CacheManager';
import {ttmlParser} from '@services/lyrics/TTMLParser';
import {BaseAPI, Logger, Validator} from "@api/core";
import {LyricLine, LyricsFormat, LyricsResult, NetworkLyricsSearchResult} from "@api/types";
import {networkAPI} from "@api/modules/NetworkAPI";

/**
 * 歌词 API 类
 */
export class LyricsAPI extends BaseAPI {
    private readonly lyricsRequestLock: Set<string>;

    constructor() {
        super('LyricsAPI');
        this.lyricsRequestLock = new Set();
    }

    /**
     * 获取歌词（按优先级：内嵌→本地→网络TTML→网络LRC）
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @param filePath - 文件路径
     * @returns 歌词信息
     */
    async getLyrics(
        title: string,
        artist: string,
        album: string = '',
        filePath: string | null = null
    ): Promise<LyricsResult> {
        Validator.assertString(title, 'title');
        Validator.assertString(artist, 'artist');

        // 生成歌词请求的唯一标识
        const lyricsKey = `${title}_${artist}_${album || ''}`;

        try {
            if (this.lyricsRequestLock.has(lyricsKey)) {
                return {success: false, error: '歌词获取已在进行中'};
            }

            // 添加到请求锁
            this.lyricsRequestLock.add(lyricsKey);
            Logger.lyrics(`获取歌词: ${title} - ${artist}${filePath ? ` (${filePath})` : ''}`);

            // 优先级1: 检查内嵌歌词
            if (filePath) {
                const embeddedLyrics: any = await this.getEmbeddedLyricsAPI(filePath);
                if (embeddedLyrics.success) {
                    this.lyricsRequestLock.delete(lyricsKey);
                    return embeddedLyrics;
                }
            }

            // 优先级2: 检查本地歌词文件
            const localLyrics: LyricsResult = await this.getLocalLyrics(title, artist, album);
            if (localLyrics.success) {
                this.lyricsRequestLock.delete(lyricsKey);
                return localLyrics;
            }

            // 优先级3: 通过网络获取TTML格式歌词
            const ttmlLyrics: any = await this.getNetworkTTMLLyrics(title, artist, album);
            if (ttmlLyrics.success) {
                await this.saveLyricsToLocal(title, artist, album, ttmlLyrics.content!, 'ttml');
                this.lyricsRequestLock.delete(lyricsKey);
                return ttmlLyrics;
            }

            // 优先级4: 通过网络获取LRC格式歌词
            const lrcLyrics = await this.getNetworkLRCLyrics(title, artist, album);
            if (lrcLyrics.success) {
                await this.saveLyricsToLocal(title, artist, album, lrcLyrics.content!, 'lrc');
                this.lyricsRequestLock.delete(lyricsKey);
                return lrcLyrics;
            }

            // 释放请求锁
            this.lyricsRequestLock.delete(lyricsKey);
            return {success: false, error: '未找到歌词'};
        } catch (error) {
            this.logError(`歌词获取失败: ${title}`, error as Error);

            // 异常情况释放锁
            this.lyricsRequestLock.delete(lyricsKey);
            return {
                success: false,
                error: (error as Error).message,
                source: 'error'
            };
        }
    }

    /**
     * 保存歌词到本地文件
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @param content - 歌词内容
     * @param format - 歌词格式
     */
    private async saveLyricsToLocal(
        title: string,
        artist: string,
        album: string,
        content: string,
        format: LyricsFormat
    ): Promise<void> {
        try {
            const result: any = await localLyricsManager.saveLyrics(title, artist, album, content, format);
            if (result.success) {
                Logger.cache(`歌词已缓存到本地: ${result.fileName}`);
            } else {
                Logger.warn(`歌词缓存到本地失败: ${result.error}`);
            }
        } catch (error) {
            this.logError('保存歌词到本地时出错', error as Error);
        }
    }

    /**
     * 获取内嵌歌词
     * @param filePath - 文件路径
     * @returns 歌词信息
     */
    async getEmbeddedLyricsAPI(filePath: string): Promise<object> {
        Validator.assertFilePath(filePath, 'filePath');

        try {
            const embeddedResult: any = await embeddedLyricsManager.getEmbeddedLyrics(filePath);
            if (embeddedResult.success) {
                return embeddedResult;
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
     * 获取本地歌词文件
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @returns 歌词信息
     */
    async getLocalLyrics(title: string, artist: string, album: string = ''): Promise<LyricsResult> {
        try {
            const localResult: LyricsResult = await localLyricsManager.getLyrics(title, artist, album);
            if (localResult.success) {
                if (localResult.format === 'ttml') {
                    return {
                        success: true,
                        content: localResult.content,
                        format: 'ttml',
                        source: 'local',
                        filePath: localResult.filePath,
                        fileName: localResult.fileName,
                    };
                } else {
                    return {
                        success: true,
                        lrc: localResult.content,
                        format: 'lrc',
                        source: 'local',
                        filePath: localResult.filePath,
                        fileName: localResult.fileName,
                    };
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
     * 搜索网络TTML歌词
     * @param title - 歌曲标题
     * @returns 搜索结果数组
     */
    async searchTTMLLyrics(title: string): Promise<NetworkLyricsSearchResult[]> {
        Validator.assertString(title, 'title');

        try {
            const url = 'https://amlldb.bikonoo.com/api/search-lyrics';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: title.trim(),
                    type: 'all'
                })
            });

            if (!response.ok) {
                throw new Error(`TTML搜索请求失败: ${response.status}`);
            }

            const results = await response.json();
            return Array.isArray(results) ? results : [];
        } catch (error) {
            Logger.networkError(`TTML歌词搜索失败: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * 匹配最佳歌词结果
     * @param results - 搜索结果数组
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @returns 最佳匹配结果
     */
    matchBestLyrics(
        results: NetworkLyricsSearchResult[],
        title: string,
        artist: string,
        album: string = ''
    ): NetworkLyricsSearchResult | null {
        if (!results || results.length === 0) {
            return null;
        }

        // 标准化字符串用于比较（转小写、去空格）
        const normalize = (str: string | undefined | null): string => {
            if (!str) return '';
            return str.toLowerCase().trim().replace(/\s+/g, '');
        };

        const normalizedTitle = normalize(title);
        const normalizedArtist = normalize(artist);
        const normalizedAlbum = normalize(album);

        // 首先过滤出歌名完全匹配的结果
        const titleMatchedResults = results.filter(result => {
            const resultTitles = (result as any).titles || [result.title];
            return resultTitles.some((t: string) => normalize(t) === normalizedTitle);
        });

        // 如果没有歌名完全匹配的结果，直接返回null
        if (titleMatchedResults.length === 0) {
            this.log(`未找到歌名完全匹配的TTML歌词 (搜索词="${title}")`);
            this.log(`搜索到${results.length}条结果，但没有一条歌名完全匹配`);
            return null;
        }

        this.log(`找到${titleMatchedResults.length}条歌名匹配的结果 (共${results.length}条)`);

        // 计算匹配分数（仅针对歌名匹配的结果）
        const scoreResult = (result: NetworkLyricsSearchResult): number => {
            let score = 100; // 歌名已经完全匹配，基础分100

            // 艺术家匹配（权重次之）
            if (artist) {
                const resultArtists = (result as any).artists || [result.artist];
                const artistMatch = resultArtists.some((a: string) => normalize(a) === normalizedArtist);
                if (artistMatch) {
                    score += 50;
                } else {
                    const partialMatch = resultArtists.some(
                        (a: string) =>
                            normalize(a).includes(normalizedArtist) ||
                            normalizedArtist.includes(normalize(a))
                    );
                    if (partialMatch) score += 25;
                }
            }

            // 专辑匹配（权重最低）
            if (album) {
                const resultAlbums = (result as any).albums || [(result as any).album];
                const albumMatch = resultAlbums.some((alb: string) => normalize(alb) === normalizedAlbum);
                if (albumMatch) {
                    score += 30;
                } else {
                    const partialMatch = resultAlbums.some(
                        (alb: string) =>
                            normalize(alb).includes(normalizedAlbum) ||
                            normalizedAlbum.includes(normalize(alb))
                    );
                    if (partialMatch) score += 15;
                }
            }

            return score;
        };

        // 对歌名匹配的结果评分并排序
        const scoredResults = titleMatchedResults
            .map(result => ({
                result,
                score: scoreResult(result)
            }))
            .sort((a, b) => b.score - a.score);

        Logger.lyrics('TTML匹配结果 (前3名):');
        scoredResults.slice(0, 3).forEach((item, index) => {
            Logger.lyrics(`  ${index + 1}. [分数=${item.score}] ${item.result.title} - ${item.result.artist}`);
        });

        // 返回分数最高的结果
        Logger.success(
            `选择最佳匹配: ${scoredResults[0].result.title} - ${scoredResults[0].result.artist} (分数=${scoredResults[0].score})`
        );
        return scoredResults[0].result;
    }

    /**
     * 下载TTML歌词内容
     * @param platform - 平台
     * @param file - 文件名
     * @returns TTML歌词内容
     */
    async downloadTTMLLyrics(platform: string, file: string): Promise<string> {
        Validator.assertString(platform, 'platform');
        Validator.assertString(file, 'file');

        try {
            const url = `https://amlldb.bikonoo.com/${platform}/${file}`;
            Logger.network(`下载TTML歌词: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
            }

            const content = await response.text();
            if (!content || content.trim() === '') {
                throw new Error('歌词内容为空');
            }

            return content;
        } catch (error) {
            this.logError('TTML歌词下载失败', error as Error);
            throw error;
        }
    }

    /**
     * 从网络获取TTML歌词（完整流程）
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @returns 歌词信息
     */
    async getNetworkTTMLLyrics(
        title: string,
        artist: string,
        album: string = ''
    ): Promise<object> {
        try {
            Logger.network(`尝试网络获取TTML歌词: ${title} - ${artist}`);

            // 1. 搜索歌词
            const searchResults = await this.searchTTMLLyrics(title);
            if (searchResults.length === 0) {
                this.logWarn('TTML搜索无结果');
                return {success: false, error: 'TTML搜索无结果'};
            }

            // 2. 匹配最佳结果
            const bestMatch = this.matchBestLyrics(searchResults, title, artist, album);
            if (!bestMatch) {
                this.logWarn('未找到匹配的TTML歌词');
                return {success: false, error: '未找到匹配的TTML歌词'};
            }

            // 3. 下载歌词内容
            const content = await this.downloadTTMLLyrics(
                (bestMatch as any).platform,
                (bestMatch as any).file
            );

            Logger.success(`成功获取TTML歌词 (来源: ${(bestMatch as any).platform})`);
            return {
                success: true,
                content: content.trim(),
                format: 'ttml',
                source: 'network-ttml',
                metadata: {
                    title: bestMatch.title,
                    artist: bestMatch.artist,
                    album: (bestMatch as any).album?.[0] || (bestMatch as any).albums?.[0],
                    platform: (bestMatch as any).platform
                }
            };
        } catch (error) {
            this.logError('网络TTML歌词获取失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 从网络获取LRC歌词
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @returns 歌词信息
     */
    async getNetworkLRCLyrics(
        title: string,
        artist: string,
        album: string = ''
    ): Promise<LyricsResult> {
        try {
            Logger.network(`尝试网络获取LRC歌词: ${title}`);
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/lyrics?${params.toString()}`;
            const response = await networkAPI.fetchWithRetry(url);
            const lrcText = await response.text();

            if (!lrcText || lrcText.trim() === '') {
                this.logWarn('LRC歌词内容为空');
                return {success: false, error: 'LRC歌词内容为空'};
            }

            Logger.success('成功获取LRC歌词');
            return {
                success: true,
                content: lrcText.trim(),
                format: 'lrc',
                source: 'network-lrc'
            };
        } catch (error) {
            this.logError('网络LRC歌词获取失败', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 缓存歌词到localStorage
     * @param title - 歌曲标题
     * @param artist - 艺术家
     * @param album - 专辑
     * @param lyricsData - 歌词数据
     */
    cacheLyrics(title: string, artist: string, album: string, lyricsData: any): void {
        cacheManager.setLyricsCache(title, artist, album, lyricsData);
    }

    /**
     * 解析LRC歌词
     * @param lrcText - LRC文本
     * @returns 解析后的歌词数组
     */
    parseLRC(lrcText: string): LyricLine[] {
        try {
            const lines = lrcText.split('\n');
            const lyrics: LyricLine[] = [];
            const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})]/g;

            for (const line of lines) {
                const matches = [...line.matchAll(timeRegex)];
                if (matches.length > 0) {
                    const content = line.replace(timeRegex, '').trim();
                    if (content) {
                        for (const match of matches) {
                            const minutes = parseInt(match[1]);
                            const seconds = parseInt(match[2]);
                            const milliseconds = parseInt(match[3].padEnd(3, '0'));
                            const time = minutes * 60 + seconds + milliseconds / 1000;

                            lyrics.push({
                                time,
                                content: content,
                                type: 'line'
                            });
                        }
                    }
                }
            }

            // 按时间排序
            lyrics.sort((a, b) => a.time - b.time);
            Logger.success(`LRC解析成功，共 ${lyrics.length} 行歌词`);
            return lyrics;
        } catch (error) {
            this.logError('LRC解析失败', error as Error);
            return [];
        }
    }

    /**
     * 解析TTML歌词
     * @param ttmlText - TTML文本
     * @returns 解析后的歌词数组
     */
    parseTTML(ttmlText: string): LyricLine[] {
        return ttmlParser.parse(ttmlText);
    }

    /**
     * 智能解析歌词（自动识别格式）
     * @param lyricsText - 歌词文本
     * @param format - 歌词格式
     * @returns 解析后的歌词数组
     */
    parse(lyricsText: string, format: LyricsFormat | null = null): LyricLine[] {
        if (!lyricsText) return [];

        if (format === 'ttml' || (!format && ttmlParser.isValidTTML(lyricsText))) {
            return this.parseTTML(lyricsText);
        }

        return this.parseLRC(lyricsText);
    }
}

export const lyricsAPI = new LyricsAPI();
