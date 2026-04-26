import {ElectronNamespaceAdapter} from './ElectronBridge';

export interface LocalCoverFileResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
}

class CoversGateway extends ElectronNamespaceAdapter<'covers'> {
    constructor() {
        super('covers');
    }

    checkLocalCover(
        coverDir: string,
        title: string,
        artist: string,
        album: string,
        isAlbum = false
    ): Promise<LocalCoverFileResult> {
        return this.call('checkLocalCover', coverDir, title, artist, album, isAlbum);
    }

    saveCoverFile(
        coverDir: string,
        fileName: string,
        imageData: unknown,
        dataType: string
    ): Promise<LocalCoverFileResult> {
        return this.call('saveCoverFile', coverDir, fileName, imageData, dataType);
    }
}

export const coversGateway = new CoversGateway();
