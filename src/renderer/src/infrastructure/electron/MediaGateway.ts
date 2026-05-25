import {ElectronNamespaceAdapter} from './ElectronBridge';

export interface SelectedImageDataResult {
    success: boolean;
    canceled?: boolean;
    fileName?: string;
    filePath?: string;
    data?: number[];
    mimeType?: string;
    error?: string;
}

class MediaGateway extends ElectronNamespaceAdapter<'media'> {
    constructor() {
        super('media');
    }

    readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return this.call('readAudioFile', filePath);
    }

    createAudioStreamUrl(filePath: string): Promise<string> {
        return this.call('createAudioStreamUrl', filePath);
    }

    selectImageData(maxSizeBytes: number): Promise<SelectedImageDataResult> {
        return this.call('selectImageData', maxSizeBytes);
    }
}

export const mediaGateway = new MediaGateway();
