import {audioFileReaderService} from '@/features/media/service';
import {trackMetadataLookupService} from '../TrackMetadataLookupService';
import type {LoadedWebAudioTrack, TrackMetadata, WebAudioTrack} from './WebAudioTypes';

class WebAudioTrackLoader {
    private readonly audioContext: AudioContext;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
    }

    async load(filePath: string): Promise<LoadedWebAudioTrack> {
        let arrayBuffer: ArrayBuffer | null = await this.readAudioData(filePath);
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        const webAudioDuration = audioBuffer.duration;
        arrayBuffer = null;

        const metadata = await this.getTrackMetadata(filePath);
        const duration = (metadata.duration && metadata.duration > 0) ? metadata.duration : webAudioDuration;
        const track: WebAudioTrack = {
            filePath,
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            duration,
            bitrate: metadata.bitrate,
            sampleRate: metadata.sampleRate,
            year: metadata.year,
            genre: metadata.genre,
            track: metadata.track,
            disc: metadata.disc,
            cover: null
        };

        return {
            buffer: audioBuffer,
            duration,
            track
        };
    }

    private async readAudioData(filePath: string): Promise<ArrayBuffer> {
        try {
            return await audioFileReaderService.readAudioFile(filePath);
        } catch {
            const fileUrl = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`;
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio file: ${response.status}`);
            }
            return await response.arrayBuffer();
        }
    }

    private async getTrackMetadata(filePath: string): Promise<TrackMetadata> {
        const metadata = await trackMetadataLookupService.getTrackPlaybackMetadata(filePath);
        if (!metadata) {
            return {};
        }

        return {
            title: metadata.title || '未知标题',
            artist: metadata.artist || '未知艺术家',
            album: metadata.album || '未知专辑',
            duration: metadata.duration || 0,
            bitrate: metadata.bitrate || 0,
            sampleRate: metadata.sampleRate || 0,
            year: metadata.year,
            genre: metadata.genre,
            track: metadata.track,
            disc: metadata.disc,
            cover: null
        };
    }
}

export {WebAudioTrackLoader};
export default WebAudioTrackLoader;
