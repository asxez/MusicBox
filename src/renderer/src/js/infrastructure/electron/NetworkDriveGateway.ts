import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Unsubscribe} from '@api/types/common';
import type {
    MountedNetworkDrive,
    NetworkDriveConfig,
    NetworkDriveDirectoryResult,
    NetworkDriveStatus
} from '@api/types/electron';

class NetworkDriveGateway extends ElectronNamespaceAdapter<'networkDrive'> {
    constructor() {
        super('networkDrive');
    }

    testConnection(config: NetworkDriveConfig): Promise<boolean> {
        return this.call('testConnection', config);
    }

    mountSMB(config: NetworkDriveConfig): Promise<boolean> {
        return this.call('mountSMB', config);
    }

    mountWebDAV(config: NetworkDriveConfig): Promise<boolean> {
        return this.call('mountWebDAV', config);
    }

    getMountedDrives(): Promise<MountedNetworkDrive[]> {
        return this.call('getMountedDrives');
    }

    getStatus(driveId: string): Promise<NetworkDriveStatus | null> {
        return this.call('getStatus', driveId);
    }

    getDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult> {
        return this.call('getDirectoryStructure', driveId, path);
    }

    refreshConnection(driveId: string): Promise<boolean> {
        return this.call('refreshConnection', driveId);
    }

    refreshConnections(): Promise<boolean> {
        return this.call('refreshConnections');
    }

    unmount(driveId: string): Promise<boolean> {
        return this.call('unmount', driveId);
    }

    onConnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return this.on('onConnected', (_event: unknown, driveId: string, config: NetworkDriveConfig) => handler(driveId, config));
    }

    onDisconnected(handler: (driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe {
        return this.on('onDisconnected', (_event: unknown, driveId: string, config: NetworkDriveConfig) => handler(driveId, config));
    }

    onError(handler: (driveId: string, error: string) => void): Unsubscribe {
        return this.on('onError', (_event: unknown, driveId: string, error: string) => handler(driveId, error));
    }
}

export const networkDriveGateway = new NetworkDriveGateway();

