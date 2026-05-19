import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";
import type {AddLyricsDomListener} from "@ui/widgets/lyrics/LyricsDomEvents";
import {LyricsPlaybackButtonController} from "@ui/widgets/lyrics/LyricsPlaybackButtonController";
import type {LyricsPlaybackButtonElements} from "@ui/widgets/lyrics/LyricsPlaybackButtonController";
import {LyricsProgressController} from "@ui/widgets/lyrics/LyricsProgressController";
import type {LyricsProgressElements} from "@ui/widgets/lyrics/LyricsProgressController";
import {LyricsVolumeController} from "@ui/widgets/lyrics/LyricsVolumeController";
import type {LyricsVolumeElements} from "@ui/widgets/lyrics/LyricsVolumeController";

interface LyricsPlaybackControlElements extends LyricsPlaybackButtonElements, LyricsProgressElements, LyricsVolumeElements {}

interface LyricsPlaybackControlsControllerOptions {
    elements: LyricsPlaybackControlElements;
    addDomListener: AddLyricsDomListener;
    getCurrentTrack: () => Track | null;
}

class LyricsPlaybackControlsController {
    private readonly playbackButtons: LyricsPlaybackButtonController;
    private readonly progressController: LyricsProgressController;
    private readonly volumeController: LyricsVolumeController;
    private bound = false;

    constructor(options: LyricsPlaybackControlsControllerOptions) {
        this.playbackButtons = new LyricsPlaybackButtonController({
            elements: options.elements,
            addDomListener: options.addDomListener
        });

        this.progressController = new LyricsProgressController({
            elements: options.elements,
            addDomListener: options.addDomListener,
            getCurrentTrack: options.getCurrentTrack
        });

        this.volumeController = new LyricsVolumeController({
            elements: options.elements,
            addDomListener: options.addDomListener
        });
    }

    bind(): void {
        if (this.bound) return;

        this.playbackButtons.bind();
        this.progressController.bind();
        this.volumeController.bind();
        this.bound = true;
    }

    async initialize(): Promise<void> {
        playbackUiStateService.syncStateFromRuntime();
        const playbackState = playbackUiStateService.getState();
        this.playbackButtons.setPlaying(playbackState.isPlaying);
        await this.volumeController.setVolume(playbackState.volume * 100);
        this.playbackButtons.updatePlayModeDisplay(playbackState.playMode);
    }

    setPlaying(isPlaying: boolean): void {
        this.playbackButtons.setPlaying(isPlaying);
    }

    updateDuration(duration: number): void {
        this.progressController.updateDuration(duration);
    }

    updateProgress(currentTime: number, duration: number): void {
        this.progressController.updateProgress(currentTime, duration);
    }

    updateTrackDuration(duration: number | undefined): void {
        this.progressController.updateTrackDuration(duration);
    }

    async setVolume(volume: number): Promise<void> {
        await this.volumeController.setVolume(volume);
    }

    setVolumeFromRuntime(volume: number): void {
        this.volumeController.setVolumeFromRuntime(volume);
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.playbackButtons.updatePlayModeDisplay(mode);
    }

    async togglePlayPause(): Promise<void> {
        await this.playbackButtons.togglePlayPause();
    }
}

export {LyricsPlaybackControlsController};
export type {LyricsPlaybackControlElements};
