import {playbackController} from "@js/features/playback";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";

type AddDomListener = (
    element: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
) => void;

interface LyricsPlaybackControlElements {
    playBtn: HTMLElement;
    prevBtn: HTMLElement;
    nextBtn: HTMLElement;
    playIcon: HTMLElement;
    pauseIcon: HTMLElement;
    progressBar: HTMLElement;
    progressFill: HTMLElement;
    progressHandle: HTMLElement;
    currentTimeEl: HTMLElement;
    durationEl: HTMLElement;
    volumeBtn: HTMLElement;
    volumeSliderContainer: HTMLElement;
    volumeFill: HTMLElement;
    volumeHandle: HTMLElement;
    volumeIcon: HTMLElement;
    volumeMuteIcon: HTMLElement;
    volumeHalfIcon: HTMLElement;
    playModeBtn: HTMLElement;
    modeSequenceIcon: HTMLElement;
    modeShuffleIcon: HTMLElement;
    modeRepeatOneIcon: HTMLElement;
}

interface LyricsPlaybackControlsControllerOptions {
    elements: LyricsPlaybackControlElements;
    addDomListener: AddDomListener;
    getCurrentTrack: () => Track | null;
}

class LyricsPlaybackControlsController {
    private readonly elements: LyricsPlaybackControlElements;
    private readonly addDomListener: AddDomListener;
    private readonly getCurrentTrack: () => Track | null;

    private playing = false;
    private draggingProgress = false;
    private draggingVolume = false;
    private currentVolume = 50;
    private previousVolume = 50;
    private toggleInProgress = false;
    private bound = false;

    constructor(options: LyricsPlaybackControlsControllerOptions) {
        this.elements = options.elements;
        this.addDomListener = options.addDomListener;
        this.getCurrentTrack = options.getCurrentTrack;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.elements.playBtn, 'click', () => {
            void this.togglePlayPause();
        });

        this.addDomListener(this.elements.prevBtn, 'click', () => {
            void playbackController.previousTrack();
        });

        this.addDomListener(this.elements.nextBtn, 'click', () => {
            void playbackController.nextTrack();
        });

        this.addDomListener(this.elements.volumeBtn, 'click', () => {
            void this.toggleVolumeMute();
        });

        this.addDomListener(this.elements.volumeSliderContainer, 'mousedown', (event) => {
            this.draggingVolume = true;
            void this.updateVolumeFromEvent(event as MouseEvent);
        });

        this.addDomListener(this.elements.volumeSliderContainer, 'click', (event) => {
            if (!this.draggingVolume) {
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

        this.addDomListener(this.elements.playModeBtn, 'click', () => {
            const newMode = playbackController.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });

        this.addDomListener(this.elements.progressBar, 'click', (event) => {
            void this.seekToPosition(event as MouseEvent);
        });

        this.addDomListener(this.elements.progressBar, 'mousedown', (event) => {
            this.startProgressDrag(event as MouseEvent);
        });

        this.addDomListener(document, 'mousemove', (event) => {
            if (this.draggingProgress) {
                this.updateProgressDrag(event as MouseEvent);
            }
            if (this.draggingVolume) {
                void this.updateVolumeFromEvent(event as MouseEvent);
            }
        });

        this.addDomListener(document, 'mouseup', () => {
            if (this.draggingProgress) {
                void this.endProgressDrag();
            }
            if (this.draggingVolume) {
                this.draggingVolume = false;
            }
        });

        this.bound = true;
    }

    async initialize(): Promise<void> {
        const playbackState = playbackController.getState();
        this.playing = playbackState.isPlaying;
        await this.setVolume(playbackState.volume * 100);
        this.updatePlayModeDisplay(playbackState.playMode);
        this.updatePlayButton();
    }

    setPlaying(isPlaying: boolean): void {
        this.playing = isPlaying;
        this.updatePlayButton();
    }

    updateDuration(duration: number): void {
        if (duration > 0) {
            this.elements.durationEl.textContent = this.formatTime(duration);
        }
    }

    updateProgress(currentTime: number, duration: number): void {
        if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            this.elements.progressFill.style.width = `${percentage}%`;
            this.elements.progressHandle.style.left = `${percentage}%`;
        }

        this.elements.currentTimeEl.textContent = this.formatTime(currentTime);
        this.elements.durationEl.textContent = this.formatTime(duration);
    }

    updateTrackDuration(duration: number | undefined): void {
        if (duration) {
            this.elements.durationEl.textContent = this.formatTime(duration);
        }
    }

    async setVolume(volume: number): Promise<void> {
        this.currentVolume = Math.max(0, Math.min(100, volume));
        this.updateVolumeDisplay();
        await playbackController.setVolume(this.currentVolume / 100);
    }

    setVolumeFromRuntime(volume: number): void {
        this.currentVolume = volume * 100;
        this.updateVolumeDisplay();
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.elements.modeSequenceIcon.style.display = 'none';
        this.elements.modeShuffleIcon.style.display = 'none';
        this.elements.modeRepeatOneIcon.style.display = 'none';

        switch (mode) {
            case 'sequence':
                this.elements.modeSequenceIcon.style.display = 'block';
                this.elements.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                this.elements.modeShuffleIcon.style.display = 'block';
                this.elements.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                this.elements.modeRepeatOneIcon.style.display = 'block';
                this.elements.playModeBtn.title = '单曲循环';
                break;
            default:
                this.elements.modeSequenceIcon.style.display = 'block';
                this.elements.playModeBtn.title = '顺序播放';
                break;
        }
    }

    async togglePlayPause(): Promise<void> {
        if (this.toggleInProgress) {
            return;
        }

        this.toggleInProgress = true;
        try {
            if (this.playing) {
                const result = await playbackController.pause();
                if (!result) {
                    console.error('❌ Lyrics: 暂停失败');
                }
            } else {
                const result = await playbackController.play();
                if (!result) {
                    console.error('❌ Lyrics: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Lyrics: 切换播放状态失败:', error);
        } finally {
            setTimeout(() => {
                this.toggleInProgress = false;
            }, 100);
        }
    }

    private updatePlayButton(): void {
        if (this.playing) {
            this.elements.playIcon.style.display = 'none';
            this.elements.pauseIcon.style.display = 'block';
        } else {
            this.elements.playIcon.style.display = 'block';
            this.elements.pauseIcon.style.display = 'none';
        }
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

    private async seekToPosition(event: MouseEvent): Promise<void> {
        const duration = this.getPlaybackDuration();
        if (!this.getCurrentTrack() || !duration) return;

        const rect = this.elements.progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = clickX / rect.width;
        await playbackController.seek(percentage * duration);
    }

    private startProgressDrag(event: MouseEvent): void {
        this.draggingProgress = true;
        this.elements.progressBar.classList.add('dragging');
        this.updateProgressDrag(event);
    }

    private updateProgressDrag(event: MouseEvent): void {
        const duration = this.getPlaybackDuration();
        if (!this.draggingProgress || !this.getCurrentTrack() || duration <= 0) return;

        const rect = this.elements.progressBar.getBoundingClientRect();
        const dragX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const percentage = dragX / rect.width;
        this.elements.progressFill.style.width = `${percentage * 100}%`;
        this.elements.currentTimeEl.textContent = this.formatTime(percentage * duration);
    }

    private async endProgressDrag(): Promise<void> {
        if (!this.draggingProgress) return;

        this.draggingProgress = false;
        this.elements.progressBar.classList.remove('dragging');

        const percentage = parseFloat(this.elements.progressFill.style.width) / 100;
        const duration = this.getPlaybackDuration();
        await playbackController.seek(percentage * (duration || 0));
    }

    private getPlaybackDuration(): number {
        const currentTrack = this.getCurrentTrack();
        return currentTrack?.duration || playbackController.getState().duration;
    }

    private formatTime(seconds: number): string {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

export {LyricsPlaybackControlsController};
export type {LyricsPlaybackControlElements};
