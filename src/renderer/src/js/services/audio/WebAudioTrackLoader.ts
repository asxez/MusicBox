import {libraryController} from '@js/features/library';
import {mediaController} from '@js/features/media';
import {embeddedCoverManager} from '@services/cover/EmbeddedCoverManager';
import type WebAudioObjectUrlStore from './WebAudioObjectUrlStore';
import type {CoverData, LoadedWebAudioTrack, TrackMetadata, WebAudioTrack} from './WebAudioTypes';

class WebAudioTrackLoader {
    private readonly audioContext: AudioContext;
    private readonly coverUrlStore: WebAudioObjectUrlStore;

    constructor(audioContext: AudioContext, coverUrlStore: WebAudioObjectUrlStore) {
        this.audioContext = audioContext;
        this.coverUrlStore = coverUrlStore;
    }

    async load(filePath: string): Promise<LoadedWebAudioTrack> {
        let arrayBuffer: ArrayBuffer | null = await this.readAudioData(filePath);
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        const webAudioDuration = audioBuffer.duration;
        arrayBuffer = null;

        const metadata = await this.getTrackMetadata(filePath);
        const duration = (metadata.duration && metadata.duration > 0) ? metadata.duration : webAudioDuration;
        const coverUrl = this.resolveCoverUrl(metadata.cover);
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
            cover: coverUrl
        };

        return {
            buffer: audioBuffer,
            duration,
            track
        };
    }

    private async readAudioData(filePath: string): Promise<ArrayBuffer> {
        try {
            return await mediaController.readAudioFile(filePath);
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
        const metadata = await libraryController.getTrackMetadata(filePath);
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
            cover: metadata.cover
        };
    }

    private resolveCoverUrl(cover: unknown): string | null {
        const embeddedCover = cover as CoverData | undefined;
        if (!embeddedCover?.data) {
            return null;
        }

        try {
            if (embeddedCoverManager) {
                const coverResult = embeddedCoverManager.convertCoverToUrl(embeddedCover as any);
                if (coverResult.success && typeof coverResult.url === 'string') {
                    return this.coverUrlStore.add(coverResult.url);
                }
                return null;
            }

            const coverBlob = new Blob([embeddedCover.data], {
                type: `image/${(embeddedCover.format || 'jpeg').toLowerCase()}`
            });
            return this.coverUrlStore.add(URL.createObjectURL(coverBlob));
        } catch (error) {
            console.error('封面处理失败:', error);
            return null;
        }
    }
}

export {WebAudioTrackLoader};
export default WebAudioTrackLoader;
