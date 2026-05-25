import WebAudioProgressTicker from './WebAudioProgressTicker';

type PlaybackStateChangedCallback = ((isPlaying: boolean) => void | Promise<void>) | null;
type PositionChangedCallback = ((position: number) => void | Promise<void>) | null;

type WebAudioTransportOptions = {
    getAudioContext: () => AudioContext | null;
    getMediaElement: () => HTMLAudioElement | null;
    getDuration: () => number;
    connectSourceToChain: (sourceNode: AudioNode | null) => void;
    onTrackEnded: () => void | Promise<void>;
    getPlaybackStateChangedCallback: () => PlaybackStateChangedCallback;
    getPositionChangedCallback: () => PositionChangedCallback;
};

class WebAudioTransportController {
    private readonly options: WebAudioTransportOptions;
    private sourceNode: MediaElementAudioSourceNode | null;
    private playing: boolean;
    private paused: boolean;
    private pauseTime: number;
    private readonly progressTicker: WebAudioProgressTicker;

    constructor(options: WebAudioTransportOptions) {
        this.options = options;
        this.sourceNode = null;
        this.playing = false;
        this.paused = false;
        this.pauseTime = 0;
        this.progressTicker = new WebAudioProgressTicker();
    }

    initialize(): void {
        const audioContext = this.options.getAudioContext();
        const mediaElement = this.options.getMediaElement();

        if (!audioContext || !mediaElement) {
            throw new Error('Web Audio transport requires an AudioContext and media element');
        }

        if (!this.sourceNode) {
            this.sourceNode = audioContext.createMediaElementSource(mediaElement);
            this.options.connectSourceToChain(this.sourceNode);
        }

        mediaElement.onended = () => this.handleSourceEnded();
    }

    isPlaying(): boolean {
        return this.playing;
    }

    isPaused(): boolean {
        return this.paused;
    }

    hasSourceNode(): boolean {
        return !!this.sourceNode;
    }

    getSourceNode(): MediaElementAudioSourceNode | null {
        return this.sourceNode;
    }

    async play(): Promise<boolean> {
        try {
            const audioContext = this.options.getAudioContext();
            const mediaElement = this.options.getMediaElement();

            if (!audioContext || !mediaElement || !mediaElement.src) {
                return false;
            }

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (this.playing && !this.paused && !mediaElement.paused) {
                return true;
            }

            await mediaElement.play();
            this.playing = true;
            this.paused = false;
            this.pauseTime = mediaElement.currentTime || 0;
            this.startProgressUpdates();
            await this.notifyPlaybackStateChanged(true);

            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    async pause(): Promise<boolean> {
        try {
            const mediaElement = this.options.getMediaElement();
            if (!mediaElement || !mediaElement.src) {
                return false;
            }

            if (!this.playing && mediaElement.paused) {
                console.log('⚠️ 音频未在播放，无法暂停');
                return false;
            }

            mediaElement.pause();
            this.pauseTime = this.clampPosition(mediaElement.currentTime || 0, this.getMaxPosition());
            this.playing = false;
            this.paused = true;
            this.stopProgressUpdates();

            console.log(`⏸️ 暂停播放，位置: ${this.pauseTime.toFixed(2)}s`);
            await this.notifyPlaybackStateChanged(false);

            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    stop(): boolean {
        try {
            const mediaElement = this.options.getMediaElement();
            if (mediaElement) {
                mediaElement.pause();
                this.setMediaElementPosition(mediaElement, 0);
            }

            this.playing = false;
            this.paused = false;
            this.pauseTime = 0;
            this.stopProgressUpdates();
            void this.notifyPlaybackStateChanged(false);
            void this.notifyPositionChanged(0);
            console.log('⏹️ 停止播放');
            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    clearMediaSource(): boolean {
        const mediaElement = this.options.getMediaElement();
        if (!mediaElement || !mediaElement.src) {
            return false;
        }

        try {
            mediaElement.pause();
            mediaElement.removeAttribute('src');
            mediaElement.load();
            this.playing = false;
            this.paused = false;
            this.pauseTime = 0;
            this.stopProgressUpdates();
            return true;
        } catch (error) {
            console.warn('⚠️ 清理媒体元素源失败:', error);
            return false;
        }
    }

    async seek(position: number): Promise<boolean> {
        try {
            const mediaElement = this.options.getMediaElement();
            if (!mediaElement || !mediaElement.src) {
                return false;
            }

            const wasPlaying = this.playing && !mediaElement.paused;
            const boundedPosition = this.clampPosition(position, this.getMaxPosition());
            this.setMediaElementPosition(mediaElement, boundedPosition);
            this.pauseTime = boundedPosition;
            this.paused = !wasPlaying;
            this.playing = wasPlaying;
            console.log(`⏭️ 跳转到: ${boundedPosition.toFixed(2)}s`);

            if (wasPlaying && mediaElement.paused) {
                await this.play();
            }

            await this.notifyPositionChanged(boundedPosition);
            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    async getPosition(): Promise<number> {
        const mediaElement = this.options.getMediaElement();
        if (!mediaElement || !mediaElement.src) {
            return 0;
        }

        return mediaElement.currentTime || 0;
    }

    destroy(): void {
        this.clearMediaSource();
        this.releaseSourceNode();
        this.stopProgressUpdates();
    }

    private releaseSourceNode(): void {
        if (!this.sourceNode) {
            return;
        }

        try {
            this.sourceNode.disconnect();
        } catch {
            // MediaElementAudioSourceNode may already be disconnected.
        }

        this.sourceNode = null;
    }

    private handleSourceEnded(): void {
        if (!this.playing) {
            return;
        }

        this.playing = false;
        this.paused = false;
        this.pauseTime = 0;
        this.stopProgressUpdates();
        void this.notifyPlaybackStateChanged(false);
        void this.options.onTrackEnded();
    }

    private startProgressUpdates(): void {
        this.progressTicker.start({
            isPlaying: () => this.playing,
            getPosition: () => this.getPosition(),
            getPositionChangedCallback: () => this.options.getPositionChangedCallback()
        });
    }

    private stopProgressUpdates(): void {
        this.progressTicker.stop();
    }

    private async notifyPlaybackStateChanged(isPlaying: boolean): Promise<void> {
        const onPlaybackStateChanged = this.options.getPlaybackStateChangedCallback();
        if (onPlaybackStateChanged) {
            await onPlaybackStateChanged(isPlaying);
        }
    }

    private async notifyPositionChanged(position: number): Promise<void> {
        const onPositionChanged = this.options.getPositionChangedCallback();
        if (onPositionChanged) {
            await onPositionChanged(position);
        }
    }

    private getMaxPosition(): number {
        const duration = this.options.getDuration();
        if (!Number.isFinite(duration) || duration <= 0) {
            return 0;
        }

        return Math.max(0, duration - 0.05);
    }

    private setMediaElementPosition(mediaElement: HTMLAudioElement, position: number): void {
        if (!Number.isFinite(position)) {
            return;
        }

        try {
            mediaElement.currentTime = position;
        } catch (error) {
            console.warn('⚠️ 设置媒体播放位置失败:', error);
        }
    }

    private clampPosition(position: number, maxPosition: number): number {
        return Math.max(0, Math.min(position, Math.max(0, maxPosition)));
    }
}

export {WebAudioTransportController};
export default WebAudioTransportController;
