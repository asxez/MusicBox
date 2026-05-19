// 播放器组件

import {formatTime, showToast} from "@js/utils";
import {cacheManager} from "@js/shared/cache";
import {Component} from "@ui/base/Component";
import {miniModeWindowService} from "@js/features/appShell/service";
import {desktopLyricsController} from "@js/features/desktopLyrics";
import {playbackController} from "@js/features/playback";
import {MiniModePlayerView} from "@ui/widgets/player/MiniModePlayerView";
import {PlayerCoverArtController} from "@ui/widgets/player/PlayerCoverArtController";
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@js/features/playback";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";

interface PlayerUpdateResult {
    status: boolean;
    error?: unknown;
}

interface MusicBoxSettingsCache {
    desktopLyrics?: boolean;
}

class Player extends Component {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    previousVolume: number;
    isDraggingProgress: boolean;
    isDraggingVolume: boolean;
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

    private _updateLock: boolean;
    private _pendingTrack: Track | null;
    private _toggleInProgress: boolean;

    constructor() {
        super('#player');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.previousVolume = 0.7;
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;
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

        // Progress bar - improved interaction
        this.addEventListenerManaged(this.progressBarContainer, 'mousedown', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            this.isDraggingProgress = true;
            this.progressBarContainer.classList.add('dragging');
            this.updateProgress(mouseEvent);
            mouseEvent.preventDefault();
        });

        // Show tooltip on hover
        this.addEventListenerManaged(this.progressBarContainer, 'mousemove', (e: Event) => {
            if (!this.isDraggingProgress) {
                this.updateProgressTooltip(e as MouseEvent);
            }
        });

        this.addEventListenerManaged(this.progressBarContainer, 'mouseleave', () => {
            if (!this.isDraggingProgress) {
                this.progressTooltip.style.opacity = '0';
            }
        });

        this.addEventListenerManaged(document, 'mousemove', (e: Event) => {
            if (this.isDraggingProgress) {
                this.updateProgress(e as MouseEvent);
            }
        });

        this.addEventListenerManaged(document, 'mouseup', async () => {
            if (this.isDraggingProgress) {
                this.isDraggingProgress = false;
                this.progressBarContainer.classList.remove('dragging');
                this.progressTooltip.style.opacity = '0';
                const progress = parseFloat(this.progressFill.style.width) / 100;
                await playbackController.seek(this.duration * progress);

                // 拖动结束后，强制同步当前播放状态
                const currentTrack = playbackController.getCurrentTrack();
                if (currentTrack && currentTrack !== this.currentTrack) {
                    await this.updateTrackInfo(currentTrack);
                }
            }
        });

        // Volume slider
        this.addEventListenerManaged(this.volumeSlider, 'mousedown', async (e: Event) => {
            this.isDraggingVolume = true;
            this.updateVolume(e as MouseEvent);
            const volume = parseFloat(this.volumeFill.style.width) / 100;
            await playbackController.setVolume(volume);
        });

        this.addEventListenerManaged(this.volumeSlider, 'input', async (e: Event) => {
            this.updateVolume((e.target as HTMLInputElement).value);
            const volume = parseFloat(this.volumeFill.style.width) / 100;
            await playbackController.setVolume(volume);
        });

        this.addEventListenerManaged(this.volumeSliderContainer, 'mousewheel', async (e: Event) => {
            const wheelEvent = e as WheelEvent & {wheelDelta?: number};
            if ((wheelEvent.wheelDelta ?? -wheelEvent.deltaY) < 0) await playbackController.adjustVolume(0.01);
            else await playbackController.adjustVolume(-0.01);
        });

        this.addEventListenerManaged(document, 'mousemove', async (e: Event) => {
            if (this.isDraggingVolume) {
                this.updateVolume(e as MouseEvent);
                const volume = parseFloat(this.volumeFill.style.width) / 100;
                await playbackController.setVolume(volume);
            }
        });

        this.addEventListenerManaged(document, 'mouseup', async () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
                const volume = parseFloat(this.volumeFill.style.width) / 100;
                await playbackController.setVolume(volume);
            }
        });

        this.addEventListenerManaged(this.volumeBtn, 'click', async () => {
            await this.toggleMute();
        });
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

        // 桌面歌词按钮事件
        if (this.desktopLyricsBtn) {
            this.addEventListenerManaged(this.desktopLyricsBtn, 'click', async () => {
                await this.toggleDesktopLyrics();
            });
        }

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
                this.updateProgressDisplay();
                break;

            case 'positionChanged':
                if (!this.isDraggingProgress) {
                    this.currentTime = state.position;
                    this.updateProgressDisplay();
                }
                break;

            case 'playbackStateChanged':
                this.isPlaying = state.isPlaying;
                this.updatePlayButton();
                break;

            case 'volumeChanged':
                this.volume = state.volume;
                this.updateVolumeDisplay();
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

    updateProgress(e: MouseEvent): void {
        const rect = this.progressTrack.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.progressFill.style.width = `${progress * 100}%`;
        this.progressHandle.style.left = `${progress * 100}%`;

        // 更新进度条位置和内容
        const time = this.duration * progress;
        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    updateProgressTooltip(e: MouseEvent): void {
        const rect = this.progressTrack.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = this.duration * progress;

        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    updateVolume(e: MouseEvent | string | number): void {
        let volume: number;
        if (typeof e === 'string' || typeof e === 'number') {
            volume = Math.max(0, Math.min(1, Number(e)));
        } else {
            const rect = this.volumeSlider.getBoundingClientRect();
            volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        }
        this.volumeFill.style.width = `${volume * 100}%`;
        this.volumeHandle.style.left = `${volume * 100}%`;
    }

    async updateTrackInfo(track: Track | null): Promise<void> {
        if (track) {
            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';
            this.duration = track.duration || 0;

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
        if (!this.isDraggingProgress) {
            const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
            this.progressFill.style.width = `${progress}%`;
            this.progressHandle.style.left = `${progress}%`;
        }
    }

    updateVolumeDisplay(): void {
        const volumePercent = this.volume * 100;
        this.volumeFill.style.width = `${volumePercent}%`;
        this.volumeHandle.style.left = `${volumePercent}%`;
        this.updateVolumeIcon();
    }

    updateVolumeIcon(): void {
        if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';

        if (this.volume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.volume <= 0.5) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'block';
        }
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
            this.updateProgressDisplay();
            this.updateVolumeDisplay();
            this.updatePlayModeDisplay(playbackController.getPlayMode());
            await this.initDesktopLyricsButton();
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

    async toggleMute(): Promise<void> {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            await playbackController.setVolume(0);
        } else {
            await playbackController.setVolume(this.previousVolume || 0.7);
        }
    }

    // 桌面歌词控制方法
    async toggleDesktopLyrics(): Promise<void> {
        try {
            const result = await desktopLyricsController.toggle();

            if (result.success) {
                this.updateDesktopLyricsButton(result.visible);

                if (result.visible) {
                    showToast('桌面歌词已显示', 'success');
                } else {
                    showToast('桌面歌词已隐藏', 'info');
                }
            } else {
                showToast('桌面歌词操作失败', 'error');
            }
        } catch (error) {
            showToast('桌面歌词操作异常', 'error');
        }
    }

    updateDesktopLyricsButton(isVisible: boolean | undefined): void {
        if (!this.desktopLyricsBtn) return;
        if (isVisible) {
            this.desktopLyricsBtn.classList.add('active');
        } else {
            this.desktopLyricsBtn.classList.remove('active');
        }
    }

    async updateDesktopLyricsButtonVisibility(enabled: boolean): Promise<void> {
        if (!this.desktopLyricsBtn) {
            return;
        }

        // 根据设置显示或隐藏按钮
        if (enabled) {
            // 启用时显示按钮并启用功能
            this.desktopLyricsBtn.style.display = '';
            this.desktopLyricsBtn.disabled = false;

            // 如果启用，检查当前桌面歌词窗口状态
            await this.checkDesktopLyricsWindowState();
        } else {
            // 禁用时隐藏按钮并禁用功能
            this.desktopLyricsBtn.style.display = 'none';
            this.desktopLyricsBtn.disabled = true;
        }
    }

    // 检查桌面歌词窗口状态的独立方法
    async checkDesktopLyricsWindowState(): Promise<void> {
        try {
            const isVisible = await desktopLyricsController.isVisible();
            this.updateDesktopLyricsButton(isVisible);
        } catch (error) {
            console.error('❌ Player: 检查桌面歌词窗口状态失败:', error);
        }
    }

    // 初始化桌面歌词按钮状态
    async initDesktopLyricsButton(): Promise<void> {
        if (!this.desktopLyricsBtn) return;

        try {
            // 检查设置中是否启用了桌面歌词功能
            const settings = cacheManager.getLocalCache<MusicBoxSettingsCache>('musicbox-settings') || {};
            // 如果设置中没有明确的值，默认启用；如果有明确的值，使用该值
            const desktopLyricsEnabled = Object.prototype.hasOwnProperty.call(settings, 'desktopLyrics') ? settings.desktopLyrics === true : true;

            console.log('🎵 Player: 初始化桌面歌词按钮，设置状态:', desktopLyricsEnabled, '(来源: CacheManager)');

            // 首先设置按钮的显示/隐藏状态
            await this.updateDesktopLyricsButtonVisibility(desktopLyricsEnabled);

            // 如果功能启用，检查桌面歌词窗口的当前状态
            if (desktopLyricsEnabled) {
                const isVisible = await desktopLyricsController.isVisible();
                this.updateDesktopLyricsButton(isVisible);
            }
        } catch (error) {
            console.error('❌ Player: 初始化桌面歌词按钮状态失败:', error);
        }
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
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;
        this.removePlaybackStateSubscription();
        super.destroy();
    }
}

export {Player};
