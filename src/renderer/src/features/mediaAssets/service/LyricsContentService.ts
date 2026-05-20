import type {LyricsFormat} from '@api/types/common';
import type {LyricLine, LyricsResult, LyricsSource} from '@api/types/lyrics';
import type {Track} from '@api/types/track';
import {lyricsLookupService} from './LyricsLookupService';

type TrackLyricsSource = LyricsSource | 'track';

export interface TrackLyricsLoadResult {
    success: boolean;
    lyrics: LyricLine[];
    source?: TrackLyricsSource;
    error?: string;
}

class LyricsContentService {
    async loadTrackLyrics(track: Track): Promise<TrackLyricsLoadResult> {
        if (!this.canLoadTrackLyrics(track)) {
            return {
                success: false,
                lyrics: [],
                error: '缺少歌曲标题或艺术家'
            };
        }

        const cachedLyrics = this.parseTrackLyrics(track);
        if (cachedLyrics.length > 0) {
            track.lyrics = cachedLyrics;
            return {
                success: true,
                lyrics: cachedLyrics,
                source: 'track'
            };
        }

        const lyricsResult = await lyricsLookupService.getLyrics(
            track.title,
            track.artist,
            track.album,
            track.filePath
        );

        if (!lyricsResult.success) {
            return {
                success: false,
                lyrics: [],
                source: lyricsResult.source,
                error: lyricsResult.error || '歌词获取失败'
            };
        }

        const parsedLyrics = this.parseLyricsResult(lyricsResult);
        if (parsedLyrics.length === 0) {
            return {
                success: false,
                lyrics: [],
                source: lyricsResult.source,
                error: '歌词解析失败'
            };
        }

        this.applyLyricsToTrack(track, parsedLyrics, lyricsResult);
        return {
            success: true,
            lyrics: parsedLyrics,
            source: lyricsResult.source
        };
    }

    parseTrackLyrics(track: Track): LyricLine[] {
        if (!track.lyrics) {
            return [];
        }

        if (Array.isArray(track.lyrics)) {
            return track.lyrics;
        }

        return lyricsLookupService.parse(
            String(track.lyrics),
            this.normalizeLyricsFormat(track.lyricsFormat)
        );
    }

    parseLyricsResult(lyricsResult: LyricsResult): LyricLine[] {
        if (lyricsResult.format === 'ttml' && lyricsResult.content) {
            return lyricsLookupService.parseTTML(lyricsResult.content);
        }

        if (lyricsResult.lrc) {
            return lyricsLookupService.parseLRC(lyricsResult.lrc);
        }

        if (lyricsResult.content) {
            return lyricsLookupService.parse(
                lyricsResult.content,
                this.normalizeLyricsFormat(lyricsResult.format)
            );
        }

        return [];
    }

    private canLoadTrackLyrics(track: Track | null | undefined): track is Track {
        return Boolean(track && track.title && track.artist);
    }

    private applyLyricsToTrack(track: Track, lyrics: LyricLine[], lyricsResult: LyricsResult): void {
        track.lyrics = lyrics;

        if (lyricsResult.lrc) {
            track.lrcText = lyricsResult.lrc;
            return;
        }

        if (lyricsResult.content) {
            track.lyricsContent = lyricsResult.content;
            track.lyricsFormat = lyricsResult.format;
        }
    }

    private normalizeLyricsFormat(format: string | null | undefined): LyricsFormat | null {
        if (format === 'ttml' || format === 'lrc') {
            return format;
        }

        return null;
    }
}

export const lyricsContentService = new LyricsContentService();
export {LyricsContentService};
