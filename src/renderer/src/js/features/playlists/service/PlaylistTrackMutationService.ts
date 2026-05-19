import {libraryController} from "@js/features/library";
import {appConfirmationService, appNotificationService} from "@js/features/appShell/service";
import type {Track} from "@api/types/library";

export type PlaylistMutationTrack = Track & {
    fileId?: string;
};

interface PlaylistMutationTarget {
    id: string;
    name: string;
}

export interface PlaylistBatchRemovalResult {
    completed: boolean;
    successCount: number;
    failCount: number;
}

class PlaylistTrackMutationService {
    async clearPlaylist(playlist: PlaylistMutationTarget, tracks: PlaylistMutationTrack[]): Promise<boolean> {
        if (!tracks.length) {
            return false;
        }

        const confirmed = await appConfirmationService.confirm({
            title: '清空歌单',
            message: `确定要清空歌单"${playlist.name}"吗？\n这将移除歌单中的所有 ${tracks.length} 首歌曲，此操作无法撤销。`,
            confirmText: '清空',
            type: 'warning'
        });

        if (!confirmed) {
            return false;
        }

        try {
            const trackIds = tracks.map((track) => track.fileId).filter((fileId): fileId is string => Boolean(fileId));
            const result = await libraryController.removeFromPlaylist(playlist.id, trackIds);

            if (result.success) {
                appNotificationService.showInfo(`歌单"${playlist.name}"已清空`);
                return true;
            }

            appNotificationService.showError(result.error || '清空歌单失败');
        } catch (error) {
            console.error('❌ PlaylistTrackMutationService: 清空歌单失败', error);
            appNotificationService.showError('清空歌单失败，请重试');
        }

        return false;
    }

    async removeSelectedTracks(
        playlistId: string,
        tracks: PlaylistMutationTrack[]
    ): Promise<PlaylistBatchRemovalResult> {
        if (!tracks.length) {
            return {completed: false, successCount: 0, failCount: 0};
        }

        const confirmed = await appConfirmationService.confirm({
            title: '移除歌曲',
            message: `确定要从歌单中移除选中的 ${tracks.length} 首歌曲吗？`,
            confirmText: '移除',
            type: 'warning'
        });

        if (!confirmed) {
            return {completed: false, successCount: 0, failCount: 0};
        }

        let successCount = 0;
        let failCount = 0;

        for (const track of tracks) {
            try {
                const result = await libraryController.removeFromPlaylist(
                    playlistId,
                    track.fileId ? [track.fileId] : []
                );

                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.warn('❌ 移除歌曲失败:', track.title, result.error);
                }
            } catch (error) {
                failCount++;
                console.error('❌ 移除歌曲异常:', track.title, error);
            }
        }

        if (failCount === 0) {
            appNotificationService.showInfo(`成功移除 ${successCount} 首歌曲`);
        } else {
            appNotificationService.showInfo(`移除完成：成功 ${successCount} 首，失败 ${failCount} 首`);
        }

        return {completed: true, successCount, failCount};
    }

    async removeTrack(playlistId: string, track: PlaylistMutationTrack): Promise<boolean> {
        const confirmed = await appConfirmationService.confirm({
            title: '移除歌曲',
            message: `确定要从歌单中移除 "${track.title}" 吗？`,
            confirmText: '移除',
            type: 'warning'
        });

        if (!confirmed) {
            return false;
        }

        try {
            const result = await libraryController.removeFromPlaylist(
                playlistId,
                track.fileId ? [track.fileId] : []
            );

            if (result.success) {
                appNotificationService.showInfo(`已从歌单中移除 "${track.title}"`);
                return true;
            }

            appNotificationService.showError(result.error || '移除失败');
        } catch (error) {
            console.error('❌ PlaylistTrackMutationService: 移除歌曲失败', error);
            appNotificationService.showError('移除失败，请重试');
        }

        return false;
    }
}

export const playlistTrackMutationService = new PlaylistTrackMutationService();

