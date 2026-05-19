import {fileGateway} from '@js/infrastructure/electron';

export class AudioFileReaderService {
    async readAudioFile(filePath: string): Promise<ArrayBuffer> {
        return await fileGateway.readAudioFile(filePath);
    }
}

export const audioFileReaderService = new AudioFileReaderService();
