import {formatTime} from "@/utils";
import {playbackUiStateService} from "@/features/playback/service/PlaybackUiStateService";
import type {Track} from "@api/types/track";
import type {AddLyricsDomListener} from "@ui/widgets/lyrics/LyricsDomEvents";

interface LyricsProgressElements {
    progressBar: HTMLElement;
    progressFill: HTMLElement;
    progressHandle: HTMLElement;
    currentTimeEl: HTMLElement;
    durationEl: HTMLElement;
}

interface LyricsProgressControllerOptions {
    elements: LyricsProgressElements;
    addDomListener: AddLyricsDomListener;
    getCurrentTrack: () => Track | null;
}

class LyricsProgressController {
    private readonly elements: LyricsProgressElements;
    private readonly addDomListener: AddLyricsDomListener;
    private readonly getCurrentTrack: () => Track | null;
    private dragging = false;
    private dragPercentage = 0;
    private bound = false;

    constructor(options: LyricsProgressControllerOptions) {
        this.elements = options.elements;
        this.addDomListener = options.addDomListener;
        this.getCurrentTrack = options.getCurrentTrack;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.elements.progressBar, 'click', (event) => {
            void this.seekToPosition(event as MouseEvent);
        });

        this.addDomListener(this.elements.progressBar, 'mousedown', (event) => {
            this.startProgressDrag(event as MouseEvent);
        });

        this.addDomListener(document, 'mousemove', (event) => {
            if (this.dragging) {
                this.updateProgressDrag(event as MouseEvent);
            }
        });

        this.addDomListener(document, 'mouseup', () => {
            if (this.dragging) {
                void this.endProgressDrag();
            }
        });

        this.bound = true;
    }

    updateDuration(duration: number): void {
        if (duration > 0) {
            this.elements.durationEl.textContent = formatTime(duration);
        }
    }

    updateProgress(currentTime: number, duration: number): void {
        if (this.dragging) {
            this.elements.durationEl.textContent = formatTime(duration);
            return;
        }

        if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            this.setProgressPercentage(percentage);
        }

        this.elements.currentTimeEl.textContent = formatTime(currentTime);
        this.elements.durationEl.textContent = formatTime(duration);
    }

    updateTrackDuration(duration: number | undefined): void {
        if (duration) {
            this.elements.durationEl.textContent = formatTime(duration);
        }
    }

    private async seekToPosition(event: MouseEvent): Promise<void> {
        const duration = this.getPlaybackDuration();
        if (!this.getCurrentTrack() || !duration) return;

        const rect = this.elements.progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        this.dragPercentage = percentage;
        this.setProgressPercentage(percentage * 100);
        await playbackUiStateService.seek(percentage * duration);
    }

    private startProgressDrag(event: MouseEvent): void {
        this.dragging = true;
        this.elements.progressBar.classList.add('dragging');
        this.updateProgressDrag(event);
    }

    private updateProgressDrag(event: MouseEvent): void {
        const duration = this.getPlaybackDuration();
        if (!this.dragging || !this.getCurrentTrack() || duration <= 0) return;

        const rect = this.elements.progressBar.getBoundingClientRect();
        const dragX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const percentage = dragX / rect.width;
        this.dragPercentage = percentage;
        this.setProgressPercentage(percentage * 100);
        this.elements.currentTimeEl.textContent = formatTime(percentage * duration);
    }

    private async endProgressDrag(): Promise<void> {
        if (!this.dragging) return;

        this.dragging = false;
        this.elements.progressBar.classList.remove('dragging');

        const duration = this.getPlaybackDuration();
        await playbackUiStateService.seek(this.dragPercentage * (duration || 0));
    }

    private getPlaybackDuration(): number {
        const currentTrack = this.getCurrentTrack();
        return currentTrack?.duration || playbackUiStateService.getState().duration;
    }

    private setProgressPercentage(percentage: number): void {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.elements.progressFill.style.width = `${clampedPercentage}%`;
        this.elements.progressHandle.style.left = `${clampedPercentage}%`;
    }
}

export {LyricsProgressController};
export type {LyricsProgressElements};
