/**
 * 桌面歌词页面
 */

import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {DesktopLyricsSettings as ApiDesktopLyricsSettings} from '@api/types/settings';
import type {Track} from '@api/types/library';
import {desktopLyricsGateway} from '@js/infrastructure/electron';

interface DesktopLyricWord {
    time: number;
    endTime?: number;
    text: string;
}

interface DesktopLyricLine {
    time: number;
    endTime?: number;
    content?: string;
    type?: string;
    words?: DesktopLyricWord[];
}

interface DesktopLyricsSettings extends ApiDesktopLyricsSettings {
    layoutMode: 'default' | 'center';
    themeColor: string;
    fontColor: string;
    opacity: number;
    fontSize: number;
}

interface DragPosition {
    x: number;
    y: number;
}

declare global {
    interface Window {
        desktopLyrics?: DesktopLyrics;
    }
}

class DesktopLyrics {
    private container: HTMLElement;
    private currentLyricEl: HTMLElement;
    private nextLyricEl: HTMLElement;
    private lockBtn: HTMLElement;
    private lockIcon: HTMLElement;
    private unlockIcon: HTMLElement;
    private closeBtn: HTMLElement;
    private lyrics: DesktopLyricLine[];
    private currentLyricIndex: number;
    isPlaying: boolean;
    currentPosition: number;
    private isLocked: boolean;
    isHovering: boolean;
    isDragging: boolean;
    dragStartPos: DragPosition;
    private settings: DesktopLyricsSettings;
    private _currentPlaybackPosition: number;
    private _lastMonotonicPosition: number;
    private _rafId: number | null;
    private _lastWordUpdateTime: number;
    private _wordUpdateInterval: number;

    constructor() {
        this.container = document.getElementById('desktop-lyrics') as HTMLElement;
        this.currentLyricEl = document.querySelector('.current-lyric .lyric-text') as HTMLElement;
        this.nextLyricEl = document.querySelector('.next-lyric .lyric-text') as HTMLElement;
        this.lockBtn = document.getElementById('lock-btn') as HTMLElement;
        this.lockIcon = this.lockBtn.querySelector('.lock-icon') as HTMLElement;
        this.unlockIcon = this.lockBtn.querySelector('.unlock-icon') as HTMLElement;
        this.closeBtn = document.getElementById('close-btn') as HTMLElement;

        // 歌词数据
        this.lyrics = [];
        this.currentLyricIndex = -1;

        // 播放状态
        this.isPlaying = false;
        this.currentPosition = 0;

        // 窗口状态
        this.isLocked = false;

        // 鼠标悬停状态
        this.isHovering = false;

        // 拖动状态
        this.isDragging = false;
        this.dragStartPos = {x: 0, y: 0};

        // 设置
        this.settings = {
            layoutMode: 'default',
            themeColor: '#64b5f6',
            fontColor: '#000',
            opacity: 0.9,
            fontSize: 48
        };

        // 逐字高亮相关
        this._currentPlaybackPosition = 0;
        this._lastMonotonicPosition = 0;
        this._rafId = null;
        this._lastWordUpdateTime = 0;
        this._wordUpdateInterval = 16;

        this.init();
    }

    init(): void {
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
        this.applySettings();
        this.showDefaultLyrics();
    }

    setupEventListeners(): void {
        // 锁定/解锁按钮
        this.lockBtn.addEventListener('click', () => {
            this.toggleLock();
        });

        // 关闭按钮
        this.closeBtn.addEventListener('click', async () => {
            await this.close();
        });

        // 控制栏鼠标事件（锁定状态下动态控制穿透）
        const controlsBar = document.querySelector('.controls-bar') as HTMLElement;
        controlsBar.addEventListener('mouseenter', () => {
            if (this.isLocked) {
                desktopLyricsGateway.setIgnoreMouseEvents(false);
            }
        });

        controlsBar.addEventListener('mouseleave', () => {
            if (this.isLocked) {
                desktopLyricsGateway.setIgnoreMouseEvents(true, {forward: true});
            }
        });
    }

    setupIPCListeners(): void {
        // 监听歌词更新
        desktopLyricsGateway.onLyricsUpdated((lyricsData) => {
            this.updateLyrics(lyricsData as DesktopLyricLine[] | string);
        });

        // 监听播放进度变化
        desktopLyricsGateway.onPositionChanged((position) => {
            this.updatePosition(position);
        });

        // 监听播放状态变化
        desktopLyricsGateway.onPlaybackStateChanged((state: DesktopLyricsPlaybackState) => {
            this.isPlaying = state?.isPlaying || false;
        });

        // 监听歌曲变化
        desktopLyricsGateway.onTrackChanged((_track: Track | null) => {
            this.resetLyrics();
        });

        // 监听设置变化
        desktopLyricsGateway.onSettingsChanged((settings) => {
            this.updateSettings(settings as Partial<DesktopLyricsSettings>);
        });
    }

    showDefaultLyrics(): void {
        this.currentLyricEl.textContent = '暂无歌词';
        this.nextLyricEl.textContent = '';
    }

    // 更新歌词数据
    updateLyrics(lyricsData: DesktopLyricLine[] | string): void {
        if (!lyricsData || !Array.isArray(lyricsData)) {
            this.lyrics = [];
            this.showDefaultLyrics();
            return;
        }

        this.lyrics = lyricsData;
        this.currentLyricIndex = -1;
        this.renderCurrentLyric();
    }

    // 更新播放进度
    updatePosition(position: number): void {
        if (typeof position !== 'number' || isNaN(position)) {
            return;
        }

        // 单调时间处理（防止时间回跳导致歌词闪烁）
        const timeDiff = position - this._lastMonotonicPosition;

        if (timeDiff < -0.5) {
            // 大幅回退，重置状态
            this._lastMonotonicPosition = position;
            this._currentPlaybackPosition = position;
            this.resetWordHighlightStates(position);
        } else if (timeDiff >= -0.05) {
            // 正常前进或微小回退
            const monotonicTime = Math.max(position, this._lastMonotonicPosition);
            this._lastMonotonicPosition = monotonicTime;
            this._currentPlaybackPosition = monotonicTime;
            position = monotonicTime;
        } else {
            // 中等回退，也当作seek处理
            this._lastMonotonicPosition = position;
            this._currentPlaybackPosition = position;
            this.resetWordHighlightStates(position);
        }

        this.currentPosition = position;
        this.updateLyricHighlight(position);
    }

    // 更新歌词高亮
    updateLyricHighlight(currentTime: number): void {
        if (!this.lyrics || this.lyrics.length === 0) {
            return;
        }

        // 找到当前时间对应的歌词索引
        let newIndex = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果索引变化，更新显示
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.renderCurrentLyric();
        }

        // 处理逐字高亮
        if (newIndex >= 0 && this.lyrics[newIndex].type === 'word-by-word') {
            this.updateWordHighlight(newIndex, currentTime);
        }
    }

    // 渲染当前歌词
    renderCurrentLyric(): void {
        if (this.currentLyricIndex < 0 || this.currentLyricIndex >= this.lyrics.length) {
            this.currentLyricEl.textContent = '暂无歌词';
            this.nextLyricEl.textContent = '';
            return;
        }

        const currentLyric = this.lyrics[this.currentLyricIndex];
        const nextLyric = this.lyrics[this.currentLyricIndex + 1];

        // 渲染当前歌词
        if (currentLyric.type === 'word-by-word' && currentLyric.words) {
            const wordsHTML = currentLyric.words.map((word, index) => {
                return `<span class="lyric-word" data-word-index="${index}" data-word-time="${word.time}" data-word-text="${word.text}">${word.text}</span>`;
            }).join('');
            this.currentLyricEl.innerHTML = wordsHTML;
        } else {
            this.currentLyricEl.textContent = currentLyric.content || '';
        }

        // 渲染下一句歌词
        if (nextLyric) {
            if (nextLyric.type === 'word-by-word' && nextLyric.words) {
                this.nextLyricEl.textContent = nextLyric.words.map(w => w.text).join('');
            } else {
                this.nextLyricEl.textContent = nextLyric.content || '';
            }
        } else {
            this.nextLyricEl.textContent = '';
        }
    }

    // 更新逐字高亮
    updateWordHighlight(lineIndex: number, currentTime: number): void {
        const lyric = this.lyrics[lineIndex];
        if (!lyric || !lyric.words || lyric.words.length === 0) {
            return;
        }
        const lyricWords = lyric.words;

        // 节流控制
        const now = performance.now();
        const timeSinceLastUpdate = now - this._lastWordUpdateTime;

        if (timeSinceLastUpdate < this._wordUpdateInterval) {
            return;
        }

        this._lastWordUpdateTime = now;

        // 取消之前的RAF
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
        }

        // 使用RAF优化DOM操作
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;

            const latestTime = this._currentPlaybackPosition !== undefined ? this._currentPlaybackPosition : currentTime;
            const words = this.currentLyricEl.querySelectorAll<HTMLElement>('.lyric-word');

            for (let i = 0; i < lyricWords.length; i++) {
                const word = lyricWords[i];
                const wordElement = words[i];

                if (!wordElement) continue;

                // 已经播放完的字跳过
                if (wordElement.classList.contains('played')) {
                    continue;
                }

                const wordStartTime = word.time;
                const wordEndTime = word.endTime || (lyricWords[i + 1] ? lyricWords[i + 1].time : lyric.endTime || wordStartTime + 0.5);

                if (latestTime < wordStartTime) {
                    // 未播放
                    if (wordElement.classList.contains('highlight')) {
                        wordElement.classList.remove('highlight');
                        wordElement.style.setProperty('--word-progress', '0');
                    }
                } else if (latestTime >= wordEndTime) {
                    // 已播放
                    wordElement.classList.remove('highlight');
                    wordElement.classList.add('played');
                    wordElement.style.setProperty('--word-progress', '1');
                } else {
                    // 正在播放 - 计算进度并应用渐进填充效果
                    const duration = wordEndTime - wordStartTime;
                    const progress = duration > 0 ? (latestTime - wordStartTime) / duration : 1;
                    const clampedProgress = Math.max(0, Math.min(1, progress));

                    if (!wordElement.classList.contains('highlight')) {
                        wordElement.classList.add('highlight');
                    }

                    // 更新进度（实现填充扫过效果）
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

    // 重置逐字高亮状态
    resetWordHighlightStates(seekPosition: number): void {
        const words = this.currentLyricEl.querySelectorAll('.lyric-word');
        words.forEach(wordElement => {
            const wordTime = parseFloat((wordElement as HTMLElement).dataset.wordTime || '0');
            if (wordTime > seekPosition) {
                wordElement.classList.remove('highlight', 'played');
                (wordElement as HTMLElement).style.setProperty('--word-progress', '0');
            }
        });
    }

    // 重置歌词
    resetLyrics(): void {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this._lastMonotonicPosition = 0;
        this._currentPlaybackPosition = 0;
        this.showDefaultLyrics();
    }

    // 切换锁定状态
    toggleLock(): void {
        this.isLocked = !this.isLocked;
        this.applyLockState();
    }

    // 应用锁定状态
    async applyLockState(): Promise<void> {
        if (this.isLocked) {
            this.container.classList.add('locked');
            this.lockBtn.classList.add('locked');
            this.lockBtn.title = '解锁';
            // 切换图标显示
            this.lockIcon.style.display = 'none';
            this.unlockIcon.style.display = 'block';
            // 锁定时启用鼠标穿透
            await desktopLyricsGateway.setIgnoreMouseEvents(true, {forward: true});
        } else {
            this.container.classList.remove('locked');
            this.lockBtn.classList.remove('locked');
            this.lockBtn.title = '锁定';
            // 切换图标显示
            this.lockIcon.style.display = 'block';
            this.unlockIcon.style.display = 'none';
            // 解锁时禁用鼠标穿透
            await desktopLyricsGateway.setIgnoreMouseEvents(false);
        }
    }

    // 关闭窗口
    async close(): Promise<void> {
        await desktopLyricsGateway.close();
    }

    // 加载设置
    loadSettings(): void {
        try {
            const savedSettings = localStorage.getItem('desktop-lyrics-settings');
            if (savedSettings) {
                this.settings = {...this.settings, ...JSON.parse(savedSettings) as Partial<DesktopLyricsSettings>};
            }
        } catch (error) {
            console.error('❌ 桌面歌词: 加载设置失败', error);
        }
    }

    // 保存设置
    saveSettings(): void {
        try {
            localStorage.setItem('desktop-lyrics-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('❌ 桌面歌词: 保存设置失败', error);
        }
    }

    // 更新设置
    updateSettings(newSettings?: Partial<DesktopLyricsSettings>): void {
        if (!newSettings) return;

        this.settings = {...this.settings, ...newSettings};
        this.saveSettings();
        this.applySettings();
    }

    // 应用设置
    async applySettings(): Promise<void> {
        const {layoutMode, themeColor, fontColor, opacity, fontSize} = this.settings;

        // 应用主题颜色
        document.documentElement.style.setProperty('--theme-color', themeColor);

        // 应用字体颜色
        if (fontColor) {
            document.documentElement.style.setProperty('--dl-font-color', fontColor);
        }

        // 应用字体大小
        document.documentElement.style.setProperty('--lyric-font-size', `${fontSize}px`);

        // 应用透明度
        try {
            await desktopLyricsGateway.setOpacity(opacity);
        } catch (error) {
            console.error('❌ 桌面歌词: 设置透明度失败', error);
        }

        // 应用布局模式
        if (layoutMode === 'center') {
            // 居中模式
            this.container.classList.add('center-mode');

            // 设置为不置顶（置于最下层）
            try {
                await desktopLyricsGateway.setAlwaysOnTop(false);
            } catch (error) {
                console.error('❌ 桌面歌词: 设置置顶状态失败', error);
            }

            // 居中模式下启用真正的鼠标穿透
            try {
                await desktopLyricsGateway.setIgnoreMouseEvents(true, {forward: true});
            } catch (error) {
                console.error('❌ 桌面歌词: 设置鼠标穿透失败', error);
            }

            // 居中窗口到屏幕底部
            try {
                await desktopLyricsGateway.centerOnScreen();
            } catch (error) {
                console.error('❌ 桌面歌词: 居中窗口失败', error);
            }

            // 居中模式下自动解锁（因为无法交互）
            if (this.isLocked) {
                this.isLocked = false;
                this.container.classList.remove('locked');
                this.lockBtn.classList.remove('locked');
            }
        } else {
            // 默认模式
            this.container.classList.remove('center-mode');

            // 设置为置顶
            try {
                await desktopLyricsGateway.setAlwaysOnTop(true);
            } catch (error) {
                console.error('❌ 桌面歌词: 设置置顶状态失败', error);
            }

            // 默认模式下根据锁定状态设置穿透
            if (this.isLocked) {
                await desktopLyricsGateway.setIgnoreMouseEvents(true, {forward: true});
            } else {
                await desktopLyricsGateway.setIgnoreMouseEvents(false);
            }
        }

        console.log('🎵 桌面歌词: 设置已应用', this.settings);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.desktopLyrics = new DesktopLyrics();
});
