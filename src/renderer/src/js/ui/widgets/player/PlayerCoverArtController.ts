import {coverLookupService, coverUpdateManager} from "@js/features/mediaAssets/service";
import {urlValidator} from "@utils/URLValidator";
import type {Track} from "@api/types/track";

interface CoverUpdatePayload {
    filePath?: string;
    title?: string;
    artist?: string;
    type?: string;
}

interface PlayerCoverArtControllerOptions {
    trackCover: HTMLImageElement;
    getCurrentTrack: () => Track | null;
    onCoverReady?: () => Promise<void> | void;
}

class PlayerCoverArtController {
    private readonly trackCover: HTMLImageElement;
    private readonly getCurrentTrack: () => Track | null;
    private readonly onCoverReady?: () => Promise<void> | void;
    private coverUpdateUnsubscribe: (() => void) | null = null;

    constructor(options: PlayerCoverArtControllerOptions) {
        this.trackCover = options.trackCover;
        this.getCurrentTrack = options.getCurrentTrack;
        this.onCoverReady = options.onCoverReady;
    }

    start(): void {
        if (this.coverUpdateUnsubscribe) {
            return;
        }

        this.coverUpdateUnsubscribe = coverUpdateManager.onCoverUpdate((data: unknown) => {
            void this.handleCoverUpdate(data as CoverUpdatePayload);
        });
    }

    async updateTrackCover(track: Track): Promise<void> {
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');

        try {
            if (track.title && track.artist) {
                const coverResult = await coverLookupService.getCover(track.title, track.artist, track.album, track.filePath, true);
                if (coverResult.success && coverResult.imageUrl) {
                    await this.applyCover(track, coverResult.imageUrl);
                } else {
                    console.log('❌ PlayerCoverArtController: 封面获取失败，使用默认封面', coverResult.error);
                }
            }
        } catch (error) {
            console.error('❌ PlayerCoverArtController: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
            await this.onCoverReady?.();
        }
    }

    destroy(): void {
        if (!this.coverUpdateUnsubscribe) {
            return;
        }

        try {
            this.coverUpdateUnsubscribe();
        } catch (error) {
            console.warn('⚠️ PlayerCoverArtController: 移除封面更新订阅失败:', error);
        }
        this.coverUpdateUnsubscribe = null;
    }

    private async applyCover(track: Track, imageUrl: unknown): Promise<void> {
        if (typeof imageUrl !== 'string') {
            return;
        }

        if (urlValidator) {
            const success = await urlValidator.safeSetImageSrc(this.trackCover, imageUrl);
            track.cover = success ? imageUrl : null;
            return;
        }

        this.trackCover.src = imageUrl;
        track.cover = imageUrl;
    }

    private async handleCoverUpdate(data: CoverUpdatePayload): Promise<void> {
        const {filePath, title, artist, type} = data;
        if (type && type !== 'cover-updated' && type !== 'manual-refresh') {
            return;
        }

        const currentTrack = this.getCurrentTrack();
        if (!currentTrack) {
            return;
        }

        const isCurrentTrack = (
            currentTrack.filePath === filePath ||
            (currentTrack.title === title && currentTrack.artist === artist)
        );
        if (!isCurrentTrack) {
            return;
        }

        if (currentTrack.cover) {
            delete currentTrack.cover;
        }

        try {
            await this.updateTrackCover(currentTrack);
        } catch (error) {
            console.error('❌ PlayerCoverArtController: 处理封面更新失败:', error);
        }
    }
}

export {PlayerCoverArtController};
