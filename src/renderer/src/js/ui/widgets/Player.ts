// 播放器组件

import {formatTime, showToast} from "@js/utils";
import {cacheManager} from "@services/CacheManager";
import {coverUpdateManager} from "@services/cover/CoverUpdateManager";
import {urlValidator} from "@utils/URLValidator";
import {Component} from "@ui/base/Component";
import {coverAPI, windowAPI, lyricsAPI} from "@api/modules";
import {desktopLyricsController} from "@js/features/desktopLyrics";
import {playbackController} from "@js/features/playback";
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@js/features/playback";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";
import type {LyricLine} from "@api/types/lyrics";

interface MiniModeLyricWord {
    text: string;
    time: number;
    endTime?: number | null;
}

interface MiniModeLyricLine extends LyricLine {
    endTime?: number | null;
    words?: MiniModeLyricWord[];
}

interface CoverUpdatePayload {
    filePath?: string;
    title?: string;
    artist?: string;
    type?: string;
}

interface PlayerUpdateResult {
    status: boolean;
    error?: unknown;
}

interface MusicBoxSettingsCache {
    desktopLyrics?: boolean;
}

interface WindowSizeCache {
    width?: number;
    height?: number;
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
    private coverUpdateUnsubscribe: (() => void) | null = null;
    private miniModeMouseEnterHandler: EventListener | null = null;
    private miniModeMouseLeaveHandler: EventListener | null = null;
    private miniModeAppContainer: Element | null = null;
    private miniModePositionChangeHandler: ((position: number) => void) | null;
    private miniModePositionUnsubscribe: Unsubscribe | null = null;
    private miniModeResizeHandler: (() => void) | null = null;
    private miniModeResizeGuardTimer: ReturnType<typeof setTimeout> | null = null;
    private playbackStateUnsubscribe: Unsubscribe | null = null;

    private _miniModeLyricsRafId: number | null;
    private _miniModeLyricsLastUpdateTime: number;
    private _miniModeLyricsUpdateInterval: number;
    private _miniModeCurrentLyricIndex: number;
    private _miniModeLyrics: MiniModeLyricLine[];
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

        // 迷你模式歌词相关
        this._miniModeLyricsRafId = null;
        this._miniModeLyricsLastUpdateTime = 0;
        this._miniModeLyricsUpdateInterval = 16;
        this.miniModePositionChangeHandler = null;
        this._miniModeCurrentLyricIndex = -1;
        this._miniModeLyrics = []; // 迷你模式的独立歌词数据
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

        // 监听封面更新事件
        this.coverUpdateUnsubscribe = coverUpdateManager.onCoverUpdate((data: unknown) => {
            void this.handleCoverUpdate(data as CoverUpdatePayload);
        });
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
                this._miniModeLyrics = [];
                this._miniModeCurrentLyricIndex = -1;
                this.showNoMiniModeLyrics();
            }

            // 并行加载封面和歌词
            if (this.isMiniMode) {
                await Promise.all([
                    this.updateCoverArt(track),
                    this.loadMiniModeLyrics(track)
                ]);
            } else {
                await this.updateCoverArt(track);
            }
        }
    }

    async updateCoverArt(track: Track): Promise<void> {
        // 首先设置默认封面
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');

        try {
            // 获取封面
            if (track.title && track.artist) {
                const coverResult = await coverAPI.getCover(track.title, track.artist, track.album, track.filePath, true);
                if (coverResult.success && coverResult.imageUrl) {
                    if (typeof coverResult.imageUrl === 'string') {
                        // 使用安全的图片设置方法
                        if (urlValidator) {
                            const success = await urlValidator.safeSetImageSrc(
                                this.trackCover,
                                coverResult.imageUrl
                            );

                            if (success) {
                                track.cover = coverResult.imageUrl;
                            } else {
                                track.cover = null;
                            }
                        } else {
                            this.trackCover.src = coverResult.imageUrl;
                            track.cover = coverResult.imageUrl;
                        }
                    }
                } else {
                    console.log('❌ Player: 封面获取失败，使用默认封面', coverResult.error);
                }
            }
        } catch (error) {
            console.error('❌ Player: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');

            // 迷你模式下，更新背景
            if (this.isMiniMode) {
                await this.updateMiniModeBackground();
            }
        }
    }

    async handleCoverUpdate(data: CoverUpdatePayload): Promise<void> {
        const {filePath, title, artist, type} = data;

        // 只处理封面更新事件
        if (type && type !== 'cover-updated' && type !== 'manual-refresh') {
            return;
        }

        const currentTrack = playbackController.getCurrentTrack();
        if (!currentTrack) {
            return;
        }

        // 检查是否是当前播放的歌曲
        const isCurrentTrack = (
            currentTrack.filePath === filePath ||
            (currentTrack.title === title && currentTrack.artist === artist)
        );

        if (isCurrentTrack) {
            // 清除缓存并重新获取封面
            if (currentTrack.cover) {
                delete currentTrack.cover;
            }

            try {
                await this.updateCoverArt(currentTrack);
            } catch (error) {
                console.error('封面更新失败:', error);
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

            cacheManager.setLocalCache('miniModeEnabled', this.isMiniMode);
        } catch (error) {
            console.error('❌ Player: 切换迷你模式失败:', error);
            showToast('迷你模式切换失败', 'error');
        }
    }

    async enterMiniMode(): Promise<void> {
        // 调整窗口大小
        const currentBounds = await windowAPI.getBounds();
        const result = await windowAPI.setMiniModeWindowState({
            enabled: true,
            x: currentBounds?.x ?? 0,
            y: currentBounds?.y ?? 0
        });
        if (!result.success) {
            throw new Error(result.error || '设置迷你模式窗口状态失败');
        }

        // 添加迷你模式类
        document.body.classList.add('mini-mode');
        this.startMiniModeResizeGuard();

        // 更新按钮状态
        if (this.miniModeButton) {
            this.miniModeButton.classList.add('active');
            this.miniModeButton.title = '退出迷你模式';
        }

        // 移除封面的普通事件（保留双击事件用于退出迷你模式）
        this.removeEventListenerManaged(this.trackCoverContainer, 'click', this.coverClickHandler);
        this.removeEventListenerManaged(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);
        this.removeEventListenerManaged(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);

        // 添加鼠标进入/离开窗口的监听（悬浮展开/收起）
        this.miniModeMouseEnterHandler = () => {
            document.body.classList.remove('mini-mode-collapsed');
        };
        this.miniModeMouseLeaveHandler = () => {
            document.body.classList.add('mini-mode-collapsed');
        };

        // 监听app容器
        const appContainer = document.querySelector('.app');
        if (appContainer) {
            this.addEventListenerManaged(appContainer, 'mouseenter', this.miniModeMouseEnterHandler);
            this.addEventListenerManaged(appContainer, 'mouseleave', this.miniModeMouseLeaveHandler);
            this.miniModeAppContainer = appContainer;
        }

        // 初始状态：收起
        document.body.classList.add('mini-mode-collapsed');

        // 更新迷你模式背景
        await this.updateMiniModeBackground();

        // 加载当前歌曲的歌词
        const currentTrack = playbackController.getCurrentTrack();
        if (currentTrack) {
            await this.loadMiniModeLyrics(currentTrack);
        }

        // 添加播放进度监听，用于更新歌词逐字高亮
        this.miniModePositionChangeHandler = (position) => {
            // 计算当前歌词索引
            this.updateMiniModeLyricIndex(position);
            // 更新逐字高亮
            this.updateMiniModeLyricsWordHighlight(position);
        };
        this.miniModePositionUnsubscribe = playbackController.on('positionChanged', this.miniModePositionChangeHandler);

        // 初始更新歌词显示
        this.updateMiniModeLyrics();
    }

    async exitMiniMode(): Promise<void> {
        this.removeMiniModeLyricsElement();
        this.stopMiniModeResizeGuard();

        // 移除迷你模式类
        document.body.classList.remove('mini-mode');

        // 恢复窗口
        const {width, height} = this.getRestoredMainWindowSize();
        const restoreResult = await windowAPI.setMiniModeWindowState({
            enabled: false,
            width,
            height
        });
        if (!restoreResult.success) {
            throw new Error(restoreResult.error || '恢复主窗口状态失败');
        }

        // 更新按钮状态
        if (this.miniModeButton) {
            this.miniModeButton.classList.remove('active');
            this.miniModeButton.title = '迷你模式';
        }

        // 恢复封面事件
        this.addEventListenerManaged(this.trackCoverContainer, 'click', this.coverClickHandler);
        this.addEventListenerManaged(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);
        this.addEventListenerManaged(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);

        // 移除迷你模式悬浮事件
        if (this.miniModeMouseEnterHandler && this.miniModeMouseLeaveHandler && this.miniModeAppContainer) {
            this.removeEventListenerManaged(this.miniModeAppContainer, 'mouseenter', this.miniModeMouseEnterHandler);
            this.removeEventListenerManaged(this.miniModeAppContainer, 'mouseleave', this.miniModeMouseLeaveHandler);
            this.miniModeMouseEnterHandler = null;
            this.miniModeMouseLeaveHandler = null;
            this.miniModeAppContainer = null;
        }

        // 移除播放进度监听
        if (this.miniModePositionUnsubscribe) {
            this.miniModePositionUnsubscribe();
            this.miniModePositionUnsubscribe = null;
            this.miniModePositionChangeHandler = null;
        }

        // 取消RAF请求
        if (this._miniModeLyricsRafId) {
            cancelAnimationFrame(this._miniModeLyricsRafId);
            this._miniModeLyricsRafId = null;
        }

        // 重置状态
        this._miniModeCurrentLyricIndex = -1;
        this._miniModeLyrics = []; // 清空歌词数据

        // 移除迷你模式歌词元素
        this.removeMiniModeLyricsElement();

        // 移除collapsed类
        document.body.classList.remove('mini-mode-collapsed');

        // 清除迷你模式背景
        this.clearMiniModeBackground();
    }

    async restoreMiniModeState(): Promise<void> {
        const savedState = cacheManager.getLocalCache('miniModeEnabled');
        if (savedState === true) {
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

    // 迷你模式：提取封面主色
    async extractDominantColor(imgElement: HTMLImageElement): Promise<string> {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve('60, 80, 120');
                    return;
                }

                canvas.width = imgElement.naturalWidth || imgElement.width;
                canvas.height = imgElement.naturalHeight || imgElement.height;

                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

                // 获取图像数据
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 简单的颜色统计算法：取平均色
                let r = 0, g = 0, b = 0, count = 0;

                // 采样：每隔10个像素采样一次以提高性能
                for (let i = 0; i < data.length; i += 40) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // 调整亮度，使背景更柔和
                const brightness = (r + g + b) / 3;
                if (brightness > 200) {
                    // 如果太亮，降低亮度
                    r = Math.round(r * 0.6);
                    g = Math.round(g * 0.6);
                    b = Math.round(b * 0.6);
                } else if (brightness < 50) {
                    // 如果太暗，提高亮度
                    r = Math.min(255, Math.round(r * 1.5));
                    g = Math.min(255, Math.round(g * 1.5));
                    b = Math.min(255, Math.round(b * 1.5));
                }

                resolve(`${r}, ${g}, ${b}`);
            } catch (error) {
                console.error('❌ Player: 提取封面主色失败:', error);
                resolve('60, 80, 120'); // 默认蓝色调
            }
        });
    }

    // 迷你模式：更新背景
    async updateMiniModeBackground(): Promise<void> {
        if (!this.isMiniMode) return;

        const coverImg = this.trackCover;
        // 检查封面是否成功加载
        if (coverImg && coverImg.complete && coverImg.naturalWidth > 0 &&
            coverImg.src && !coverImg.src.includes('default-cover.svg')) {
            try {
                const dominantColor = await this.extractDominantColor(coverImg);
                document.documentElement.style.setProperty('--mini-mode-bg-color', dominantColor);
            } catch (error) {
                this.setDefaultMiniModeBackground();
            }
        } else {
            // 封面未加载或加载失败，使用默认背景色
            this.setDefaultMiniModeBackground();
        }
    }

    // 迷你模式：设置默认背景色
    setDefaultMiniModeBackground(): void {
        const defaultColor = '60, 80, 120'; // 默认蓝色调
        document.documentElement.style.setProperty('--mini-mode-bg-color', defaultColor);
    }

    // 迷你模式：清除背景
    clearMiniModeBackground(): void {
        document.documentElement.style.removeProperty('--mini-mode-bg-color');
    }

    removeMiniModeLyricsElement(): void {
        document.querySelectorAll('.mini-mode-lyrics').forEach((element) => {
            element.remove();
        });
    }

    getRestoredMainWindowSize(): {width: number; height: number} {
        const savedSize = cacheManager.getLocalCache<WindowSizeCache | [number, number]>('mainWindow-size');
        const width = Array.isArray(savedSize) ? savedSize[0] : savedSize?.width;
        const height = Array.isArray(savedSize) ? savedSize[1] : savedSize?.height;

        if (typeof width === 'number' && typeof height === 'number' && width >= 1080 && height >= 720) {
            return {width, height};
        }

        if (savedSize) {
            cacheManager.removeLocalCache('mainWindow-size');
        }

        return {width: 1440, height: 900};
    }

    startMiniModeResizeGuard(): void {
        this.stopMiniModeResizeGuard();

        this.miniModeResizeHandler = () => {
            if (!this.isMiniMode) {
                return;
            }

            if (this.miniModeResizeGuardTimer) {
                clearTimeout(this.miniModeResizeGuardTimer);
            }

            this.miniModeResizeGuardTimer = setTimeout(() => {
                void this.enforceMiniModeWindowBounds();
            }, 80);
        };

        this.addEventListenerManaged(window, 'resize', this.miniModeResizeHandler);
    }

    stopMiniModeResizeGuard(): void {
        if (this.miniModeResizeHandler) {
            this.removeEventListenerManaged(window, 'resize', this.miniModeResizeHandler);
            this.miniModeResizeHandler = null;
        }

        if (this.miniModeResizeGuardTimer) {
            clearTimeout(this.miniModeResizeGuardTimer);
            this.miniModeResizeGuardTimer = null;
        }
    }

    async enforceMiniModeWindowBounds(): Promise<void> {
        if (!this.isMiniMode) {
            return;
        }

        try {
            if (await windowAPI.isMaximized()) {
                await windowAPI.unmaximize();
            }

            const bounds = await windowAPI.getBounds();
            const x = bounds?.x ?? 0;
            const y = bounds?.y ?? 0;
            if (!bounds || bounds.width !== 400 || bounds.height !== 145) {
                await windowAPI.setBounds({x, y, width: 400, height: 145});
            }
        } catch (error) {
            console.warn('⚠️ Player: 迷你模式窗口尺寸守卫失败:', error);
        }
    }

    // 迷你模式：更新歌词显示
    updateMiniModeLyrics(): void {
        if (!this.isMiniMode) return;

        // 使用迷你模式自己的歌词数据
        if (!this._miniModeLyrics || this._miniModeLyrics.length === 0) {
            this.showNoMiniModeLyrics();
            return;
        }

        const currentIndex = this._miniModeCurrentLyricIndex;
        if (currentIndex < 0 || currentIndex >= this._miniModeLyrics.length) {
            this.showNoMiniModeLyrics();
            return;
        }

        const currentLyric = this._miniModeLyrics[currentIndex];

        let miniLyricsElement = document.querySelector<HTMLElement>('.mini-mode-lyrics');
        if (!miniLyricsElement) {
            miniLyricsElement = document.createElement('div');
            miniLyricsElement.className = 'mini-mode-lyrics';
            const playerControls = this.element?.querySelector('.controls');
            if (playerControls) {
                playerControls.appendChild(miniLyricsElement);
            }
        }

        // 检查是否为逐字歌词
        const isWordByWord = currentLyric.type === 'word-by-word' && currentLyric.words && currentLyric.words.length > 0;

        if (isWordByWord) {
            const words = currentLyric.words ?? [];
            miniLyricsElement.classList.add('lyrics-word-by-word');
            miniLyricsElement.innerHTML = '';

            // 根据歌词数据创建逐字元素
            words.forEach((word, index) => {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'lyric-word';
                wordSpan.setAttribute('data-word-index', String(index));
                wordSpan.setAttribute('data-word-time', String(word.time));
                wordSpan.setAttribute('data-word-text', word.text);
                wordSpan.textContent = word.text;
                wordSpan.style.setProperty('--word-progress', '0');
                miniLyricsElement.appendChild(wordSpan);
            });
        } else {
            // 普通歌词
            miniLyricsElement.classList.remove('lyrics-word-by-word');
            miniLyricsElement.textContent = currentLyric.content || '暂无歌词';
        }
    }

    // 迷你模式：显示无歌词状态
    showNoMiniModeLyrics(): void {
        let miniLyricsElement = document.querySelector<HTMLElement>('.mini-mode-lyrics');
        if (!miniLyricsElement) {
            miniLyricsElement = document.createElement('div');
            miniLyricsElement.className = 'mini-mode-lyrics';
            const playerControls = this.element?.querySelector('.controls');
            if (playerControls) {
                playerControls.appendChild(miniLyricsElement);
            }
        }
        miniLyricsElement.classList.remove('lyrics-word-by-word');
        miniLyricsElement.textContent = '暂无歌词';
    }

    // 迷你模式：加载歌词数据
    async loadMiniModeLyrics(track: Track | null): Promise<void> {
        if (!track || !track.title || !track.artist) {
            this._miniModeLyrics = [];
            this._miniModeCurrentLyricIndex = -1;
            this.showNoMiniModeLyrics();
            return;
        }

        try {
            let parsedLyrics: MiniModeLyricLine[] | null = null;

            // 检查是否已有内嵌的歌词
            if (track.lyrics) {
                parsedLyrics = Array.isArray(track.lyrics) ? track.lyrics as MiniModeLyricLine[] : null;
            } else {
                // 从API获取歌词
                const lyricsResult = await lyricsAPI.getLyrics(track.title, track.artist, track.album, track.filePath);
                if (lyricsResult.success) {
                    if (lyricsResult.format === 'ttml' && lyricsResult.content) {
                        parsedLyrics = lyricsAPI.parseTTML(lyricsResult.content);
                    } else if (lyricsResult.lrc) {
                        parsedLyrics = lyricsAPI.parseLRC(lyricsResult.lrc);
                    } else if (lyricsResult.content) {
                        parsedLyrics = lyricsAPI.parse(lyricsResult.content, lyricsResult.format);
                    }
                }
            }

            if (parsedLyrics && parsedLyrics.length > 0) {
                this._miniModeLyrics = parsedLyrics;

                // 根据当前播放位置初始化歌词索引（修复关键）
                const currentTime = this.currentTime || 0;
                let initialIndex = 0;

                // 找到当前时间对应的歌词索引
                for (let i = 0; i < parsedLyrics.length; i++) {
                    if (currentTime >= parsedLyrics[i].time) {
                        initialIndex = i;
                    } else {
                        break;
                    }
                }

                this._miniModeCurrentLyricIndex = initialIndex;
                console.log(`✅ Player: 迷你模式歌词加载成功，共${parsedLyrics.length}行，当前索引:${initialIndex}，播放位置:${currentTime.toFixed(2)}s`);

                // 立即更新显示
                this.updateMiniModeLyrics();
            } else {
                this._miniModeLyrics = [];
                this._miniModeCurrentLyricIndex = -1;
                this.showNoMiniModeLyrics();
            }
        } catch (error) {
            console.error('❌ Player: 迷你模式歌词加载失败:', error);
            this._miniModeLyrics = [];
            this._miniModeCurrentLyricIndex = -1;
            this.showNoMiniModeLyrics();
        }
    }

    // 迷你模式：更新歌词索引
    updateMiniModeLyricIndex(currentTime: number): void {
        if (!this._miniModeLyrics || this._miniModeLyrics.length === 0) {
            return;
        }

        // 找到当前时间对应的歌词索引
        let newIndex = -1;
        for (let i = 0; i < this._miniModeLyrics.length; i++) {
            if (currentTime >= this._miniModeLyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果没有找到匹配的歌词行（当前时间早于第一句歌词），显示第一句
        if (newIndex === -1 && this._miniModeLyrics.length > 0) {
            newIndex = 0;
        }

        // 如果索引变化，更新显示
        if (newIndex !== this._miniModeCurrentLyricIndex) {
            this._miniModeCurrentLyricIndex = newIndex;
            this.updateMiniModeLyrics();
        }
    }

    // 迷你模式：更新逐字歌词高亮
    updateMiniModeLyricsWordHighlight(currentTime: number): void {
        if (!this.isMiniMode) return;

        const miniLyricsElement = document.querySelector<HTMLElement>('.mini-mode-lyrics');
        if (!miniLyricsElement || !miniLyricsElement.classList.contains('lyrics-word-by-word')) {
            return;
        }

        // 节流控制
        const now = performance.now();
        if (now - this._miniModeLyricsLastUpdateTime < this._miniModeLyricsUpdateInterval) {
            return;
        }
        this._miniModeLyricsLastUpdateTime = now;

        const words = miniLyricsElement.querySelectorAll<HTMLElement>('.lyric-word');
        if (words.length === 0) return;

        // 取消之前的RAF请求
        if (this._miniModeLyricsRafId) {
            cancelAnimationFrame(this._miniModeLyricsRafId);
        }

        // 使用requestAnimationFrame优化DOM操作
        this._miniModeLyricsRafId = requestAnimationFrame(() => {
            this._miniModeLyricsRafId = null;

            for (let i = 0; i < words.length; i++) {
                const wordElement = words[i];
                const wordStartTime = parseFloat(wordElement.getAttribute('data-word-time') || '0');

                // 计算词的结束时间
                let wordEndTime;
                if (i < words.length - 1) {
                    wordEndTime = parseFloat(words[i + 1].getAttribute('data-word-time') || '0');
                } else {
                    // 最后一个词，假设持续0.5秒
                    wordEndTime = wordStartTime + 0.5;
                }

                if (currentTime < wordStartTime) {
                    // 未播放的字
                    wordElement.classList.remove('highlight', 'played');
                    wordElement.style.setProperty('--word-progress', '0');
                } else if (currentTime >= wordEndTime) {
                    // 已播放的字
                    wordElement.classList.remove('highlight');
                    wordElement.classList.add('played');
                    wordElement.style.setProperty('--word-progress', '1');
                } else {
                    // 正在播放的字
                    const duration = wordEndTime - wordStartTime;
                    const progress = duration > 0 ? (currentTime - wordStartTime) / duration : 1;
                    const clampedProgress = Math.max(0, Math.min(1, progress));

                    wordElement.classList.add('highlight');
                    wordElement.classList.remove('played');
                    wordElement.style.setProperty('--word-progress', clampedProgress.toFixed(2));
                }
            }
        });
    }

    destroy(): void {
        if (this.isMiniMode) {
            document.body.classList.remove('mini-mode', 'mini-mode-collapsed');
            this.removeMiniModeLyricsElement();
            this.clearMiniModeBackground();
        }

        this.stopMiniModeResizeGuard();

        if (this.miniModeMouseEnterHandler && this.miniModeMouseLeaveHandler && this.miniModeAppContainer) {
            this.removeEventListenerManaged(this.miniModeAppContainer, 'mouseenter', this.miniModeMouseEnterHandler);
            this.removeEventListenerManaged(this.miniModeAppContainer, 'mouseleave', this.miniModeMouseLeaveHandler);
            this.miniModeMouseEnterHandler = null;
            this.miniModeMouseLeaveHandler = null;
            this.miniModeAppContainer = null;
        }

        if (this.miniModePositionUnsubscribe) {
            this.miniModePositionUnsubscribe();
            this.miniModePositionUnsubscribe = null;
            this.miniModePositionChangeHandler = null;
        }

        if (this._miniModeLyricsRafId) {
            cancelAnimationFrame(this._miniModeLyricsRafId);
            this._miniModeLyricsRafId = null;
        }

        // 清理封面更新订阅
        if (this.coverUpdateUnsubscribe) {
            this.coverUpdateUnsubscribe();
            this.coverUpdateUnsubscribe = null;
        }

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
