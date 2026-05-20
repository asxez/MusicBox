type PublishReason = 'tick' | 'commit';

interface PlaybackPositionUpdateCoordinatorOptions {
    minIntervalMs?: number;
    emitPositionChanged: (position: number) => void;
    syncDesktopPosition: (position: number) => Promise<void> | void;
    savePosition: (position: number) => void;
}

interface PublishPositionOptions {
    reason?: PublishReason;
}

export class PlaybackPositionUpdateCoordinator {
    private readonly minIntervalMs: number;
    private readonly emitPositionChanged: (position: number) => void;
    private readonly syncDesktopPosition: (position: number) => Promise<void> | void;
    private readonly savePosition: (position: number) => void;
    private pendingPosition: number | null = null;
    private publishTimer: ReturnType<typeof setTimeout> | null = null;
    private lastPublishedAt = 0;
    private lastPublishedPosition: number | null = null;

    constructor({
        minIntervalMs = 200,
        emitPositionChanged,
        syncDesktopPosition,
        savePosition
    }: PlaybackPositionUpdateCoordinatorOptions) {
        this.minIntervalMs = minIntervalMs;
        this.emitPositionChanged = emitPositionChanged;
        this.syncDesktopPosition = syncDesktopPosition;
        this.savePosition = savePosition;
    }

    publish(position: number, options: PublishPositionOptions = {}): void {
        const reason = options.reason ?? 'tick';

        if (reason === 'commit') {
            this.publishNow(position, undefined, true);
            return;
        }

        const now = Date.now();
        const elapsed = now - this.lastPublishedAt;

        if (elapsed >= this.minIntervalMs) {
            this.publishNow(position, now);
            return;
        }

        this.pendingPosition = position;
        this.schedulePendingPublish(this.minIntervalMs - elapsed);
    }

    flush(): void {
        if (this.pendingPosition === null) {
            return;
        }

        this.publishNow(this.pendingPosition);
    }

    dispose(): void {
        this.clearTimer();
        this.pendingPosition = null;
    }

    private schedulePendingPublish(delayMs: number): void {
        if (this.publishTimer) {
            return;
        }

        this.publishTimer = setTimeout(() => {
            const pendingPosition = this.pendingPosition;
            this.clearTimer();

            if (pendingPosition !== null) {
                this.publishNow(pendingPosition);
            }
        }, delayMs);
    }

    private publishNow(position: number, now = Date.now(), forceEffects = false): void {
        this.clearTimer();
        this.pendingPosition = null;

        const duplicatePosition = this.lastPublishedPosition === position;
        this.lastPublishedAt = now;

        if (!duplicatePosition) {
            this.lastPublishedPosition = position;
            this.emitPositionChanged(position);
        } else if (!forceEffects) {
            return;
        }

        void Promise.resolve(this.syncDesktopPosition(position)).catch((error) => {
            console.error('❌ PlaybackPositionUpdateCoordinator: 同步桌面歌词位置失败:', error);
        });
        this.savePosition(position);
    }

    private clearTimer(): void {
        if (!this.publishTimer) {
            return;
        }

        clearTimeout(this.publishTimer);
        this.publishTimer = null;
    }
}
