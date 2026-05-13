import {cacheMaintenanceService} from "@services/settings/CacheMaintenanceService";

interface CacheStatisticsDisplay {
    success: boolean;
    description?: string;
    toastMessage?: string;
    error?: string;
}

interface CacheActionDisplay {
    success: boolean;
    message: string;
    description?: string;
}

class CacheSettingsService {
    async getStatisticsDisplay(): Promise<CacheStatisticsDisplay> {
        const stats = await cacheMaintenanceService.getStatistics();
        if (!stats) {
            return {
                success: false,
                error: '获取缓存统计失败'
            };
        }

        const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
        const cacheAgeDays = Math.floor((stats.cacheAge || 0) / (1000 * 60 * 60 * 24));

        return {
            success: true,
            description: `缓存了 ${stats.totalTracks} 个音乐文件，总大小 ${totalSizeMB} MB，已扫描 ${stats.scannedDirectories || 0} 个目录，缓存时间 ${cacheAgeDays} 天`,
            toastMessage: `缓存统计: ${stats.totalTracks} 个文件，${totalSizeMB} MB`
        };
    }

    async validateCache(): Promise<CacheActionDisplay> {
        const result = await cacheMaintenanceService.validate();
        if (!result) {
            return {
                success: false,
                message: '缓存验证失败'
            };
        }

        return {
            success: true,
            message: `缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`
        };
    }

    async clearCache(): Promise<CacheActionDisplay> {
        const success = await cacheMaintenanceService.clear();
        return {
            success,
            message: success ? '缓存已清空' : '清空缓存失败',
            description: success ? '缓存已清空' : undefined
        };
    }
}

export const cacheSettingsService = new CacheSettingsService();
