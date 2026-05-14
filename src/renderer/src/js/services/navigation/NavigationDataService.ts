import {appShellController} from "@js/features/appShell";
import {libraryController} from "@js/features/library";
import {libraryGateway, networkDriveGateway} from "@js/infrastructure/electron";
import type {Result, Unsubscribe} from "@api/types/common";
import type {MountedNetworkDrive} from "@api/types/electron";
import type {Playlist, Track} from "@api/types/library";

class NavigationDataService {
    onLibraryUpdated(handler: (tracks: Track[]) => void | Promise<void>): Unsubscribe {
        return libraryGateway.onLibraryUpdated(handler);
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return appShellController.onWindowMaximizedChanged(handler);
    }

    onNetworkDriveConnected(handler: () => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onConnected(handler);
    }

    onNetworkDriveDisconnected(handler: () => void | Promise<void>): Unsubscribe {
        return networkDriveGateway.onDisconnected(handler);
    }

    async minimizeWindow(): Promise<void> {
        await appShellController.minimizeWindow();
    }

    async toggleMaximizeWindow(): Promise<void> {
        await appShellController.toggleMaximizeWindow();
    }

    async closeWindow(): Promise<void> {
        await appShellController.closeWindow();
    }

    async isWindowMaximized(): Promise<boolean> {
        return appShellController.isWindowMaximized();
    }

    async getPlaylists(): Promise<Playlist[]> {
        return libraryController.getPlaylists();
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        return libraryController.deletePlaylist(playlistId);
    }

    async getMountedNetworkDrives(): Promise<MountedNetworkDrive[]> {
        return networkDriveGateway.getMountedDrives();
    }

    async refreshNetworkDrive(driveId: string): Promise<boolean> {
        return networkDriveGateway.refreshConnection(driveId);
    }
}

export const navigationDataService = new NavigationDataService();
