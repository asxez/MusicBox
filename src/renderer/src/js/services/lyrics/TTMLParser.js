/**
 * TTML歌词解析器
 * 负责解析TTML格式歌词，支持逐字时间轴
 */

class TTMLParser {
    /**
     * 解析TTML歌词内容
     * @param {string} ttmlContent - TTML XML内容
     * @returns {Array} - 解析后的歌词数组，包含逐字时间信息
     */
    parse(ttmlContent) {
        try {
            if (!ttmlContent || typeof ttmlContent !== 'string') {
                console.error('❌ TTMLParser: 无效的TTML内容');
                return [];
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(ttmlContent, 'text/xml');

            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.error('❌ TTMLParser: XML解析失败', parserError.textContent);
                return [];
            }

            const lyrics = [];
            const bodyElement = xmlDoc.querySelector('body');
            if (!bodyElement) {
                console.error('❌ TTMLParser: 未找到body元素');
                return [];
            }

            const pElements = bodyElement.querySelectorAll('p');
            if (!pElements || pElements.length === 0) {
                console.error('❌ TTMLParser: 未找到歌词段落元素');
                return [];
            }

            for (const pElement of pElements) {
                const lineData = this.parseParagraph(pElement);
                if (lineData) {
                    lyrics.push(lineData);
                }
            }

            lyrics.sort((a, b) => a.time - b.time);
            console.log(`✅ TTML解析成功，共 ${lyrics.length} 行歌词`);
            return lyrics;
        } catch (error) {
            console.error('❌ TTML解析失败:', error);
            return [];
        }
    }

    /**
     * 解析单个段落元素
     * @param {Element} pElement - 段落元素
     * @returns {Object|null} - 歌词行数据
     */
    parseParagraph(pElement) {
        try {
            const begin = pElement.getAttribute('begin');
            const end = pElement.getAttribute('end');

            if (!begin) {
                return null;
            }

            const startTime = this.parseTime(begin);
            const endTime = end ? this.parseTime(end) : null;

            const spanElements = pElement.querySelectorAll('span');

            if (spanElements.length > 0) {
                const words = [];
                let fullText = '';

                for (const span of spanElements) {
                    const spanBegin = span.getAttribute('begin');
                    const spanEnd = span.getAttribute('end');
                    const text = span.textContent.trim();

                    if (text) {
                        fullText += text;

                        if (spanBegin) {
                            words.push({
                                text: text,
                                time: this.parseTime(spanBegin),
                                endTime: spanEnd ? this.parseTime(spanEnd) : null
                            });
                        } else {
                            words.push({
                                text: text,
                                time: startTime,
                                endTime: endTime
                            });
                        }
                    }
                }

                return {
                    time: startTime,
                    endTime: endTime,
                    content: fullText,
                    words: words,
                    type: 'word-by-word'
                };
            } else {
                const content = pElement.textContent.trim();
                if (!content) {
                    return null;
                }

                return {
                    time: startTime,
                    endTime: endTime,
                    content: content,
                    type: 'line'
                };
            }
        } catch (error) {
            console.error('❌ TTMLParser: 段落解析失败:', error);
            return null;
        }
    }

    /**
     * 解析时间字符串为秒数
     * @param {string} timeStr - 时间字符串
     * @returns {number} - 秒数
     */
    parseTime(timeStr) {
        if (!timeStr) return 0;

        try {
            if (timeStr.includes(':')) {
                const parts = timeStr.split(':');
                if (parts.length === 3) {
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    const secondsParts = parts[2].split('.');
                    const seconds = parseInt(secondsParts[0]) || 0;
                    const milliseconds = secondsParts[1] ? parseInt(secondsParts[1].padEnd(3, '0').substring(0, 3)) : 0;

                    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
                } else if (parts.length === 2) {
                    const minutes = parseInt(parts[0]) || 0;
                    const secondsParts = parts[1].split('.');
                    const seconds = parseInt(secondsParts[0]) || 0;
                    const milliseconds = secondsParts[1] ? parseInt(secondsParts[1].padEnd(3, '0').substring(0, 3)) : 0;

                    return minutes * 60 + seconds + milliseconds / 1000;
                }
            }

            if (timeStr.endsWith('s')) {
                return parseFloat(timeStr.replace('s', '')) || 0;
            }

            if (timeStr.endsWith('ms')) {
                return (parseFloat(timeStr.replace('ms', '')) || 0) / 1000;
            }

            return parseFloat(timeStr) || 0;
        } catch (error) {
            console.error('❌ TTMLParser: 时间解析失败:', timeStr, error);
            return 0;
        }
    }

    /**
     * 验证TTML内容格式
     * @param {string} content - 待验证内容
     * @returns {boolean} - 是否为有效的TTML格式
     */
    isValidTTML(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const trimmedContent = content.trim();

        if (!trimmedContent.startsWith('<?xml') && !trimmedContent.startsWith('<tt')) {
            return false;
        }

        if (!trimmedContent.includes('<tt') || !trimmedContent.includes('</tt>')) {
            return false;
        }

        return true;
    }
}

const ttmlParser = new TTMLParser();
export {ttmlParser};
