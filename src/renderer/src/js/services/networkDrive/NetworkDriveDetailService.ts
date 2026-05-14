import {appShellController} from "@js/features/appShell";
import {libraryController} from "@js/features/library";
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
        return appShellController.getNetworkDriveStatus(driveId);
    }

    getTracksByDrive(driveId: string): Promise<Track[]> {
        return libraryController.getTracksByDrive(driveId) as Promise<Track[]>;
    }

    getDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult> {
        return appShellController.getNetworkDriveDirectoryStructure(driveId, path);
    }

    refreshConnection(driveId: string): Promise<boolean> {
        return appShellController.refreshNetworkDriveConnection(driveId);
    }

    scanNetworkDrive(driveId: string, relativePath = '/'): Promise<boolean> {
        return libraryController.scanNetworkDrive(driveId, relativePath);
    }

    scanSingleFile(networkPath: string): Promise<SingleFileScanResult> {
        return libraryController.scanSingleFile(networkPath) as Promise<SingleFileScanResult>;
    }

    removeTracksByDrive(driveId: string): Promise<Result> {
        return libraryController.removeTracksByDrive(driveId);
    }

    unmount(driveId: string): Promise<boolean> {
        return appShellController.unmountNetworkDrive(driveId);
    }

    onScanProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return libraryController.onScanProgress(handler);
    }
}

export const networkDriveDetailService = new NetworkDriveDetailService();
