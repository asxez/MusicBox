import {mediaFileDialogService} from "@js/features/media/service";
import {appConfirmationService, appNotificationService} from "@js/features/appShell/service";
import {libraryDataService} from "@js/features/library/service/LibraryDataService";

export interface PlaylistCoverActionResult {
    changed: boolean;
    coverImage?: string | null;
}

class PlaylistCoverActionService {
    async selectAndSetCover(playlistId: string): Promise<PlaylistCoverActionResult> {
        try {
            const imagePath = await this.selectCoverImage();
            if (!imagePath) {
                return {changed: false};
            }

            return await this.setCover(playlistId, imagePath);
        } catch (error) {
            console.error('❌ PlaylistCoverActionService: 选择图片失败', error);
            appNotificationService.showError('选择图片失败，请重试');
            return {changed: false};
        }
    }

    async selectCoverImage(): Promise<string | null> {
        const result = await mediaFileDialogService.selectImageFile();
        if (result.success && result.path) {
            console.log('✅ 选择的图片路径:', result.path);
            return result.path;
        }
        return null;
    }

    async setCover(playlistId: string, imagePath: string): Promise<PlaylistCoverActionResult> {
        try {
            if (!this.isValidImageFile(imagePath)) {
                throw new Error('不支持的图片格式，请选择 JPG、PNG、GIF、WebP 或 BMP 格式的图片');
            }

            console.log(`🖼️ 设置歌单封面: ${playlistId} -> ${imagePath}`);
            const result = await libraryDataService.updatePlaylistCover(playlistId, imagePath);

            if (result.success) {
                appNotificationService.showInfo('歌单封面设置成功');
                return {changed: true, coverImage: imagePath};
            }

            throw new Error(result.error || '设置封面失败');
        } catch (error) {
            appNotificationService.showError(getErrorMessage(error) || '设置封面失败，请重试');
            return {changed: false};
        }
    }

    async removeCover(playlistId: string): Promise<PlaylistCoverActionResult> {
        try {
            const confirmed = await appConfirmationService.confirm({
                title: '移除歌单封面',
                message: '确定要移除歌单封面吗？',
                confirmText: '移除',
                type: 'warning'
            });

            if (!confirmed) {
                return {changed: false};
            }

            console.log(`🗑️ 移除歌单封面: ${playlistId}`);
            const result = await libraryDataService.removePlaylistCover(playlistId);

            if (result.success) {
                appNotificationService.showInfo('歌单封面已移除');
                return {changed: true, coverImage: null};
            }

            throw new Error(result.error || '移除封面失败');
        } catch (error) {
            appNotificationService.showError(getErrorMessage(error) || '移除封面失败，请重试');
            return {changed: false};
        }
    }

    isValidImageFile(filePath: unknown): filePath is string {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        return validExtensions.includes(extension);
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export const playlistCoverActionService = new PlaylistCoverActionService();
