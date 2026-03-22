/**
 * 文件搜索工具模块
 * 提供歌词文件和封面文件的搜索匹配功能
 */

import * as path from 'path';
import {
    cleanFileName,
    cleanCoverFileName,
    generateTextVariants,
    generateCoverTextVariants,
    calculateStringSimilarity,
    calculateWordMatch,
    parseFileNamePattern
} from './string';

/**
 * 生成歌词文件搜索模式
 * @param title - 歌曲标题
 * @param artist - 艺术家
 * @param album - 专辑名
 * @param extension - 格式
 * @returns 搜索模式数组
 */
export function generateLyricsSearchPatterns(
    title: string,
    artist: string,
    album: string,
    extension: string = '.frc'
): string[] {
    const patterns: string[] = [];

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
                patterns.push(`${artistVar} - ${titleVar}${extension}`);
                patterns.push(`${titleVar} - ${artistVar}${extension}`);
                patterns.push(`${artistVar}-${titleVar}${extension}`);
                patterns.push(`${titleVar}-${artistVar}${extension}`);
                patterns.push(`${artistVar}_${titleVar}${extension}`);
                patterns.push(`${titleVar}_${artistVar}${extension}`);
            }
        }
    }

    // 仅标题格式
    if (cleanTitle) {
        for (const titleVar of titleVariants) {
            patterns.push(`${titleVar}${extension}`);
        }
    }

    // 包含专辑信息的格式
    if (cleanTitle && cleanArtist && cleanAlbum) {
        const cleanAlbumVar = cleanFileName(cleanAlbum);
        patterns.push(`${cleanArtist} - ${cleanAlbumVar} - ${cleanTitle}${extension}`);
        patterns.push(`${cleanArtist} - ${cleanTitle} - ${cleanAlbumVar}${extension}`);
        patterns.push(`${cleanAlbumVar} - ${cleanArtist} - ${cleanTitle}${extension}`);
        patterns.push(`${cleanAlbumVar} - ${cleanTitle} - ${cleanArtist}${extension}`);
        patterns.push(`${cleanTitle} - ${cleanAlbumVar} - ${cleanArtist}${extension}`);
        patterns.push(`${cleanTitle} - ${cleanArtist} - ${cleanAlbumVar}${extension}`);
    }

    return patterns;
}

/**
 * 匹配结果
 */
interface MatchResult {
    file: string;
    score: number;
    type: 'exact' | 'high_similarity' | 'keyword_match';
}

/**
 * 查找最佳匹配的歌词文件
 * @param files - 文件列表
 * @param patterns - 搜索模式列表
 * @returns 最佳匹配的文件名，如果没有找到则返回null
 */
export function findBestLyricsMatch(files: string[], patterns: string[]): string | null {
    const matches: MatchResult[] = [];
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
        return matches[0].file;
    }

    // 第二轮：高相似度匹配
    console.log(`🎯 第二轮：高相似度匹配 (阈值: 80%)`);
    for (const file of files) {
        const fileName = path.basename(file, '.lrc').toLowerCase();

        for (const pattern of patterns) {
            const patternName = path.basename(pattern, '.lrc').toLowerCase();
            const similarity = calculateStringSimilarity(fileName, patternName);
            if (similarity >= 0.8) {
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
                    continue;
                }

                // 计算标题匹配度（权重更高）
                const titleMatch = calculateWordMatch(fileInfo.title, patternInfo.title);

                // 计算艺术家匹配度（权重较低）
                const artistMatch = patternInfo.artist && fileInfo.artist
                    ? calculateWordMatch(fileInfo.artist, patternInfo.artist)
                    : 0;

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
        const minScoreThreshold: Record<MatchResult['type'], number> = {
            'exact': 100,
            'high_similarity': 80,
            'keyword_match': 50
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
 * @param title - 歌曲标题
 * @param artist - 艺术家
 * @param album - 专辑名
 * @returns 搜索模式数组
 */
export function generateCoverSearchPatterns(title: string, artist: string, album: string): string[] {
    const patterns: string[] = [];

    // 使用与渲染器进程一致的封面文件名清理逻辑
    const cleanTitle = cleanCoverFileName(title);
    const cleanArtist = cleanCoverFileName(artist);
    const cleanAlbum = cleanCoverFileName(album);

    // 生成不同的变体
    const titleVariants = generateCoverTextVariants(cleanTitle);
    const artistVariants = generateCoverTextVariants(cleanArtist);

    // 常见的封面文件命名格式（按优先级排序）
    if (cleanTitle && cleanArtist) {
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
 * @param imageFiles - 图片文件列表
 * @param searchPatterns - 搜索模式列表
 * @returns 最佳匹配的文件名，如果没有找到则返回null
 */
export function findBestCoverMatch(imageFiles: string[], searchPatterns: string[]): string | null {
    let bestMatch: string | null = null;
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
 * @param fileName - 文件名（不含扩展名）
 * @param pattern - 搜索模式
 * @param patternIndex - 模式索引（用于优先级计算）
 * @returns 匹配分数
 */
function calculateCoverMatchScore(fileName: string, pattern: string, patternIndex: number): number {
    if (!fileName || !pattern) return 0;

    if (fileName === pattern) {
        return 1000 - patternIndex;
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
