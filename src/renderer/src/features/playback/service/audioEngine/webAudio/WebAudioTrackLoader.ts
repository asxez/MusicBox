import {audioFileReaderService} from '@/features/media/service';
import {trackMetadataLookupService} from '../TrackMetadataLookupService';
import type {LoadedWebAudioTrack, TrackMetadata, WebAudioTrack} from './WebAudioTypes';

class WebAudioTrackLoader {
    async load(filePath: string, audioElement: HTMLAudioElement, preload = false): Promise<LoadedWebAudioTrack> {
        const sourceUrl = await audioFileReaderService.createAudioStreamUrl(filePath);
        this.prepareElement(audioElement, sourceUrl, preload);
        await this.waitForMetadata(audioElement);

        const mediaDuration = Number.isFinite(audioElement.duration) && audioElement.duration > 0
            ? audioElement.duration
            : 0;

        const metadata = await this.getTrackMetadata(filePath);
        const duration = (metadata.duration && metadata.duration > 0) ? metadata.duration : mediaDuration;
        const track: WebAudioTrack = {
            filePath,
            sourceUrl,
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
            duration,
            track
        };
    }

    private prepareElement(audioElement: HTMLAudioElement, sourceUrl: string, preload: boolean): void {
        audioElement.pause();
        audioElement.crossOrigin = 'anonymous';
        audioElement.preload = preload ? 'auto' : 'metadata';
        audioElement.src = sourceUrl;
        audioElement.load();
    }

    private async waitForMetadata(audioElement: HTMLAudioElement): Promise<void> {
        if (audioElement.readyState >= 1) {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                audioElement.removeEventListener('loadedmetadata', handleMetadata);
                audioElement.removeEventListener('error', handleError);
                audioElement.removeEventListener('abort', handleAbort);
            };
            const handleMetadata = () => {
                cleanup();
                resolve();
            };
            const handleError = () => {
                cleanup();
                const mediaError = audioElement.error;
                reject(new Error(mediaError?.message || `Media element failed to load source: ${audioElement.src}`));
            };
            const handleAbort = () => {
                cleanup();
                reject(new Error(`Media element load aborted: ${audioElement.src}`));
            };

            audioElement.addEventListener('loadedmetadata', handleMetadata, {once: true});
            audioElement.addEventListener('error', handleError, {once: true});
            audioElement.addEventListener('abort', handleAbort, {once: true});
        });
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
