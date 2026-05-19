import {networkDriveGateway} from "@js/infrastructure/electron";
import {libraryController} from "@js/features/library";
import type {Unsubscribe} from "@api/types/common";
import type {ScanProgress} from "@api/types/events";
import type {MountedNetworkDrive, NetworkDriveConfig} from "@api/types/electron";

class NetworkDriveManagementService {
    testConnection(config: NetworkDriveConfig): Promise<boolean> {
        return networkDriveGateway.testConnection(config);
    }

    mount(config: NetworkDriveConfig): Promise<boolean> {
        if (config.type === 'smb') {
            return networkDriveGateway.mountSMB(config);
        }

        if (config.type === 'webdav') {
            return networkDriveGateway.mountWebDAV(config);
        }

        return Promise.resolve(false);
    }

    getMountedDrives(): Promise<MountedNetworkDrive[]> {
        return networkDriveGateway.getMountedDrives();
    }

    scanNetworkDrive(driveId: string, relativePath = '/'): Promise<boolean> {
        return libraryController.scanNetworkDrive(driveId, relativePath);
    }

    unmount(driveId: string): Promise<boolean> {
        return networkDriveGateway.unmount(driveId);
    }

    refreshConnections(): Promise<boolean> {
        return networkDriveGateway.refreshConnections();
    }

    refreshConnection(driveId: string): Promise<boolean> {
        return networkDriveGateway.refreshConnection(driveId);
    }

    onConnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onConnected(handler);
    }

    onDisconnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onDisconnected(handler);
    }

    onError(handler: (driveId: string, error: string) => void): Unsubscribe {
        return networkDriveGateway.onError(handler);
    }

    onScanProgress(handler: (progress: ScanProgress) => void): Unsubscribe {
        return libraryController.onScanProgress(handler);
    }
}

export const networkDriveManagementService = new NetworkDriveManagementService();
