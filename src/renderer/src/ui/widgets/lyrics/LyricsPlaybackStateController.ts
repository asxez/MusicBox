import {playbackUiStateService} from "@/features/playback/service/PlaybackUiStateService";
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@/features/playback/PlaybackStore";
import type {PlayMode} from "@api/types/playback";
import type {LyricsTrack} from "@ui/widgets/lyrics/LyricsTypes";

interface LyricsPlaybackStateControllerOptions {
    isVisible: () => boolean;
    onPositionChanged: (position: number) => void;
    onPlaybackStateChanged: (isPlaying: boolean) => void;
    onDurationChanged: (duration: number) => void;
    onTrackChanged: (track: LyricsTrack | null) => Promise<void>;
    onVolumeChanged: (volume: number) => void;
    onPlayModeChanged: (mode: PlayMode) => void;
}

class LyricsPlaybackStateController {
    private readonly isVisible: () => boolean;
    private readonly onPositionChanged: (position: number) => void;
    private readonly onPlaybackStateChanged: (isPlaying: boolean) => void;
    private readonly onDurationChanged: (duration: number) => void;
    private readonly onTrackChanged: (track: LyricsTrack | null) => Promise<void>;
    private readonly onVolumeChanged: (volume: number) => void;
    private readonly onPlayModeChanged: (mode: PlayMode) => void;
    private playbackStateUnsubscribe: Unsubscribe | null = null;

    constructor(options: LyricsPlaybackStateControllerOptions) {
        this.isVisible = options.isVisible;
        this.onPositionChanged = options.onPositionChanged;
        this.onPlaybackStateChanged = options.onPlaybackStateChanged;
        this.onDurationChanged = options.onDurationChanged;
        this.onTrackChanged = options.onTrackChanged;
        this.onVolumeChanged = options.onVolumeChanged;
        this.onPlayModeChanged = options.onPlayModeChanged;
    }

    bind(): void {
        if (this.playbackStateUnsubscribe) {
            return;
        }

        this.playbackStateUnsubscribe = playbackUiStateService.subscribe((state, change) => {
            return this.handlePlaybackStateChange(state, change);
        });
    }

    destroy(): void {
        if (!this.playbackStateUnsubscribe) {
            return;
        }

        try {
            this.playbackStateUnsubscribe();
        } catch (error) {
            console.warn('⚠️ Lyrics: 移除 playback state 订阅失败:', error);
        }
        this.playbackStateUnsubscribe = null;
    }

    private async handlePlaybackStateChange(
        state: Readonly<PlaybackState>,
        change: PlaybackStoreChange
    ): Promise<void> {
        switch (change.type) {
            case 'positionChanged':
                this.onPositionChanged(state.position);
                break;

            case 'playbackStateChanged':
                this.onPlaybackStateChanged(state.isPlaying);
                break;

            case 'durationChanged':
                this.onDurationChanged(state.duration);
                break;

            case 'trackChanged':
                if (this.isVisible()) {
                    await this.onTrackChanged(state.currentTrack as LyricsTrack | null);
                }
                break;

            case 'volumeChanged':
                this.onVolumeChanged(state.volume);
                break;

            case 'playModeChanged':
                this.onPlayModeChanged(state.playMode);
                break;
        }
    }
}

export {LyricsPlaybackStateController};
