import type {Track} from '@api/types/track';
import {coverLookupService} from './CoverLookupService';
import {mediaAssetsService} from './MediaAssetsService';

type LyricsCoverTrack = Track & {
    path?: string;
};

export interface LyricsCoverArtResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

export class LyricsCoverArtService {
    async loadTrackCover(track: LyricsCoverTrack): Promise<LyricsCoverArtResult> {
        if (!track.title || !track.artist) {
            return {
                success: false,
                error: '歌曲标题或歌手缺失'
            };
        }

        try {
            const coverResult = await coverLookupService.getCover(
                track.title,
                track.artist,
                track.album,
                track.filePath,
                true
            );

            if (!coverResult.success || typeof coverResult.imageUrl !== 'string') {
                return {
                    success: false,
                    error: coverResult.error || '未找到封面'
                };
            }

            track.cover = coverResult.imageUrl;

            return {
                success: true,
                imageUrl: coverResult.imageUrl
            };
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async normalizeImageUrl(imageUrl: string): Promise<string | null> {
        if (!imageUrl || typeof imageUrl !== 'string') return null;

        if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
            return imageUrl;
        }

        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        if (imageUrl.startsWith('file://')) {
            return await this.convertFileUrlToBlobUrl(imageUrl);
        }

        return await this.convertLocalPathToBlobUrl(imageUrl);
    }

    private async convertFileUrlToBlobUrl(fileUrl: string): Promise<string | null> {
        try {
            let filePath = fileUrl.replace('file://', '');

            if (filePath.startsWith('/') && filePath.includes(':')) {
                filePath = filePath.substring(1);
            }

            return await this.convertLocalPathToBlobUrl(filePath);
        } catch (error) {
            console.error('❌ LyricsCoverArtService: file://协议转换失败', error);
            return null;
        }
    }

    private async convertLocalPathToBlobUrl(filePath: string): Promise<string | null> {
        try {
            const imageResult = await mediaAssetsService.readCoverImage(filePath);
            if (!imageResult.success || !imageResult.data || imageResult.data.length === 0) {
                console.error('❌ LyricsCoverArtService: 文件数据为空');
                return null;
            }

            const uint8Array = new Uint8Array(imageResult.data);
            const mimeType = imageResult.mimeType || 'image/jpeg';
            const blob = new Blob([uint8Array], {type: mimeType});
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('❌ LyricsCoverArtService: 本地文件转换失败', error);
            return null;
        }
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export const lyricsCoverArtService = new LyricsCoverArtService();
