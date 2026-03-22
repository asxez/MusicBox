/**
 * 音频元数据处理工具模块
 * 提供音频文件元数据解析、内嵌歌词提取等功能
 */

import * as path from 'path';
import * as mm from 'music-metadata';
import {fixStringEncoding} from './string';
import type {TrackMetadata} from '../types/global';

/**
 * 同步歌词时间戳
 */
interface LyricsTimestamp {
    time: number;
    text: string;
}

/**
 * 同步歌词对象
 */
interface SynchronizedLyrics {
    timestamps: LyricsTimestamp[];
    text: string;
}

/**
 * 内嵌歌词对象
 */
export interface EmbeddedLyrics {
    type: 'USLT' | 'SYLT' | 'TXXX';
    format: string;
    language?: string;
    description?: string;
    text: string;
    timestamps?: LyricsTimestamp[];
    synchronized: boolean;
}

/**
 * 网络文件适配器接口
 */
interface NetworkFileAdapter {
    isNetworkPath(filePath: string): boolean;

    readFile(filePath: string): Promise<Buffer>;
}

/**
 * 元数据解析选项
 */
export interface ParseMetadataOptions {
    skipCover?: boolean;
    skipLyrics?: boolean;
}

/**
 * 判断是否为歌词标签
 * @param tagId - 标签ID
 * @param format - 音频格式
 * @returns 是否为歌词标签
 */
function isLyricsTag(tagId: string, format: string): boolean {
    const lyricsTagIds = [
        'USLT', 'LYRICS', 'UNSYNCED LYRICS', 'UNSYNCEDLYRICS',
        'SYLT', 'SYNCHRONIZED LYRICS', 'SYNCEDLYRICS',
        'TXXX', '©LYR', 'LYR', 'LYRICIST'
    ];

    // 对于Vorbis Comments格式，还要检查其他可能的标签
    if (format === 'vorbis') {
        lyricsTagIds.push('LYRICS', 'UNSYNCEDLYRICS', 'SYNCEDLYRICS');
    }

    // 对于APE格式
    if (format === 'APEv2') {
        lyricsTagIds.push('Lyrics', 'LYRICS');
    }

    return lyricsTagIds.includes(tagId);
}

/**
 * 提取歌词文本内容
 * @param value - 歌词值
 * @returns 提取的歌词文本
 */
function extractLyricsText(value: any): string | null {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }

    if (typeof value === 'object') {
        if (value.text && typeof value.text === 'string') {
            const trimmed = value.text.trim();
            return trimmed || null;
        }

        if (value.lyrics && typeof value.lyrics === 'string') {
            const trimmed = value.lyrics.trim();
            return trimmed || null;
        }

        const possibleKeys = ['lyric', 'content', 'data', 'value'];
        for (const key of possibleKeys) {
            if (value[key] && typeof value[key] === 'string') {
                const trimmed = value[key].trim();
                return trimmed || null;
            }
        }

        if (Array.isArray(value) && value.length > 0) {
            for (const item of value) {
                if (typeof item === 'string') {
                    const trimmed = item.trim();
                    return trimmed || null;
                } else if (typeof item === 'object' && item.text) {
                    const trimmed = item.text.trim();
                    return trimmed || null;
                }
            }
        }
    }

    return null;
}

/**
 * 提取同步歌词
 * @param value - 同步歌词值
 * @returns 同步歌词对象或null
 */
function extractSynchronizedLyrics(value: any): SynchronizedLyrics | null {
    console.log('🔍 提取同步歌词:', {
        type: typeof value,
        isArray: Array.isArray(value),
        keys: typeof value === 'object' && value ? Object.keys(value) : null
    });

    if (!value || typeof value !== 'object') {
        console.log('🔍 同步歌词值无效');
        return null;
    }

    try {
        let timestamps: LyricsTimestamp[] = [];
        let text = '';

        if (Array.isArray(value.synchronizedText)) {
            // 标准SYLT格式
            console.log(`🔍 标准SYLT格式，同步文本数量: ${value.synchronizedText.length}`);
            for (const item of value.synchronizedText) {
                console.log('🔍 SYLT项目:', {text: item.text, timeStamp: item.timeStamp});
                if (item.text && typeof item.timeStamp === 'number') {
                    timestamps.push({
                        time: item.timeStamp / 1000, // 转换为秒
                        text: item.text.trim()
                    });
                    text += item.text.trim() + '\n';
                }
            }
        } else if (value.text && value.timeStamps) {
            // 其他可能的格式
            console.log('🔍 文本+时间戳格式');
            const textLines = value.text.split('\n');
            const timeStamps = Array.isArray(value.timeStamps) ? value.timeStamps : [];

            console.log(`🔍 文本行数: ${textLines.length}, 时间戳数: ${timeStamps.length}`);

            for (let i = 0; i < Math.min(textLines.length, timeStamps.length); i++) {
                if (textLines[i].trim() && typeof timeStamps[i] === 'number') {
                    timestamps.push({
                        time: timeStamps[i] / 1000,
                        text: textLines[i].trim()
                    });
                }
            }
            text = value.text;
        } else if (Array.isArray(value)) {
            // 有些格式可能直接是数组
            console.log(`🔍 数组格式，长度: ${value.length}`);
            for (const item of value) {
                if (item && typeof item === 'object' && item.text && typeof item.time === 'number') {
                    timestamps.push({
                        time: item.time / 1000,
                        text: item.text.trim()
                    });
                    text += item.text.trim() + '\n';
                }
            }
        } else {
            // 尝试其他可能的属性名
            console.log('🔍 检查其他可能的同步歌词格式');
            const possibleKeys = ['lyrics', 'lines', 'entries', 'items'];
            for (const key of possibleKeys) {
                if (Array.isArray(value[key])) {
                    console.log(`🔍 找到${key}数组，长度: ${value[key].length}`);
                    for (const item of value[key]) {
                        if (item && typeof item === 'object') {
                            const timeKey = item.time !== undefined ? 'time' :
                                item.timestamp !== undefined ? 'timestamp' :
                                    item.timeStamp !== undefined ? 'timeStamp' : null;
                            const textKey = item.text !== undefined ? 'text' :
                                item.lyric !== undefined ? 'lyric' :
                                    item.content !== undefined ? 'content' : null;

                            if (timeKey && textKey && typeof item[timeKey] === 'number' && typeof item[textKey] === 'string') {
                                timestamps.push({
                                    time: item[timeKey] / 1000,
                                    text: item[textKey].trim()
                                });
                                text += item[textKey].trim() + '\n';
                            }
                        }
                    }
                    break;
                }
            }
        }

        console.log(`🔍 提取到 ${timestamps.length} 个时间戳`);
        if (timestamps.length > 0) {
            const sortedTimestamps = timestamps.sort((a, b) => a.time - b.time);
            console.log(`🔍 同步歌词时间范围: ${sortedTimestamps[0].time}s - ${sortedTimestamps[sortedTimestamps.length - 1].time}s`);
            return {
                timestamps: sortedTimestamps,
                text: text.trim()
            };
        }
    } catch (error) {
        console.error(`❌ 解析同步歌词失败: ${(error as Error).message}`, error);
    }

    console.log('🔍 未找到有效的同步歌词');
    return null;
}

/**
 * 提取内嵌歌词函数
 * @param metadata - 音频元数据对象
 * @returns 内嵌歌词对象或null
 */
export function extractEmbeddedLyrics(metadata: mm.IAudioMetadata): EmbeddedLyrics | null {
    if (!metadata || !metadata.native) {
        return null;
    }

    let embeddedLyrics: EmbeddedLyrics | null = null;

    for (const [format, tags] of Object.entries(metadata.native)) {
        if (!Array.isArray(tags)) continue;

        for (const tag of tags) {
            const tagId = tag.id ? tag.id.toUpperCase() : '';

            if (isLyricsTag(tagId, format)) {
                if (tagId === 'USLT' || tagId === 'LYRICS' || tagId === 'UNSYNCED LYRICS' ||
                    tagId === 'UNSYNCEDLYRICS' || tagId === '©LYR' || tagId === 'LYR') {
                    const lyricsText = extractLyricsText(tag.value);
                    if (lyricsText) {
                        embeddedLyrics = {
                            type: 'USLT',
                            format: format,
                            language: (tag.value as any)?.language || 'unknown',
                            description: (tag.value as any)?.description || '',
                            text: lyricsText,
                            synchronized: false
                        };
                        break;
                    }
                } else if (tagId === 'SYLT' || tagId === 'SYNCHRONIZED LYRICS' || tagId === 'SYNCEDLYRICS') {
                    const syncLyrics = extractSynchronizedLyrics(tag.value);
                    if (syncLyrics) {
                        embeddedLyrics = {
                            type: 'SYLT',
                            format: format,
                            language: (tag.value as any)?.language || 'unknown',
                            description: (tag.value as any)?.description || '',
                            text: syncLyrics.text,
                            timestamps: syncLyrics.timestamps,
                            synchronized: true
                        };
                        break;
                    }
                } else if (tagId === 'TXXX' && (tag.value as any)?.description) {
                    const desc = (tag.value as any).description.toUpperCase();
                    if (desc.includes('LYRIC') || desc.includes('歌词') || desc.includes('LYRICS')) {
                        const lyricsText = (tag.value as any).text;
                        if (lyricsText && typeof lyricsText === 'string' && lyricsText.trim()) {
                            embeddedLyrics = {
                                type: 'TXXX',
                                format: format,
                                description: (tag.value as any).description,
                                text: lyricsText.trim(),
                                synchronized: false
                            };
                            break;
                        }
                    }
                }
            }
        }
        if (embeddedLyrics) break;
    }

    return embeddedLyrics;
}

/**
 * 根据文件扩展名获取MIME类型
 * @param filePath - 文件路径
 * @returns MIME类型
 */
export function getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * 全局元数据解析函数
 * @param filePath - 音频文件路径
 * @param networkFileAdapter - 网络文件适配器
 * @param options - 解析选项
 * @returns 解析后的元数据对象
 */
export async function parseMetadata(
    filePath: string,
    networkFileAdapter: NetworkFileAdapter | null = null,
    options: ParseMetadataOptions = {}
): Promise<TrackMetadata> {
    const {skipCover = false, skipLyrics = false} = options;
    try {
        let metadata: mm.IAudioMetadata;
        const parseOptions: mm.IOptions = {
            skipCovers: skipCover,
            skipPostHeaders: skipLyrics
        };

        if (networkFileAdapter && networkFileAdapter.isNetworkPath(filePath)) {
            const buffer = await networkFileAdapter.readFile(filePath);
            metadata = await mm.parseBuffer(buffer, {
                mimeType: getMimeTypeFromExtension(filePath),
                size: buffer.length,
                ...parseOptions
            });
        } else {
            metadata = await mm.parseFile(filePath, parseOptions);
        }

        if (!metadata) {
            throw new Error('无法解析音频文件元数据');
        }

        // 提取基本信息并修复编码
        const title = fixStringEncoding(metadata.common.title || path.basename(filePath, path.extname(filePath)));
        const artist = fixStringEncoding(metadata.common.artist || metadata.common.albumartist || '未知艺术家');
        const album = fixStringEncoding(metadata.common.album || '未知专辑');
        const duration = metadata.format.duration || 0;
        const bitrate = metadata.format.bitrate || 0;
        const sampleRate = metadata.format.sampleRate || 0;
        const year = metadata.common.year || undefined;
        const genre = metadata.common.genre ? metadata.common.genre.map(g => fixStringEncoding(g)) : [];

        const track = metadata.common.track?.no ?? undefined;
        const disc = metadata.common.disk?.no ?? undefined;

        // 提取专辑封面
        let cover: { format: string; data: Buffer } | undefined;
        if (!skipCover && metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            cover = {
                format: picture.format,
                data: picture.data
            };
        }

        // 提取内嵌歌词
        let embeddedLyrics: EmbeddedLyrics | null = null;
        if (!skipLyrics) {
            try {
                embeddedLyrics = extractEmbeddedLyrics(metadata);
                if (embeddedLyrics) {
                    console.log(`🎵 发现内嵌歌词: ${embeddedLyrics.type} 格式`);
                }
            } catch (error) {
                console.warn(`⚠️ 提取内嵌歌词失败: ${(error as Error).message}`);
            }
        }

        return {
            title,
            artist,
            album,
            duration,
            bitrate,
            sampleRate,
            year,
            genre,
            trackNumber: track,
            diskNumber: disc,
            cover,
            embeddedLyrics
        };
    } catch (error) {
        console.error(`❌ 解析元数据失败: ${filePath}`, error);
        throw error;
    }
}
