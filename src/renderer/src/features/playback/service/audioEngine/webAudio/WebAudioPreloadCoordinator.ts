import {
    getTrackFilePath,
    getTrackTitle,
    type TrackSource
} from '../AudioTrack';
import WebAudioTrackLoader from './WebAudioTrackLoader';

type PreloadedTrack = {
    element: HTMLAudioElement;
    trackInfo: TrackSource & {
        filePath: string;
        duration: number;
        sourceUrl?: string;
    };
};

class WebAudioPreloadCoordinator {
    private readonly trackLoader: WebAudioTrackLoader;
    private nextTrack: PreloadedTrack | null;
    private preloadElement: HTMLAudioElement | null;
    private isPreloading: boolean;
    private preloadPromise: Promise<boolean> | null;

    constructor() {
        this.trackLoader = new WebAudioTrackLoader();
        this.nextTrack = null;
        this.preloadElement = null;
        this.isPreloading = false;
        this.preloadPromise = null;
    }

    hasPreloaded(filePath: string): boolean {
        return !!this.nextTrack
            && getTrackFilePath(this.nextTrack.trackInfo) === filePath;
    }

    getPreloaded(): PreloadedTrack | null {
        return this.nextTrack;
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
        this.preloadPromise = this.loadNextTrackElement(filePath, trackInfo);
        try {
            return await this.preloadPromise;
        } finally {
            this.isPreloading = false;
            this.preloadPromise = null;
        }
    }

    clear(): void {
        if (this.preloadElement) {
            try {
                this.preloadElement.pause();
                this.preloadElement.removeAttribute('src');
                this.preloadElement.load();
            } catch (error) {
                console.warn('⚠️ 清理预加载媒体元素失败:', error);
            }
        }

        this.nextTrack = null;
    }

    private async loadNextTrackElement(filePath: string, trackInfo: TrackSource): Promise<boolean> {
        try {
            console.log(`🔄 预加载下一首歌曲: ${getTrackTitle(trackInfo) || filePath}`);
            this.clear();

            const preloadElement = this.getOrCreatePreloadElement();
            const loadedTrack = await this.trackLoader.load(filePath, preloadElement, true);
            this.nextTrack = {
                element: preloadElement,
                trackInfo: {
                    ...(typeof trackInfo === 'string' ? {} : trackInfo),
                    filePath,
                    sourceUrl: loadedTrack.track.sourceUrl,
                    duration: loadedTrack.duration
                }
            };

            console.log(`✅ 下一首歌曲预加载完成: ${getTrackTitle(trackInfo) || filePath}`);
            return true;
        } catch (error) {
            console.error('❌ 预加载下一首歌曲失败:', error);
            this.clear();
            return false;
        }
    }

    private getOrCreatePreloadElement(): HTMLAudioElement {
        if (!this.preloadElement) {
            this.preloadElement = new Audio();
            this.preloadElement.crossOrigin = 'anonymous';
            this.preloadElement.preload = 'auto';
            this.preloadElement.muted = true;
        }

        return this.preloadElement;
    }
}

export {WebAudioPreloadCoordinator};
export default WebAudioPreloadCoordinator;
