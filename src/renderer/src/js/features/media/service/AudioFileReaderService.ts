import {mediaGateway} from '@js/infrastructure/electron/MediaGateway';

export class AudioFileReaderService {
    async readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return await mediaGateway.readAudioFile(filePath);
    }
}

export const audioFileReaderService = new AudioFileReaderService();
