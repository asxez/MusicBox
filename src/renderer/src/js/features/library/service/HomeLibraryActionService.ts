import type {Track} from "@api/types/library";
import {mediaFileDialogService} from "@js/features/media/service";
import {appFileImportActionService} from "@js/features/appShell/service";
import {libraryService} from "./LibraryService";

export interface HomeLibraryActionResult {
    changed: boolean;
    tracks: Track[];
}

export class HomeLibraryActionService {
    async loadTracks(): Promise<Track[]> {
        return await libraryService.getTracks();
    }

    async scanSelectedFolder(): Promise<HomeLibraryActionResult> {
        const directory = await mediaFileDialogService.openDirectory();
        if (!directory) {
            return {changed: false, tracks: []};
        }

        const success = await libraryService.scanDirectory(directory);
        const tracks = success ? await libraryService.getTracks() : [];
        return {changed: success, tracks};
    }

    async addMusicFiles(): Promise<HomeLibraryActionResult> {
        await appFileImportActionService.addMusicFiles();
        const tracks = await libraryService.getTracks();
        return {changed: true, tracks};
    }
}

export const homeLibraryActionService = new HomeLibraryActionService();
