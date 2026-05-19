import {settingsShellService} from "@js/features/appShell/service";
import {localCoverManager} from "@js/features/mediaAssets/service/LocalCoverManager";
import {localLyricsManager} from "@js/features/mediaAssets/service/LocalLyricsManager";

interface PathResult {
    success?: boolean;
    path?: string;
    error?: string;
}

interface DirectoryResult {
    directory: string | null;
    shouldPersist: boolean;
    error?: string;
}

class MediaDirectorySettingsService {
    async selectDirectory(): Promise<string | null> {
        const result = await settingsShellService.selectFolder();
        if (!result || !result.filePaths || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    }

    applyLyricsDirectory(directory: string): void {
        localLyricsManager.setLyricsDirectory(directory);
    }

    applyCoverDirectory(directory: string): void {
        localCoverManager.setCoverDirectory(directory);
    }

    async resolveCoverCacheDirectory(savedDirectory: string | null): Promise<DirectoryResult> {
        if (savedDirectory) {
            return {directory: savedDirectory, shouldPersist: false};
        }

        const defaultPathResult = await settingsShellService.getDefaultCoverCachePath() as PathResult;
        if (!defaultPathResult.success || !defaultPathResult.path) {
            return {
                directory: null,
                shouldPersist: false,
                error: defaultPathResult.error || '获取默认封面缓存路径失败'
            };
        }

        const ensureResult = await settingsShellService.ensureDirectoryExists(defaultPathResult.path) as PathResult;
        if (!ensureResult.success) {
            return {
                directory: null,
                shouldPersist: false,
                error: ensureResult.error || '创建默认封面缓存目录失败'
            };
        }

        return {
            directory: defaultPathResult.path,
            shouldPersist: true
        };
    }
}

export const mediaDirectorySettingsService = new MediaDirectorySettingsService();
