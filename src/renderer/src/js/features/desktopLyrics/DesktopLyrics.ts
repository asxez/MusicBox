import {resolveDesktopLyricsElements} from './DesktopLyricsElements';
import {DesktopLyricsEventBinder} from './DesktopLyricsEventBinder';
import {DesktopLyricsLockController} from './DesktopLyricsLockController';
import {DesktopLyricsRenderController} from './DesktopLyricsRenderController';
import {DesktopLyricsSettingsController} from './DesktopLyricsSettingsController';
import type {DesktopLyricsElements} from './DesktopLyricsTypes';

class DesktopLyrics {
    private readonly elements: DesktopLyricsElements;
    private readonly lockController: DesktopLyricsLockController;
    private readonly renderController: DesktopLyricsRenderController;
    private readonly settingsController: DesktopLyricsSettingsController;
    private readonly eventBinder: DesktopLyricsEventBinder;
    isPlaying: boolean;
    currentPosition: number;

    constructor() {
        this.elements = resolveDesktopLyricsElements();
        this.lockController = new DesktopLyricsLockController(this.elements);
        this.renderController = new DesktopLyricsRenderController(this.elements);
        this.settingsController = new DesktopLyricsSettingsController(this.elements, this.lockController);
        this.eventBinder = new DesktopLyricsEventBinder({
            elements: this.elements,
            lockController: this.lockController,
            renderController: this.renderController,
            settingsController: this.settingsController,
            setPlaybackState: (state) => {
                if (typeof state.isPlaying === 'boolean') {
                    this.isPlaying = state.isPlaying;
                }
                if (typeof state.position === 'number') {
                    this.currentPosition = state.position;
                }
            }
        });
        this.isPlaying = false;
        this.currentPosition = 0;

        this.init();
    }

    init(): void {
        this.eventBinder.bind();
        this.settingsController.loadSettings();
        void this.settingsController.applySettings();
        this.renderController.showDefaultLyrics();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DesktopLyrics();
});
