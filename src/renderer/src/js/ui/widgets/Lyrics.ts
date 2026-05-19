/**
 * 歌词页组件
 */

import {Component} from "@ui/base/Component";
import {formatTime} from "@js/utils";
import {LyricsWidgetComposition} from "@ui/widgets/lyrics/LyricsWidgetComposition";
import type {PlayMode} from "@api/types/playback";
import type {LyricsTrack} from "@ui/widgets/lyrics/LyricsTypes";

class Lyrics extends Component {
    public isVisible: boolean;
    public isFullscreen: boolean;
    private currentTrack: LyricsTrack | null;
    private listenersSetup: boolean;
    private readonly composition: LyricsWidgetComposition;

    constructor(element: Element | null) {
        super(element);
        this.element = element;
        this.isVisible = false;
        this.isFullscreen = false;
        this.currentTrack = null;
        this.listenersSetup = false;

        this.composition = new LyricsWidgetComposition({
            root: this.element,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            isVisible: () => this.isVisible,
            getCurrentTrack: () => this.currentTrack,
            setCurrentTrack: (track) => {
                this.currentTrack = track;
            },
            onClose: () => {
                this.hide();
            }
        });
    }

    async show(track: LyricsTrack | null): Promise<void> {
        if (!this.listenersSetup) {
            this.composition.bind();
            this.listenersSetup = true;
        }

        this.currentTrack = track;
        this.isVisible = true;

        this.composition.elements.page.style.display = 'block';
        setTimeout(() => {
            this.composition.elements.page.classList.add('show');
        }, 10);

        this.updateFullscreenState();
        await this.initializeControls();

        if (track) {
            await this.updateTrackInfo(track);
        }

        setTimeout(() => {
            this.composition.elements.lyricsDisplay.scrollTop = 0;
        }, 50);
    }

    hide(): void {
        this.isVisible = false;
        this.composition.elements.page.classList.remove('show');
        this.composition.resetAfterHide();

        setTimeout(() => {
            if (!this.isVisible) {
                this.composition.elements.page.style.display = 'none';
            }
        }, 300);
    }

    destroy(): void {
        this.composition.destroy();
        this.currentTrack = null;
        this.isVisible = false;
        this.listenersSetup = false;
        super.destroy();
    }

    async toggle(track: LyricsTrack | null): Promise<void> {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show(track);
        }
    }

    async togglePlayPause(): Promise<void> {
        await this.composition.togglePlayPause();
    }

    updateProgress(currentTime: number, duration: number): void {
        this.composition.updateProgress(currentTime, duration);
    }

    updatePlayButton(): void {
        this.composition.updatePlayButton();
    }

    formatTime(seconds: number): string {
        return formatTime(seconds);
    }

    async updateTrackInfo(track: LyricsTrack | null): Promise<void> {
        await this.composition.updateTrackInfo(track);
    }

    toggleFullscreen(): void {
        this.composition.toggleFullscreen();
    }

    enterFullscreen(): void {
        this.composition.enterFullscreen();
    }

    exitFullscreen(): void {
        this.composition.exitFullscreen();
    }

    updateFullscreenState(): void {
        this.isFullscreen = this.composition.updateFullscreenState();
    }

    async initializeControls(): Promise<void> {
        await this.composition.initializeControls();
    }

    async setVolume(volume: number): Promise<void> {
        await this.composition.setVolume(volume);
    }

    updateVolumeDisplay(): void {
        this.composition.updateVolumeDisplay();
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.composition.updatePlayModeDisplay(mode);
    }

    resetLayoutState(): void {
        this.composition.resetLayoutState();
    }
}

export {Lyrics};
