/**
 * 歌词页组件
 */

import {Component} from "@ui/base/Component";
import {playbackController} from "@js/features/playback";
import {LyricsCoverArtController} from "@ui/widgets/lyrics/LyricsCoverArtController";
import {resolveLyricsElements} from "@ui/widgets/lyrics/LyricsElementRegistry";
import {LyricsLayoutController} from "@ui/widgets/lyrics/LyricsLayoutController";
import {LyricsLoaderController} from "@ui/widgets/lyrics/LyricsLoaderController";
import {LyricsPlaybackControlsController} from "@ui/widgets/lyrics/LyricsPlaybackControlsController";
import {LyricsPlaybackStateController} from "@ui/widgets/lyrics/LyricsPlaybackStateController";
import {LyricsRenderController} from "@ui/widgets/lyrics/LyricsRenderController";
import {LyricsTrackInfoController} from "@ui/widgets/lyrics/LyricsTrackInfoController";
import type {PlayMode} from "@api/types/playback";
import type {LyricsElements} from "@ui/widgets/lyrics/LyricsElementRegistry";
import type {LyricsTrack} from "@ui/widgets/lyrics/LyricsTypes";

class Lyrics extends Component {
    public isVisible: boolean;
    public isFullscreen: boolean;
    private currentTrack: LyricsTrack | null;
    private listenersSetup: boolean;
    private elements!: LyricsElements;
    private coverArtController!: LyricsCoverArtController;
    private layoutController!: LyricsLayoutController;
    private lyricsLoader!: LyricsLoaderController;
    private playbackControls!: LyricsPlaybackControlsController;
    private playbackStateController!: LyricsPlaybackStateController;
    private renderController!: LyricsRenderController;
    private trackInfoController!: LyricsTrackInfoController;

    constructor(element: Element | null) {
        super(element);
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.listenersSetup = false; // 事件监听器是否已设置

        this.isFullscreen = false;

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
        this.elements.page.style.display = 'block';
        setTimeout(() => {
            this.elements.page.classList.add('show');
        }, 10);

        this.updateFullscreenState();
        await this.initializeControls();

        // 异步加载歌曲信息和歌词，不阻塞页面显示
        if (track) {
            await this.updateTrackInfo(track);
        }

        // 确保歌词显示区域滚动到顶部
        setTimeout(() => {
            if (this.elements.lyricsDisplay) {
                this.elements.lyricsDisplay.scrollTop = 0;
            }
        }, 50);
    }

    hide(): void {
        this.isVisible = false;
        this.elements.page.classList.remove('show');

        // 重置防重复状态
        this.trackInfoController.reset();
        this.lyricsLoader.reset();
        this.renderController.resetPlaybackPosition();

        setTimeout(() => {
            if (!this.isVisible) {
                this.elements.page.style.display = 'none';
            }
        }, 300);
    }

    destroy(): void {
        this.playbackStateController.destroy();

        // 清理歌词数据
        this.renderController.reset();
        this.currentTrack = null;

        // 重置状态
        this.isVisible = false;
        this.listenersSetup = false;

        this.layoutController.resetLayoutState();
        super.destroy();
    }

    setupElements(): void {
        this.elements = resolveLyricsElements(this.element);

        // 全屏状态
        this.isFullscreen = false;

        this.coverArtController = new LyricsCoverArtController({
            background: this.elements.background,
            trackCover: this.elements.trackCover
        });

        this.layoutController = new LyricsLayoutController({
            elements: this.elements.layout,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            isVisible: () => this.isVisible
        });

        this.renderController = new LyricsRenderController({
            lyricsDisplay: this.elements.lyricsDisplay,
            isVisible: () => this.isVisible,
            seek: async (time) => {
                await playbackController.seek(time);
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
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            getCurrentTrack: () => this.currentTrack
        });

        this.playbackStateController = new LyricsPlaybackStateController({
            isVisible: () => this.isVisible,
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
                this.currentTrack = track;
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

    setupEventListeners(): void {
        this.addEventListenerManaged(this.elements.closeBtn, 'click', () => {
            this.hide();
        });

        this.layoutController.bind();
        this.playbackControls.bind();
    }

    setupAPIListeners(): void {
        this.playbackStateController.bind();
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
        await this.trackInfoController.updateTrackInfo(track);
    }

    // 全屏功能方法
    toggleFullscreen(): void {
        this.layoutController.toggleFullscreen();
    }

    enterFullscreen(): void {
        this.layoutController.enterFullscreen();
    }

    exitFullscreen(): void {
        this.layoutController.exitFullscreen();
    }

    updateFullscreenState(): void {
        this.isFullscreen = this.layoutController.updateFullscreenState();
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

    // 重置布局状态
    resetLayoutState(): void {
        this.layoutController.resetLayoutState();
    }

}

export {Lyrics};
