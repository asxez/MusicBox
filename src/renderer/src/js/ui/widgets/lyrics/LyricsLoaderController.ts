import {desktopLyricsService} from "@js/features/desktopLyrics/service/DesktopLyricsService";
import {lyricsContentService} from "@js/features/mediaAssets/service/LyricsContentService";
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

        if (!track.lyrics) {
            this.showLoading();
        }

        try {
            const result = await lyricsContentService.loadTrackLyrics(track);
            if (result.success && result.lyrics.length > 0) {
                const lyrics = result.lyrics as RenderLyricLine[];
                this.setLyrics(lyrics);
                this.renderLyrics();
                await desktopLyricsService.syncLyrics(lyrics);
            } else {
                this.showNoLyrics();
                console.log(`❌ Lyrics: ${result.error || '歌词获取失败'}`);
            }
        } catch (error) {
            console.error('❌ Lyrics: 歌词加载失败:', error);
            this.showNoLyrics();
        } finally {
            this.loadingLyrics = false;
        }
    }
}

export {LyricsLoaderController};
