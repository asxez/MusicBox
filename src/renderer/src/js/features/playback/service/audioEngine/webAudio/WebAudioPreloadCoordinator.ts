import {audioFileReaderService} from '@js/features/media/service';
import {
    getTrackFilePath,
    getTrackTitle,
    type TrackSource
} from '../AudioTrack';

type PreloadedTrack = {
    buffer: AudioBuffer;
    trackInfo: TrackSource & {
        filePath: string;
        duration: number;
    };
};

class WebAudioPreloadCoordinator {
    private readonly audioContext: AudioContext;
    private nextAudioBuffer: AudioBuffer | null;
    private nextTrackInfo: PreloadedTrack['trackInfo'] | null;
    private isPreloading: boolean;
    private preloadPromise: Promise<boolean> | null;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
        this.nextAudioBuffer = null;
        this.nextTrackInfo = null;
        this.isPreloading = false;
        this.preloadPromise = null;
    }

    hasPreloaded(filePath: string): boolean {
        return !!this.nextAudioBuffer
            && !!this.nextTrackInfo
            && getTrackFilePath(this.nextTrackInfo) === filePath;
    }

    getPreloaded(): PreloadedTrack | null {
        if (!this.nextAudioBuffer || !this.nextTrackInfo) {
            return null;
        }

        return {
            buffer: this.nextAudioBuffer,
            trackInfo: this.nextTrackInfo
        };
    }

    async preload(filePath: string, trackInfo: TrackSource): Promise<boolean> {
        if (this.hasPreloaded(filePath)) {
            console.log('✅ 下一首歌曲已预加载:', getTrackTitle(trackInfo) || filePath);
            return true;
        }

        if (this.isPreloading && this.preloadPromise) {
            return await this.preloadPromise;
        }

        this.isPreloading = true;
        this.preloadPromise = this.loadNextTrackBuffer(filePath, trackInfo);
        try {
            return await this.preloadPromise;
        } finally {
            this.isPreloading = false;
            this.preloadPromise = null;
        }
    }

    clear(): void {
        if (this.nextAudioBuffer) {
            this.nextAudioBuffer = null;
            this.nextTrackInfo = null;
        }
    }

    private async loadNextTrackBuffer(filePath: string, trackInfo: TrackSource): Promise<boolean> {
        try {
            console.log(`🔄 预加载下一首歌曲: ${getTrackTitle(trackInfo) || filePath}`);

            let arrayBuffer: ArrayBuffer | null = await audioFileReaderService.readAudioFile(filePath);
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            arrayBuffer = null;

            this.nextAudioBuffer = audioBuffer;
            this.nextTrackInfo = {
                ...(typeof trackInfo === 'string' ? {} : trackInfo),
                filePath,
                duration: audioBuffer.duration
            };

            console.log(`✅ 下一首歌曲预加载完成: ${getTrackTitle(trackInfo) || filePath}`);
            return true;
        } catch (error) {
            console.error('❌ 预加载下一首歌曲失败:', error);
            this.clear();
            return false;
        }
    }
}

export {WebAudioPreloadCoordinator};
export default WebAudioPreloadCoordinator;
