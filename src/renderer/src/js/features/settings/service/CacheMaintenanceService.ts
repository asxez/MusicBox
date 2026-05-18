import {libraryController} from "@js/features/library";
import type {Result} from "@api/types/common";
import type {CacheValidationResult} from "@api/types/events";

export interface CacheStatisticsView {
    totalTracks: number;
    totalSize: number;
    scannedDirectories?: number;
    cacheAge?: number;
}

class CacheMaintenanceService {
    getStatistics(): Promise<CacheStatisticsView | null> {
        return libraryController.getCacheStatistics() as Promise<CacheStatisticsView | null>;
    }

    validate(): Promise<CacheValidationResult | null> {
        return libraryController.validateCache();
    }

    clear(): Promise<boolean> {
        return libraryController.clearCache();
    }

    clearIgnoreList(): Promise<Result> {
        return libraryController.clearIgnoreList();
    }
}

export const cacheMaintenanceService = new CacheMaintenanceService();
