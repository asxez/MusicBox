import {appShellController} from "@js/features/appShell";
import {libraryController} from "@js/features/library";
import type {Unsubscribe} from "@api/types/common";
import type {ScanProgress} from "@api/types/events";
import type {MountedNetworkDrive, NetworkDriveConfig} from "@api/types/electron";

class NetworkDriveManagementService {
    testConnection(config: NetworkDriveConfig): Promise<boolean> {
        return appShellController.testNetworkDriveConnection(config);
    }

    mount(config: NetworkDriveConfig): Promise<boolean> {
        return appShellController.mountNetworkDrive(config);
    }

    getMountedDrives(): Promise<MountedNetworkDrive[]> {
        return appShellController.getMountedNetworkDrives();
    }

    scanNetworkDrive(driveId: string, relativePath = '/'): Promise<boolean> {
        return libraryController.scanNetworkDrive(driveId, relativePath);
    }

    unmount(driveId: string): Promise<boolean> {
        return appShellController.unmountNetworkDrive(driveId);
    }

    refreshConnections(): Promise<boolean> {
        return appShellController.refreshNetworkDriveConnections();
    }

    onConnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return appShellController.onNetworkDriveConnected(handler);
    }

    onDisconnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return appShellController.onNetworkDriveDisconnected(handler);
    }

    onError(handler: (driveId: string, error: string) => void): Unsubscribe {
        return appShellController.onNetworkDriveError(handler);
    }

    onScanProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return libraryController.onScanProgress(handler);
    }
}

export const networkDriveManagementService = new NetworkDriveManagementService();
