import {showToast} from "@utils/index.js";
import {cacheMaintenanceService} from "@services/settings/CacheMaintenanceService";
import {musicFolderSettingsService} from "@services/settings/MusicFolderSettingsService";
import {appInteractionService} from "@js/features/appShell/service";

interface AutoScanToggleResult {
    checked: boolean;
}

class MusicFolderSettingsController {
    async addMusicFolder(): Promise<string[] | null> {
        try {
            const selectedPath = await musicFolderSettingsService.selectMusicFolder();
            if (!selectedPath) {
                return null;
            }

            const addResult = await musicFolderSettingsService.addMusicFolder(selectedPath);
            if (!addResult.success) {
                showToast(addResult.error || '添加文件夹失败', 'error');
                return null;
            }

            showToast('文件夹已添加', 'success');
            await this.confirmAndScan(selectedPath);
            return addResult.folders;
        } catch (error) {
            console.error('❌ Settings: 添加音乐文件夹失败:', error);
            showToast('添加文件夹失败', 'error');
            return null;
        }
    }

    async removeMusicFolder(folderPath: string): Promise<string[] | null> {
        const confirmed = await appInteractionService.confirm({
            title: '移除文件夹',
            message: `确定要移除文件夹吗？\n\n${folderPath}\n\n移除后该文件夹中的音乐将不会被自动扫描。`,
            confirmText: '移除',
            type: 'warning'
        });

        if (!confirmed) {
            return null;
        }

        try {
            const result = await musicFolderSettingsService.removeMusicFolder(folderPath);
            if (!result.success) {
                showToast(result.error || '移除文件夹失败', 'error');
                return null;
            }

            showToast('文件夹已移除', 'success');
            return result.folders;
        } catch (error) {
            console.error('❌ Settings: 移除音乐文件夹失败:', error);
            showToast('移除文件夹失败', 'error');
            return null;
        }
    }

    async toggleAutoScan(enabled: boolean): Promise<AutoScanToggleResult> {
        try {
            const result = await musicFolderSettingsService.updateAutoScanEnabled(enabled);
            if (!result.success) {
                showToast('更新自动扫描设置失败', 'error');
                return {checked: !enabled};
            }

            showToast(enabled ? '自动扫描已启用' : '自动扫描已禁用', 'success');
            return {checked: enabled};
        } catch (error) {
            console.error('❌ Settings: 更新自动扫描设置失败:', error);
            showToast('更新自动扫描设置失败', 'error');
            return {checked: !enabled};
        }
    }

    async updateScanFrequency(frequency: string): Promise<void> {
        try {
            const result = await musicFolderSettingsService.updateScanFrequency(frequency);
            showToast(result.success ? '扫描频率已更新' : '更新扫描频率失败', result.success ? 'success' : 'error');
        } catch (error) {
            console.error('❌ Settings: 更新扫描频率失败:', error);
            showToast('更新扫描频率失败', 'error');
        }
    }

    async clearIgnoreList(): Promise<void> {
        const confirmed = await appInteractionService.confirm({
            title: '清空忽略列表',
            message: '确定要清空忽略列表吗？\n\n清空后,之前手动删除的歌曲在下次自动扫描时会被重新添加到音乐库。',
            confirmText: '清空',
            type: 'warning'
        });

        if (!confirmed) {
            return;
        }

        try {
            const result = await cacheMaintenanceService.clearIgnoreList();
            showToast(result.success ? '忽略列表已清空' : '清空忽略列表失败', result.success ? 'success' : 'error');
        } catch (error) {
            console.error('❌ Settings: 清空忽略列表失败:', error);
            showToast('清空忽略列表失败', 'error');
        }
    }

    private async confirmAndScan(folderPath: string): Promise<void> {
        const shouldScan = await appInteractionService.confirm({
            title: '扫描文件夹',
            message: '是否立即扫描该文件夹？',
            confirmText: '扫描'
        });

        if (!shouldScan) {
            return;
        }

        showToast('正在扫描...', 'info');
        await musicFolderSettingsService.scanDirectory(folderPath);
        showToast('扫描完成', 'success');
    }
}

export const musicFolderSettingsController = new MusicFolderSettingsController();
