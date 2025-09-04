/**
 * 字符串处理工具模块
 * 提供字符串编码修复、相似度计算、文本处理等功能
 */

const iconv = require('iconv-lite');
const chardet = require('chardet');

/**
 * 修复字符串编码问题
 * @param {string} str - 需要修复的字符串
 * @returns {string} 修复后的字符串
 */
function fixStringEncoding(str) {
    if (!str || typeof str !== 'string') {
        return str;
    }

    try {
        // 检测字符串是否包含乱码字符
        const hasGarbledChars = /[\u00C0-\u00FF][\u0080-\u00BF]+/.test(str);

        if (hasGarbledChars) {
            const buffer = Buffer.from(str, 'latin1');
            const detectedEncoding = chardet.detect(buffer) || 'utf8';

            if (detectedEncoding.toLowerCase() !== 'utf8' && detectedEncoding.toLowerCase() !== 'utf-8') {
                const fixedStr = iconv.decode(buffer, detectedEncoding);
                return fixedStr;
            }
        }
        return str;
    } catch (error) {
        return str;
    }
}

/**
 * 计算字符串相似度（使用编辑距离算法）
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} 相似度
 */
function calculateStringSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,     // 删除
                matrix[i][j - 1] + 1,     // 插入
                matrix[i - 1][j - 1] + cost // 替换
            );
        }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
}

/**
 * 生成文本变体
 * @param {string} text - 原始文本
 * @returns {string[]} 文本变体数组
 */
function generateTextVariants(text) {
    if (!text) return [''];

    const variants = new Set();
    const cleaned = cleanFileName(text);

    // 原始文本
    variants.add(cleaned);

    // 移除括号内容 (feat. xxx), [xxx], 等
    const withoutBrackets = cleaned.replace(/[(\[{].*?[)\]}]/g, '').trim();
    if (withoutBrackets && withoutBrackets !== cleaned) {
        variants.add(withoutBrackets);
    }

    // 移除常见后缀
    const suffixesToRemove = [
        'feat\\.',
        'ft\\.',
        'featuring',
        'remix',
        'remaster',
        'remastered',
        'acoustic',
        'live',
        'radio edit',
        'extended',
        'instrumental'
    ];

    for (const suffix of suffixesToRemove) {
        const regex = new RegExp(`\\s*\\(?${suffix}.*?\\)?$`, 'gi');
        const withoutSuffix = cleaned.replace(regex, '').trim();
        if (withoutSuffix && withoutSuffix !== cleaned) {
            variants.add(withoutSuffix);
        }
    }

    // 处理数字和特殊字符
    const withoutSpecialChars = cleaned.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
    if (withoutSpecialChars && withoutSpecialChars !== cleaned) {
        variants.add(withoutSpecialChars);
    }

    return Array.from(variants).filter(v => v.length > 0);
}

/**
 * 清理文件名中的特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 清理后的字符串
 */
function cleanFileName(str) {
    if (!str) return '';
    return str.replace(/[<>:"/\\|?*]/g, '').trim();
}

/**
 * 清理封面文件名中的特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 清理后的字符串
 */
function cleanCoverFileName(str) {
    if (!str) return '';
    return str.replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .trim();
}

/**
 * 生成封面文件名的文本变体（用于封面匹配）
 * @param {string} text - 原始文本
 * @returns {string[]} 文本变体数组
 */
function generateCoverTextVariants(text) {
    if (!text) return [''];

    const variants = new Set();
    const cleaned = cleanCoverFileName(text);

    // 原始文本
    variants.add(cleaned);

    // 移除括号内容 (feat. xxx), [xxx], 等
    const withoutBrackets = cleaned.replace(/[(\[{].*?[)\]}]/g, '').trim();
    if (withoutBrackets && withoutBrackets !== cleaned) {
        variants.add(withoutBrackets);
    }

    // 移除常见后缀
    const suffixesToRemove = [
        'feat\\.',
        'ft\\.',
        'featuring',
        'remix',
        'remaster',
        'remastered',
        'acoustic',
        'live',
        'radio_edit',
        'extended',
        'instrumental'
    ];

    for (const suffix of suffixesToRemove) {
        const regex = new RegExp(`_*\\(?${suffix}.*?\\)?$`, 'gi');
        const withoutSuffix = cleaned.replace(regex, '').trim();
        if (withoutSuffix && withoutSuffix !== cleaned) {
            variants.add(withoutSuffix);
        }
    }

    // 处理数字和特殊字符（保持下划线）
    const withoutSpecialChars = cleaned.replace(/[^\w\s\u4e00-\u9fff_]/g, '_').replace(/_+/g, '_').trim();
    if (withoutSpecialChars && withoutSpecialChars !== cleaned) {
        variants.add(withoutSpecialChars);
    }

    return Array.from(variants).filter(v => v.length > 0);
}

/**
 * 计算词匹配度
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} 匹配度
 */
function calculateWordMatch(str1, str2) {
    if (!str1 || !str2) return 0;

    const words1 = str1.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 1);
    const words2 = str2.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 1);

    if (words1.length === 0 || words2.length === 0) return 0;

    let matchedWords = 0;
    let totalWords = Math.max(words1.length, words2.length);

    for (const word1 of words1) {
        for (const word2 of words2) {
            // 精确匹配
            if (word1 === word2) {
                matchedWords += 1;
                break;
            }
            // 包含匹配（权重较低）
            else if (word1.includes(word2) || word2.includes(word1)) {
                matchedWords += 0.7;
                break;
            }
            // 相似度匹配（权重更低）
            else if (calculateStringSimilarity(word1, word2) >= 0.8) {
                matchedWords += 0.5;
                break;
            }
        }
    }
    return matchedWords / totalWords;
}

/**
 * 解析文件名模式，提取标题和艺术家
 * @param {string} fileName - 文件名
 * @returns {object} 解析结果 {title, artist, originalFormat}
 */
function parseFileNamePattern(fileName) {
    // 常见的分隔符模式
    const separators = [' - ', ' – ', ' — ', '-', '_'];

    for (const sep of separators) {
        if (fileName.includes(sep)) {
            const parts = fileName.split(sep);
            if (parts.length >= 2) {
                // 尝试不同的组合：艺术家-标题 或 标题-艺术家
                return {
                    title: parts[1].trim(),
                    artist: parts[0].trim(),
                    originalFormat: 'artist-title'
                };
            }
        }
    }

    // 如果没有分隔符，整个文件名作为标题
    return {
        title: fileName.trim(),
        artist: '',
        originalFormat: 'title-only'
    };
}

module.exports = {
    fixStringEncoding,
    calculateStringSimilarity,
    generateTextVariants,
    generateCoverTextVariants,
    cleanFileName,
    cleanCoverFileName,
    calculateWordMatch,
    parseFileNamePattern
};
