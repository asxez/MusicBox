import type {PlayerCoverArtController} from "@ui/widgets/player/PlayerCoverArtController";
import type {Track} from "@api/types/track";

interface PlayerTrackInfoControllerOptions {
    trackTitle: HTMLElement;
    trackArtist: HTMLElement;
    coverArtController: PlayerCoverArtController;
    setDuration: (duration: number) => void;
    getCurrentTime: () => number;
    isMiniModeActive: () => boolean;
    clearMiniModeLyrics: () => void;
    loadMiniModeTrackLyrics: (track: Track | null, currentTime: number) => Promise<void>;
}

class PlayerTrackInfoController {
    private readonly trackTitle: HTMLElement;
    private readonly trackArtist: HTMLElement;
    private readonly coverArtController: PlayerCoverArtController;
    private readonly setDuration: (duration: number) => void;
    private readonly getCurrentTime: () => number;
    private readonly isMiniModeActive: () => boolean;
    private readonly clearMiniModeLyrics: () => void;
    private readonly loadMiniModeTrackLyrics: (track: Track | null, currentTime: number) => Promise<void>;

    private currentTrack: Track | null = null;

    constructor(options: PlayerTrackInfoControllerOptions) {
        this.trackTitle = options.trackTitle;
        this.trackArtist = options.trackArtist;
        this.coverArtController = options.coverArtController;
        this.setDuration = options.setDuration;
        this.getCurrentTime = options.getCurrentTime;
        this.isMiniModeActive = options.isMiniModeActive;
        this.clearMiniModeLyrics = options.clearMiniModeLyrics;
        this.loadMiniModeTrackLyrics = options.loadMiniModeTrackLyrics;
    }

    getCurrentTrack(): Track | null {
        return this.currentTrack;
    }

    async updateTrackInfo(track: Track | null): Promise<void> {
        this.currentTrack = track;
        if (!track) {
            return;
        }

        this.trackTitle.textContent = track.title || '未知歌曲';
        this.trackArtist.textContent = track.artist || '未知艺术家';
        this.setDuration(track.duration || 0);

        if (this.isMiniModeActive()) {
            this.clearMiniModeLyrics();
            await Promise.all([
                this.coverArtController.updateTrackCover(track),
                this.loadMiniModeTrackLyrics(track, this.getCurrentTime())
            ]);
            return;
        }

        await this.coverArtController.updateTrackCover(track);
    }

    reset(): void {
        this.currentTrack = null;
    }
}

export {PlayerTrackInfoController};
