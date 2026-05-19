import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import type {AddManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";

interface PlayerVolumeControllerOptions {
    volumeBtn: HTMLButtonElement;
    volumeSlider: HTMLElement;
    volumeSliderContainer: HTMLElement;
    volumeFill: HTMLElement;
    volumeHandle: HTMLElement;
    volumeHighIcon: HTMLElement | null;
    volumeHalfIcon: HTMLElement | null;
    volumeMuteIcon: HTMLElement | null;
    addDomListener: AddManagedDomListener;
}

class PlayerVolumeController {
    private readonly volumeBtn: HTMLButtonElement;
    private readonly volumeSlider: HTMLElement;
    private readonly volumeSliderContainer: HTMLElement;
    private readonly volumeFill: HTMLElement;
    private readonly volumeHandle: HTMLElement;
    private readonly volumeHighIcon: HTMLElement | null;
    private readonly volumeHalfIcon: HTMLElement | null;
    private readonly volumeMuteIcon: HTMLElement | null;
    private readonly addDomListener: AddManagedDomListener;

    private volume = 0.7;
    private previousVolume = 0.7;
    private dragging = false;
    private bound = false;

    constructor(options: PlayerVolumeControllerOptions) {
        this.volumeBtn = options.volumeBtn;
        this.volumeSlider = options.volumeSlider;
        this.volumeSliderContainer = options.volumeSliderContainer;
        this.volumeFill = options.volumeFill;
        this.volumeHandle = options.volumeHandle;
        this.volumeHighIcon = options.volumeHighIcon;
        this.volumeHalfIcon = options.volumeHalfIcon;
        this.volumeMuteIcon = options.volumeMuteIcon;
        this.addDomListener = options.addDomListener;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.volumeSlider, 'mousedown', (event: Event) => {
            void this.startDragging(event as MouseEvent);
        });

        this.addDomListener(this.volumeSlider, 'input', (event: Event) => {
            void this.applyInputValue((event.target as HTMLInputElement).value);
        });

        this.addDomListener(this.volumeSliderContainer, 'mousewheel', (event: Event) => {
            void this.adjustFromWheel(event as WheelEvent & {wheelDelta?: number});
        });

        this.addDomListener(document, 'mousemove', (event: Event) => {
            if (this.dragging) {
                void this.applyPointerVolume(event as MouseEvent);
            }
        });

        this.addDomListener(document, 'mouseup', () => {
            void this.stopDragging();
        });

        this.addDomListener(this.volumeBtn, 'click', () => {
            void this.toggleMute();
        });

        this.bound = true;
    }

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        this.updateDisplay();
    }

    updateDisplay(): void {
        const volumePercent = this.volume * 100;
        this.volumeFill.style.width = `${volumePercent}%`;
        this.volumeHandle.style.left = `${volumePercent}%`;
        this.updateIcon();
    }

    reset(): void {
        this.dragging = false;
    }

    private async startDragging(event: MouseEvent): Promise<void> {
        this.dragging = true;
        await this.applyPointerVolume(event);
    }

    private async applyInputValue(value: string): Promise<void> {
        this.updateVolume(value);
        await playbackUiStateService.setVolume(this.getRenderedVolume());
    }

    private async applyPointerVolume(event: MouseEvent): Promise<void> {
        this.updateVolume(event);
        await playbackUiStateService.setVolume(this.getRenderedVolume());
    }

    private async adjustFromWheel(event: WheelEvent & {wheelDelta?: number}): Promise<void> {
        if ((event.wheelDelta ?? -event.deltaY) < 0) {
            await playbackUiStateService.adjustVolume(0.01);
            return;
        }

        await playbackUiStateService.adjustVolume(-0.01);
    }

    private async stopDragging(): Promise<void> {
        if (!this.dragging) {
            return;
        }

        this.dragging = false;
        await playbackUiStateService.setVolume(this.getRenderedVolume());
    }

    private updateVolume(eventOrValue: MouseEvent | string | number): void {
        let volume: number;
        if (typeof eventOrValue === 'string' || typeof eventOrValue === 'number') {
            volume = Math.max(0, Math.min(1, Number(eventOrValue)));
        } else {
            const rect = this.volumeSlider.getBoundingClientRect();
            volume = Math.max(0, Math.min(1, (eventOrValue.clientX - rect.left) / rect.width));
        }

        this.volumeFill.style.width = `${volume * 100}%`;
        this.volumeHandle.style.left = `${volume * 100}%`;
    }

    private getRenderedVolume(): number {
        return parseFloat(this.volumeFill.style.width) / 100;
    }

    private async toggleMute(): Promise<void> {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            await playbackUiStateService.setVolume(0);
            return;
        }

        await playbackUiStateService.setVolume(this.previousVolume || 0.7);
    }

    private updateIcon(): void {
        if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';

        if (this.volume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.volume <= 0.5) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'block';
        }
    }
}

export {PlayerVolumeController};
