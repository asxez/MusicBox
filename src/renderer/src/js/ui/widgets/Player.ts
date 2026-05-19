// 播放器组件

import {Component} from "@ui/base/Component";
import {playbackUiStateService} from "@js/features/playback/service/PlaybackUiStateService";
import {DesktopLyricsButtonController} from "@ui/widgets/player/DesktopLyricsButtonController";
import {PlayerCoverInteractionController} from "@ui/widgets/player/PlayerCoverInteractionController";
import {resolvePlayerElements} from "@ui/widgets/player/PlayerElementRegistry";
import {MiniModePlayerView} from "@ui/widgets/player/MiniModePlayerView";
import {PlayerCoverArtController} from "@ui/widgets/player/PlayerCoverArtController";
import {PlayerMiniModeController} from "@ui/widgets/player/PlayerMiniModeController";
import {PlayerPlaybackController} from "@ui/widgets/player/PlayerPlaybackController";
import {PlayerProgressController} from "@ui/widgets/player/PlayerProgressController";
import {PlayerTrackInfoController} from "@ui/widgets/player/PlayerTrackInfoController";
import {PlayerVolumeController} from "@ui/widgets/player/PlayerVolumeController";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";
import type {PlayerElements} from "@ui/widgets/player/PlayerElementRegistry";

interface PlayerUpdateResult {
    status: boolean;
    error?: unknown;
}

class Player extends Component {
    isPlaying: boolean;
    currentTime: number;
    duration: number;

    likeBtn!: HTMLButtonElement;

    private readonly elements: PlayerElements;
    private miniModeController!: PlayerMiniModeController;
    private playbackControls!: PlayerPlaybackController;
    private coverInteractionController!: PlayerCoverInteractionController;
    private coverArtController!: PlayerCoverArtController;
    private trackInfoController!: PlayerTrackInfoController;
    private progressController!: PlayerProgressController;
    private volumeController!: PlayerVolumeController;
    private desktopLyricsButtonController!: DesktopLyricsButtonController;

    constructor() {
        super('#player');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.elements = resolvePlayerElements(this.element);
        this.likeBtn = this.elements.actions.likeBtn;

        this.setupElements();
        this.setupEventListeners();
        this.updateUI().then(r => {
            if (!r.status) console.error('Player UI初始化失败：', r.error);
        });
    }

    setupElements(): void {
        const {actions, controls, progress, track, volume} = this.elements;
        const miniModeView = new MiniModePlayerView({
            rootElement: this.element,
            trackCover: track.cover,
            miniModeButton: actions.miniModeButton,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            removeDomListener: (element, event, handler) => {
                this.removeEventListenerManaged(element, event, handler);
            }
        });

        this.coverArtController = new PlayerCoverArtController({
            trackCover: track.cover,
            getCurrentTrack: () => playbackUiStateService.getCurrentTrack(),
            onCoverReady: async () => {
                await this.miniModeController.updateBackground();
            }
        });

        this.progressController = new PlayerProgressController({
            progressBarContainer: progress.barContainer,
            progressTrack: progress.track,
            progressFill: progress.fill,
            progressHandle: progress.handle,
            progressTooltip: progress.tooltip,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            onSeekCommitted: async () => {
                const currentTrack = playbackUiStateService.getCurrentTrack();
                if (currentTrack && currentTrack !== this.trackInfoController.getCurrentTrack()) {
                    await this.updateTrackInfo(currentTrack);
                }
            }
        });

        this.volumeController = new PlayerVolumeController({
            volumeBtn: volume.button,
            volumeSlider: volume.slider,
            volumeSliderContainer: volume.sliderContainer,
            volumeFill: volume.fill,
            volumeHandle: volume.handle,
            volumeHighIcon: volume.highIcon,
            volumeHalfIcon: volume.halfIcon,
            volumeMuteIcon: volume.muteIcon,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            }
        });

        this.playbackControls = new PlayerPlaybackController({
            playPauseBtn: controls.playPauseBtn,
            prevBtn: controls.prevBtn,
            nextBtn: controls.nextBtn,
            playModeBtn: controls.playModeBtn,
            playIcon: controls.playIcon,
            pauseIcon: controls.pauseIcon,
            modeSequenceIcon: controls.modeSequenceIcon,
            modeShuffleIcon: controls.modeShuffleIcon,
            modeRepeatOneIcon: controls.modeRepeatOneIcon,
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
            trackCoverContainer: track.coverContainer,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            removeDomListener: (element, event, handler) => {
                this.removeEventListenerManaged(element, event, handler);
            },
            isMiniMode: () => this.miniModeController.isActive(),
            onOpenLyrics: () => {
                this.emit('toggleLyrics');
            },
            onToggleMiniMode: async () => {
                await this.toggleMiniMode();
            }
        });

        this.miniModeController = new PlayerMiniModeController({
            miniModeView,
            coverInteractionController: this.coverInteractionController,
            getCurrentTime: () => this.currentTime
        });

        this.trackInfoController = new PlayerTrackInfoController({
            trackTitle: track.title,
            trackArtist: track.artist,
            coverArtController: this.coverArtController,
            setDuration: (duration) => {
                this.duration = duration;
                this.progressController.setDuration(duration);
            },
            getCurrentTime: () => this.currentTime,
            isMiniModeActive: () => this.miniModeController.isActive(),
            clearMiniModeLyrics: () => {
                this.miniModeController.clearLyrics();
            },
            loadMiniModeTrackLyrics: async (track, currentTime) => {
                await this.miniModeController.loadTrackLyrics(track, currentTime);
            }
        });

        this.desktopLyricsButtonController = new DesktopLyricsButtonController({
            button: actions.desktopLyricsBtn,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            }
        });
    }

    setupEventListeners(): void {
        this.playbackControls.bind();
        this.progressController.bind();
        this.volumeController.bind();
        this.addEventListenerManaged(this.elements.actions.lyricsBtn, 'click', () => {
            this.emit('toggleLyrics');
        });
        this.addEventListenerManaged(this.elements.actions.playlistBtn, 'click', () => {
            this.emit('togglePlaylist');
        });

        this.coverInteractionController.bind();
        this.desktopLyricsButtonController.bind();

        // 迷你模式按钮
        if (this.elements.actions.miniModeButton) {
            this.addEventListenerManaged(this.elements.actions.miniModeButton, 'click', async () => {
                await this.toggleMiniMode();
            });
        }

        this.coverArtController.start();
    }

    async updateTrackInfo(track: Track | null): Promise<void> {
        await this.trackInfoController.updateTrackInfo(track);
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
        await this.miniModeController.toggle();
    }

    async enterMiniMode(): Promise<void> {
        await this.miniModeController.enter();
    }

    async exitMiniMode(): Promise<void> {
        await this.miniModeController.exit();
    }

    async restoreMiniModeState(): Promise<void> {
        await this.miniModeController.restore();
    }

    async togglePlayPause(): Promise<void> {
        await this.playbackControls.togglePlayPause();
    }

    async updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void> {
        await this.desktopLyricsButtonController.updateVisibility(enabled);
    }

    destroy(): void {
        this.miniModeController.destroy();
        this.playbackControls.destroy();
        this.coverInteractionController.destroy();
        this.coverArtController.destroy();
        this.trackInfoController.reset();

        // 重置播放状态
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.progressController.reset();
        this.volumeController.reset();
        super.destroy();
    }
}

export {Player};
