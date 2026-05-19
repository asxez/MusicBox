// 播放器组件

import {showToast} from "@js/utils";
import {Component} from "@ui/base/Component";
import {miniModeWindowService} from "@js/features/appShell/service";
import {playbackController} from "@js/features/playback";
import {DesktopLyricsButtonController} from "@ui/widgets/player/DesktopLyricsButtonController";
import {MiniModePlayerView} from "@ui/widgets/player/MiniModePlayerView";
import {PlayerCoverArtController} from "@ui/widgets/player/PlayerCoverArtController";
import {PlayerProgressController} from "@ui/widgets/player/PlayerProgressController";
import {PlayerVolumeController} from "@ui/widgets/player/PlayerVolumeController";
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@js/features/playback";
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

    private coverClickHandler!: EventListener;
    private coverDblClickHandler!: EventListener;
    private coverMouseEnterHandler!: EventListener;
    private coverMouseLeaveHandler!: EventListener;
    private playbackStateUnsubscribe: Unsubscribe | null = null;
    private miniModeView!: MiniModePlayerView;
    private coverArtController!: PlayerCoverArtController;
    private progressController!: PlayerProgressController;
    private volumeController!: PlayerVolumeController;
    private desktopLyricsButtonController!: DesktopLyricsButtonController;

    private _updateLock: boolean;
    private _pendingTrack: Track | null;
    private _toggleInProgress: boolean;

    constructor() {
        super('#player');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.isMiniMode = false;
        this.currentTrack = null;
        this.miniModeButton = null;
        this.desktopLyricsBtn = null;
        this.playbackStateUnsubscribe = null;

        this._updateLock = false;
        this._pendingTrack = null;
        this._toggleInProgress = false;

        this.setupElements();
        this.setupEventListeners();
        this.setupAPIListeners();
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

        this.desktopLyricsButtonController = new DesktopLyricsButtonController({
            button: this.desktopLyricsBtn,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            }
        });
    }

    setupEventListeners(): void {
        // Play/pause button
        this.addEventListenerManaged(this.playPauseBtn, 'click', async () => {
            await this.togglePlayPause();
        });

        // Previous/next buttons
        this.addEventListenerManaged(this.prevBtn, 'click', async () => {
            await playbackController.previousTrack();
        });

        this.addEventListenerManaged(this.nextBtn, 'click', async () => {
            await playbackController.nextTrack();
        });

        this.progressController.bind();
        this.volumeController.bind();
        this.addEventListenerManaged(this.playModeBtn, 'click', () => {
            const newMode = playbackController.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });
        this.addEventListenerManaged(this.lyricsBtn, 'click', () => {
            this.emit('toggleLyrics');
        });
        this.addEventListenerManaged(this.playlistBtn, 'click', () => {
            this.emit('togglePlaylist');
        });

        // 点击封面也打开歌词页
        this.coverClickHandler = () => {
            this.emit('toggleLyrics');
        };
        this.addEventListenerManaged(this.trackCoverContainer, 'click', this.coverClickHandler);

        // 双击封面切换迷你模式
        this.coverDblClickHandler = async () => {
            if (this.isMiniMode) {
                await this.toggleMiniMode();
            }
        };
        this.addEventListenerManaged(this.trackCoverContainer, 'dblclick', this.coverDblClickHandler);

        // 封面悬浮效果
        this.coverMouseEnterHandler = () => {
            this.trackCoverContainer.classList.add('hover');
        };
        this.addEventListenerManaged(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);

        this.coverMouseLeaveHandler = () => {
            this.trackCoverContainer.classList.remove('hover');
        };
        this.addEventListenerManaged(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);

        this.desktopLyricsButtonController.bind();

        // 迷你模式按钮
        if (this.miniModeButton) {
            this.addEventListenerManaged(this.miniModeButton, 'click', async () => {
                await this.toggleMiniMode();
            });
        }

        this.coverArtController.start();
    }

    setupAPIListeners(): void {
        // 0.2.5版本 改进更新机制
        // 记录待更新的track，避免丢失更新
        this._updateLock = false;
        this._pendingTrack = null;

        this.playbackStateUnsubscribe = playbackController.subscribe((state, change) => {
            return this.handlePlaybackStateChange(state, change);
        });
    }

    private async handlePlaybackStateChange(
        state: Readonly<PlaybackState>,
        change: PlaybackStoreChange
    ): Promise<void> {
        switch (change.type) {
            case 'durationChanged':
                this.duration = state.duration;
                this.progressController.setDuration(state.duration);
                break;

            case 'positionChanged':
                if (!this.progressController.isDragging()) {
                    this.currentTime = state.position;
                    this.progressController.setPosition(state.position);
                }
                break;

            case 'playbackStateChanged':
                this.isPlaying = state.isPlaying;
                this.updatePlayButton();
                break;

            case 'volumeChanged':
                this.volumeController.setVolume(state.volume);
                break;

            case 'trackChanged':
                await this.handlePlaybackTrackChanged(state.currentTrack);
                break;

            case 'trackIndexChanged':
                this.emit('trackIndexChanged', state.currentIndex);
                break;

            case 'playModeChanged':
                this.updatePlayModeDisplay(state.playMode);
                break;
        }
    }

    private async handlePlaybackTrackChanged(track: Track | null): Promise<void> {
        // 如果正在更新，记录新的track待后续处理
        if (this._updateLock) {
            this._pendingTrack = track;
            return;
        }

        this._updateLock = true;
        try {
            await this.updateTrackInfo(track);

            // 检查是否有待处理的track
            while (this._pendingTrack) {
                const nextTrack = this._pendingTrack;
                this._pendingTrack = null;
                await this.updateTrackInfo(nextTrack);
            }
        } finally {
            this._updateLock = false;
        }
    }

    private removePlaybackStateSubscription(): void {
        if (!this.playbackStateUnsubscribe) {
            return;
        }

        try {
            this.playbackStateUnsubscribe();
        } catch (error) {
            console.warn('⚠️ Player: 移除 playback state 订阅失败:', error);
        }
        this.playbackStateUnsubscribe = null;
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
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
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
        return playbackController.getVolume();
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        if (this.modeSequenceIcon) this.modeSequenceIcon.style.display = 'none';
        if (this.modeShuffleIcon) this.modeShuffleIcon.style.display = 'none';
        if (this.modeRepeatOneIcon) this.modeRepeatOneIcon.style.display = 'none';
        switch (mode) {
            case 'sequence':
                if (this.modeSequenceIcon) this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                if (this.modeShuffleIcon) this.modeShuffleIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                if (this.modeRepeatOneIcon) this.modeRepeatOneIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '单曲循环';
                break;
            default:
                // 默认显示顺序播放
                if (this.modeSequenceIcon) this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
        }
    }

    async updateUI(): Promise<PlayerUpdateResult> {
        try {
            this.updatePlayButton();
            const state = playbackController.getState();
            this.currentTime = state.position;
            this.duration = state.duration;
            this.progressController.setDuration(state.duration);
            this.progressController.setPosition(state.position);
            this.volumeController.setVolume(state.volume);
            this.updatePlayModeDisplay(playbackController.getPlayMode());
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

        // 移除封面的普通事件（保留双击事件用于退出迷你模式）
        this.removeEventListenerManaged(this.trackCoverContainer, 'click', this.coverClickHandler);
        this.removeEventListenerManaged(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);
        this.removeEventListenerManaged(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);

        await this.miniModeView.enter(playbackController.getCurrentTrack(), this.currentTime);
    }

    async exitMiniMode(): Promise<void> {
        this.miniModeView.beginExit();
        await miniModeWindowService.exitMiniMode();

        // 恢复封面事件
        this.addEventListenerManaged(this.trackCoverContainer, 'click', this.coverClickHandler);
        this.addEventListenerManaged(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);
        this.addEventListenerManaged(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);

        this.miniModeView.completeExit();
    }

    async restoreMiniModeState(): Promise<void> {
        if (miniModeWindowService.getPersistedMiniModeEnabled()) {
            this.isMiniMode = false;
            await this.toggleMiniMode();
        }
    }

    async togglePlayPause(): Promise<void> {
        // 防止重复调用的锁定机制
        if (this._toggleInProgress) {
            console.log('🚫 Player: 播放状态切换正在进行中，忽略重复调用');
            return;
        }

        this._toggleInProgress = true;
        console.log('🔄 Player: 切换播放状态，当前状态:', this.isPlaying);

        try {
            if (this.isPlaying) {
                console.log('🔄 Player: 请求暂停');
                const result = await playbackController.pause();
                if (!result) {
                    console.error('❌ Player: 暂停失败');
                }
            } else {
                console.log('🔄 Player: 请求播放');
                const result = await playbackController.play();
                if (!result) {
                    console.error('❌ Player: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Player: 切换播放状态失败:', error);
        } finally {
            // 延迟释放锁，确保状态更新完成
            setTimeout(() => {
                this._toggleInProgress = false;
            }, 100);
        }
    }

    async updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void> {
        await this.desktopLyricsButtonController.updateVisibility(enabled);
    }

    destroy(): void {
        if (this.isMiniMode) {
            this.miniModeView.destroy();
        }

        miniModeWindowService.stopResizeGuard();

        this.coverArtController.destroy();

        // 重置播放状态
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.currentTrack = null;
        this.progressController.reset();
        this.volumeController.reset();
        this.removePlaybackStateSubscription();
        super.destroy();
    }
}

export {Player};
