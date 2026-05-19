import {desktopLyricsController} from "@js/features/desktopLyrics";
import {mediaController} from "@js/features/media";
import type {LyricsTrack, RenderLyricLine} from "@ui/widgets/lyrics/LyricsTypes";

interface LyricsLoaderControllerOptions {
    setLyrics: (lyrics: RenderLyricLine[]) => void;
    renderLyrics: () => void;
    showLoading: () => void;
    showNoLyrics: () => void;
}

class LyricsLoaderController {
    private readonly setLyrics: (lyrics: RenderLyricLine[]) => void;
    private readonly renderLyrics: () => void;
    private readonly showLoading: () => void;
    private readonly showNoLyrics: () => void;
    private lastLoadedLyricsPath: string | null = null;
    private lastLoadedTrackId: string | null = null;
    private loadingLyrics = false;

    constructor(options: LyricsLoaderControllerOptions) {
        this.setLyrics = options.setLyrics;
        this.renderLyrics = options.renderLyrics;
        this.showLoading = options.showLoading;
        this.showNoLyrics = options.showNoLyrics;
    }

    reset(): void {
        this.lastLoadedLyricsPath = null;
        this.loadingLyrics = false;
    }

    async loadLyrics(track: LyricsTrack): Promise<void> {
        if (!track || !track.title || !track.artist) {
            this.showNoLyrics();
            return;
        }

        const trackPath = track.filePath || track.path || `${track.title}_${track.artist}`;
        const trackId = `${track.title}_${track.artist}_${track.album || ''}`;

        if (this.loadingLyrics || this.lastLoadedLyricsPath === trackPath) {
            return;
        }

        if (this.lastLoadedTrackId === trackId) {
            return;
        }

        this.loadingLyrics = true;
        this.lastLoadedLyricsPath = trackPath;
        this.lastLoadedTrackId = trackId;

        if (track.lyrics) {
            await this.loadEmbeddedLyrics(track);
            this.loadingLyrics = false;
            return;
        }

        this.showLoading();

        try {
            const lyricsResult = await mediaController.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                let parsedLyrics: RenderLyricLine[] | undefined;

                if (lyricsResult.format === 'ttml' && lyricsResult.content) {
                    parsedLyrics = mediaController.parseTTML(lyricsResult.content) as RenderLyricLine[];
                } else if (lyricsResult.lrc) {
                    parsedLyrics = mediaController.parseLRC(lyricsResult.lrc) as RenderLyricLine[];
                } else if (lyricsResult.content) {
                    parsedLyrics = mediaController.parseLyrics(lyricsResult.content, lyricsResult.format) as RenderLyricLine[];
                }

                if (parsedLyrics && parsedLyrics.length > 0) {
                    this.setLyrics(parsedLyrics);
                    track.lyrics = parsedLyrics;
                    if (lyricsResult.lrc) {
                        track.lrcText = lyricsResult.lrc;
                    } else if (lyricsResult.content) {
                        track.lyricsContent = lyricsResult.content;
                        track.lyricsFormat = lyricsResult.format;
                    }
                    this.renderLyrics();
                    await desktopLyricsController.syncLyrics(parsedLyrics);
                } else {
                    this.showNoLyrics();
                    console.log('❌ Lyrics: 歌词解析失败');
                }
            } else {
                this.showNoLyrics();
                console.log('❌ Lyrics: 歌词获取失败');
            }
        } catch (error) {
            console.error('❌ Lyrics: 歌词加载失败:', error);
            this.showNoLyrics();
        } finally {
            this.loadingLyrics = false;
        }
    }

    private async loadEmbeddedLyrics(track: LyricsTrack): Promise<void> {
        if (!track.lyrics) return;

        const lyrics = Array.isArray(track.lyrics)
            ? track.lyrics as RenderLyricLine[]
            : mediaController.parseLyrics(String(track.lyrics), track.lyricsFormat as any) as RenderLyricLine[];

        this.setLyrics(lyrics);
        this.renderLyrics();
        await desktopLyricsController.syncLyrics(lyrics);
    }
}

export {LyricsLoaderController};
