import {
    appConfirmationService,
    appNavigationService,
    appNotificationService
} from "@js/features/appShell/service";
import type {ScanProgress} from "@api/types/events";
import type {Track} from "@api/types/track";
import type {MountedNetworkDrive} from "@api/types/electron";
import {networkDriveDetailService} from './NetworkDriveDetailService';

type NetworkDriveActionTarget = MountedNetworkDrive & {
    config: MountedNetworkDrive['config'] & {
        url?: string;
    };
};

export interface NetworkDriveRefreshResult {
    refreshed: boolean;
}

export interface NetworkDriveScanResult {
    scanned: boolean;
    tracks?: Track[];
}

export interface NetworkDriveRemoveResult {
    removed: boolean;
}

export interface NetworkDrivePlayFileResult {
    track?: Track;
    addedTrack?: Track;
}

class NetworkDriveActionService {
    async refreshDrive(drive: NetworkDriveActionTarget): Promise<NetworkDriveRefreshResult> {
        try {
            await networkDriveDetailService.refreshConnection(drive.id);
            appNotificationService.showInfo(`网络磁盘 "${getDriveDisplayName(drive)}" 已刷新`);
            return {refreshed: true};
        } catch (error) {
            console.error('❌ NetworkDriveActionService: 刷新失败', error);
            appNotificationService.showError('刷新失败，请重试');
            return {refreshed: false};
        }
    }

    async scanDrive(
        drive: NetworkDriveActionTarget,
        onProgress: (progress: ScanProgress) => void
    ): Promise<NetworkDriveScanResult> {
        const removeListener = networkDriveDetailService.onScanProgress(onProgress);

        try {
            const result = await networkDriveDetailService.scanNetworkDrive(drive.id, '/');
            if (!result) {
                appNotificationService.showError('扫描失败，请检查网络连接');
                return {scanned: false};
            }

            const tracks = await networkDriveDetailService.getTracksByDrive(drive.id);
            appNotificationService.showInfo(`扫描完成，找到 ${tracks.length} 首歌曲`);
            return {scanned: true, tracks};
        } catch (error) {
            console.error('❌ NetworkDriveActionService: 扫描失败', error);
            appNotificationService.showError('扫描失败，请重试');
            return {scanned: false};
        } finally {
            removeListener();
        }
    }

    async removeDrive(drive: NetworkDriveActionTarget): Promise<NetworkDriveRemoveResult> {
        const displayName = getDriveDisplayName(drive);
        const confirmed = await appConfirmationService.confirm({
            title: '移除网络磁盘',
            message: `确定要移除网络磁盘 "${displayName}" 吗？\n\n这将删除该磁盘下的所有音乐缓存，但不会删除网络磁盘上的文件。`,
            confirmText: '移除',
            type: 'warning'
        });

        if (!confirmed) {
            return {removed: false};
        }

        try {
            const result = await networkDriveDetailService.removeTracksByDrive(drive.id);
            if (result.success) {
                await networkDriveDetailService.unmount(drive.id);
                appNotificationService.showInfo(`网络磁盘 "${displayName}" 已移除`);
                await appNavigationService.navigateToLibrary();
                return {removed: true};
            }

            appNotificationService.showError('移除失败，请重试');
        } catch (error) {
            console.error('❌ NetworkDriveActionService: 移除失败', error);
            appNotificationService.showError('移除失败，请重试');
        }

        return {removed: false};
    }

    async resolveMusicFileForPlayback(
        driveId: string,
        filePath: string,
        tracks: Track[]
    ): Promise<NetworkDrivePlayFileResult> {
        try {
            const networkPath = this.toNetworkPath(driveId, filePath);
            const cachedTrack = tracks.find((track) => track.filePath === networkPath);

            if (cachedTrack) {
                console.log('✅ NetworkDriveActionService: 文件已在缓存中，直接播放');
                return {track: cachedTrack};
            }

            console.log('🎵 NetworkDriveActionService: 文件未在缓存中，开始扫描...');
            appNotificationService.showInfo('正在加载音乐...');

            const result = await networkDriveDetailService.scanSingleFile(networkPath);
            if (result.success && result.track) {
                console.log(`✅ NetworkDriveActionService: 文件扫描成功 - ${result.track.title}`);
                if (result.isNew) {
                    appNotificationService.showSuccess('音乐已添加到音乐库');
                    return {track: result.track, addedTrack: result.track};
                }
                return {track: result.track};
            }

            console.error('❌ NetworkDriveActionService: 文件扫描失败', result.error);
            appNotificationService.showError(result.error || '无法加载此音乐文件');
        } catch (error) {
            console.error('❌ NetworkDriveActionService: 播放音乐文件失败', error);
            appNotificationService.showError('播放失败，请重试');
        }

        return {};
    }

    createContextMenuTrack(driveId: string, filePath: string, fileName?: string, tracks: Track[] = []): Track {
        const networkPath = this.toNetworkPath(driveId, filePath);
        const cachedTrack = tracks.find((track) => track.filePath === networkPath);

        if (cachedTrack) {
            return cachedTrack;
        }

        return {
            filePath: networkPath,
            title: (fileName || filePath.split('/').pop() || '未知歌曲').replace(/\.[^/.]+$/, ''),
            artist: '未知艺术家',
            album: '未知专辑',
            duration: 0,
            isNetworkFile: true,
            needsScan: true
        };
    }

    toNetworkPath(driveId: string, filePath: string): string {
        return `network://${driveId}${filePath}`;
    }
}

function getDriveDisplayName(drive: NetworkDriveActionTarget): string {
    return drive.config?.displayName || drive.displayName || '未命名磁盘';
}

export const networkDriveActionService = new NetworkDriveActionService();

