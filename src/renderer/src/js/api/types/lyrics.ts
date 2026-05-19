/**
 * 歌词 API 类型定义
 */

import {LyricsFormat, Result} from "@api/types/common";

/**
 * 歌词行
 */
export interface LyricLine {
    time: number;
    content: string;
    type: string;
    translation?: string;
    romanization?: string;
}

/**
 * 歌词数据
 */
export interface LyricsData {
    lines: LyricLine[];
    format: LyricsFormat;
    hasTranslation?: boolean;
    hasRomanization?: boolean;
    offset?: number;
}

/**
 * 歌词结果
 */
// @ts-ignore
export interface LyricsResult extends Result<LyricsData> {
    content?: string;
    source?: LyricsSource;
    format?: LyricsFormat;
    lyrics?: LyricsData;
    data?: object;
    metadata?: object;
    success?: boolean;
    filePath?: string;
    fileName?: string;
    lrc?: string;
}

/**
 * 歌词来源
 */
export type LyricsSource = 'embedded' | 'local' | 'network-ttml' | 'network-lrc' | 'error';


/**
 * 网络歌词搜索结果
 */
export interface NetworkLyricsSearchResult {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    source: string;
}
