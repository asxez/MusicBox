import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import type {AddLyricsDomListener} from "@ui/widgets/lyrics/LyricsDomEvents";

interface LyricsVolumeElements {
    volumeBtn: HTMLElement;
    volumeSliderContainer: HTMLElement;
    volumeFill: HTMLElement;
    volumeHandle: HTMLElement;
    volumeIcon: HTMLElement;
    volumeMuteIcon: HTMLElement;
    volumeHalfIcon: HTMLElement;
}

interface LyricsVolumeControllerOptions {
    elements: LyricsVolumeElements;
    addDomListener: AddLyricsDomListener;
}

class LyricsVolumeController {
    private readonly elements: LyricsVolumeElements;
    private readonly addDomListener: AddLyricsDomListener;
    private currentVolume = 50;
    private previousVolume = 50;
    private dragging = false;
    private bound = false;

    constructor(options: LyricsVolumeControllerOptions) {
        this.elements = options.elements;
        this.addDomListener = options.addDomListener;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.elements.volumeBtn, 'click', () => {
            void this.toggleVolumeMute();
        });

        this.addDomListener(this.elements.volumeSliderContainer, 'mousedown', (event) => {
            this.dragging = true;
            void this.updateVolumeFromEvent(event as MouseEvent);
        });

        this.addDomListener(this.elements.volumeSliderContainer, 'click', (event) => {
            if (!this.dragging) {
                void this.updateVolumeFromEvent(event as MouseEvent);
            }
        });

        this.addDomListener(this.elements.volumeSliderContainer, 'mousewheel', (event) => {
            const wheelEvent = event as WheelEvent & {wheelDelta?: number};
            if ((wheelEvent.wheelDelta || -wheelEvent.deltaY) < 0) {
                void this.setVolume(Math.min(100, this.currentVolume + 1));
            } else {
                void this.setVolume(Math.max(0, this.currentVolume - 1));
            }
        });

        this.addDomListener(document, 'mousemove', (event) => {
            if (this.dragging) {
                void this.updateVolumeFromEvent(event as MouseEvent);
            }
        });

        this.addDomListener(document, 'mouseup', () => {
            if (this.dragging) {
                this.dragging = false;
            }
        });

        this.bound = true;
    }

    async setVolume(volume: number): Promise<void> {
        this.currentVolume = Math.max(0, Math.min(100, volume));
        this.updateVolumeDisplay();
        await playbackUiStateService.setVolume(this.currentVolume / 100);
    }

    setVolumeFromRuntime(volume: number): void {
        this.currentVolume = volume * 100;
        this.updateVolumeDisplay();
    }

    private updateVolumeDisplay(): void {
        this.elements.volumeFill.style.width = `${this.currentVolume}%`;
        this.elements.volumeHandle.style.left = `${this.currentVolume}%`;

        this.elements.volumeIcon.style.display = 'none';
        this.elements.volumeHalfIcon.style.display = 'none';
        this.elements.volumeMuteIcon.style.display = 'none';

        if (this.currentVolume === 0) {
            this.elements.volumeMuteIcon.style.display = 'block';
        } else if (this.currentVolume <= 50) {
            this.elements.volumeHalfIcon.style.display = 'block';
        } else {
            this.elements.volumeIcon.style.display = 'block';
            this.elements.volumeMuteIcon.style.display = 'none';
            this.elements.volumeHalfIcon.style.display = 'none';
        }
    }

    private async updateVolumeFromEvent(event: MouseEvent): Promise<void> {
        const rect = this.elements.volumeSliderContainer.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        await this.setVolume(Math.round(percentage * 100));
    }

    private async toggleVolumeMute(): Promise<void> {
        if (this.currentVolume > 0) {
            this.previousVolume = this.currentVolume;
            await this.setVolume(0);
        } else {
            await this.setVolume(this.previousVolume || 50);
        }
    }
}

export {LyricsVolumeController};
export type {LyricsVolumeElements};
