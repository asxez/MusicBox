import type {Track} from "@api/types/library";
import {appNotificationService} from "@js/features/appShell/service";
import {coverLookupService} from "@js/features/mediaAssets/service/CoverLookupService";
import {coverUpdateManager} from "@js/features/mediaAssets/service/CoverUpdateManager";
import {mediaImageSelectionService} from "@js/features/media/service";
import {libraryDataService} from "./LibraryDataService";

export type EditableTrackMetadata = Omit<Track, 'cover' | 'year'> & {
    cover?: string | {data?: ArrayLike<number> | ArrayBuffer; format?: string; [key: string]: unknown} | null;
    year?: string | number;
};

export interface MetadataUpdatePayload {
    filePath: string;
    title: string;
    artist: string;
    album: string;
    year: string | null;
    genre: string | null;
    cover?: number[];
}

export interface MetadataUpdateResult {
    success: boolean;
    error?: string;
    updatedMetadata?: EditableTrackMetadata;
    coverUpdated?: boolean;
}

export interface SelectedCoverFileResult {
    canceled: boolean;
    file?: File;
    error?: string;
}

export interface SaveTrackMetadataResult {
    track: EditableTrackMetadata;
    updatedData: MetadataUpdatePayload & Partial<EditableTrackMetadata>;
}

export class TrackMetadataEditService {
    async loadCover(track: EditableTrackMetadata): Promise<string | null> {
        const result = await coverLookupService.getCover(track.title, track.artist, track.album, track.filePath);
        return result.success && typeof result.imageUrl === 'string' ? result.imageUrl : null;
    }

    async selectCoverFile(): Promise<SelectedCoverFileResult> {
        try {
            const result = await mediaImageSelectionService.selectImageData(5 * 1024 * 1024);
            if (result.canceled) {
                return {canceled: true};
            }

            if (!result.success || !result.data) {
                return {canceled: false, error: result.error || '选择封面失败'};
            }

            const uint8Array = new Uint8Array(result.data);
            return {
                canceled: false,
                file: new File([uint8Array], result.fileName || 'cover.jpg', {type: result.mimeType || 'image/jpeg'})
            };
        } catch (error) {
            return {canceled: false, error: this.toSelectCoverErrorMessage(error)};
        }
    }

    async saveTrackMetadata(
        track: EditableTrackMetadata,
        payload: MetadataUpdatePayload,
        selectedCoverFile: File | null
    ): Promise<SaveTrackMetadataResult> {
        const updatedData: MetadataUpdatePayload = {...payload};

        if (selectedCoverFile) {
            try {
                const arrayBuffer = await selectedCoverFile.arrayBuffer();
                updatedData.cover = Array.from(new Uint8Array(arrayBuffer));
                console.log('🖼️ TrackMetadataEditService: 封面数据准备完成');
            } catch (error) {
                console.error('❌ TrackMetadataEditService: 封面数据处理失败', error);
                throw new Error('封面图片处理失败，请重新选择封面');
            }
        }

        console.log('📝 TrackMetadataEditService: 开始保存歌曲信息', updatedData.title);
        const result = await libraryDataService.updateTrackMetadata(updatedData) as MetadataUpdateResult;
        if (!result.success) {
            throw new Error(result.error || '保存失败，请检查文件权限或文件格式是否支持');
        }

        if (selectedCoverFile && result.updatedMetadata?.cover) {
            track.cover = await this.resolveUpdatedCover(result.updatedMetadata);
        }

        const safeUpdatedData = {
            ...(result.updatedMetadata || updatedData),
            cover: track.cover
        } as MetadataUpdatePayload & Partial<EditableTrackMetadata>;

        if (result.coverUpdated) {
            await this.refreshUpdatedCover(track, safeUpdatedData);
        }

        return {
            track,
            updatedData: safeUpdatedData
        };
    }

    showError(message: string): void {
        appNotificationService.showError(message);
    }

    private async resolveUpdatedCover(updatedMetadata: EditableTrackMetadata): Promise<string | null> {
        try {
            const coverResult = await coverLookupService.getCover(
                updatedMetadata.title,
                updatedMetadata.artist,
                updatedMetadata.album,
                updatedMetadata.filePath
            );

            return coverResult.success && typeof coverResult.imageUrl === 'string'
                ? coverResult.imageUrl
                : null;
        } catch (error) {
            console.error('获取封面URL失败:', error);
            return null;
        }
    }

    private async refreshUpdatedCover(
        track: EditableTrackMetadata,
        updatedData: MetadataUpdatePayload & Partial<EditableTrackMetadata>
    ): Promise<void> {
        console.log('🖼️ TrackMetadataEditService: 检测到封面更新，触发刷新');
        try {
            await coverUpdateManager.refreshCover(
                track.filePath,
                updatedData.title || track.title,
                updatedData.artist || track.artist,
                updatedData.album || track.album
            );
        } catch (error) {
            console.warn('⚠️ TrackMetadataEditService: 封面刷新失败:', error);
        }
    }

    private toSelectCoverErrorMessage(error: unknown): string {
        const message = error instanceof Error ? error.message : String(error || '');
        if (message.includes('Cannot read properties of undefined')) {
            return '选择封面失败：API接口不可用，请重启应用后重试';
        }
        if (message.includes('dialog')) {
            return '选择封面失败：文件选择对话框打开失败';
        }
        if (message.includes('fs')) {
            return '选择封面失败：文件系统访问失败';
        }
        return `选择封面失败：${message || '未知错误'}`;
    }
}

export const trackMetadataEditService = new TrackMetadataEditService();
