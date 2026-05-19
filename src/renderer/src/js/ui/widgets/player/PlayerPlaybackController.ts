import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@js/features/playback/PlaybackStore";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";
import type {AddManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";

interface PlayerPlaybackControllerOptions {
    playPauseBtn: HTMLButtonElement;
    prevBtn: HTMLButtonElement;
    nextBtn: HTMLButtonElement;
    playModeBtn: HTMLButtonElement;
    playIcon: HTMLElement;
    pauseIcon: HTMLElement;
    modeSequenceIcon: HTMLElement | null;
    modeShuffleIcon: HTMLElement | null;
    modeRepeatOneIcon: HTMLElement | null;
    addDomListener: AddManagedDomListener;
    isProgressDragging: () => boolean;
    onDurationChanged: (duration: number) => void;
    onPositionChanged: (position: number) => void;
    onPlaybackStateChanged: (isPlaying: boolean) => void;
    onVolumeChanged: (volume: number) => void;
    onTrackChanged: (track: Track | null) => Promise<void> | void;
    onTrackIndexChanged: (index: number) => void;
}

class PlayerPlaybackController {
    private readonly playPauseBtn: HTMLButtonElement;
    private readonly prevBtn: HTMLButtonElement;
    private readonly nextBtn: HTMLButtonElement;
    private readonly playModeBtn: HTMLButtonElement;
    private readonly playIcon: HTMLElement;
    private readonly pauseIcon: HTMLElement;
    private readonly modeSequenceIcon: HTMLElement | null;
    private readonly modeShuffleIcon: HTMLElement | null;
    private readonly modeRepeatOneIcon: HTMLElement | null;
    private readonly addDomListener: AddManagedDomListener;
    private readonly isProgressDragging: () => boolean;
    private readonly onDurationChanged: (duration: number) => void;
    private readonly onPositionChanged: (position: number) => void;
    private readonly onPlaybackStateChanged: (isPlaying: boolean) => void;
    private readonly onVolumeChanged: (volume: number) => void;
    private readonly onTrackChanged: (track: Track | null) => Promise<void> | void;
    private readonly onTrackIndexChanged: (index: number) => void;

    private playbackStateUnsubscribe: Unsubscribe | null = null;
    private currentPlaying = false;
    private trackUpdateLocked = false;
    private pendingTrack: Track | null | undefined;
    private toggleInProgress = false;
    private bound = false;

    constructor(options: PlayerPlaybackControllerOptions) {
        this.playPauseBtn = options.playPauseBtn;
        this.prevBtn = options.prevBtn;
        this.nextBtn = options.nextBtn;
        this.playModeBtn = options.playModeBtn;
        this.playIcon = options.playIcon;
        this.pauseIcon = options.pauseIcon;
        this.modeSequenceIcon = options.modeSequenceIcon;
        this.modeShuffleIcon = options.modeShuffleIcon;
        this.modeRepeatOneIcon = options.modeRepeatOneIcon;
        this.addDomListener = options.addDomListener;
        this.isProgressDragging = options.isProgressDragging;
        this.onDurationChanged = options.onDurationChanged;
        this.onPositionChanged = options.onPositionChanged;
        this.onPlaybackStateChanged = options.onPlaybackStateChanged;
        this.onVolumeChanged = options.onVolumeChanged;
        this.onTrackChanged = options.onTrackChanged;
        this.onTrackIndexChanged = options.onTrackIndexChanged;
    }

    bind(): void {
        if (this.bound) return;

        this.addDomListener(this.playPauseBtn, 'click', () => {
            void this.togglePlayPause();
        });

        this.addDomListener(this.prevBtn, 'click', () => {
            void playbackUiStateService.previousTrack();
        });

        this.addDomListener(this.nextBtn, 'click', () => {
            void playbackUiStateService.nextTrack();
        });

        this.addDomListener(this.playModeBtn, 'click', () => {
            const newMode = playbackUiStateService.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });

        this.playbackStateUnsubscribe = playbackUiStateService.subscribe((state, change) => {
            return this.handlePlaybackStateChange(state, change);
        });

        this.bound = true;
    }

    syncInitialState(): Readonly<PlaybackState> {
        playbackUiStateService.syncStateFromRuntime();
        const state = playbackUiStateService.getState();
        this.currentPlaying = state.isPlaying;
        this.updatePlayButton();
        this.updatePlayModeDisplay(state.playMode);
        return state;
    }

    updatePlayButton(isPlaying = this.currentPlaying): void {
        this.currentPlaying = isPlaying;
        this.onPlaybackStateChanged(isPlaying);

        if (isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            return;
        }

        this.playIcon.style.display = 'block';
        this.pauseIcon.style.display = 'none';
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        if (this.modeSequenceIcon) this.modeSequenceIcon.style.display = 'none';
        if (this.modeShuffleIcon) this.modeShuffleIcon.style.display = 'none';
        if (this.modeRepeatOneIcon) this.modeRepeatOneIcon.style.display = 'none';
        switch (mode) {
            case 'sequence':
                if (this.modeSequenceIcon) this.modeSequenceIcon.style.display = 'block';
                this.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                if (this.modeShuffleIcon) this.modeShuffleIcon.style.display = 'block';
                this.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                if (this.modeRepeatOneIcon) this.modeRepeatOneIcon.style.display = 'block';
                this.playModeBtn.title = '单曲循环';
                break;
            default:
                if (this.modeSequenceIcon) this.modeSequenceIcon.style.display = 'block';
                this.playModeBtn.title = '顺序播放';
                break;
        }
    }

    async togglePlayPause(): Promise<void> {
        if (this.toggleInProgress) {
            console.log('🚫 Player: 播放状态切换正在进行中，忽略重复调用');
            return;
        }

        this.toggleInProgress = true;
        console.log('🔄 Player: 切换播放状态，当前状态:', this.currentPlaying);

        try {
            if (this.currentPlaying) {
                console.log('🔄 Player: 请求暂停');
                const result = await playbackUiStateService.pause();
                if (!result) {
                    console.error('❌ Player: 暂停失败');
                }
            } else {
                console.log('🔄 Player: 请求播放');
                const result = await playbackUiStateService.play();
                if (!result) {
                    console.error('❌ Player: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Player: 切换播放状态失败:', error);
        } finally {
            setTimeout(() => {
                this.toggleInProgress = false;
            }, 100);
        }
    }

    getVolume(): number {
        return playbackUiStateService.getVolume();
    }

    destroy(): void {
        if (!this.playbackStateUnsubscribe) {
            return;
        }

        try {
            this.playbackStateUnsubscribe();
        } catch (error) {
            console.warn('⚠️ Player: 移除 playback state 订阅失败:', error);
        }
        this.playbackStateUnsubscribe = null;
        this.bound = false;
    }

    private async handlePlaybackStateChange(
        state: Readonly<PlaybackState>,
        change: PlaybackStoreChange
    ): Promise<void> {
        switch (change.type) {
            case 'durationChanged':
                this.onDurationChanged(state.duration);
                break;

            case 'positionChanged':
                if (!this.isProgressDragging()) {
                    this.onPositionChanged(state.position);
                }
                break;

            case 'playbackStateChanged':
                this.updatePlayButton(state.isPlaying);
                break;

            case 'volumeChanged':
                this.onVolumeChanged(state.volume);
                break;

            case 'trackChanged':
                await this.handleTrackChanged(state.currentTrack);
                break;

            case 'trackIndexChanged':
                this.onTrackIndexChanged(state.currentIndex);
                break;

            case 'playModeChanged':
                this.updatePlayModeDisplay(state.playMode);
                break;
        }
    }

    private async handleTrackChanged(track: Track | null): Promise<void> {
        if (this.trackUpdateLocked) {
            this.pendingTrack = track;
            return;
        }

        this.trackUpdateLocked = true;
        try {
            await this.onTrackChanged(track);

            while (this.pendingTrack !== undefined) {
                const nextTrack = this.pendingTrack;
                this.pendingTrack = undefined;
                await this.onTrackChanged(nextTrack);
            }
        } finally {
            this.trackUpdateLocked = false;
        }
    }
}

export {PlayerPlaybackController};
