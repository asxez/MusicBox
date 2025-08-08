/**
 * 文件搜索工具模块
 * 提供歌词文件和封面文件的搜索匹配功能
 */

const path = require('path');
const {
    cleanFileName,
    generateTextVariants,
    calculateStringSimilarity,
    calculateWordMatch,
    parseFileNamePattern
} = require('./string');

/**
 * 生成歌词文件搜索模式
 * @param {string} title - 歌曲标题
 * @param {string} artist - 艺术家
 * @param {string} album - 专辑名
 * @returns {string[]} 搜索模式数组
 */
function generateLyricsSearchPatterns(title, artist, album) {
    const patterns = [];

    // 清理文件名中的特殊字符
    const cleanTitle = cleanFileName(title);
    const cleanArtist = cleanFileName(artist);
    const cleanAlbum = cleanFileName(album);

    // 生成不同的变体
    const titleVariants = generateTextVariants(cleanTitle);
    const artistVariants = generateTextVariants(cleanArtist);

    // 常见的歌词文件命名格式（按优先级排序）
    if (cleanTitle && cleanArtist) {
        // 标准格式
        for (const titleVar of titleVariants) {
            for (const artistVar of artistVariants) {
                patterns.push(`${artistVar} - ${titleVar}.lrc`);
                patterns.push(`${titleVar} - ${artistVar}.lrc`);
                patterns.push(`${artistVar}-${titleVar}.lrc`);
                patterns.push(`${titleVar}-${artistVar}.lrc`);
                patterns.push(`${artistVar}_${titleVar}.lrc`);
                patterns.push(`${titleVar}_${artistVar}.lrc`);
            }
        }
    }

    // 仅标题格式
    if (cleanTitle) {
        for (const titleVar of titleVariants) {
            patterns.push(`${titleVar}.lrc`);
        }
    }

    // 包含专辑信息的格式
    if (cleanTitle && cleanArtist && cleanAlbum) {
        const cleanAlbumVar = cleanFileName(cleanAlbum);
        patterns.push(`${cleanArtist} - ${cleanAlbumVar} - ${cleanTitle}.lrc`);
        patterns.push(`${cleanAlbumVar} - ${cleanArtist} - ${cleanTitle}.lrc`);
    }

    return patterns;
}

/**
 * 查找最佳匹配的歌词文件
 * @param {string[]} files - 文件列表
 * @param {string[]} patterns - 搜索模式列表
 * @returns {string|null} 最佳匹配的文件名，如果没有找到则返回null
 */
function findBestLyricsMatch(files, patterns) {
    const matches = [];
    console.log(`🔍 开始匹配 ${files.length} 个文件与 ${patterns.length} 个模式`);

    // 第一轮：精确匹配
    console.log(`🎯 第一轮：精确匹配`);
    for (const pattern of patterns) {
        const exactMatch = files.find(file => file.toLowerCase() === pattern.toLowerCase());
        if (exactMatch) {
            console.log(`✅ 精确匹配: ${exactMatch} = ${pattern}`);
            matches.push({file: exactMatch, score: 100, type: 'exact'});
        }
    }

    if (matches.length > 0) {
        console.log(`🎯 找到 ${matches.length} 个精确匹配，返回第一个`);
        return matches[0].file; // 返回第一个精确匹配
    }

    // 第二轮：高相似度匹配
    console.log(`🎯 第二轮：高相似度匹配 (阈值: 80%)`);
    for (const file of files) {
        const fileName = path.basename(file, '.lrc').toLowerCase();

        for (const pattern of patterns) {
            const patternName = path.basename(pattern, '.lrc').toLowerCase();
            const similarity = calculateStringSimilarity(fileName, patternName);
            if (similarity >= 0.8) { // 80%以上相似度
                console.log(`📊 高相似度匹配: ${file} vs ${patternName} - 相似度: ${(similarity * 100).toFixed(1)}%`);
                matches.push({file, score: similarity * 100, type: 'high_similarity'});
            }
        }
    }

    // 第三轮：包含匹配
    if (matches.length === 0) {
        console.log(`🎯 第三轮：关键词匹配 (要求: 至少1个精确匹配 + 70%总匹配度)`);
        for (const file of files) {
            const fileName = path.basename(file, '.lrc').toLowerCase();

            for (const pattern of patterns) {
                const patternName = path.basename(pattern, '.lrc').toLowerCase();

                // 解析模式，提取歌曲标题和艺术家
                const patternInfo = parseFileNamePattern(patternName);
                const fileInfo = parseFileNamePattern(fileName);
                if (!patternInfo.title || !fileInfo.title) {
                    // console.log(`⚠️ 跳过无法解析的模式: ${patternName}`);
                    continue;
                }

                // 计算标题匹配度（权重更高）
                const titleMatch = calculateWordMatch(fileInfo.title, patternInfo.title);

                // 计算艺术家匹配度（权重较低）
                const artistMatch = patternInfo.artist && fileInfo.artist ?
                    calculateWordMatch(fileInfo.artist, patternInfo.artist) : 0;

                // 评分机制：
                // 1. 标题匹配是必须的，权重70%
                // 2. 艺术家匹配是加分项，权重30%
                // 3. 标题匹配度必须>=0.6才考虑
                if (titleMatch >= 0.6) {
                    const score = (titleMatch * 0.7 + artistMatch * 0.3) * 60;
                    console.log(`🎯 有效匹配: ${file} - 综合得分: ${score.toFixed(1)} (标题: ${titleMatch.toFixed(2)}, 艺术家: ${artistMatch.toFixed(2)})`);
                    matches.push({file, score, type: 'keyword_match'});
                }
            }
        }
    }

    // 按分数排序，返回最佳匹配
    if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score);

        // 设置更严格的最低匹配分数阈值
        const bestMatch = matches[0];
        const minScoreThreshold = {
            'exact': 100,           // 精确匹配必须100分
            'high_similarity': 80,  // 高相似度至少80分
            'keyword_match': 50     // 关键词匹配至少50分
        };

        const requiredScore = minScoreThreshold[bestMatch.type] || 0;
        if (bestMatch.score >= requiredScore) {
            console.log(`🎯 找到匹配文件: ${bestMatch.file} (得分: ${bestMatch.score.toFixed(1)}, 类型: ${bestMatch.type})`);
            return bestMatch.file;
        }
    }
    return null;
}

/**
 * 生成封面文件搜索模式
 * @param {string} title - 歌曲标题
 * @param {string} artist - 艺术家
 * @param {string} album - 专辑名
 * @returns {string[]} 搜索模式数组
 */
function generateCoverSearchPatterns(title, artist, album) {
    const patterns = [];

    // 清理文件名中的特殊字符
    const cleanTitle = cleanFileName(title);
    const cleanArtist = cleanFileName(artist);
    const cleanAlbum = cleanFileName(album);

    // 生成不同的变体
    const titleVariants = generateTextVariants(cleanTitle);
    const artistVariants = generateTextVariants(cleanArtist);

    // 常见的封面文件命名格式（按优先级排序）
    if (cleanTitle && cleanArtist) {
        // 标准格式
        for (const titleVar of titleVariants) {
            for (const artistVar of artistVariants) {
                patterns.push(`${artistVar}_${titleVar}_${cleanAlbum}`);
                patterns.push(`${artistVar}_${titleVar}`);
                patterns.push(`${artistVar} - ${titleVar}`);
                patterns.push(`${titleVar} - ${artistVar}`);
                patterns.push(`${artistVar}-${titleVar}`);
                patterns.push(`${titleVar}-${artistVar}`);
            }
        }
    }

    // 只有歌曲名的情况
    if (cleanTitle) {
        for (const titleVar of titleVariants) {
            patterns.push(titleVar);
        }
    }
    // 只有艺术家名的情况
    if (cleanArtist) {
        for (const artistVar of artistVariants) {
            patterns.push(artistVar);
        }
    }
    return patterns;
}

/**
 * 查找最佳封面文件匹配
 * @param {string[]} imageFiles - 图片文件列表
 * @param {string[]} searchPatterns - 搜索模式列表
 * @returns {string|null} 最佳匹配的文件名，如果没有找到则返回null
 */
function findBestCoverMatch(imageFiles, searchPatterns) {
    let bestMatch = null;
    let bestScore = 0;

    for (const file of imageFiles) {
        const fileNameWithoutExt = path.parse(file).name.toLowerCase();

        for (let i = 0; i < searchPatterns.length; i++) {
            const pattern = searchPatterns[i].toLowerCase();
            const score = calculateCoverMatchScore(fileNameWithoutExt, pattern, i);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = file;
            }
        }
    }
    return bestMatch;
}

/**
 * 计算封面文件匹配分数
 * @param {string} fileName - 文件名（不含扩展名）
 * @param {string} pattern - 搜索模式
 * @param {number} patternIndex - 模式索引（用于优先级计算）
 * @returns {number} 匹配分数
 */
function calculateCoverMatchScore(fileName, pattern, patternIndex) {
    if (!fileName || !pattern) return 0;

    if (fileName === pattern) {
        return 1000 - patternIndex; // 优先级越高分数越高
    }
    if (fileName.includes(pattern)) {
        return 500 - patternIndex;
    }
    // 模糊匹配，计算相似度
    const similarity = calculateStringSimilarity(fileName, pattern);
    if (similarity > 0.7) {
        return Math.floor(similarity * 300) - patternIndex;
    }
    return 0;
}

module.exports = {
    generateLyricsSearchPatterns,
    findBestLyricsMatch,
    generateCoverSearchPatterns,
    findBestCoverMatch,
    calculateCoverMatchScore
};
