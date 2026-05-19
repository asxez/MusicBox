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
import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from "@js/features/playback";
import type {PlayMode} from "@api/types/playback";
import type {LyricsElements} from "@ui/widgets/lyrics/LyricsElementRegistry";
import type {LyricsTrack, RenderLyricLine} from "@ui/widgets/lyrics/LyricsTypes";

class Lyrics extends Component {
    public isVisible: boolean;
    public isFullscreen: boolean;
    private currentTrack: LyricsTrack | null;
    private lyrics: RenderLyricLine[];
    private currentLyricIndex: number;
    private listenersSetup: boolean;
    private elements!: LyricsElements;
    private coverArtController!: LyricsCoverArtController;
    private layoutController!: LyricsLayoutController;
    private lyricsLoader!: LyricsLoaderController;
    private playbackControls!: LyricsPlaybackControlsController;
    private _lastTrackPath: string | null;
    private _updateTrackInfoInProgress: boolean;
    private _pendingUpdatePromise: Promise<void> | null;
    private _currentPlaybackPosition: number;
    private _lastMonotonicPosition: number;
    private _rafId: number | null;
    private _lastWordUpdateTime: number;
    private _wordUpdateInterval: number;
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
        this._updateTrackInfoInProgress = false; // 是否正在更新歌曲信息
        this._pendingUpdatePromise = null; // 当前正在执行的更新Promise

        // 逐字高亮相关状态
        this._currentPlaybackPosition = 0; // 当前播放位置
        this._lastMonotonicPosition = 0; // 上次的单调递增位置（用于防止时间回跳）
        this._rafId = null; // requestAnimationFrame ID
        this._lastWordUpdateTime = 0; // 上次逐字更新的时间戳
        this._wordUpdateInterval = 16; // 逐字更新间隔（毫秒），约60fps

        this.isFullscreen = false;
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
        this._lastTrackPath = null;
        this.lyricsLoader.reset();
        this._updateTrackInfoInProgress = false;
        this._pendingUpdatePromise = null;

        // 重置单调时间状态
        this._lastMonotonicPosition = 0;
        this._currentPlaybackPosition = 0;

        setTimeout(() => {
            if (!this.isVisible) {
                this.elements.page.style.display = 'none';
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

        this.layoutController.resetLayoutState();
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

        this.lyricsLoader = new LyricsLoaderController({
            setLyrics: (lyrics) => {
                this.lyrics = lyrics;
            },
            renderLyrics: () => {
                this.renderLyrics();
            },
            showLoading: () => {
                this.showLoading();
            },
            showNoLyrics: () => {
                this.showNoLyrics();
            }
        });

        this.playbackControls = new LyricsPlaybackControlsController({
            elements: this.elements.playback,
            addDomListener: (element, event, handler, options) => {
                this.addEventListenerManaged(element, event, handler, options);
            },
            getCurrentTrack: () => this.currentTrack
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

            this.elements.trackTitle.textContent = track.title || '未知歌曲';
            this.elements.trackArtist.textContent = track.artist || '未知艺术家';

            this.playbackControls.updateTrackDuration(track.duration);

            // 更新封面和歌词
            await this.lyricsLoader.loadLyrics(track);
            await this.coverArtController.updateCoverArt(track);
        } catch (error) {
            console.error('❌ Lyrics: 歌曲信息更新失败:', error);
            throw error;
        }
    }

    showLoading(): void {
        this.elements.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <p class="lyrics-line loading">正在加载歌词...</p>
            </div>
        `;
    }

    showNoLyrics(): void {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.elements.lyricsDisplay.innerHTML = `
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

        this.elements.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                ${lyricsHTML}
                <div class="lyrics-line-spacer"></div>
            </div>
        `;

        // 重置滚动位置到顶部，确保从第一行歌词开始显示
        this.elements.lyricsDisplay.scrollTop = 0;
        // 添加点击事件，允许用户跳转到指定时间
        this.elements.lyricsDisplay.querySelectorAll<HTMLElement>('.lyrics-line').forEach((line) => {
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
                const prevLine = this.elements.lyricsDisplay.querySelector(`[data-index="${this.currentLyricIndex}"]`);
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
                const currentLine = this.elements.lyricsDisplay.querySelector(`[data-index="${newIndex}"]`);
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

        const currentLine = this.elements.lyricsDisplay.querySelector(`[data-index="${lineIndex}"]`);
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
        if (!this.elements.lyricsDisplay) return;

        // 获取所有歌词行
        const allLines = this.elements.lyricsDisplay.querySelectorAll<HTMLElement>('.lyrics-line.lyrics-word-by-word');

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
