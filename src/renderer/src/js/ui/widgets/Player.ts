// 播放器组件

import {showToast} from "@js/utils";
import {Component} from "@ui/base/Component";
import {miniModeWindowService} from "@js/features/appShell/service";
import {playbackController} from "@js/features/playback";
import {DesktopLyricsButtonController} from "@ui/widgets/player/DesktopLyricsButtonController";
import {PlayerCoverInteractionController} from "@ui/widgets/player/PlayerCoverInteractionController";
import {MiniModePlayerView} from "@ui/widgets/player/MiniModePlayerView";
import {PlayerCoverArtController} from "@ui/widgets/player/PlayerCoverArtController";
import {PlayerPlaybackController} from "@ui/widgets/player/PlayerPlaybackController";
import {PlayerProgressController} from "@ui/widgets/player/PlayerProgressController";
import {PlayerVolumeController} from "@ui/widgets/player/PlayerVolumeController";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";

interface PlayerUpdateResult {
    status: boolean;
    error?: unknown;
}

class Player extends Component {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isMiniMode: boolean;
    currentTrack: Track | null;

    private playPauseBtn!: HTMLButtonElement;
    private prevBtn!: HTMLButtonElement;
    private nextBtn!: HTMLButtonElement;
    private playModeBtn!: HTMLButtonElement;
    private lyricsBtn!: HTMLButtonElement;
    private playlistBtn!: HTMLButtonElement;
    likeBtn!: HTMLButtonElement;
    private desktopLyricsBtn: HTMLButtonElement | null;
    private miniModeButton: HTMLButtonElement | null;
    private trackCover!: HTMLImageElement;
    private trackCoverContainer!: HTMLElement;
    private trackTitle!: HTMLElement;
    private trackArtist!: HTMLElement;
    private progressBarContainer!: HTMLElement;
    private progressTrack!: HTMLElement;
    private progressFill!: HTMLElement;
    private progressHandle!: HTMLElement;
    private progressTooltip!: HTMLElement;
    private volumeBtn!: HTMLButtonElement;
    private volumeSlider!: HTMLElement;
    private volumeSliderContainer!: HTMLElement;
    private volumeFill!: HTMLElement;
    private volumeHandle!: HTMLElement;
    private playIcon!: HTMLElement;
    private pauseIcon!: HTMLElement;
    private modeSequenceIcon: HTMLElement | null = null;
    private modeShuffleIcon: HTMLElement | null = null;
    private modeRepeatOneIcon: HTMLElement | null = null;
    private volumeHighIcon: HTMLElement | null = null;
    private volumeHalfIcon: HTMLElement | null = null;
    private volumeMuteIcon: HTMLElement | null = null;

    private miniModeView!: MiniModePlayerView;
    private playbackControls!: PlayerPlaybackController;
    private coverInteractionController!: PlayerCoverInteractionController;
    private coverArtController!: PlayerCoverArtController;
    private progressController!: PlayerProgressController;
    private volumeController!: PlayerVolumeController;
    private desktopLyricsButtonController!: DesktopLyricsButtonController;

    constructor() {
        super('#player');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.isMiniMode = false;
        this.currentTrack = null;
        this.miniModeButton = null;
        this.desktopLyricsBtn = null;

        this.setupElements();
        this.setupEventListeners();
        this.updateUI().then(r => {
            if (!r.status) console.error('Player UI初始化失败：', r.error);
        });
    }

    private queryElement<T extends Element>(selector: string): T {
        const element = this.element?.querySelector(selector);
        if (!element) {
            throw new Error(`Player element not found: ${selector}`);
        }

        return element as T;
    }

    setupElements(): void {
        this.playPauseBtn = this.queryElement<HTMLButtonElement>('#play-pause-btn');
        this.prevBtn = this.queryElement<HTMLButtonElement>('#prev-btn');
        this.nextBtn = this.queryElement<HTMLButtonElement>('#next-btn');
        this.playModeBtn = this.queryElement<HTMLButtonElement>('#play-mode-btn');
        this.lyricsBtn = this.queryElement<HTMLButtonElement>('#lyrics-btn');
        this.playlistBtn = this.queryElement<HTMLButtonElement>('#playlist-btn');
        this.likeBtn = this.queryElement<HTMLButtonElement>('#like-btn');
        this.desktopLyricsBtn = this.element?.querySelector<HTMLButtonElement>('#desktop-lyrics-btn') ?? null;
        this.miniModeButton = this.element?.querySelector<HTMLButtonElement>('#mini-mode-btn') ?? null;

        this.trackCover = this.queryElement<HTMLImageElement>('#track-cover');
        this.trackCoverContainer = this.queryElement<HTMLElement>('.track-cover-container');
        this.trackTitle = this.queryElement<HTMLElement>('#track-title');
        this.trackArtist = this.queryElement<HTMLElement>('#track-artist');

        this.progressBarContainer = this.queryElement<HTMLElement>('.progress-bar-container');
        this.progressTrack = this.queryElement<HTMLElement>('.progress-track');
        this.progressFill = this.queryElement<HTMLElement>('#progress-fill');
        this.progressHandle = this.queryElement<HTMLElement>('#progress-handle');
        this.progressTooltip = this.queryElement<HTMLElement>('#progress-tooltip');

        this.volumeBtn = this.queryElement<HTMLButtonElement>('#volume-btn');
        this.volumeSlider = this.queryElement<HTMLElement>('.volume-slider');
        this.volumeSliderContainer = this.queryElement<HTMLElement>('.volume-slider-container');
        this.volumeFill = this.queryElement<HTMLElement>('#volume-fill');
        this.volumeHandle = this.queryElement<HTMLElement>('#volume-handle');

        this.playIcon = this.queryElement<HTMLElement>('.play-icon');
        this.pauseIcon = this.queryElement<HTMLElement>('.pause-icon');

        // Play mode icons
        this.modeSequenceIcon = this.playModeBtn.querySelector<HTMLElement>('.mode-sequence');
        this.modeShuffleIcon = this.playModeBtn.querySelector<HTMLElement>('.mode-shuffle');
        this.modeRepeatOneIcon = this.playModeBtn.querySelector<HTMLElement>('.mode-repeat-one');

        // Volume icons
        this.volumeHighIcon = this.volumeBtn.querySelector<HTMLElement>('.volume-high');
        this.volumeHalfIcon = this.volumeBtn.querySelector<HTMLElement>('.volume-half');
        this.volumeMuteIcon = this.volumeBtn.querySelector<HTMLElement>('.volume-mute');

        this.miniModeView = new MiniModePlayerView({
            rootElement: this.element,
            trackCover: this.trackCover,
            miniModeButton: this.miniModeButton,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            removeDomListener: (element, event, handler) => {
                this.removeEventListenerManaged(element, event, handler);
            }
        });

        this.coverArtController = new PlayerCoverArtController({
            trackCover: this.trackCover,
            getCurrentTrack: () => playbackController.getCurrentTrack(),
            onCoverReady: async () => {
                if (this.isMiniMode) {
                    await this.miniModeView.updateBackground();
                }
            }
        });

        this.progressController = new PlayerProgressController({
            progressBarContainer: this.progressBarContainer,
            progressTrack: this.progressTrack,
            progressFill: this.progressFill,
            progressHandle: this.progressHandle,
            progressTooltip: this.progressTooltip,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            onSeekCommitted: async () => {
                const currentTrack = playbackController.getCurrentTrack();
                if (currentTrack && currentTrack !== this.currentTrack) {
                    await this.updateTrackInfo(currentTrack);
                }
            }
        });

        this.volumeController = new PlayerVolumeController({
            volumeBtn: this.volumeBtn,
            volumeSlider: this.volumeSlider,
            volumeSliderContainer: this.volumeSliderContainer,
            volumeFill: this.volumeFill,
            volumeHandle: this.volumeHandle,
            volumeHighIcon: this.volumeHighIcon,
            volumeHalfIcon: this.volumeHalfIcon,
            volumeMuteIcon: this.volumeMuteIcon,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            }
        });

        this.playbackControls = new PlayerPlaybackController({
            playPauseBtn: this.playPauseBtn,
            prevBtn: this.prevBtn,
            nextBtn: this.nextBtn,
            playModeBtn: this.playModeBtn,
            playIcon: this.playIcon,
            pauseIcon: this.pauseIcon,
            modeSequenceIcon: this.modeSequenceIcon,
            modeShuffleIcon: this.modeShuffleIcon,
            modeRepeatOneIcon: this.modeRepeatOneIcon,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            isProgressDragging: () => this.progressController.isDragging(),
            onDurationChanged: (duration) => {
                this.duration = duration;
                this.progressController.setDuration(duration);
            },
            onPositionChanged: (position) => {
                this.currentTime = position;
                this.progressController.setPosition(position);
            },
            onPlaybackStateChanged: (isPlaying) => {
                this.isPlaying = isPlaying;
            },
            onVolumeChanged: (volume) => {
                this.volumeController.setVolume(volume);
            },
            onTrackChanged: async (track) => {
                await this.updateTrackInfo(track);
            },
            onTrackIndexChanged: (index) => {
                this.emit('trackIndexChanged', index);
            }
        });

        this.coverInteractionController = new PlayerCoverInteractionController({
            trackCoverContainer: this.trackCoverContainer,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            removeDomListener: (element, event, handler) => {
                this.removeEventListenerManaged(element, event, handler);
            },
            isMiniMode: () => this.isMiniMode,
            onOpenLyrics: () => {
                this.emit('toggleLyrics');
            },
            onToggleMiniMode: async () => {
                await this.toggleMiniMode();
            }
        });

        this.desktopLyricsButtonController = new DesktopLyricsButtonController({
            button: this.desktopLyricsBtn,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            }
        });
    }

    setupEventListeners(): void {
        this.playbackControls.bind();
        this.progressController.bind();
        this.volumeController.bind();
        this.addEventListenerManaged(this.lyricsBtn, 'click', () => {
            this.emit('toggleLyrics');
        });
        this.addEventListenerManaged(this.playlistBtn, 'click', () => {
            this.emit('togglePlaylist');
        });

        this.coverInteractionController.bind();
        this.desktopLyricsButtonController.bind();

        // 迷你模式按钮
        if (this.miniModeButton) {
            this.addEventListenerManaged(this.miniModeButton, 'click', async () => {
                await this.toggleMiniMode();
            });
        }

        this.coverArtController.start();
    }

    async updateTrackInfo(track: Track | null): Promise<void> {
        this.currentTrack = track;

        if (track) {
            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';
            this.duration = track.duration || 0;
            this.progressController.setDuration(this.duration);

            // 在迷你模式下，立即清理旧状态
            if (this.isMiniMode) {
                this.miniModeView.clearLyrics();
            }

            // 并行加载封面和歌词
            if (this.isMiniMode) {
                await Promise.all([
                    this.coverArtController.updateTrackCover(track),
                    this.miniModeView.loadTrackLyrics(track, this.currentTime)
                ]);
            } else {
                await this.coverArtController.updateTrackCover(track);
            }
        }
    }

    updatePlayButton(): void {
        this.playbackControls.updatePlayButton(this.isPlaying);
    }

    updateProgressDisplay(): void {
        this.progressController.updateDisplay();
    }

    updateVolumeDisplay(): void {
        this.volumeController.updateDisplay();
    }

    updateVolumeIcon(): void {
        this.volumeController.updateDisplay();
    }

    getVolume(): number {
        return this.playbackControls.getVolume();
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.playbackControls.updatePlayModeDisplay(mode);
    }

    async updateUI(): Promise<PlayerUpdateResult> {
        try {
            const state = this.playbackControls.syncInitialState();
            this.currentTime = state.position;
            this.duration = state.duration;
            this.progressController.setDuration(state.duration);
            this.progressController.setPosition(state.position);
            this.volumeController.setVolume(state.volume);
            await this.desktopLyricsButtonController.initialize();
            await this.restoreMiniModeState();
            return {
                status: true
            }
        } catch (error) {
            return {
                status: false,
                error: error
            }
        }
    }

    async toggleMiniMode(): Promise<void> {
        try {
            this.isMiniMode = !this.isMiniMode;
            if (this.isMiniMode) {
                await this.enterMiniMode();
            } else {
                await this.exitMiniMode();
            }

            miniModeWindowService.setPersistedMiniModeEnabled(this.isMiniMode);
        } catch (error) {
            console.error('❌ Player: 切换迷你模式失败:', error);
            showToast('迷你模式切换失败', 'error');
        }
    }

    async enterMiniMode(): Promise<void> {
        await miniModeWindowService.enterMiniMode();

        this.coverInteractionController.disableStandardInteractions();
        await this.miniModeView.enter(playbackController.getCurrentTrack(), this.currentTime);
    }

    async exitMiniMode(): Promise<void> {
        this.miniModeView.beginExit();
        await miniModeWindowService.exitMiniMode();

        this.coverInteractionController.enableStandardInteractions();
        this.miniModeView.completeExit();
    }

    async restoreMiniModeState(): Promise<void> {
        if (miniModeWindowService.getPersistedMiniModeEnabled()) {
            this.isMiniMode = false;
            await this.toggleMiniMode();
        }
    }

    async togglePlayPause(): Promise<void> {
        await this.playbackControls.togglePlayPause();
    }

    async updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void> {
        await this.desktopLyricsButtonController.updateVisibility(enabled);
    }

    destroy(): void {
        if (this.isMiniMode) {
            this.miniModeView.destroy();
        }

        miniModeWindowService.stopResizeGuard();

        this.playbackControls.destroy();
        this.coverInteractionController.destroy();
        this.coverArtController.destroy();

        // 重置播放状态
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.currentTrack = null;
        this.progressController.reset();
        this.volumeController.reset();
        super.destroy();
    }
}

export {Player};
