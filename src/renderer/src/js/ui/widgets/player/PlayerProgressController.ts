import {formatTime} from "@js/utils";
import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import type {AddManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";

interface PlayerProgressControllerOptions {
    progressBarContainer: HTMLElement;
    progressTrack: HTMLElement;
    progressFill: HTMLElement;
    progressHandle: HTMLElement;
    progressTooltip: HTMLElement;
    addDomListener: AddManagedDomListener;
    onSeekCommitted?: () => Promise<void> | void;
}

class PlayerProgressController {
    private readonly progressBarContainer: HTMLElement;
    private readonly progressTrack: HTMLElement;
    private readonly progressFill: HTMLElement;
    private readonly progressHandle: HTMLElement;
    private readonly progressTooltip: HTMLElement;
    private readonly addDomListener: AddManagedDomListener;
    private readonly onSeekCommitted?: () => Promise<void> | void;

    private currentTime = 0;
    private duration = 0;
    private dragging = false;
    private bound = false;

    constructor(options: PlayerProgressControllerOptions) {
        this.progressBarContainer = options.progressBarContainer;
        this.progressTrack = options.progressTrack;
        this.progressFill = options.progressFill;
        this.progressHandle = options.progressHandle;
        this.progressTooltip = options.progressTooltip;
        this.addDomListener = options.addDomListener;
        this.onSeekCommitted = options.onSeekCommitted;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.progressBarContainer, 'mousedown', (event: Event) => {
            const mouseEvent = event as MouseEvent;
            this.dragging = true;
            this.progressBarContainer.classList.add('dragging');
            this.updateProgress(mouseEvent);
            mouseEvent.preventDefault();
        });

        this.addDomListener(this.progressBarContainer, 'mousemove', (event: Event) => {
            if (!this.dragging) {
                this.updateTooltip(event as MouseEvent);
            }
        });

        this.addDomListener(this.progressBarContainer, 'mouseleave', () => {
            if (!this.dragging) {
                this.progressTooltip.style.opacity = '0';
            }
        });

        this.addDomListener(document, 'mousemove', (event: Event) => {
            if (this.dragging) {
                this.updateProgress(event as MouseEvent);
            }
        });

        this.addDomListener(document, 'mouseup', () => {
            void this.commitSeek();
        });

        this.bound = true;
    }

    isDragging(): boolean {
        return this.dragging;
    }

    setDuration(duration: number): void {
        this.duration = duration;
        this.updateDisplay();
    }

    setPosition(position: number): void {
        if (this.dragging) {
            return;
        }

        this.currentTime = position;
        this.updateDisplay();
    }

    updateDisplay(): void {
        if (this.dragging) {
            return;
        }

        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        this.progressFill.style.width = `${progress}%`;
        this.progressHandle.style.left = `${progress}%`;
    }

    reset(): void {
        this.currentTime = 0;
        this.duration = 0;
        this.dragging = false;
        this.progressBarContainer.classList.remove('dragging');
        this.progressTooltip.style.opacity = '0';
        this.updateDisplay();
    }

    private updateProgress(event: MouseEvent): void {
        const progress = this.getPointerProgress(event);
        this.progressFill.style.width = `${progress * 100}%`;
        this.progressHandle.style.left = `${progress * 100}%`;

        const time = this.duration * progress;
        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    private updateTooltip(event: MouseEvent): void {
        const progress = this.getPointerProgress(event);
        const time = this.duration * progress;

        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    private getPointerProgress(event: MouseEvent): number {
        const rect = this.progressTrack.getBoundingClientRect();
        return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    }

    private async commitSeek(): Promise<void> {
        if (!this.dragging) {
            return;
        }

        this.dragging = false;
        this.progressBarContainer.classList.remove('dragging');
        this.progressTooltip.style.opacity = '0';

        const progress = parseFloat(this.progressFill.style.width) / 100;
        await playbackUiStateService.seek(this.duration * progress);
        await this.onSeekCommitted?.();
    }
}

export {PlayerProgressController};
