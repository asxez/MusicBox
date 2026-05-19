import {windowShellService} from "@js/features/appShell/service";
import {libraryController} from "@js/features/library";
import {networkDriveManagementService} from "@js/features/networkDrive/service";
import type {Result, Unsubscribe} from "@api/types/common";
import type {MountedNetworkDrive} from "@api/types/electron";
import type {Playlist, Track} from "@api/types/library";

class NavigationDataService {
    onLibraryUpdated(handler: (tracks: Track[]) => void | Promise<void>): Unsubscribe {
        return libraryController.onLibraryUpdated(handler);
    }

    onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): Unsubscribe {
        return windowShellService.onMaximizedChanged(handler);
    }

    onNetworkDriveConnected(handler: () => void | Promise<void>): Unsubscribe {
        return networkDriveManagementService.onConnected(handler);
    }

    onNetworkDriveDisconnected(handler: () => void | Promise<void>): Unsubscribe {
        return networkDriveManagementService.onDisconnected(handler);
    }

    async minimizeWindow(): Promise<void> {
        await windowShellService.minimize();
    }

    async toggleMaximizeWindow(): Promise<void> {
        await windowShellService.maximize();
    }

    async closeWindow(): Promise<void> {
        await windowShellService.close();
    }

    async isWindowMaximized(): Promise<boolean> {
        return windowShellService.isMaximized();
    }

    async getPlaylists(): Promise<Playlist[]> {
        return libraryController.getPlaylists();
    }

    async deletePlaylist(playlistId: string): Promise<Result> {
        return libraryController.deletePlaylist(playlistId);
    }

    async getMountedNetworkDrives(): Promise<MountedNetworkDrive[]> {
        return networkDriveManagementService.getMountedDrives();
    }

    async refreshNetworkDrive(driveId: string): Promise<boolean> {
        return networkDriveManagementService.refreshConnection(driveId);
    }
}

export const navigationDataService = new NavigationDataService();
export default NavigationDataService;
