import {api} from '@api/api';
import {libraryAPI} from '@api/modules';
import type {Track} from '@api/types/library';

class LibraryController {
    async getTracks(): Promise<Track[]> {
        return await libraryAPI.getTracks();
    }

    async scanDirectory(directoryPath: string): Promise<boolean> {
        return await api.scanDirectory(directoryPath);
    }
}

export const libraryController = new LibraryController();
export {LibraryController};
