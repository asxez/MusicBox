type WebAudioVisibilityCoordinatorOptions = {
    onHiddenCleanup: () => void | Promise<void>;
    forceGarbageCollection: () => void | Promise<void>;
};

class WebAudioVisibilityCoordinator {
    private readonly options: WebAudioVisibilityCoordinatorOptions;
    private isWindowVisible: boolean;
    private memoryCleanupTimer: ReturnType<typeof setTimeout> | null;
    private visibilityChangeListener: EventListener | null;
    private windowFocusListener: EventListener | null;
    private windowBlurListener: EventListener | null;

    constructor(options: WebAudioVisibilityCoordinatorOptions) {
        this.options = options;
        this.isWindowVisible = true;
        this.memoryCleanupTimer = null;
        this.visibilityChangeListener = null;
        this.windowFocusListener = null;
        this.windowBlurListener = null;
    }

    start(): void {
        try {
            if (this.visibilityChangeListener || this.windowFocusListener || this.windowBlurListener) {
                return;
            }

            this.visibilityChangeListener = () => {
                void this.handleVisibilityChange();
            };
            this.windowFocusListener = () => {
                this.isWindowVisible = true;
                void this.handleWindowVisible();
            };
            this.windowBlurListener = () => {
                this.isWindowVisible = false;
                this.handleWindowHidden();
            };

            document.addEventListener('visibilitychange', this.visibilityChangeListener);
            window.addEventListener('focus', this.windowFocusListener);
            window.addEventListener('blur', this.windowBlurListener);
        } catch (error) {
            console.error('❌ WebAudioEngine: 初始化窗口可见性监听失败:', error);
        }
    }

    isVisible(): boolean {
        return this.isWindowVisible;
    }

    requestGarbageCollectionIfHidden(): void {
        if (!this.isWindowVisible) {
            setTimeout(() => {
                void this.options.forceGarbageCollection();
            }, 0);
        }
    }

    requestMemoryCleanupIfHidden(): void {
        if (!this.isWindowVisible) {
            setTimeout(() => {
                void this.performMemoryCleanup();
            }, 0);
        }
    }

    destroy(): void {
        this.cancelScheduledMemoryCleanup();
        this.removeListeners();
    }

    private async handleVisibilityChange(): Promise<void> {
        if (document.hidden) {
            this.isWindowVisible = false;
            this.handleWindowHidden();
        } else {
            this.isWindowVisible = true;
            await this.handleWindowVisible();
        }
    }

    private handleWindowHidden(): void {
        this.scheduleMemoryCleanup();
    }

    private async handleWindowVisible(): Promise<void> {
        this.cancelScheduledMemoryCleanup();
        await this.options.forceGarbageCollection();
    }

    private scheduleMemoryCleanup(): void {
        this.cancelScheduledMemoryCleanup();
        this.memoryCleanupTimer = setTimeout(async () => {
            await this.performMemoryCleanup();
        }, 5000);
    }

    private cancelScheduledMemoryCleanup(): void {
        if (this.memoryCleanupTimer) {
            clearTimeout(this.memoryCleanupTimer);
            this.memoryCleanupTimer = null;
        }
    }

    private async performMemoryCleanup(): Promise<void> {
        if (this.isWindowVisible) {
            return;
        }

        try {
            await this.options.onHiddenCleanup();
            await this.options.forceGarbageCollection();
        } catch (error) {
            console.error('❌ WebAudioEngine: 内存清理失败:', error);
        }
    }

    private removeListeners(): void {
        if (this.visibilityChangeListener) {
            document.removeEventListener('visibilitychange', this.visibilityChangeListener);
            this.visibilityChangeListener = null;
        }

        if (this.windowFocusListener) {
            window.removeEventListener('focus', this.windowFocusListener);
            this.windowFocusListener = null;
        }

        if (this.windowBlurListener) {
            window.removeEventListener('blur', this.windowBlurListener);
            this.windowBlurListener = null;
        }
    }
}

export {WebAudioVisibilityCoordinator};
export default WebAudioVisibilityCoordinator;
