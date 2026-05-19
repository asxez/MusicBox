/**
 * 歌词页组件
 */

import {urlValidator} from "@utils/URLValidator";
import {Component} from "@ui/base/Component";
import {desktopLyricsController} from "@js/features/desktopLyrics";
import {mediaController} from "@js/features/media";
import {playbackController} from "@js/features/playback";
import {LyricsPlaybackControlsController} from "@ui/widgets/lyrics/LyricsPlaybackControlsController";
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@js/features/playback";
import type {LyricLine} from "@api/types/lyrics";
import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";
import type {LyricsPlaybackControlElements} from "@ui/widgets/lyrics/LyricsPlaybackControlsController";

type WordLyric = {
    text: string;
    time: number;
    endTime?: number;
};

type RenderLyricLine = LyricLine & {
    type?: string;
    words?: WordLyric[];
    endTime?: number;
};

type LyricsTrack = Track & {
    path?: string;
    lyrics?: string | RenderLyricLine[];
    lrcText?: string;
    lyricsContent?: string;
    lyricsFormat?: string;
};

class Lyrics extends Component {
    public isVisible: boolean;
    public isFullscreen: boolean;
    private currentTrack: LyricsTrack | null;
    private lyrics: RenderLyricLine[];
    private currentLyricIndex: number;
    private listenersSetup: boolean;
    private page!: HTMLElement;
    private background!: HTMLElement;
    private closeBtn!: HTMLElement;
    private fullscreenBtn!: HTMLElement;
    private fullscreenIcon!: HTMLElement;
    private fullscreenExitIcon!: HTMLElement;
    private trackCover!: HTMLImageElement;
    private trackTitle!: HTMLElement;
    private trackArtist!: HTMLElement;
    private lyricsDisplay!: HTMLElement;
    private lyricsMain!: HTMLElement;
    private leftSide!: HTMLElement;
    private playBtn!: HTMLElement;
    private prevBtn!: HTMLElement;
    private nextBtn!: HTMLElement;
    private playIcon!: HTMLElement;
    private pauseIcon!: HTMLElement;
    private progressBar!: HTMLElement;
    private progressFill!: HTMLElement;
    private progressHandle!: HTMLElement;
    private currentTimeEl!: HTMLElement;
    private durationEl!: HTMLElement;
    private volumeBtn!: HTMLElement;
    private volumeSliderContainer!: HTMLElement;
    private volumeFill!: HTMLElement;
    private volumeHandle!: HTMLElement;
    private volumeIcon!: HTMLElement;
    private volumeMuteIcon!: HTMLElement;
    private volumeHalfIcon!: HTMLElement;
    private playModeBtn!: HTMLElement;
    private modeSequenceIcon!: HTMLElement;
    private modeShuffleIcon!: HTMLElement;
    private modeRepeatOneIcon!: HTMLElement;
    private playbackControls!: LyricsPlaybackControlsController;
    private elementMouseMoveHandler: (() => void) | null;
    private clearHideTimer: (() => void) | null;
    private _lastTrackPath: string | null;
    private _lastLoadedLyricsPath: string | null;
    private _lastLoadedTrackId: string | null;
    private _isLoadingLyrics: boolean;
    private _updateTrackInfoInProgress: boolean;
    private _pendingUpdatePromise: Promise<void> | null;
    private _currentPlaybackPosition: number;
    private _lastMonotonicPosition: number;
    private _rafId: number | null;
    private _lastWordUpdateTime: number;
    private _wordUpdateInterval: number;
    private isCenterMode: boolean;
    private isTransitioning: boolean;
    private lastClickTime: number;
    private readonly doubleClickDelay: number;
    private playbackStateUnsubscribe: Unsubscribe | null;

    constructor(element: Element | null) {
        super(element);
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.listenersSetup = false; // 事件监听器是否已设置

        // 防重复加载机制
        this._lastTrackPath = null; // 上次更新的歌曲路径
        this._lastLoadedLyricsPath = null; // 上次加载歌词的歌曲路径
        this._lastLoadedTrackId = null; // 上次加载的歌曲ID
        this._isLoadingLyrics = false; // 是否正在加载歌词
        this._updateTrackInfoInProgress = false; // 是否正在更新歌曲信息
        this._pendingUpdatePromise = null; // 当前正在执行的更新Promise

        // 逐字高亮相关状态
        this._currentPlaybackPosition = 0; // 当前播放位置
        this._lastMonotonicPosition = 0; // 上次的单调递增位置（用于防止时间回跳）
        this._rafId = null; // requestAnimationFrame ID
        this._lastWordUpdateTime = 0; // 上次逐字更新的时间戳
        this._wordUpdateInterval = 16; // 逐字更新间隔（毫秒），约60fps

        // 封面双击切换功能状态
        this.isCenterMode = false; // 是否处于居中模式
        this.isTransitioning = false; // 是否正在进行布局切换动画
        this.lastClickTime = 0; // 上次点击时间，用于双击检测
        this.doubleClickDelay = 300; // 双击检测延迟（毫秒）
        this.isFullscreen = false;
        this.elementMouseMoveHandler = null;
        this.clearHideTimer = null;
        this.playbackStateUnsubscribe = null;

        this.setupElements();
    }

    async show(track: LyricsTrack | null): Promise<void> {
        // 只在首次显示或事件监听器被清理后才设置
        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.setupAPIListeners();
            this.listenersSetup = true;
        }

        this.currentTrack = track;
        this.isVisible = true;

        // 立即显示页面，不等待歌词加载
        this.page.style.display = 'block';
        setTimeout(() => {
            this.page.classList.add('show');
        }, 10);

        this.updateFullscreenState();
        await this.initializeControls();

        // 异步加载歌曲信息和歌词，不阻塞页面显示
        if (track) {
            await this.updateTrackInfo(track);
        }

        // 确保歌词显示区域滚动到顶部
        setTimeout(() => {
            if (this.lyricsDisplay) {
                this.lyricsDisplay.scrollTop = 0;
            }
        }, 50);
    }

    hide(): void {
        this.isVisible = false;
        this.page.classList.remove('show');

        // 重置防重复状态
        this._lastTrackPath = null;
        this._lastLoadedLyricsPath = null;
        this._isLoadingLyrics = false;
        this._updateTrackInfoInProgress = false;
        this._pendingUpdatePromise = null;

        // 重置单调时间状态
        this._lastMonotonicPosition = 0;
        this._currentPlaybackPosition = 0;

        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
            }
        }, 300);
    }

    destroy(): void {
        this.removePlaybackStateSubscription();

        // 清理歌词数据
        this.lyrics = [];
        this.currentTrack = null;
        this.currentLyricIndex = -1;

        // 重置状态
        this.isVisible = false;
        this.listenersSetup = false;

        this.resetLayoutState();
        super.destroy();
    }

    private removePlaybackStateSubscription(): void {
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

    setupElements(): void {
        this.page = this.requireElement(this.element, '#lyrics-page');
        this.background = this.queryElement('.lyrics-background');
        this.closeBtn = this.queryElement('#lyrics-close');
        this.fullscreenBtn = this.queryElement('#lyrics-fullscreen');

        // 全屏按钮图标
        this.fullscreenIcon = this.queryChildElement(this.fullscreenBtn, '.fullscreen-icon');
        this.fullscreenExitIcon = this.queryChildElement(this.fullscreenBtn, '.fullscreen-exit-icon');

        // 封面和歌曲信息
        this.trackCover = this.queryElement<HTMLImageElement>('#lyrics-cover-image');
        this.trackTitle = this.queryElement('#lyrics-track-title');
        this.trackArtist = this.queryElement('#lyrics-track-artist');

        // 歌词显示
        this.lyricsDisplay = this.queryElement('#lyrics-display');

        // 布局切换相关元素
        this.lyricsMain = this.queryElement('.lyrics-main');
        this.leftSide = this.queryElement('.lyrics-left-side');
        // this.rightSide = this.element.querySelector('.lyrics-right-side');

        // 播放控制
        this.playBtn = this.queryElement('#lyrics-play-btn');
        this.prevBtn = this.queryElement('#lyrics-prev-btn');
        this.nextBtn = this.queryElement('#lyrics-next-btn');
        this.playIcon = this.queryChildElement(this.playBtn, '.play-icon');
        this.pauseIcon = this.queryChildElement(this.playBtn, '.pause-icon');

        // 进度条
        this.progressBar = this.queryElement('#lyrics-progress-bar');
        this.progressFill = this.queryElement('#lyrics-progress-fill');
        this.progressHandle = this.queryElement('#lyrics-progress-handle');
        this.currentTimeEl = this.queryElement('#lyrics-current-time');
        this.durationEl = this.queryElement('#lyrics-duration');

        // 音量控制
        this.volumeBtn = this.queryElement('#lyrics-volume-btn');
        this.volumeSliderContainer = this.queryElement('.volume-slider-container');
        this.volumeFill = this.queryElement('#lyrics-volume-fill');
        this.volumeHandle = this.queryElement('#lyrics-volume-handle');
        this.volumeIcon = this.queryChildElement(this.volumeBtn, '.volume-icon');
        this.volumeMuteIcon = this.queryChildElement(this.volumeBtn, '.volume-mute-icon');
        this.volumeHalfIcon = this.queryChildElement(this.volumeBtn, '.volume-half-icon');

        // 播放模式控制
        this.playModeBtn = this.queryElement('#lyrics-playmode-btn');
        this.modeSequenceIcon = this.queryChildElement(this.playModeBtn, '.lyrics-mode-sequence');
        this.modeShuffleIcon = this.queryChildElement(this.playModeBtn, '.lyrics-mode-shuffle');
        this.modeRepeatOneIcon = this.queryChildElement(this.playModeBtn, '.lyrics-mode-repeat-one');

        // 全屏状态
        this.isFullscreen = false;

        this.playbackControls = new LyricsPlaybackControlsController({
            elements: this.getPlaybackControlElements(),
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            getCurrentTrack: () => this.currentTrack
        });
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.closeBtn, 'click', () => {
            this.hide();
        });

        this.addEventListenerManaged(this.fullscreenBtn, 'click', () => {
            this.toggleFullscreen();
        });

        this.playbackControls.bind();

        // 封面双击切换布局事件
        this.addEventListenerManaged(this.trackCover, 'click', async (e) => {
            await this.handleCoverClick(e as MouseEvent);
        });

        // 窗口大小变化监听器
        this.addEventListenerManaged(window, 'resize', () => {
            this.handleWindowResize();
        });

        // 鼠标隐藏逻辑
        const HIDE_DELAY = 2000;
        let mouseTimer: ReturnType<typeof setTimeout> | null = null;
        this.elementMouseMoveHandler = () => {
            if (this.isVisible && this.isFullscreen) {
                this.page.classList.remove('hide-cursor');
                if (mouseTimer) clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    if (this.isVisible && this.isFullscreen) {
                        this.page.classList.add('hide-cursor');
                    }
                }, HIDE_DELAY);
            }
        };
        this.addEventListenerManaged(this.page, 'mousemove', this.elementMouseMoveHandler);

        this.clearHideTimer = () => {
            if (mouseTimer) clearTimeout(mouseTimer);
            mouseTimer = null;
            this.page.classList.remove('hide-cursor');
        };

        this.addEventListenerManaged(document, 'fullscreenchange', () => {
            if (!this.isFullscreen) this.clearHideTimer?.();
            this.updateFullscreenState();
        });
    }

    setupAPIListeners(): void {
        this.playbackStateUnsubscribe = playbackController.subscribe((state, change) => {
            return this.handlePlaybackStateChange(state, change);
        });
    }

    private async handlePlaybackStateChange(
        state: Readonly<PlaybackState>,
        change: PlaybackStoreChange
    ): Promise<void> {
        switch (change.type) {
            case 'positionChanged':
                this.handlePlaybackPositionChanged(state.position);
                break;

            case 'playbackStateChanged':
                this.playbackControls.setPlaying(state.isPlaying);
                break;

            case 'durationChanged':
                this.playbackControls.updateDuration(state.duration);
                break;

            case 'trackChanged':
                // 只有在歌词页面可见时才更新，避免不必要的资源消耗
                if (this.isVisible && state.currentTrack) {
                    await this.updateTrackInfo(state.currentTrack);
                }
                break;

            case 'volumeChanged':
                this.playbackControls.setVolumeFromRuntime(state.volume);
                break;

            case 'playModeChanged':
                this.updatePlayModeDisplay(state.playMode);
                break;
        }
    }

    private handlePlaybackPositionChanged(position: number): void {
        // 单调时间
        // 允许小幅回跳（可能是seek操作），但对于微小回跳则忽略
        const timeDiff = position - this._lastMonotonicPosition;

        // 如果时间大幅回退（超过0.5秒），说明是用户seek操作，允许并重置字状态
        if (timeDiff < -0.5) {
            this._lastMonotonicPosition = position;
            this._currentPlaybackPosition = position;
            this.resetWordHighlightStates(position);
        }
        // 如果时间前进或者微小回退（小于0.05秒），使用单调递增的时间
        else if (timeDiff >= -0.05) {
            // 确保时间只增不减（忽略微小回跳）
            const monotonicTime = Math.max(position, this._lastMonotonicPosition);
            this._lastMonotonicPosition = monotonicTime;
            this._currentPlaybackPosition = monotonicTime;
            position = monotonicTime;
        }
        // 如果是0.05-0.5秒的回退，也当作seek处理
        else {
            this._lastMonotonicPosition = position;
            this._currentPlaybackPosition = position;
            this.resetWordHighlightStates(position);
        }
        this.updateLyricHighlight(position);
    }

    async toggle(track: LyricsTrack | null): Promise<void> {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show(track);
        }
    }

    async togglePlayPause(): Promise<void> {
        await this.playbackControls.togglePlayPause();
    }

    updateProgress(currentTime: number, duration: number): void {
        this.playbackControls.updateProgress(currentTime, duration);
    }

    updatePlayButton(): void {
        this.playbackControls.setPlaying(playbackController.getState().isPlaying);
    }

    formatTime(seconds: number): string {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async updateTrackInfo(track: LyricsTrack | null): Promise<void> {
        if (!track) return;

        // 检查是否正在更新或是同一首歌
        const trackPath = track.filePath || track.path || `${track.title}_${track.artist}`;

        // 如果有正在执行的更新Promise，等待它完成
        if (this._pendingUpdatePromise) {
            await this._pendingUpdatePromise;
        }

        // 再次检查是否需要更新（可能在等待期间已经更新了相同的歌曲）
        if (this._lastTrackPath === trackPath) {
            return;
        }

        if (this._updateTrackInfoInProgress) {
            return;
        }

        this._updateTrackInfoInProgress = true;
        this._lastTrackPath = trackPath;

        // 创建更新Promise
        this._pendingUpdatePromise = this._doUpdateTrackInfo(track);

        try {
            await this._pendingUpdatePromise;
        } finally {
            this._pendingUpdatePromise = null;
            this._updateTrackInfoInProgress = false;
        }
    }

    async _doUpdateTrackInfo(track: LyricsTrack): Promise<void> {
        try {
            console.log('🎵 Lyrics: 开始更新歌曲信息', track.title, '时间戳:', Date.now());

            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';

            this.playbackControls.updateTrackDuration(track.duration);

            // 更新封面和歌词
            await this.loadLyrics(track);
            await this.updateCoverArt(track);
        } catch (error) {
            console.error('❌ Lyrics: 歌曲信息更新失败:', error);
            throw error;
        }
    }

    async loadLyrics(track: LyricsTrack): Promise<void> {
        if (!track || !track.title || !track.artist) {
            this.showNoLyrics();
            return;
        }

        // 增强的防重复加载机制
        const trackPath = track.filePath || track.path || `${track.title}_${track.artist}`;
        const trackId = `${track.title}_${track.artist}_${track.album || ''}`;

        // 检查是否正在加载或已经加载过相同歌曲
        if (this._isLoadingLyrics || this._lastLoadedLyricsPath === trackPath) {
            return;
        }

        // 检查是否是相同的歌曲
        // 即使路径不同也检查
        if (this._lastLoadedTrackId === trackId) {
            return;
        }

        this._isLoadingLyrics = true;
        this._lastLoadedLyricsPath = trackPath;
        this._lastLoadedTrackId = trackId;

        // 检查是否已有内嵌的歌词
        if (track.lyrics) {
            if (Array.isArray(track.lyrics)) {
                this.lyrics = track.lyrics as RenderLyricLine[];
            } else {
                const parsedLyrics = mediaController.parseLyrics(String(track.lyrics), track.lyricsFormat as any);
                this.lyrics = parsedLyrics as RenderLyricLine[];
            }
            this.renderLyrics();

            // 同步歌词到桌面歌词窗口
            await desktopLyricsController.syncLyrics(this.lyrics);
            this._isLoadingLyrics = false;
            return;
        }

        this.showLoading();

        try {
            const lyricsResult = await mediaController.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                let parsedLyrics: RenderLyricLine[] | undefined;

                if (lyricsResult.format === 'ttml' && lyricsResult.content) {
                    parsedLyrics = mediaController.parseTTML(lyricsResult.content);
                } else if (lyricsResult.lrc) {
                    parsedLyrics = mediaController.parseLRC(lyricsResult.lrc);
                } else if (lyricsResult.content) {
                    parsedLyrics = mediaController.parseLyrics(lyricsResult.content, lyricsResult.format);
                }

                if (parsedLyrics && parsedLyrics.length > 0) {
                    this.lyrics = parsedLyrics;
                    // 缓存歌词到track对象
                    track.lyrics = this.lyrics;
                    if (lyricsResult.lrc) {
                        track.lrcText = lyricsResult.lrc;
                    } else if (lyricsResult.content) {
                        track.lyricsContent = lyricsResult.content;
                        track.lyricsFormat = lyricsResult.format;
                    }
                    this.renderLyrics();

                    // 同步歌词到桌面歌词窗口
                    await desktopLyricsController.syncLyrics(this.lyrics);
                } else {
                    this.showNoLyrics();
                    console.log('❌ Lyrics: 歌词解析失败');
                }
            } else {
                this.showNoLyrics();
                console.log('❌ Lyrics: 歌词获取失败');
            }
        } catch (error) {
            console.error('❌ Lyrics: 歌词加载失败:', error);
            this.showNoLyrics();
        } finally {
            this._isLoadingLyrics = false;
        }
    }

    async updateCoverArt(track: LyricsTrack): Promise<void> {
        // 首先设置默认封面和背景
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');
        await this.setBackgroundImage(null); // 清空背景

        try {
            let finalImageUrl = null;
            if (track.title && track.artist) {
                // 添加forceRefresh参数以确保首次播放时能正确获取封面，特别是网络磁盘文件
                const coverResult = await mediaController.getCover(track.title, track.artist, track.album, track.filePath, true);
                if (coverResult.success && coverResult.imageUrl) {
                    // 验证URL格式
                    if (typeof coverResult.imageUrl === 'string') {
                        finalImageUrl = coverResult.imageUrl;
                        // 缓存封面URL到track对象
                        track.cover = coverResult.imageUrl;
                    } else {
                        console.error('❌ Lyrics: API返回的imageUrl不是字符串', {
                            type: typeof coverResult.imageUrl,
                            value: coverResult.imageUrl
                        });
                    }
                } else {
                    console.log('❌ Lyrics: 封面获取失败，使用默认封面', coverResult.error);
                }
            }

            // 统一设置封面和背景
            if (finalImageUrl) {
                await this.setCoverAndBackground(finalImageUrl);
            }
        } catch (error) {
            console.error('❌ Lyrics: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    // 设置背景图片的辅助方法
    async setBackgroundImage(imageUrl: string | null): Promise<void> {
        if (!this.background) return;

        if (imageUrl) {
            try {
                // 处理不同类型的URL
                const processedUrl = await this.processImageUrl(imageUrl);
                if (processedUrl) {
                    this.background.style.backgroundImage = `url("${processedUrl}")`;
                } else {
                    this.background.style.backgroundImage = 'none';
                }
            } catch (error) {
                console.error('❌ Lyrics: 背景图片设置失败:', error);
                this.background.style.backgroundImage = 'none';
            }
        } else {
            this.background.style.backgroundImage = 'none';
        }
    }

    // 处理图片URL，将file://协议转换为可用格式
    async processImageUrl(url: string): Promise<string | null> {
        if (!url || typeof url !== 'string') return null;

        // 如果是data URL或blob URL，直接返回
        if (url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
        }

        // 如果是HTTP/HTTPS URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // 如果是file://协议，转换为blob URL
        if (url.startsWith('file://')) {
            return await this.convertFileUrlToBlobUrl(url);
        }

        // 其他情况，尝试作为本地文件路径处理
        return await this.convertLocalPathToBlobUrl(url);
    }

    // 将file://协议的URL转换为blob URL
    async convertFileUrlToBlobUrl(fileUrl: string): Promise<string | null> {
        try {
            // 提取文件路径
            let filePath = fileUrl.replace('file://', '');

            // Windows路径处理
            if (filePath.startsWith('/') && filePath.includes(':')) {
                filePath = filePath.substring(1); // 移除开头的/
            }

            return await this.convertLocalPathToBlobUrl(filePath);
        } catch (error) {
            console.error('❌ Lyrics: file://协议转换失败:', error);
            return null;
        }
    }

    // 将本地文件路径转换为blob URL
    async convertLocalPathToBlobUrl(filePath: string): Promise<string | null> {
        try {
            // 读取文件数据
            const fileData = await mediaController.readFile(filePath);
            if (!fileData || fileData.length === 0) {
                console.error('❌ Lyrics: 文件数据为空');
                return null;
            }

            // 根据文件扩展名确定MIME类型
            const mimeType = this.getMimeTypeFromPath(filePath);

            // 创建Blob
            const uint8Array = typeof fileData === 'string'
                ? new TextEncoder().encode(fileData)
                : new Uint8Array(fileData);
            const blob = new Blob([uint8Array], {type: mimeType});

            // 创建blob URL
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('❌ Lyrics: 本地文件转换失败:', error);
            return null;
        }
    }

    // 根据文件路径获取MIME类型
    getMimeTypeFromPath(filePath: string): string {
        const ext = filePath.toLowerCase().split('.').pop() || '';
        const mimeTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }

    // 统一设置封面和背景的方法
    async setCoverAndBackground(imageUrl: string): Promise<void> {
        try {
            // 使用urlValidator安全设置封面图片
            const success = await urlValidator.safeSetImageSrc(this.trackCover, imageUrl);
            if (!success) {
                this.trackCover.src = 'assets/images/default-cover.svg';
            }

            // 设置背景图片
            await this.setBackgroundImage(imageUrl);
        } catch (error) {
            console.error('❌ Lyrics: 封面和背景设置失败:', error);
            this.trackCover.src = 'assets/images/default-cover.svg';
            await this.setBackgroundImage(null);
        }
    }

    showLoading(): void {
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <p class="lyrics-line loading">正在加载歌词...</p>
            </div>
        `;
    }

    showNoLyrics(): void {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                <p class="lyrics-line">暂无歌词</p>
                <p class="lyrics-line">请欣赏音乐</p>
                <div class="lyrics-line-spacer"></div>
            </div>
        `;
    }

    renderLyrics(): void {
        if (!this.lyrics || this.lyrics.length === 0) {
            this.showNoLyrics();
            return;
        }

        const lyricsHTML = this.lyrics.map((lyric, index) => {
            if (lyric.type === 'word-by-word' && lyric.words && lyric.words.length > 0) {
                const wordsHTML = lyric.words.map((word, wordIndex) => {
                    return `<span class="lyric-word" data-word-index="${wordIndex}" data-word-time="${word.time}" data-word-text="${word.text}">${word.text}</span>`;
                }).join('');
                return `<p class="lyrics-line lyrics-word-by-word" data-time="${lyric.time}" data-index="${index}">${wordsHTML}</p>`;
            } else {
                return `<p class="lyrics-line" data-time="${lyric.time}" data-index="${index}">${lyric.content}</p>`;
            }
        }).join('');

        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                ${lyricsHTML}
                <div class="lyrics-line-spacer"></div>
            </div>
        `;

        // 重置滚动位置到顶部，确保从第一行歌词开始显示
        this.lyricsDisplay.scrollTop = 0;
        // 添加点击事件，允许用户跳转到指定时间
        this.lyricsDisplay.querySelectorAll<HTMLElement>('.lyrics-line').forEach((line) => {
            line.addEventListener('click', async () => {
                const time = parseFloat(line.dataset.time || '');
                if (!isNaN(time)) {
                    await playbackController.seek(time);
                }
            });
        });

        // 重置当前歌词索引和单调时间
        this.currentLyricIndex = -1;
        this._lastMonotonicPosition = 0;
    }

    updateLyricHighlight(currentTime: number): void {
        if (!this.lyrics || this.lyrics.length === 0 || !this.isVisible) {
            return;
        }

        // 找到当前时间对应的歌词行
        let newIndex = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果索引发生变化，更新高亮
        if (newIndex !== this.currentLyricIndex) {
            // 移除之前的高亮
            if (this.currentLyricIndex >= 0) {
                const prevLine = this.lyricsDisplay.querySelector(`[data-index="${this.currentLyricIndex}"]`);
                if (prevLine) {
                    prevLine.classList.remove('highlight');
                    // 清除逐字高亮（但保留played状态）
                    const words = prevLine.querySelectorAll('.lyric-word');
                    words.forEach(word => {
                        // 只移除highlight，不移除played
                        word.classList.remove('highlight');
                    });
                }
            }

            // 添加新的高亮
            if (newIndex >= 0) {
                const currentLine = this.lyricsDisplay.querySelector(`[data-index="${newIndex}"]`);
                if (currentLine) {
                    currentLine.classList.add('highlight');

                    // 只有在歌曲开始播放后才进行自动滚动
                    // 避免在歌词刚加载时就滚动到中间位置
                    if (currentTime > 0 && this.currentLyricIndex >= 0) {
                        currentLine.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }
            }
            this.currentLyricIndex = newIndex;
        }

        // 处理逐字高亮
        if (newIndex >= 0 && this.lyrics[newIndex].type === 'word-by-word') {
            this.updateWordHighlight(newIndex, currentTime);
        }
    }

    updateWordHighlight(lineIndex: number, currentTime: number): void {
        const lyric = this.lyrics[lineIndex];
        if (!lyric || !lyric.words || lyric.words.length === 0) {
            return;
        }

        const currentLine = this.lyricsDisplay.querySelector(`[data-index="${lineIndex}"]`);
        if (!currentLine) {
            return;
        }

        // 节流控制：限制更新频率
        const now = performance.now();
        const timeSinceLastUpdate = now - this._lastWordUpdateTime;

        // 如果距离上次更新时间太短，跳过本次更新
        if (timeSinceLastUpdate < this._wordUpdateInterval) {
            return;
        }

        this._lastWordUpdateTime = now;
        const lyricWords = lyric.words || [];
        const words = currentLine.querySelectorAll<HTMLElement>('.lyric-word');

        // 取消之前的RAF请求，防止重复调用
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
        }

        // 使用requestAnimationFrame优化DOM操作
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;

            // 使用最新的播放位置，而不是闭包捕获的旧值
            const latestTime = this._currentPlaybackPosition !== undefined ? this._currentPlaybackPosition : currentTime;

            // 遍历所有字，更新状态
            for (let i = 0; i < lyricWords.length; i++) {
                const word = lyricWords[i];
                const wordElement = words[i];

                if (!wordElement) continue;
                if (wordElement.classList.contains('played')) {
                    continue;
                }

                const wordStartTime = word.time;
                const wordEndTime = word.endTime || (lyricWords[i + 1] ? lyricWords[i + 1].time : lyric.endTime || wordStartTime + 0.5);
                if (latestTime < wordStartTime) {
                    // 未播放的字：保持默认状态（只移除highlight，不影响played）
                    if (wordElement.classList.contains('highlight')) {
                        wordElement.classList.remove('highlight');
                        wordElement.style.setProperty('--word-progress', '0');
                    }
                } else if (latestTime >= wordEndTime) {
                    // 已播放的字：标记为已播放
                    wordElement.classList.remove('highlight');
                    wordElement.classList.add('played');
                    wordElement.style.setProperty('--word-progress', '1');
                } else {
                    // 正在播放的字：计算进度并应用渐进高亮
                    const duration = wordEndTime - wordStartTime;
                    const progress = duration > 0 ? (latestTime - wordStartTime) / duration : 1;
                    const clampedProgress = Math.max(0, Math.min(1, progress));

                    if (!wordElement.classList.contains('highlight')) {
                        wordElement.classList.add('highlight');
                    }

                    // 只有当进度确实发生变化时才更新CSS变量
                    const currentProgress = parseFloat(wordElement.style.getPropertyValue('--word-progress')) || 0;
                    const newProgress = parseFloat(clampedProgress.toFixed(2));

                    // 确保进度只能前进，不能后退
                    if (newProgress > currentProgress) {
                        wordElement.style.setProperty('--word-progress', newProgress.toString());
                    }
                }
            }
        });
    }

    /**
     * 重置逐字高亮状态（用于seek操作时回退到更早位置）
     * @param {number} seekPosition - seek到的时间位置
     */
    resetWordHighlightStates(seekPosition: number): void {
        if (!this.lyricsDisplay) return;

        // 获取所有歌词行
        const allLines = this.lyricsDisplay.querySelectorAll<HTMLElement>('.lyrics-line.lyrics-word-by-word');

        for (const line of allLines) {
            const words = line.querySelectorAll<HTMLElement>('.lyric-word');

            for (const wordElement of words) {
                const wordTime = parseFloat(wordElement.dataset.wordTime || '');

                // 如果字的开始时间在seek位置之后，需要重置状态
                if (wordTime > seekPosition) {
                    wordElement.classList.remove('highlight', 'played');
                    wordElement.style.setProperty('--word-progress', '0');
                }
            }
        }
    }

    // 全屏功能方法
    toggleFullscreen(): void {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen(): void {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().then(() => {
                console.log('🎵 Lyrics: 进入全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 进入全屏失败:', err);
            });
        }
    }

    exitFullscreen(): void {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                console.log('🎵 Lyrics: 退出全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 退出全屏失败:', err);
            });
        }
    }

    updateFullscreenState(): void {
        this.isFullscreen = !!document.fullscreenElement;

        // 更新按钮图标
        if (this.isFullscreen) {
            this.fullscreenIcon.style.display = 'none';
            this.fullscreenExitIcon.style.display = 'block';
        } else {
            this.fullscreenIcon.style.display = 'block';
            this.fullscreenExitIcon.style.display = 'none';
        }
    }

    // 初始化控件状态
    async initializeControls(): Promise<void> {
        await this.playbackControls.initialize();
    }

    // 音量控制方法
    async setVolume(volume: number): Promise<void> {
        await this.playbackControls.setVolume(volume);
    }

    updateVolumeDisplay(): void {
        this.playbackControls.setVolumeFromRuntime(playbackController.getState().volume);
    }

    updatePlayModeDisplay(mode: PlayMode): void {
        this.playbackControls.updatePlayModeDisplay(mode);
    }

    // 封面点击处理方法
    async handleCoverClick(e: MouseEvent): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastClickTime;

        if (timeDiff < this.doubleClickDelay) {
            // 双击检测成功
            await this.handleCoverDoubleClick();
        }

        this.lastClickTime = currentTime;
    }

    // 封面双击处理方法
    async handleCoverDoubleClick(): Promise<void> {
        if (this.isTransitioning) {
            return; // 如果正在切换，忽略双击
        }

        // 添加视觉反馈
        this.trackCover.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (this.trackCover) {
                this.trackCover.style.transform = '';
            }
        }, 150);

        this.toggleLayoutMode();
    }

    // 检查是否支持布局切换（在小屏幕上禁用）
    isLayoutSwitchSupported(): boolean {
        return window.innerWidth > 768;
    }

    // 处理窗口大小变化
    handleWindowResize(): void {
        // 若当前处于居中模式，但屏幕变小了，则退出居中模式
        if (this.isCenterMode && !this.isLayoutSwitchSupported()) {
            this.resetLayoutState();
            return;
        }

        // 若当前处于动态居中模式，重新计算居中位置
        if (this.isCenterMode && this.page.classList.contains('dynamic-center')) {
            // 延迟一点时间等待布局稳定
            setTimeout(() => {
                this.applyDynamicCenter();
            }, 100);
        }
    }

    // 动态计算精确的居中transform值
    calculateCenterTransform(): string {
        if (!this.page || !this.lyricsMain || !this.leftSide) {
            return 'translateX(0)';
        }

        const pageRect = this.page.getBoundingClientRect();
        const mainRect = this.lyricsMain.getBoundingClientRect();

        // 获取左侧内容的实际内容区域
        const coverSection = this.leftSide.querySelector('.lyrics-cover-section');
        if (!coverSection) {
            return 'translateX(0)';
        }

        const coverRect = coverSection.getBoundingClientRect();

        // 计算页面中心位置（相对于main容器）
        const pageCenterX = pageRect.width / 2;

        // 计算内容当前中心位置（相对于main容器）
        const contentCenterX = coverRect.left + coverRect.width / 2 - mainRect.left;

        // 计算需要移动的距离
        const translateX = pageCenterX - contentCenterX;
        return `translateX(${translateX}px)`;
    }

    // 应用动态居中
    applyDynamicCenter(): void {
        if (!this.leftSide) return;

        const transform = this.calculateCenterTransform();
        this.leftSide.style.setProperty('--dynamic-center-transform', transform);

        // 添加CSS变量支持的类
        this.page.classList.add('dynamic-center');
    }

    // 切换布局模式
    toggleLayoutMode(): void {
        if (this.isTransitioning || !this.isLayoutSwitchSupported() || !this.page) {
            return;
        }

        this.isTransitioning = true;
        this.isCenterMode = !this.isCenterMode;
        if (this.isCenterMode) {
            // 进入居中模式：计算并应用动态居中
            this.applyDynamicCenter();
        } else {
            // 退出居中模式：移除动态居中
            this.page.classList.remove('dynamic-center');
        }

        // 切换CSS类，让CSS动画处理过渡效果
        this.page.classList.toggle('center-mode', this.isCenterMode);

        // 设置动画完成后的回调
        setTimeout(() => {
            this.isTransitioning = false;
        }, 800);
    }

    // 重置布局状态
    resetLayoutState(): void {
        if (!this.page) {
            return;
        }

        // 重置状态变量
        this.isCenterMode = false;
        this.isTransitioning = false;

        // 移除所有布局相关的类
        this.page.classList.remove('center-mode', 'dynamic-center');

        // 清理动态CSS变量
        if (this.leftSide) {
            this.leftSide.style.removeProperty('--dynamic-center-transform');
        }
    }

    private requireElement<T extends HTMLElement = HTMLElement>(element: Element | null, selector: string): T {
        if (element instanceof HTMLElement) {
            return element as T;
        }

        throw new Error(`Element not found: ${selector}`);
    }

    private queryElement<T extends HTMLElement = HTMLElement>(selector: string): T {
        const element = this.page?.querySelector<T>(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        return element;
    }

    private queryChildElement<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
        const element = root.querySelector<T>(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        return element;
    }

    private getPlaybackControlElements(): LyricsPlaybackControlElements {
        return {
            playBtn: this.playBtn,
            prevBtn: this.prevBtn,
            nextBtn: this.nextBtn,
            playIcon: this.playIcon,
            pauseIcon: this.pauseIcon,
            progressBar: this.progressBar,
            progressFill: this.progressFill,
            progressHandle: this.progressHandle,
            currentTimeEl: this.currentTimeEl,
            durationEl: this.durationEl,
            volumeBtn: this.volumeBtn,
            volumeSliderContainer: this.volumeSliderContainer,
            volumeFill: this.volumeFill,
            volumeHandle: this.volumeHandle,
            volumeIcon: this.volumeIcon,
            volumeMuteIcon: this.volumeMuteIcon,
            volumeHalfIcon: this.volumeHalfIcon,
            playModeBtn: this.playModeBtn,
            modeSequenceIcon: this.modeSequenceIcon,
            modeShuffleIcon: this.modeShuffleIcon,
            modeRepeatOneIcon: this.modeRepeatOneIcon
        };
    }
}

export {Lyrics};
