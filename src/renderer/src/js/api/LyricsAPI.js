import {embeddedLyricsManager} from "@services/lyrics/EmbeddedLyricsManager";
import {localLyricsManager} from "@services/lyrics/LocalLyricsManager";
import {cacheManager} from "@services/CacheManager";
import {networkAPI} from "@api/NetworkAPI";
import {ttmlParser} from "@services/lyrics/TTMLParser";

class LyricsAPI {
    constructor() {
        // 歌词获取去重机制
        this._lyricsRequestLock = new Set(); // 正在请求歌词的歌曲集合
    }

    /**
     * 获取歌词（按优先级：内嵌→本地→网络TTML→网络LRC）
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @param {string || null} filePath - 文件路径
     * @returns {Promise<Object>} - 歌词信息
     */
    async getLyrics(title, artist, album, filePath = null) {
        // 生成歌词请求的唯一标识
        const lyricsKey = `${title}_${artist}_${album || ''}`;

        try {
            if (this._lyricsRequestLock.has(lyricsKey)) {
                return {success: false, error: '歌词获取已在进行中'};
            }

            // 添加到请求锁
            this._lyricsRequestLock.add(lyricsKey);
            console.log(`🎵 获取歌词: ${title} - ${artist}${filePath ? ` (${filePath})` : ''}`);

            // 优先级1: 检查内嵌歌词
            if (filePath) {
                const embeddedLyrics = await this.getEmbeddedLyricsAPI(filePath);
                if (embeddedLyrics.success) {
                    this._lyricsRequestLock.delete(lyricsKey);
                    return embeddedLyrics;
                }
            }

            // 优先级2: 检查本地TTML歌词文件
            const localTTMLLyrics = await this.getLocalLyrics(title, artist, album, 'ttml');
            if (localTTMLLyrics.success) {
                this._lyricsRequestLock.delete(lyricsKey);
                return localTTMLLyrics;
            }

            // 优先级3: 通过网络获取TTML格式歌词
            const ttmlLyrics = await this.getNetworkTTMLLyrics(title, artist, album);
            if (ttmlLyrics.success) {
                await this.saveLyricsToLocal(title, artist, album, ttmlLyrics.content, 'ttml');
                this._lyricsRequestLock.delete(lyricsKey);
                return ttmlLyrics;
            }

            // 优先级4: 检查本地LRC歌词文件
            const localLyrics = await this.getLocalLyrics(title, artist, album, 'lrc');
            if (localLyrics.success) {
                this._lyricsRequestLock.delete(lyricsKey);
                return localLyrics;
            }

            // 优先级5: 通过网络获取LRC格式歌词
            const lrcLyrics = await this.getNetworkLRCLyrics(title, artist, album);
            if (lrcLyrics.success) {
                await this.saveLyricsToLocal(title, artist, album, lrcLyrics.content, 'lrc');
                this._lyricsRequestLock.delete(lyricsKey);
                return lrcLyrics;
            }

            // 释放请求锁
            this._lyricsRequestLock.delete(lyricsKey);
            return {success: false, error: '未找到歌词'};
        } catch (error) {
            console.error(`❌ 歌词获取失败: ${title} - ${error.message}`);

            // 异常情况释放锁
            this._lyricsRequestLock.delete(lyricsKey);
            return {
                success: false,
                error: error.message,
                source: 'error'
            };
        }
    }

    /**
     * 保存歌词到本地文件
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @param {string} content - 歌词内容
     * @param {string} format - 歌词格式 (lrc/ttml)
     * @returns {Promise<void>}
     */
    async saveLyricsToLocal(title, artist, album, content, format) {
        try {
            const result = await localLyricsManager.saveLyrics(title, artist, album, content, format);
            if (result.success) {
                console.log(`💾 歌词已缓存到本地: ${result.fileName}`);
            } else {
                console.warn(`⚠️ 歌词缓存到本地失败: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ 保存歌词到本地时出错:', error);
        }
    }

    /**
     * 获取内嵌歌词
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} - 歌词信息
     */
    async getEmbeddedLyricsAPI(filePath) {
        try {
            const embeddedResult = await embeddedLyricsManager.getEmbeddedLyrics(filePath);
            if (embeddedResult.success) return embeddedResult;
            return {success: false};
        } catch (embeddedError) {
            return {success: false, error: embeddedError.message};
        }
    }

    /**
     * 获取本地歌词文件
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @param {string} extension - 格式
     * @returns {Promise<Object>} - 歌词信息
     */
    async getLocalLyrics(title, artist, album, extension) {
        try {
            const localResult = await localLyricsManager.getLyrics(title, artist, album);
            if (localResult.success) {
                if (localResult.format === extension && localResult.format === 'ttml') {
                    return {
                        success: true,
                        content: localResult.content,
                        format: 'ttml',
                        source: 'local',
                        filePath: localResult.filePath,
                        fileName: localResult.fileName
                    };
                } else if (localResult.format === extension && localResult.format === 'lrc') {
                    return {
                        success: true,
                        lrc: localResult.content,
                        format: 'lrc',
                        source: 'local',
                        filePath: localResult.filePath,
                        fileName: localResult.fileName
                    };
                } else return {success: false};
            }
            return {success: false};
        } catch (error) {
            return {success: false, error: error.message};
        }
    }

    /**
     * 搜索网络TTML歌词
     * @param {string} title - 歌曲标题
     * @returns {Promise<Array>} - 搜索结果数组
     */
    async searchTTMLLyrics(title) {
        try {
            const url = 'https://amlldb.bikonoo.com/api/search-lyrics';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
            console.error('🌐 TTML歌词搜索失败:', error.message);
            return [];
        }
    }

    /**
     * 匹配最佳歌词结果
     * @param {Array} results - 搜索结果数组
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Object|null} - 最佳匹配结果
     */
    matchBestLyrics(results, title, artist, album) {
        if (!results || results.length === 0) {
            return null;
        }

        // 标准化字符串用于比较（转小写、去空格）
        const normalize = (str) => {
            if (!str) return '';
            return str.toLowerCase().trim().replace(/\s+/g, '');
        };

        const normalizedTitle = normalize(title);
        const normalizedArtist = normalize(artist);
        const normalizedAlbum = normalize(album);

        // 首先过滤出歌名完全匹配的结果
        const titleMatchedResults = results.filter(result => {
            const resultTitles = result.titles || [result.title];
            return resultTitles.some(t => normalize(t) === normalizedTitle);
        });

        // 如果没有歌名完全匹配的结果，直接返回null
        if (titleMatchedResults.length === 0) {
            console.log(`❌ 未找到歌名完全匹配的TTML歌词 (搜索词="${title}")`);
            console.log(`   搜索到${results.length}条结果，但没有一条歌名完全匹配`);
            return null;
        }

        console.log(`🎯 找到${titleMatchedResults.length}条歌名匹配的结果 (共${results.length}条)`);

        // 计算匹配分数（仅针对歌名匹配的结果）
        const scoreResult = (result) => {
            let score = 100; // 歌名已经完全匹配，基础分100

            // 艺术家匹配（权重次之）
            if (artist) {
                const resultArtists = result.artists || [result.artist];
                const artistMatch = resultArtists.some(a => normalize(a) === normalizedArtist);
                if (artistMatch) {
                    score += 50;
                } else {
                    const partialMatch = resultArtists.some(a =>
                        normalize(a).includes(normalizedArtist) || normalizedArtist.includes(normalize(a))
                    );
                    if (partialMatch) score += 25;
                }
            }

            // 专辑匹配（权重最低）
            if (album) {
                const resultAlbums = result.albums || [result.album];
                const albumMatch = resultAlbums.some(alb => normalize(alb) === normalizedAlbum);
                if (albumMatch) {
                    score += 30;
                } else {
                    const partialMatch = resultAlbums.some(alb =>
                        normalize(alb).includes(normalizedAlbum) || normalizedAlbum.includes(normalize(alb))
                    );
                    if (partialMatch) score += 15;
                }
            }

            return score;
        };

        // 对歌名匹配的结果评分并排序
        const scoredResults = titleMatchedResults.map(result => ({
            result,
            score: scoreResult(result)
        })).sort((a, b) => b.score - a.score);

        console.log(`🎯 TTML匹配结果 (前3名):`);
        scoredResults.slice(0, 3).forEach((item, index) => {
            console.log(`  ${index + 1}. [分数=${item.score}] ${item.result.title} - ${item.result.artist}`);
        });

        // 返回分数最高的结果
        console.log(`✅ 选择最佳匹配: ${scoredResults[0].result.title} - ${scoredResults[0].result.artist} (分数=${scoredResults[0].score})`);
        return scoredResults[0].result;
    }

    /**
     * 下载TTML歌词内容
     * @param {string} platform - 平台
     * @param {string} file - 文件名
     * @returns {Promise<string>} - TTML歌词内容
     */
    async downloadTTMLLyrics(platform, file) {
        try {
            const url = `https://amlldb.bikonoo.com/${platform}/${file}`;
            console.log(`📥 下载TTML歌词: ${url}`);

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
            console.error('❌ TTML歌词下载失败:', error.message);
            throw error;
        }
    }

    /**
     * 从网络获取TTML歌词（完整流程）
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Promise<Object>} - 歌词信息
     */
    async getNetworkTTMLLyrics(title, artist, album) {
        try {
            console.log(`🌐 尝试网络获取TTML歌词: ${title} - ${artist}`);

            // 1. 搜索歌词
            const searchResults = await this.searchTTMLLyrics(title);
            if (searchResults.length === 0) {
                console.log(`⚠️ TTML搜索无结果`);
                return {success: false, error: 'TTML搜索无结果'};
            }

            // 2. 匹配最佳结果
            const bestMatch = this.matchBestLyrics(searchResults, title, artist, album);
            if (!bestMatch) {
                console.log(`⚠️ 未找到匹配的TTML歌词`);
                return {success: false, error: '未找到匹配的TTML歌词'};
            }

            // 3. 下载歌词内容
            const content = await this.downloadTTMLLyrics(bestMatch.platform, bestMatch.file);

            console.log(`✅ 成功获取TTML歌词 (来源: ${bestMatch.platform})`);
            return {
                success: true,
                content: content.trim(),
                format: 'ttml',
                source: 'network-ttml',
                metadata: {
                    title: bestMatch.title,
                    artist: bestMatch.artist,
                    album: bestMatch.album?.[0] || bestMatch.albums?.[0],
                    platform: bestMatch.platform
                }
            };
        } catch (error) {
            console.error('❌ 网络TTML歌词获取失败:', error.message);
            return {success: false, error: error.message};
        }
    }

    /**
     * 从网络获取LRC歌词
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Promise<Object>} - 歌词信息
     */
    async getNetworkLRCLyrics(title, artist, album) {
        try {
            console.log(`🌐 尝试网络获取LRC歌词: ${title}`);
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/lyrics?${params.toString()}`;
            const response = await networkAPI.fetchWithRetry(url);
            const lrcText = await response.text();

            if (!lrcText || lrcText.trim() === '') {
                console.error(`⚠️ LRC歌词内容为空`);
                return {success: false, error: 'LRC歌词内容为空'};
            }

            console.log(`✅ 成功获取LRC歌词`);
            return {
                success: true,
                content: lrcText.trim(),
                format: 'lrc',
                source: 'network-lrc'
            };
        } catch (error) {
            console.error('❌ 网络LRC歌词获取失败:', error.message);
            return {success: false, error: error.message};
        }
    }

    /**
     * 缓存歌词到localStorage
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @param {Object} lyricsData - 歌词数据
     */
    cacheLyrics(title, artist, album, lyricsData) {
        cacheManager.setLyricsCache(title, artist, album, lyricsData);
    }

    /**
     * 解析LRC歌词
     * @param {string} lrcText - LRC文本
     * @returns {Array} - 解析后的歌词数组
     */
    parseLRC(lrcText) {
        try {
            const lines = lrcText.split('\n');
            const lyrics = [];
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
                                time: time,
                                content: content,
                                type: 'line'
                            });
                        }
                    }
                }
            }
            // 按时间排序
            lyrics.sort((a, b) => a.time - b.time);
            console.log(`✅ LRC解析成功，共 ${lyrics.length} 行歌词`);
            return lyrics;
        } catch (error) {
            console.error('❌ LRC解析失败:', error);
            return [];
        }
    }

    /**
     * 解析TTML歌词
     * @param {string} ttmlText - TTML文本
     * @returns {Array} - 解析后的歌词数组
     */
    parseTTML(ttmlText) {
        return ttmlParser.parse(ttmlText);
    }

    /**
     * 智能解析歌词（自动识别格式）
     * @param {string} lyricsText - 歌词文本
     * @param {string | null} format - 歌词格式，可选 'lrc' 或 'ttml'
     * @returns {Array} - 解析后的歌词数组
     */
    parse(lyricsText, format = null) {
        if (!lyricsText) return [];

        if (format === 'ttml' || (!format && ttmlParser.isValidTTML(lyricsText))) {
            return this.parseTTML(lyricsText);
        }

        return this.parseLRC(lyricsText);
    }
}

let lyricsAPI = new LyricsAPI();
export {lyricsAPI};
