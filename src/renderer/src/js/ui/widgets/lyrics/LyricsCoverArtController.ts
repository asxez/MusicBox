import {urlValidator} from "@utils/URLValidator";
import type {Track} from "@api/types/track";
import {lyricsCoverArtService} from '@js/features/mediaAssets/service/LyricsCoverArtService';

type LyricsCoverTrack = Track & {
    path?: string;
};

interface LyricsCoverArtElements {
    background: HTMLElement;
    trackCover: HTMLImageElement;
}

class LyricsCoverArtController {
    private readonly elements: LyricsCoverArtElements;
    private backgroundObjectUrl: string | null = null;

    constructor(elements: LyricsCoverArtElements) {
        this.elements = elements;
    }

    async updateCoverArt(track: LyricsCoverTrack): Promise<void> {
        this.elements.trackCover.src = 'assets/images/default-cover.svg';
        this.elements.trackCover.classList.add('loading');
        await this.setBackgroundImage(null);

        try {
            let finalImageUrl: string | null = null;
            if (track.title && track.artist) {
                const coverResult = await lyricsCoverArtService.loadTrackCover(track);
                if (coverResult.success && coverResult.imageUrl) {
                    finalImageUrl = coverResult.imageUrl;
                } else {
                    console.log('❌ Lyrics: 封面获取失败，使用默认封面', coverResult.error);
                }
            }

            if (finalImageUrl) {
                await this.setCoverAndBackground(finalImageUrl);
            }
        } catch (error) {
            console.error('❌ Lyrics: 封面更新失败:', error);
        } finally {
            this.elements.trackCover.classList.remove('loading');
        }
    }

    destroy(): void {
        this.setBackgroundImageUrl(null);
        this.elements.trackCover.src = 'assets/images/default-cover.svg';
        this.elements.trackCover.classList.remove('loading');
    }

    private async setBackgroundImage(imageUrl: string | null): Promise<void> {
        if (imageUrl) {
            try {
                const processedUrl = await lyricsCoverArtService.normalizeImageUrl(imageUrl);
                this.setBackgroundImageUrl(processedUrl, this.shouldOwnProcessedUrl(imageUrl, processedUrl));
            } catch (error) {
                console.error('❌ Lyrics: 背景图片设置失败:', error);
                this.setBackgroundImageUrl(null);
            }
        } else {
            this.setBackgroundImageUrl(null);
        }
    }

    private setBackgroundImageUrl(imageUrl: string | null, ownsObjectUrl = false): void {
        if (this.backgroundObjectUrl) {
            URL.revokeObjectURL(this.backgroundObjectUrl);
            this.backgroundObjectUrl = null;
        }

        if (!imageUrl) {
            this.elements.background.style.backgroundImage = 'none';
            return;
        }

        if (ownsObjectUrl && imageUrl.startsWith('blob:')) {
            this.backgroundObjectUrl = imageUrl;
        }
        this.elements.background.style.backgroundImage = `url("${imageUrl}")`;
    }

    private shouldOwnProcessedUrl(originalUrl: string, processedUrl: string | null): boolean {
        return Boolean(processedUrl?.startsWith('blob:') && !originalUrl.startsWith('blob:'));
    }

    private async setCoverAndBackground(imageUrl: string): Promise<void> {
        try {
            const success = await urlValidator.safeSetImageSrc(this.elements.trackCover, imageUrl);
            if (!success) {
                this.elements.trackCover.src = 'assets/images/default-cover.svg';
            }

            await this.setBackgroundImage(imageUrl);
        } catch (error) {
            console.error('❌ Lyrics: 封面和背景设置失败:', error);
            this.elements.trackCover.src = 'assets/images/default-cover.svg';
            await this.setBackgroundImage(null);
        }
    }
}

export {LyricsCoverArtController};
