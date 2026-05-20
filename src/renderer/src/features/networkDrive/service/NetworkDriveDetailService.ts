import {networkDriveGateway} from "@/infrastructure/electron";
import {libraryGateway} from "@/infrastructure/electron";
import {libraryDataService} from "@/features/library/service/LibraryDataService";
import type {Result, Unsubscribe} from "@api/types/common";
import type {ScanProgress} from "@api/types/events";
import type {
    NetworkDriveDirectoryResult,
    NetworkDriveStatus
} from "@api/types/electron";
import type {Track} from "@api/types/track";

export interface SingleFileScanResult {
    success: boolean;
    track?: Track;
    error?: string;
    isNew?: boolean;
}

class NetworkDriveDetailService {
    getStatus(driveId: string): Promise<NetworkDriveStatus | null> {
        return networkDriveGateway.getStatus(driveId);
    }

    getTracksByDrive(driveId: string): Promise<Track[]> {
        return libraryDataService.getTracksByDrive(driveId) as Promise<Track[]>;
    }

    getDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult> {
        return networkDriveGateway.getDirectoryStructure(driveId, path);
    }

    refreshConnection(driveId: string): Promise<boolean> {
        return networkDriveGateway.refreshConnection(driveId);
    }

    scanNetworkDrive(driveId: string, relativePath = '/'): Promise<boolean> {
        return libraryDataService.scanNetworkDrive(driveId, relativePath);
    }

    scanSingleFile(networkPath: string): Promise<SingleFileScanResult> {
        return libraryDataService.scanSingleFile(networkPath) as Promise<SingleFileScanResult>;
    }

    removeTracksByDrive(driveId: string): Promise<Result> {
        return libraryDataService.removeTracksByDrive(driveId);
    }

    unmount(driveId: string): Promise<boolean> {
        return networkDriveGateway.unmount(driveId);
    }

    onScanProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return libraryGateway.onScanProgress(handler);
    }
}

export const networkDriveDetailService = new NetworkDriveDetailService();
