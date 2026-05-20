import type {LyricsTrack} from "@ui/widgets/lyrics/LyricsTypes";

interface LyricsTrackInfoElements {
    trackTitle: HTMLElement;
    trackArtist: HTMLElement;
}

interface LyricsTrackInfoControllerOptions {
    elements: LyricsTrackInfoElements;
    updateTrackDuration: (duration: number | undefined) => void;
    loadLyrics: (track: LyricsTrack) => Promise<void>;
    updateCoverArt: (track: LyricsTrack) => Promise<void>;
}

class LyricsTrackInfoController {
    private readonly elements: LyricsTrackInfoElements;
    private readonly updateTrackDuration: (duration: number | undefined) => void;
    private readonly loadLyrics: (track: LyricsTrack) => Promise<void>;
    private readonly updateCoverArt: (track: LyricsTrack) => Promise<void>;
    private lastTrackPath: string | null = null;
    private updateInProgress = false;
    private pendingUpdatePromise: Promise<void> | null = null;

    constructor(options: LyricsTrackInfoControllerOptions) {
        this.elements = options.elements;
        this.updateTrackDuration = options.updateTrackDuration;
        this.loadLyrics = options.loadLyrics;
        this.updateCoverArt = options.updateCoverArt;
    }

    reset(): void {
        this.lastTrackPath = null;
        this.updateInProgress = false;
        this.pendingUpdatePromise = null;
    }

    async updateTrackInfo(track: LyricsTrack | null): Promise<void> {
        if (!track) return;

        const trackPath = this.getTrackPath(track);

        if (this.pendingUpdatePromise) {
            await this.pendingUpdatePromise;
        }

        if (this.lastTrackPath === trackPath || this.updateInProgress) {
            return;
        }

        this.updateInProgress = true;
        this.lastTrackPath = trackPath;
        this.pendingUpdatePromise = this.doUpdateTrackInfo(track);

        try {
            await this.pendingUpdatePromise;
        } finally {
            this.pendingUpdatePromise = null;
            this.updateInProgress = false;
        }
    }

    private getTrackPath(track: LyricsTrack): string {
        return track.filePath || track.path || `${track.title}_${track.artist}`;
    }

    private async doUpdateTrackInfo(track: LyricsTrack): Promise<void> {
        try {
            console.log('🎵 Lyrics: 开始更新歌曲信息', track.title, '时间戳:', Date.now());

            this.elements.trackTitle.textContent = track.title || '未知歌曲';
            this.elements.trackArtist.textContent = track.artist || '未知艺术家';

            this.updateTrackDuration(track.duration);
            await this.loadLyrics(track);
            await this.updateCoverArt(track);
        } catch (error) {
            console.error('❌ Lyrics: 歌曲信息更新失败:', error);
            throw error;
        }
    }
}

export {LyricsTrackInfoController};
