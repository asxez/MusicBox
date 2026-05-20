import {mediaGateway, type SelectedImageDataResult} from '@js/infrastructure/electron/MediaGateway';

export type {SelectedImageDataResult};

export class MediaImageSelectionService {
    selectImageData(maxSizeBytes: number): Promise<SelectedImageDataResult> {
        return mediaGateway.selectImageData(maxSizeBytes);
    }
}

export const mediaImageSelectionService = new MediaImageSelectionService();
