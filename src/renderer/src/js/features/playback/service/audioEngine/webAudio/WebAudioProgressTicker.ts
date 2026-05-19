type PositionChangedCallback = ((position: number) => void | Promise<void>) | null;

type WebAudioProgressTickerOptions = {
    isPlaying: () => boolean;
    getPosition: () => Promise<number>;
    getPositionChangedCallback: () => PositionChangedCallback;
};

class WebAudioProgressTicker {
    private timer: ReturnType<typeof setInterval> | null;

    constructor() {
        this.timer = null;
    }

    start(options: WebAudioProgressTickerOptions): void {
        this.stop();
        this.timer = setInterval(async () => {
            const onPositionChanged = options.getPositionChangedCallback();
            if (options.isPlaying() && onPositionChanged) {
                await onPositionChanged(await options.getPosition());
            }
        }, 50);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

export {WebAudioProgressTicker};
export default WebAudioProgressTicker;
