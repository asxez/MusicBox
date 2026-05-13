import {libraryAPI, windowAPI} from "@api/modules";
import {libraryGateway, networkDriveGateway} from "@js/infrastructure/electron";
import type {Result, Unsubscribe} from "@api/types/common";
import type {MountedNetworkDrive} from "@api/types/electron";
import type {Playlist, Track} from "@api/types/library";

class NavigationDataService {
    onLibraryUpdated(handler: (tracks: Track[]) => void | Promise<void>): Unsubscribe {
        return libraryGateway.onLibraryUpdated(handler);
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return windowAPI.onMaximizedChanged(handler);
    }

    onNetworkDriveConnected(handler: () => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onConnected(handler);
    }

    onNetworkDriveDisconnected(handler: () => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onDisconnected(handler);
    }

    async minimizeWindow(): Promise<void> {
        await windowAPI.minimize();
    }

    async toggleMaximizeWindow(): Promise<void> {
        await windowAPI.maximize();
    }

    async closeWindow(): Promise<void> {
        await windowAPI.close();
    }

    async isWindowMaximized(): Promise<boolean> {
        return windowAPI.isMaximized();
    }

    async getPlaylists(): Promise<Playlist[]> {
        return libraryAPI.getPlaylists();
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        return libraryAPI.deletePlaylist(playlistId);
    }

    async getMountedNetworkDrives(): Promise<MountedNetworkDrive[]> {
        return networkDriveGateway.getMountedDrives();
    }

    async refreshNetworkDrive(driveId: string): Promise<boolean> {
        return networkDriveGateway.refreshConnection(driveId);
    }
}

export const navigationDataService = new NavigationDataService();
