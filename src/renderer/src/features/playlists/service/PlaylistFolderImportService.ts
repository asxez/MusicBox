import {mediaFileDialogService} from "@/features/media/service";
import {appNotificationService} from "@/features/appShell/service";
import {libraryDataService} from "@/features/library/service/LibraryDataService";
import type {Track} from "@api/types/library";

type AudioFileCandidate = Partial<Track> & {
    fileName?: string;
    filePath?: string;
};

export interface PlaylistFolderImportResult {
    changed: boolean;
}

export interface PlaylistAddTracksResult {
    success: boolean;
    error?: string;
    successCount?: number;
    failCount?: number;
    errors?: string[];
    totalCount?: number;
}

class PlaylistFolderImportService {
    async addFromFolder(playlistId: string): Promise<PlaylistFolderImportResult> {
        try {
            appNotificationService.showInfo('正在选择文件夹...');

            const folderPath = await mediaFileDialogService.openDirectory();
            if (!folderPath) {
                return {changed: false};
            }

            appNotificationService.showInfo('正在扫描文件夹中的音频文件...');

            const audioFiles = await this.scanFolderForAudioFiles(folderPath);
            if (audioFiles.length === 0) {
                appNotificationService.showInfo('在选择的文件夹中未找到音频文件');
                return {changed: false};
            }

            appNotificationService.showInfo(`正在添加 ${audioFiles.length} 首歌曲到歌单...`);

            const result = await this.addTracksToPlaylist(playlistId, audioFiles);
            if (!result.success) {
                appNotificationService.showError(result.error || '添加歌曲到歌单失败');
                return {changed: false};
            }

            const successCount = result.successCount || 0;
            const failCount = result.failCount || 0;
            let message = `成功添加 ${successCount} 首歌曲到歌单`;
            if (failCount > 0) {
                message += `，${failCount} 首歌曲添加失败`;
            }
            appNotificationService.showSuccess(message);
            return {changed: true};
        } catch (error) {
            console.error('❌ PlaylistFolderImportService: 从文件夹添加音乐失败', error);
            appNotificationService.showError('从文件夹添加音乐失败，请重试');
            return {changed: false};
        }
    }

    async scanFolderForAudioFiles(folderPath: string): Promise<AudioFileCandidate[]> {
        try {
            const result = await libraryDataService.scanDirectoryForFiles(folderPath);
            if (result?.success && Array.isArray(result.files)) {
                return result.files as AudioFileCandidate[];
            }

            console.warn('📁 扫描文件夹失败或未找到音频文件');
            return [];
        } catch (error) {
            console.error('❌ 扫描文件夹失败:', error);
            return [];
        }
    }

    async addTracksToPlaylist(playlistId: string, audioFiles: AudioFileCandidate[]): Promise<PlaylistAddTracksResult> {
        try {
            if (!playlistId || !audioFiles.length) {
                return {success: false, error: '无效的参数'};
            }

            let successCount = 0;
            let failCount = 0;
            const errors: string[] = [];

            for (const audioFile of audioFiles) {
                try {
                    const addToLibraryResult = await libraryDataService.addTrackToLibrary(audioFile);
                    if (addToLibraryResult?.success && addToLibraryResult.track) {
                        const addToPlaylistResult = await libraryDataService.addToPlaylist(
                            playlistId,
                            addToLibraryResult.track.fileId ? [addToLibraryResult.track.fileId] : []
                        );

                        if (addToPlaylistResult?.success) {
                            successCount++;
                        } else {
                            failCount++;
                            const error = `添加到歌单失败: ${audioFile.fileName || audioFile.filePath}`;
                            errors.push(error);
                            console.warn(`⚠️ ${error}`);
                        }
                    } else {
                        failCount++;
                        const error = `添加到音乐库失败: ${audioFile.fileName || audioFile.filePath}`;
                        errors.push(error);
                        console.warn(`⚠️ ${error}`);
                    }
                } catch (error) {
                    failCount++;
                    const errorMsg = `处理文件失败: ${audioFile.fileName || audioFile.filePath} - ${getErrorMessage(error)}`;
                    errors.push(errorMsg);
                    console.error(`❌ ${errorMsg}`);
                }
            }

            return {
                success: successCount > 0,
                successCount,
                failCount,
                errors,
                totalCount: audioFiles.length
            };
        } catch (error) {
            console.error('❌ 批量添加音频文件到歌单失败:', error);
            return {
                success: false,
                error: getErrorMessage(error) || '批量添加失败',
                successCount: 0,
                failCount: audioFiles.length
            };
        }
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export const playlistFolderImportService = new PlaylistFolderImportService();
