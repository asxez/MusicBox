import {cacheManager} from '@/shared/cache';
import {networkRequestClient} from '@/shared/network';
import type {LyricLine, LyricsFormat, LyricsResult, NetworkLyricsSearchResult} from '@api/types';
import {embeddedLyricsManager} from './EmbeddedLyricsManager';
import {localLyricsManager} from './LocalLyricsManager';
import {ttmlParser} from './TTMLParser';

export class LyricsLookupService {
    private readonly lyricsRequestLock = new Set<string>();

    async getLyrics(
        title: string,
        artist: string,
        album = '',
        filePath: string | null = null
    ): Promise<LyricsResult> {
        const lyricsKey = `${title}_${artist}_${album || ''}`;

        if (this.lyricsRequestLock.has(lyricsKey)) {
            return {success: false, error: '歌词获取已在进行中'};
        }

        this.lyricsRequestLock.add(lyricsKey);
        console.log(`📝 Lyrics: 获取歌词: ${title} - ${artist}${filePath ? ` (${filePath})` : ''}`);

        try {
            if (filePath) {
                const embeddedLyrics = await this.getEmbeddedLyrics(filePath);
                if (embeddedLyrics.success) {
                    return embeddedLyrics;
                }
            }

            const localLyrics = await this.getLocalLyrics(title, artist, album);
            if (localLyrics.success) {
                return localLyrics;
            }

            const ttmlLyrics = await this.getNetworkTTMLLyrics(title, artist, album);
            if (ttmlLyrics.success && ttmlLyrics.content) {
                await this.saveLyricsToLocal(title, artist, album, ttmlLyrics.content, 'ttml');
                return ttmlLyrics;
            }

            const lrcLyrics = await this.getNetworkLRCLyrics(title, artist, album);
            if (lrcLyrics.success && lrcLyrics.content) {
                await this.saveLyricsToLocal(title, artist, album, lrcLyrics.content, 'lrc');
                return lrcLyrics;
            }

            return {success: false, error: '未找到歌词'};
        } catch (error) {
            this.logError(`歌词获取失败: ${title}`, error);
            return {
                success: false,
                error: this.getErrorMessage(error),
                source: 'error'
            };
        } finally {
            this.lyricsRequestLock.delete(lyricsKey);
        }
    }

    async getEmbeddedLyrics(filePath: string): Promise<LyricsResult> {
        try {
            const embeddedResult: LyricsResult = await embeddedLyricsManager.getEmbeddedLyrics(filePath) as LyricsResult;
            if (embeddedResult.success) {
                return embeddedResult;
            }

            return {success: false};
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async getLocalLyrics(title: string, artist: string, album = ''): Promise<LyricsResult> {
        try {
            const localResult: LyricsResult = await localLyricsManager.getLyrics(title, artist, album);
            if (!localResult.success) {
                return {success: false};
            }

            if (localResult.format === 'ttml') {
                return {
                    success: true,
                    content: localResult.content,
                    format: 'ttml',
                    source: 'local',
                    filePath: localResult.filePath,
                    fileName: localResult.fileName
                };
            }

            return {
                success: true,
                lrc: localResult.content,
                format: 'lrc',
                source: 'local',
                filePath: localResult.filePath,
                fileName: localResult.fileName
            };
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async searchTTMLLyrics(title: string): Promise<NetworkLyricsSearchResult[]> {
        try {
            const response = await fetch('https://amlldb.bikonoo.com/api/search-lyrics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
            console.error(`🚫 Network: TTML歌词搜索失败: ${this.getErrorMessage(error)}`);
            return [];
        }
    }

    matchBestLyrics(
        results: NetworkLyricsSearchResult[],
        title: string,
        artist: string,
        album = ''
    ): NetworkLyricsSearchResult | null {
        if (!results || results.length === 0) {
            return null;
        }

        const normalize = (value: string | undefined | null): string =>
            value ? value.toLowerCase().trim().replace(/\s+/g, '') : '';

        const normalizedTitle = normalize(title);
        const normalizedArtist = normalize(artist);
        const normalizedAlbum = normalize(album);

        const titleMatchedResults = results.filter(result => {
            const resultTitles = (result as any).titles || [result.title];
            return resultTitles.some((candidateTitle: string) => normalize(candidateTitle) === normalizedTitle);
        });

        if (titleMatchedResults.length === 0) {
            console.log(`🔌 API: [LyricsLookupService] 未找到歌名完全匹配的TTML歌词 (搜索词="${title}")`);
            console.log(`🔌 API: [LyricsLookupService] 搜索到${results.length}条结果，但没有一条歌名完全匹配`);
            return null;
        }

        console.log(`🔌 API: [LyricsLookupService] 找到${titleMatchedResults.length}条歌名匹配的结果 (共${results.length}条)`);

        const scoreResult = (result: NetworkLyricsSearchResult): number => {
            let score = 100;

            if (artist) {
                const resultArtists = (result as any).artists || [result.artist];
                const artistMatch = resultArtists.some((candidateArtist: string) =>
                    normalize(candidateArtist) === normalizedArtist
                );
                if (artistMatch) {
                    score += 50;
                } else {
                    const partialMatch = resultArtists.some(
                        (candidateArtist: string) =>
                            normalize(candidateArtist).includes(normalizedArtist) ||
                            normalizedArtist.includes(normalize(candidateArtist))
                    );
                    if (partialMatch) score += 25;
                }
            }

            if (album) {
                const resultAlbums = (result as any).albums || [(result as any).album];
                const albumMatch = resultAlbums.some((candidateAlbum: string) =>
                    normalize(candidateAlbum) === normalizedAlbum
                );
                if (albumMatch) {
                    score += 30;
                } else {
                    const partialMatch = resultAlbums.some(
                        (candidateAlbum: string) =>
                            normalize(candidateAlbum).includes(normalizedAlbum) ||
                            normalizedAlbum.includes(normalize(candidateAlbum))
                    );
                    if (partialMatch) score += 15;
                }
            }

            return score;
        };

        const scoredResults = titleMatchedResults
            .map(result => ({
                result,
                score: scoreResult(result)
            }))
            .sort((a, b) => b.score - a.score);

        console.log('📝 Lyrics: TTML匹配结果 (前3名):');
        scoredResults.slice(0, 3).forEach((item, index) => {
            console.log(`📝 Lyrics:   ${index + 1}. [分数=${item.score}] ${item.result.title} - ${item.result.artist}`);
        });

        const bestResult = scoredResults[0].result;
        console.log(`✅ Success: 选择最佳匹配: ${bestResult.title} - ${bestResult.artist} (分数=${scoredResults[0].score})`);
        return bestResult;
    }

    async downloadTTMLLyrics(platform: string, file: string): Promise<string> {
        try {
            const url = `https://amlldb.bikonoo.com/${platform}/${file}`;
            console.log(`🌐 Network: 下载TTML歌词: ${url}`);

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
            this.logError('TTML歌词下载失败', error);
            throw error;
        }
    }

    async getNetworkTTMLLyrics(title: string, artist: string, album = ''): Promise<LyricsResult> {
        try {
            console.log(`🌐 Network: 尝试网络获取TTML歌词: ${title} - ${artist}`);

            const searchResults = await this.searchTTMLLyrics(title);
            if (searchResults.length === 0) {
                console.warn('⚠️ LyricsLookupService: TTML搜索无结果');
                return {success: false, error: 'TTML搜索无结果'};
            }

            const bestMatch = this.matchBestLyrics(searchResults, title, artist, album);
            if (!bestMatch) {
                console.warn('⚠️ LyricsLookupService: 未找到匹配的TTML歌词');
                return {success: false, error: '未找到匹配的TTML歌词'};
            }

            const content = await this.downloadTTMLLyrics(
                (bestMatch as any).platform,
                (bestMatch as any).file
            );

            console.log(`✅ Success: 成功获取TTML歌词 (来源: ${(bestMatch as any).platform})`);
            const metadata = {
                title: bestMatch.title,
                artist: bestMatch.artist,
                album: (bestMatch as any).album?.[0] || (bestMatch as any).albums?.[0],
                platform: (bestMatch as any).platform
            };

            return {
                success: true,
                content: content.trim(),
                format: 'ttml',
                source: 'network-ttml',
                data: metadata,
                metadata
            };
        } catch (error) {
            this.logError('网络TTML歌词获取失败', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async getNetworkLRCLyrics(title: string, artist: string, album = ''): Promise<LyricsResult> {
        try {
            console.log(`🌐 Network: 尝试网络获取LRC歌词: ${title}`);
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/lyrics?${params.toString()}`;
            const response = await networkRequestClient.fetchWithRetry(url);
            const lrcText = await response.text();

            if (!lrcText || lrcText.trim() === '') {
                console.warn('⚠️ LyricsLookupService: LRC歌词内容为空');
                return {success: false, error: 'LRC歌词内容为空'};
            }

            console.log('✅ Success: 成功获取LRC歌词');
            return {
                success: true,
                content: lrcText.trim(),
                format: 'lrc',
                source: 'network-lrc'
            };
        } catch (error) {
            this.logError('网络LRC歌词获取失败', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    cacheLyrics(title: string, artist: string, album: string, lyricsData: Record<string, unknown>): void {
        cacheManager.setLyricsCache(title, artist, album, lyricsData);
    }

    parseLRC(lrcText: string): LyricLine[] {
        try {
            const lines = lrcText.split('\n');
            const lyrics: LyricLine[] = [];
            const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})]/g;

            for (const line of lines) {
                const matches = [...line.matchAll(timeRegex)];
                if (matches.length === 0) {
                    continue;
                }

                const content = line.replace(timeRegex, '').trim();
                if (!content) {
                    continue;
                }

                for (const match of matches) {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    const milliseconds = parseInt(match[3].padEnd(3, '0'));
                    const time = minutes * 60 + seconds + milliseconds / 1000;

                    lyrics.push({
                        time,
                        content,
                        type: 'line'
                    });
                }
            }

            lyrics.sort((a, b) => a.time - b.time);
            console.log(`✅ Success: LRC解析成功，共 ${lyrics.length} 行歌词`);
            return lyrics;
        } catch (error) {
            this.logError('LRC解析失败', error);
            return [];
        }
    }

    parseTTML(ttmlText: string): LyricLine[] {
        return ttmlParser.parse(ttmlText);
    }

    parse(lyricsText: string, format: LyricsFormat | null = null): LyricLine[] {
        if (!lyricsText) return [];

        if (format === 'ttml' || (!format && ttmlParser.isValidTTML(lyricsText))) {
            return this.parseTTML(lyricsText);
        }

        return this.parseLRC(lyricsText);
    }

    private async saveLyricsToLocal(
        title: string,
        artist: string,
        album: string,
        content: string,
        format: LyricsFormat
    ): Promise<void> {
        try {
            const result: any = await localLyricsManager.saveLyrics(title, artist, album, content, format);
            if (result.success) {
                console.log(`💾 Cache: 歌词已缓存到本地: ${result.fileName}`);
            } else {
                console.warn(`⚠️ LyricsLookupService: 歌词缓存到本地失败: ${result.error}`);
            }
        } catch (error) {
            this.logError('保存歌词到本地时出错', error);
        }
    }

    private logError(message: string, error: unknown): void {
        console.error(`❌ LyricsLookupService: ${message}`, error);
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export const lyricsLookupService = new LyricsLookupService();
