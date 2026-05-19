import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {Track} from '@api/types/library';
import {desktopLyricsWindowService} from './service';
import {resolveDesktopLyricsElements} from './DesktopLyricsElements';
import {DesktopLyricsLockController} from './DesktopLyricsLockController';
import {DesktopLyricsRenderController} from './DesktopLyricsRenderController';
import {DesktopLyricsSettingsController} from './DesktopLyricsSettingsController';
import type {DesktopLyricsElements, DesktopLyricsSettings} from './DesktopLyricsTypes';

class DesktopLyrics {
    private readonly elements: DesktopLyricsElements;
    private readonly lockController: DesktopLyricsLockController;
    private readonly renderController: DesktopLyricsRenderController;
    private readonly settingsController: DesktopLyricsSettingsController;
    isPlaying: boolean;
    currentPosition: number;

    constructor() {
        this.elements = resolveDesktopLyricsElements();
        this.lockController = new DesktopLyricsLockController(this.elements);
        this.renderController = new DesktopLyricsRenderController(this.elements);
        this.settingsController = new DesktopLyricsSettingsController(this.elements, this.lockController);
        this.isPlaying = false;
        this.currentPosition = 0;

        this.init();
    }

    init(): void {
        this.setupEventListeners();
        this.setupIPCListeners();
        this.settingsController.loadSettings();
        void this.settingsController.applySettings();
        this.renderController.showDefaultLyrics();
    }

    setupEventListeners(): void {
        this.elements.lockBtn.addEventListener('click', () => {
            void this.lockController.toggle();
        });

        this.elements.closeBtn.addEventListener('click', () => {
            void desktopLyricsWindowService.close();
        });

        this.lockController.bindControlHover();
    }

    setupIPCListeners(): void {
        desktopLyricsWindowService.onLyricsUpdated((lyricsData) => {
            this.renderController.updateLyrics(lyricsData);
        });

        desktopLyricsWindowService.onPositionChanged((position) => {
            const normalizedPosition = this.renderController.updatePosition(position);
            if (normalizedPosition !== null) {
                this.currentPosition = normalizedPosition;
            }
        });

        desktopLyricsWindowService.onPlaybackStateChanged((state: DesktopLyricsPlaybackState) => {
            this.isPlaying = state?.isPlaying || false;
        });

        desktopLyricsWindowService.onTrackChanged((_track: Track | null) => {
            this.currentPosition = 0;
            this.renderController.reset();
        });

        desktopLyricsWindowService.onSettingsChanged((settings) => {
            void this.settingsController.updateSettings(settings as Partial<DesktopLyricsSettings>);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DesktopLyrics();
});
