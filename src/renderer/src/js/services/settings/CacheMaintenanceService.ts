import {libraryAPI} from "@api/modules";
import {libraryController} from "@js/features/library";
import {libraryGateway} from "@js/infrastructure/electron";
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
        return libraryAPI.getCacheStatistics() as Promise<CacheStatisticsView | null>;
    }

    validate(): Promise<CacheValidationResult | null> {
        return libraryController.validateCache();
    }

    clear(): Promise<boolean> {
        return libraryController.clearCache();
    }

    clearIgnoreList(): Promise<Result> {
        return libraryGateway.clearIgnoreList();
    }
}

export const cacheMaintenanceService = new CacheMaintenanceService();
