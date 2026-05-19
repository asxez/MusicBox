import {libraryDataService} from "@js/features/library/service/LibraryDataService";
import {libraryService} from "@js/features/library/service/LibraryService";
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
        return libraryDataService.getCacheStatistics() as Promise<CacheStatisticsView | null>;
    }

    validate(): Promise<CacheValidationResult | null> {
        return libraryService.validateCache();
    }

    clear(): Promise<boolean> {
        return libraryDataService.clearCache();
    }

    clearIgnoreList(): Promise<Result> {
        return libraryDataService.clearIgnoreList();
    }
}

export const cacheMaintenanceService = new CacheMaintenanceService();
