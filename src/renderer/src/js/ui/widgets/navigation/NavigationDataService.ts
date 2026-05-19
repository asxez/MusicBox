import {appShellController} from "@js/features/appShell";
import {libraryController} from "@js/features/library";
import type {Result, Unsubscribe} from "@api/types/common";
import type {MountedNetworkDrive, NetworkDriveConfig} from "@api/types/electron";
import type {Playlist, Track} from "@api/types/library";

class NavigationDataService {
    onLibraryUpdated(handler: (tracks: Track[]) => void | Promise<void>): Unsubscribe {
        return libraryController.onLibraryUpdated(handler);
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return appShellController.onWindowMaximizedChanged(handler);
    }

    onNetworkDriveConnected(handler: () => void | Promise<void>): Unsubscribe {
        return appShellController.onNetworkDriveConnected(handler as (driveId: string, config: NetworkDriveConfig) => void | Promise<void>);
    }

    onNetworkDriveDisconnected(handler: () => void | Promise<void>): Unsubscribe {
        return appShellController.onNetworkDriveDisconnected(handler as (driveId: string, config: NetworkDriveConfig) => void | Promise<void>);
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
        return appShellController.getMountedNetworkDrives();
    }

    async refreshNetworkDrive(driveId: string): Promise<boolean> {
        return appShellController.refreshNetworkDriveConnection(driveId);
    }
}

export const navigationDataService = new NavigationDataService();
export default NavigationDataService;
