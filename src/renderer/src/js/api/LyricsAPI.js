import {embeddedLyricsManager} from "@services/lyrics/EmbeddedLyricsManager";
import {localLyricsManager} from "@services/lyrics/LocalLyricsManager";
import {cacheManager} from "@services/CacheManager";
import {networkAPI} from "@api/NetworkAPI";

class LyricsAPI {
    constructor() {
        // 歌词获取去重机制
        this._lyricsRequestLock = new Set(); // 正在请求歌词的歌曲集合
    }

    /**
     * 获取歌词（按优先级：内嵌→本地→缓存→网络）
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

            // 优先级2: 检查本地歌词文件
            const localLyrics = await this.getLocalLyrics(title, artist, album);
            if (localLyrics.success) {
                this._lyricsRequestLock.delete(lyricsKey);
                return localLyrics;
            }

            // 优先级3: 检查localStorage缓存
            const cachedLyrics = this.getCachedLyrics(title, artist, album);
            if (cachedLyrics.success) {
                this._lyricsRequestLock.delete(lyricsKey);
                return cachedLyrics;
            }

            // 优先级4: 通过网络接口获取
            const networkLyrics = await this.getNetworkLyrics(title, artist, album);
            if (networkLyrics.success) {
                // 缓存到localStorage
                this.cacheLyrics(title, artist, album, networkLyrics);
                this._lyricsRequestLock.delete(lyricsKey);
                return networkLyrics;
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
            return {success: false, error: error.message};
        }
    }

    /**
     * 获取本地歌词文件
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Promise<Object>} - 歌词信息
     */
    async getLocalLyrics(title, artist, album) {
        try {
            const localResult = await localLyricsManager.getLyrics(title, artist, album);
            if (localResult.success) return localResult;
            return {success: false};
        } catch (error) {
            return {success: false, error: error.message};
        }
    }

    /**
     * 获取缓存的歌词
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Object} - 歌词信息
     */
    getCachedLyrics(title, artist, album) {
        try {
            const cached = cacheManager.getLyricsCache(title, artist, album);
            if (cached) return cached;
            return {success: false};
        } catch (error) {
            return {success: false, error: error.message};
        }
    }

    /**
     * 从网络获取歌词
     * @param {string} title - 歌曲标题
     * @param {string} artist - 艺术家
     * @param {string} album - 专辑
     * @returns {Promise<Object>} - 歌词信息
     */
    async getNetworkLyrics(title, artist, album) {
        try {
            console.log(`🌐 尝试网络获取歌词: ${title}`);
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/lyrics?${params.toString()}`;
            const response = await networkAPI.fetchWithRetry(url);
            const lrcText = await response.text();

            if (!lrcText || lrcText.trim() === '') {
                console.error(`⚠️ 歌词内容为空`);
                return {success: false, error: '歌词内容为空'};
            }

            return {
                success: true,
                lrc: lrcText.trim(),
                source: 'network'
            };
        } catch (error) {
            console.error('网络歌词获取失败:', error.message);
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
                                content: content
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
}

let lyricsAPI = new LyricsAPI();
export {lyricsAPI};
