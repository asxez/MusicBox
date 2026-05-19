import {mediaController} from "@js/features/media";
import {urlValidator} from "@utils/URLValidator";
import type {Track} from "@api/types/track";

type LyricsCoverTrack = Track & {
    path?: string;
};

interface LyricsCoverArtElements {
    background: HTMLElement;
    trackCover: HTMLImageElement;
}

class LyricsCoverArtController {
    private readonly elements: LyricsCoverArtElements;

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
                const coverResult = await mediaController.getCover(
                    track.title,
                    track.artist,
                    track.album,
                    track.filePath,
                    true
                );
                if (coverResult.success && coverResult.imageUrl) {
                    if (typeof coverResult.imageUrl === 'string') {
                        finalImageUrl = coverResult.imageUrl;
                        track.cover = coverResult.imageUrl;
                    } else {
                        console.error('❌ Lyrics: API返回的imageUrl不是字符串', {
                            type: typeof coverResult.imageUrl,
                            value: coverResult.imageUrl
                        });
                    }
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

    private async setBackgroundImage(imageUrl: string | null): Promise<void> {
        if (imageUrl) {
            try {
                const processedUrl = await this.processImageUrl(imageUrl);
                this.elements.background.style.backgroundImage = processedUrl
                    ? `url("${processedUrl}")`
                    : 'none';
            } catch (error) {
                console.error('❌ Lyrics: 背景图片设置失败:', error);
                this.elements.background.style.backgroundImage = 'none';
            }
        } else {
            this.elements.background.style.backgroundImage = 'none';
        }
    }

    private async processImageUrl(url: string): Promise<string | null> {
        if (!url || typeof url !== 'string') return null;

        if (url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
        }

        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        if (url.startsWith('file://')) {
            return await this.convertFileUrlToBlobUrl(url);
        }

        return await this.convertLocalPathToBlobUrl(url);
    }

    private async convertFileUrlToBlobUrl(fileUrl: string): Promise<string | null> {
        try {
            let filePath = fileUrl.replace('file://', '');

            if (filePath.startsWith('/') && filePath.includes(':')) {
                filePath = filePath.substring(1);
            }

            return await this.convertLocalPathToBlobUrl(filePath);
        } catch (error) {
            console.error('❌ Lyrics: file://协议转换失败:', error);
            return null;
        }
    }

    private async convertLocalPathToBlobUrl(filePath: string): Promise<string | null> {
        try {
            const fileData = await mediaController.readFile(filePath);
            if (!fileData || fileData.length === 0) {
                console.error('❌ Lyrics: 文件数据为空');
                return null;
            }

            const mimeType = this.getMimeTypeFromPath(filePath);
            const uint8Array = typeof fileData === 'string'
                ? new TextEncoder().encode(fileData)
                : new Uint8Array(fileData);
            const blob = new Blob([uint8Array], {type: mimeType});
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('❌ Lyrics: 本地文件转换失败:', error);
            return null;
        }
    }

    private getMimeTypeFromPath(filePath: string): string {
        const ext = filePath.toLowerCase().split('.').pop() || '';
        const mimeTypes: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            bmp: 'image/bmp',
            svg: 'image/svg+xml'
        };
        return mimeTypes[ext] || 'image/jpeg';
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
