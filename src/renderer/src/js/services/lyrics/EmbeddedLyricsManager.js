/**
 * 内嵌歌词管理器
 * 负责内嵌歌词的提取、格式转换和缓存管理
 */

class EmbeddedLyricsManager {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 5;
    }

    /**
     * 获取内嵌歌词
     * @param {string} filePath - 音频文件路径
     * @returns {Promise<Object>} 歌词获取结果
     */
    async getEmbeddedLyrics(filePath) {
        try {
            // 参数验证
            if (!filePath || typeof filePath !== 'string') {
                console.error('❌ EmbeddedLyricsManager: 无效的文件路径参数');
                return {success: false, error: '无效的文件路径参数'};
            }

            // 检查API可用性
            if (!window.electronAPI || !window.electronAPI.lyrics || !window.electronAPI.lyrics.getEmbedded) {
                console.error('❌ EmbeddedLyricsManager: 内嵌歌词API不可用');
                return {success: false, error: '内嵌歌词API不可用'};
            }

            // 检查缓存
            const cacheKey = this.generateCacheKey(filePath);
            if (this.cache.has(cacheKey)) {
                console.log(`✅ EmbeddedLyricsManager: 缓存命中 - ${filePath}`);
                return this.cache.get(cacheKey);
            }

            console.log(`🔍 EmbeddedLyricsManager: 获取内嵌歌词 - ${filePath}`);

            // 从主进程获取内嵌歌词
            const result = await window.electronAPI.lyrics.getEmbedded(filePath);

            if (!result || typeof result !== 'object') {
                const errorResult = {success: false, error: '主进程返回无效响应'};
                this.setCache(cacheKey, errorResult);
                return errorResult;
            }

            if (!result.success) {
                const errorResult = {success: false, error: result.error || '未知错误'};
                this.setCache(cacheKey, errorResult);
                return errorResult;
            }

            // 验证歌词数据
            if (!result.lyrics || typeof result.lyrics !== 'object') {
                const errorResult = {success: false, error: '内嵌歌词数据格式无效'};
                this.setCache(cacheKey, errorResult);
                return errorResult;
            }

            // 转换歌词格式为LRC
            const convertedLyrics = this.convertToLRC(result.lyrics);
            if (!convertedLyrics.success) {
                const errorResult = {success: false, error: `歌词格式转换失败: ${convertedLyrics.error}`};
                this.setCache(cacheKey, errorResult);
                return errorResult;
            }

            const finalResult = {
                success: true,
                lrc: convertedLyrics.lrc,
                source: 'embedded',
                type: result.lyrics.type,
                format: result.lyrics.format,
                language: result.lyrics.language,
                description: result.lyrics.description,
                synchronized: result.lyrics.synchronized,
                originalData: result.lyrics
            };

            // 缓存结果
            this.setCache(cacheKey, finalResult);
            console.log(`✅ EmbeddedLyricsManager: 成功获取内嵌歌词 - ${result.lyrics.type} 格式 (语言: ${result.lyrics.language || '未知'})`);
            return finalResult;

        } catch (error) {
            console.error('❌ EmbeddedLyricsManager: 获取内嵌歌词失败:', error);

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
     * 将内嵌歌词转换为LRC格式
     * @param {Object} embeddedLyrics - 内嵌歌词数据
     * @returns {Object} 转换结果
     */
    convertToLRC(embeddedLyrics) {
        try {
            if (!embeddedLyrics || !embeddedLyrics.text) {
                console.error('内嵌歌词数据无效');
                return;
            }

            let lrcContent = '';

            if (embeddedLyrics.synchronized && embeddedLyrics.timestamps) {
                // 同步歌词转换为LRC格式
                console.log('🔍 使用同步歌词转换路径');
                lrcContent = this.convertSynchronizedToLRC(embeddedLyrics);
            } else {
                // 非同步歌词转换为简单LRC格式
                console.log('🔍 使用非同步歌词转换路径');
                lrcContent = this.convertUnsynchronizedToLRC(embeddedLyrics);
            }

            return {
                success: true,
                lrc: lrcContent,
                type: embeddedLyrics.synchronized ? 'synchronized' : 'unsynchronized'
            };

        } catch (error) {
            console.error('❌ EmbeddedLyricsManager: 歌词格式转换失败:', error);
            return {
                success: false,
                error: error.message,
                lrc: ''
            };
        }
    }

    /**
     * 将同步歌词转换为LRC格式
     * @param {Object} embeddedLyrics - 同步歌词数据
     * @returns {string} LRC格式歌词
     */
    convertSynchronizedToLRC(embeddedLyrics) {
        let lrcLines = [];

        // 添加元数据标签
        if (embeddedLyrics.language) {
            lrcLines.push(`[la:${embeddedLyrics.language}]`);
        }
        if (embeddedLyrics.description) {
            lrcLines.push(`[ti:${embeddedLyrics.description}]`);
        }
        lrcLines.push(`[tool:MusicBox - 内嵌歌词转换]`);
        lrcLines.push('');

        // 转换时间戳歌词
        for (const item of embeddedLyrics.timestamps) {
            const timeTag = this.formatTimeTag(item.time);
            lrcLines.push(`${timeTag}${item.text}`);
        }

        return lrcLines.join('\n');
    }

    /**
     * 将非同步歌词转换为LRC格式
     * @param {Object} embeddedLyrics - 非同步歌词数据
     * @returns {string} LRC格式歌词
     */
    convertUnsynchronizedToLRC(embeddedLyrics) {
        console.log('🔍 转换非同步歌词为LRC格式');

        // 检查原始歌词是否已经是LRC格式
        if (this.isAlreadyLRCFormat(embeddedLyrics.text)) {
            console.log('✅ 检测到歌词已经是LRC格式，直接返回原始内容');

            // 如果已经是LRC格式，只添加必要的元数据标签（如果缺失）
            const existingLines = embeddedLyrics.text.split('\n');
            const hasMetadata = existingLines.some(line =>
                line.startsWith('[la:') || line.startsWith('[ti:') || line.startsWith('[tool:')
            );

            if (!hasMetadata) {
                let metadataLines = [];
                if (embeddedLyrics.language) {
                    metadataLines.push(`[la:${embeddedLyrics.language}]`);
                }
                if (embeddedLyrics.description) {
                    metadataLines.push(`[ti:${embeddedLyrics.description}]`);
                }
                metadataLines.push(`[tool:MusicBox - 内嵌歌词]`);
                metadataLines.push('');

                return metadataLines.join('\n') + embeddedLyrics.text;
            }

            return embeddedLyrics.text;
        }

        console.log('🔍 歌词不是LRC格式，开始转换');
        let lrcLines = [];

        // 添加元数据标签
        if (embeddedLyrics.language) {
            lrcLines.push(`[la:${embeddedLyrics.language}]`);
        }
        if (embeddedLyrics.description) {
            lrcLines.push(`[ti:${embeddedLyrics.description}]`);
        }
        lrcLines.push(`[tool:MusicBox - 内嵌歌词转换]`);
        lrcLines.push('');

        // 将歌词文本按行分割，每行添加时间标签（从0开始，间隔3秒）
        const lines = embeddedLyrics.text.split('\n').filter(line => line.trim());
        console.log(`🔍 处理 ${lines.length} 行歌词文本`);

        for (let i = 0; i < lines.length; i++) {
            const time = i * 3; // 每行间隔3秒
            const timeTag = this.formatTimeTag(time);
            lrcLines.push(`${timeTag}${lines[i].trim()}`);
        }

        return lrcLines.join('\n');
    }

    /**
     * 检查文本是否已经是LRC格式
     * @param {string} text - 歌词文本
     * @returns {boolean} 是否为LRC格式
     */
    isAlreadyLRCFormat(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        // LRC格式的特征：包含时间标签 [mm:ss.xx] 或 [mm:ss]
        const lrcTimeRegex = /^\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/;

        const lines = text.split('\n').filter(line => line.trim());
        let lrcLineCount = 0;
        let totalContentLines = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 跳过空行和元数据标签
            if (!trimmedLine || trimmedLine.startsWith('[') &&
                (trimmedLine.includes(':') && !lrcTimeRegex.test(trimmedLine))) {
                continue;
            }

            totalContentLines++;

            // 检查是否包含LRC时间标签
            if (lrcTimeRegex.test(trimmedLine)) {
                lrcLineCount++;
            }
        }
        // 如果超过50%的内容行包含LRC时间标签，认为是LRC格式
        const lrcRatio = totalContentLines > 0 ? lrcLineCount / totalContentLines : 0;
        const isLRC = lrcRatio >= 0.5;
        console.log(`🔍 LRC格式检测: ${lrcLineCount}/${totalContentLines} 行包含时间标签 (${(lrcRatio * 100).toFixed(1)}%), 判定为${isLRC ? 'LRC' : '纯文本'}格式`);
        return isLRC;
    }

    /**
     * 格式化时间标签为LRC格式
     * @param {number} timeInSeconds - 时间（秒）
     * @returns {string} LRC时间标签
     */
    formatTimeTag(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 100);

        return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`;
    }

    /**
     * 生成缓存键
     * @param {string} filePath - 文件路径
     * @returns {string} 缓存键
     */
    generateCacheKey(filePath) {
        return `embedded_${filePath}`;
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {Object} data - 缓存数据
     */
    setCache(key, data) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
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
        this.cache.clear();
        console.log('🗑️ EmbeddedLyricsManager: 缓存已清空');
    }

    /**
     * 检查文件是否包含内嵌歌词
     * @param {Object} trackMetadata - 音频文件元数据
     * @returns {boolean} 是否包含内嵌歌词
     */
    hasEmbeddedLyrics(trackMetadata) {
        return !!(trackMetadata && trackMetadata.embeddedLyrics && trackMetadata.embeddedLyrics.text);
    }

    /**
     * 调试内嵌歌词提取过程
     * @param {string} filePath - 音频文件路径
     * @returns {Promise<Object>} 详细的调试信息
     */
    async debugEmbeddedLyrics(filePath) {
        try {
            console.log(`🔧 开始调试内嵌歌词: ${filePath}`);

            // 检查API可用性
            if (!window.electronAPI || !window.electronAPI.lyrics || !window.electronAPI.lyrics.getEmbedded) {
                return {
                    success: false,
                    error: '内嵌歌词API不可用',
                    details: {
                        electronAPI: !!window.electronAPI,
                        lyricsAPI: !!(window.electronAPI && window.electronAPI.lyrics),
                        getEmbeddedAPI: !!(window.electronAPI && window.electronAPI.lyrics && window.electronAPI.lyrics.getEmbedded)
                    }
                };
            }

            // 获取原始结果
            const result = await window.electronAPI.lyrics.getEmbedded(filePath);

            const debugInfo = {
                success: result.success,
                filePath: filePath,
                apiResponse: result,
                timestamp: new Date().toISOString()
            };

            if (result.success && result.lyrics) {
                // 分析歌词数据
                debugInfo.lyricsAnalysis = {
                    type: result.lyrics.type,
                    format: result.lyrics.format,
                    language: result.lyrics.language,
                    description: result.lyrics.description,
                    synchronized: result.lyrics.synchronized,
                    hasText: !!result.lyrics.text,
                    textLength: result.lyrics.text ? result.lyrics.text.length : 0,
                    hasTimestamps: !!result.lyrics.timestamps,
                    timestampCount: result.lyrics.timestamps ? result.lyrics.timestamps.length : 0,
                    textSample: result.lyrics.text ? result.lyrics.text.substring(0, 200) : null,
                    timestampSample: result.lyrics.timestamps ? result.lyrics.timestamps.slice(0, 3) : null,
                    isAlreadyLRC: result.lyrics.text ? this.isAlreadyLRCFormat(result.lyrics.text) : false
                };

                // 尝试转换为LRC
                try {
                    const converted = this.convertToLRC(result.lyrics);
                    debugInfo.conversionResult = {
                        success: converted.success,
                        error: converted.error,
                        lrcLength: converted.lrc ? converted.lrc.length : 0,
                        lrcSample: converted.lrc ? converted.lrc.substring(0, 300) : null
                    };
                } catch (conversionError) {
                    debugInfo.conversionResult = {
                        success: false,
                        error: conversionError.message
                    };
                }
            } else {
                debugInfo.error = result.error;
            }

            console.log('🔧 调试信息:', debugInfo);
            return debugInfo;

        } catch (error) {
            console.error('🔧 调试过程失败:', error);
            return {
                success: false,
                error: error.message,
                filePath: filePath,
                timestamp: new Date().toISOString()
            };
        }
    }
}

let embeddedLyricsManager = new EmbeddedLyricsManager();
export {embeddedLyricsManager};
