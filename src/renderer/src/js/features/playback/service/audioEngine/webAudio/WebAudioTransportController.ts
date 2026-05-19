import WebAudioProgressTicker from './WebAudioProgressTicker';

type PlaybackStateChangedCallback = ((isPlaying: boolean) => void | Promise<void>) | null;
type PositionChangedCallback = ((position: number) => void | Promise<void>) | null;

type WebAudioTransportOptions = {
    getAudioContext: () => AudioContext | null;
    getAudioBuffer: () => AudioBuffer | null;
    getDuration: () => number;
    connectSourceToChain: (sourceNode: AudioBufferSourceNode) => void;
    onTrackEnded: () => void | Promise<void>;
    getPlaybackStateChangedCallback: () => PlaybackStateChangedCallback;
    getPositionChangedCallback: () => PositionChangedCallback;
};

class WebAudioTransportController {
    private readonly options: WebAudioTransportOptions;
    private sourceNode: AudioBufferSourceNode | null;
    private playing: boolean;
    private paused: boolean;
    private startTime: number;
    private pauseTime: number;
    private readonly progressTicker: WebAudioProgressTicker;

    constructor(options: WebAudioTransportOptions) {
        this.options = options;
        this.sourceNode = null;
        this.playing = false;
        this.paused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.progressTicker = new WebAudioProgressTicker();
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

    getSourceNode(): AudioBufferSourceNode | null {
        return this.sourceNode;
    }

    async play(): Promise<boolean> {
        try {
            const audioContext = this.options.getAudioContext();
            const audioBuffer = this.options.getAudioBuffer();
            const duration = this.options.getDuration();

            if (!audioContext || !audioBuffer) {
                return false;
            }

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (this.playing && !this.paused) {
                return true;
            }

            this.releaseSourceNode();

            this.sourceNode = this.createSourceNode(audioContext, audioBuffer);
            this.options.connectSourceToChain(this.sourceNode);
            this.sourceNode.onended = () => this.handleSourceEnded();

            const offset = this.paused ? this.pauseTime : 0;
            const validOffset = this.clampPosition(offset, duration - 0.1);
            console.log(`▶️ 开始播放，原始偏移量: ${offset.toFixed(2)}s, 有效偏移量: ${validOffset.toFixed(2)}s, 音频时长: ${duration.toFixed(2)}s`);

            try {
                this.sourceNode.start(0, validOffset);
                this.startTime = audioContext.currentTime - validOffset;

                if (validOffset !== offset) {
                    this.pauseTime = validOffset;
                }
            } catch (startError) {
                console.error('❌ 音频源启动失败:', startError);
                this.sourceNode = this.createSourceNode(audioContext, audioBuffer);
                this.options.connectSourceToChain(this.sourceNode);
                this.sourceNode.onended = () => this.handleSourceEnded();
                this.sourceNode.start(0, 0);
                this.startTime = audioContext.currentTime;
                this.pauseTime = 0;
                this.paused = false;
            }

            this.playing = true;
            this.paused = false;
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
            const audioContext = this.options.getAudioContext();
            const duration = this.options.getDuration();

            if (!audioContext) {
                return false;
            }

            if (!this.playing && !this.sourceNode) {
                console.log('⚠️ 音频未在播放且无音频源，无法暂停');
                return false;
            }

            if (!this.playing) {
                console.log('⚠️ 状态显示未播放，但仍尝试暂停');
            }

            const currentPosition = audioContext.currentTime - this.startTime;
            this.pauseTime = this.clampPosition(currentPosition, duration - 0.1);
            console.log(`🔄 暂停位置计算: currentTime=${audioContext.currentTime.toFixed(2)}, startTime=${this.startTime.toFixed(2)}, 计算位置=${currentPosition.toFixed(2)}, 最终位置=${this.pauseTime.toFixed(2)}`);

            if (this.pauseTime < 0 || this.pauseTime >= duration) {
                const fallbackPosition = await this.getPosition();
                console.log(`⚠️ 暂停位置异常，使用备用位置: ${fallbackPosition.toFixed(2)}s`);
                this.pauseTime = this.clampPosition(fallbackPosition, duration - 0.1);
            }

            this.releaseSourceNode();
            this.playing = false;
            this.paused = true;
            this.stopProgressUpdates();

            console.log(`⏸️ 暂停播放，位置: ${this.pauseTime.toFixed(2)}s`);
            const onPlaybackStateChanged = this.options.getPlaybackStateChangedCallback();
            if (onPlaybackStateChanged) {
                console.log('🔄 Web Audio Engine: 触发暂停状态变化事件');
                await onPlaybackStateChanged(false);
            } else {
                console.warn('⚠️ Web Audio Engine: onPlaybackStateChanged 回调未设置');
            }

            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    stop(): boolean {
        try {
            this.releaseSourceNode();
            this.playing = false;
            this.paused = false;
            this.startTime = 0;
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

    async seek(position: number): Promise<boolean> {
        try {
            if (!this.options.getAudioBuffer()) {
                return false;
            }

            const wasPlaying = this.playing;
            this.releaseSourceNode();
            this.stopProgressUpdates();

            this.pauseTime = this.clampPosition(position, this.options.getDuration());
            this.paused = true;
            this.playing = false;
            console.log(`⏭️ 跳转到: ${position.toFixed(2)}s`);

            if (wasPlaying) {
                await this.play();
            }

            await this.notifyPositionChanged(this.pauseTime);
            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    async getPosition(): Promise<number> {
        if (!this.playing && !this.paused) {
            return 0;
        }

        if (this.paused) {
            return this.pauseTime;
        }

        const audioContext = this.options.getAudioContext();
        if (!audioContext) {
            return 0;
        }

        return audioContext.currentTime - this.startTime;
    }

    destroy(): void {
        this.releaseSourceNode();
        this.stopProgressUpdates();
    }

    private createSourceNode(audioContext: AudioContext, audioBuffer: AudioBuffer): AudioBufferSourceNode {
        const sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        return sourceNode;
    }

    private releaseSourceNode(): void {
        if (!this.sourceNode) {
            return;
        }

        try {
            this.sourceNode.onended = null;
            this.sourceNode.stop();
            this.sourceNode.disconnect();
        } catch (error) {
            // AudioBufferSourceNode can only be stopped once.
        }

        this.sourceNode = null;
    }

    private handleSourceEnded(): void {
        if (!this.playing) {
            return;
        }

        this.sourceNode = null;
        this.playing = false;
        this.paused = false;
        this.stopProgressUpdates();
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

    private clampPosition(position: number, maxPosition: number): number {
        return Math.max(0, Math.min(position, Math.max(0, maxPosition)));
    }
}

export {WebAudioTransportController};
export default WebAudioTransportController;
