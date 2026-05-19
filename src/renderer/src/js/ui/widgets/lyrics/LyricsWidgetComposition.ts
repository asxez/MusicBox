import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import {LyricsCoverArtController} from "@ui/widgets/lyrics/LyricsCoverArtController";
import {resolveLyricsElements} from "@ui/widgets/lyrics/LyricsElementRegistry";
import {LyricsLayoutController} from "@ui/widgets/lyrics/LyricsLayoutController";
import {LyricsLoaderController} from "@ui/widgets/lyrics/LyricsLoaderController";
import {LyricsPlaybackControlsController} from "@ui/widgets/lyrics/LyricsPlaybackControlsController";
import {LyricsPlaybackStateController} from "@ui/widgets/lyrics/LyricsPlaybackStateController";
import {LyricsRenderController} from "@ui/widgets/lyrics/LyricsRenderController";
import {LyricsTrackInfoController} from "@ui/widgets/lyrics/LyricsTrackInfoController";
import type {PlayMode} from "@api/types/playback";
import type {AddLyricsDomListener} from "@ui/widgets/lyrics/LyricsDomEvents";
import type {LyricsElements} from "@ui/widgets/lyrics/LyricsElementRegistry";
import type {LyricsTrack} from "@ui/widgets/lyrics/LyricsTypes";

interface LyricsWidgetCompositionOptions {
    root: Element | null;
    addDomListener: AddLyricsDomListener;
    isVisible: () => boolean;
    getCurrentTrack: () => LyricsTrack | null;
    setCurrentTrack: (track: LyricsTrack | null) => void;
    onClose: () => void;
}

class LyricsWidgetComposition {
    readonly elements: LyricsElements;
    private readonly coverArtController: LyricsCoverArtController;
    private readonly layoutController: LyricsLayoutController;
    private readonly lyricsLoader: LyricsLoaderController;
    private readonly playbackControls: LyricsPlaybackControlsController;
    private readonly playbackStateController: LyricsPlaybackStateController;
    private readonly renderController: LyricsRenderController;
    private readonly trackInfoController: LyricsTrackInfoController;
    private readonly addDomListener: AddLyricsDomListener;
    private readonly isVisible: () => boolean;
    private readonly getCurrentTrack: () => LyricsTrack | null;
    private readonly setCurrentTrack: (track: LyricsTrack | null) => void;
    private readonly onClose: () => void;
    private bound = false;

    constructor(options: LyricsWidgetCompositionOptions) {
        this.addDomListener = options.addDomListener;
        this.isVisible = options.isVisible;
        this.getCurrentTrack = options.getCurrentTrack;
        this.setCurrentTrack = options.setCurrentTrack;
        this.onClose = options.onClose;
        this.elements = resolveLyricsElements(options.root);

        this.coverArtController = new LyricsCoverArtController({
            background: this.elements.background,
            trackCover: this.elements.trackCover
        });

        this.layoutController = new LyricsLayoutController({
            elements: this.elements.layout,
            addDomListener: this.addDomListener,
            isVisible: this.isVisible
        });

        this.renderController = new LyricsRenderController({
            lyricsDisplay: this.elements.lyricsDisplay,
            isVisible: this.isVisible,
            seek: async (time) => {
                await playbackUiStateService.seek(time);
            }
        });

        this.lyricsLoader = new LyricsLoaderController({
            setLyrics: (lyrics) => {
                this.renderController.setLyrics(lyrics);
            },
            renderLyrics: () => {
                this.renderController.renderLyrics();
            },
            showLoading: () => {
                this.renderController.showLoading();
            },
            showNoLyrics: () => {
                this.renderController.showNoLyrics();
            }
        });

        this.playbackControls = new LyricsPlaybackControlsController({
            elements: this.elements.playback,
            addDomListener: this.addDomListener,
            getCurrentTrack: this.getCurrentTrack
        });

        this.playbackStateController = new LyricsPlaybackStateController({
            isVisible: this.isVisible,
            onPositionChanged: (position) => {
                this.renderController.handlePlaybackPositionChanged(position);
            },
            onPlaybackStateChanged: (isPlaying) => {
                this.playbackControls.setPlaying(isPlaying);
            },
            onDurationChanged: (duration) => {
                this.playbackControls.updateDuration(duration);
            },
            onTrackChanged: (track) => {
                this.setCurrentTrack(track);
                return this.updateTrackInfo(track);
            },
            onVolumeChanged: (volume) => {
                this.playbackControls.setVolumeFromRuntime(volume);
            },
            onPlayModeChanged: (mode) => {
                this.updatePlayModeDisplay(mode);
            }
        });

        this.trackInfoController = new LyricsTrackInfoController({
            elements: {
                trackTitle: this.elements.trackTitle,
                trackArtist: this.elements.trackArtist
            },
            updateTrackDuration: (duration) => {
                this.playbackControls.updateTrackDuration(duration);
            },
            loadLyrics: (track) => {
                return this.lyricsLoader.loadLyrics(track);
            },
            updateCoverArt: (track) => {
                return this.coverArtController.updateCoverArt(track);
            }
        });
    }

    bind(): void {
        if (this.bound) {
            return;
        }

        this.addDomListener(this.elements.closeBtn, 'click', () => {
            this.onClose();
        });

        this.layoutController.bind();
        this.playbackControls.bind();
        this.playbackStateController.bind();
        this.bound = true;
    }

    resetAfterHide(): void {
        this.trackInfoController.reset();
        this.lyricsLoader.reset();
        this.renderController.resetPlaybackPosition();
    }

    destroy(): void {
        this.playbackStateController.destroy();
        this.renderController.reset();
        this.layoutController.resetLayoutState();
        this.bound = false;
    }

    async updateTrackInfo(track: LyricsTrack | null): Promise<void> {
        await this.trackInfoController.updateTrackInfo(track);
    }

    async initializeControls(): Promise<void> {
        await this.playbackControls.initialize();
    }

    async togglePlayPause(): Promise<void> {
        await this.playbackControls.togglePlayPause();
    }

    updateProgress(currentTime: number, duration: number): void {
        this.playbackControls.updateProgress(currentTime, duration);
    }

    updatePlayButton(): void {
        this.playbackControls.setPlaying(playbackUiStateService.getState().isPlaying);
    }

    async setVolume(volume: number): Promise<void> {
        await this.playbackControls.setVolume(volume);
    }

    updateVolumeDisplay(): void {
        this.playbackControls.setVolumeFromRuntime(playbackUiStateService.getState().volume);
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.playbackControls.updatePlayModeDisplay(mode);
    }

    toggleFullscreen(): void {
        this.layoutController.toggleFullscreen();
    }

    enterFullscreen(): void {
        this.layoutController.enterFullscreen();
    }

    exitFullscreen(): void {
        this.layoutController.exitFullscreen();
    }

    updateFullscreenState(): boolean {
        return this.layoutController.updateFullscreenState();
    }

    resetLayoutState(): void {
        this.layoutController.resetLayoutState();
    }
}

export {LyricsWidgetComposition};
