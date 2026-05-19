import {mediaController} from "@js/features/media";
import {playbackController} from "@js/features/playback";
import type {Unsubscribe} from "@js/features/playback";
import type {AddManagedDomListener, ManagedDomTarget, RemoveManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";
import type {LyricLine} from "@api/types/lyrics";
import type {Track} from "@api/types/track";

interface MiniModeLyricWord {
    text: string;
    time: number;
    endTime?: number | null;
}

interface MiniModeLyricLine extends LyricLine {
    endTime?: number | null;
    words?: MiniModeLyricWord[];
}

interface MiniModePlayerViewOptions {
    rootElement: Element | null;
    trackCover: HTMLImageElement;
    miniModeButton: HTMLButtonElement | null;
    addDomListener: AddManagedDomListener;
    removeDomListener: RemoveManagedDomListener;
}

class MiniModePlayerView {
    private readonly rootElement: Element | null;
    private readonly trackCover: HTMLImageElement;
    private readonly miniModeButton: HTMLButtonElement | null;
    private readonly addDomListener: MiniModePlayerViewOptions['addDomListener'];
    private readonly removeDomListener: MiniModePlayerViewOptions['removeDomListener'];
    private readonly lyricsUpdateInterval = 16;

    private active = false;
    private lyricsRafId: number | null = null;
    private lyricsLastUpdateTime = 0;
    private currentLyricIndex = -1;
    private lyrics: MiniModeLyricLine[] = [];
    private mouseEnterHandler: EventListener | null = null;
    private mouseLeaveHandler: EventListener | null = null;
    private appContainer: ManagedDomTarget | null = null;
    private positionUnsubscribe: Unsubscribe | null = null;

    constructor(options: MiniModePlayerViewOptions) {
        this.rootElement = options.rootElement;
        this.trackCover = options.trackCover;
        this.miniModeButton = options.miniModeButton;
        this.addDomListener = options.addDomListener;
        this.removeDomListener = options.removeDomListener;
    }

    async enter(track: Track | null, currentTime: number): Promise<void> {
        this.active = true;
        document.body.classList.add('mini-mode');
        document.body.classList.add('mini-mode-collapsed');
        this.updateButtonState(true);
        this.bindHoverCollapse();

        await this.updateBackground();
        await this.loadTrackLyrics(track, currentTime);
        this.subscribePositionChanges();
        this.updateLyrics();
    }

    beginExit(): void {
        this.removeLyricsElement();
        document.body.classList.remove('mini-mode');
    }

    completeExit(): void {
        this.active = false;
        this.updateButtonState(false);
        this.unbindHoverCollapse();
        this.unsubscribePositionChanges();
        this.cancelLyricsFrame();
        this.resetLyrics(false);
        this.removeLyricsElement();
        document.body.classList.remove('mini-mode-collapsed');
        this.clearBackground();
    }

    destroy(): void {
        document.body.classList.remove('mini-mode', 'mini-mode-collapsed');
        this.unbindHoverCollapse();
        this.unsubscribePositionChanges();
        this.cancelLyricsFrame();
        this.resetLyrics(false);
        this.removeLyricsElement();
        this.clearBackground();
        this.active = false;
    }

    clearLyrics(): void {
        this.resetLyrics(true);
    }

    async updateBackground(): Promise<void> {
        if (!this.active) return;

        const coverImg = this.trackCover;
        if (
            coverImg &&
            coverImg.complete &&
            coverImg.naturalWidth > 0 &&
            coverImg.src &&
            !coverImg.src.includes('default-cover.svg')
        ) {
            try {
                const dominantColor = await this.extractDominantColor(coverImg);
                document.documentElement.style.setProperty('--mini-mode-bg-color', dominantColor);
                return;
            } catch (error) {
                console.error('❌ MiniModePlayerView: 提取封面主色失败:', error);
            }
        }

        this.setDefaultBackground();
    }

    async loadTrackLyrics(track: Track | null, currentTime: number): Promise<void> {
        if (!track || !track.title || !track.artist) {
            this.resetLyrics(true);
            return;
        }

        try {
            const parsedLyrics = await this.resolveLyrics(track);
            if (!parsedLyrics || parsedLyrics.length === 0) {
                this.resetLyrics(true);
                return;
            }

            this.lyrics = parsedLyrics;
            this.currentLyricIndex = this.findLyricIndex(currentTime);
            console.log(`✅ MiniModePlayerView: 迷你模式歌词加载成功，共${parsedLyrics.length}行，当前索引:${this.currentLyricIndex}，播放位置:${currentTime.toFixed(2)}s`);
            this.updateLyrics();
        } catch (error) {
            console.error('❌ MiniModePlayerView: 迷你模式歌词加载失败:', error);
            this.resetLyrics(true);
        }
    }

    private bindHoverCollapse(): void {
        if (this.appContainer) return;

        const appContainer = document.querySelector('.app') as ManagedDomTarget | null;
        if (!appContainer) return;

        this.mouseEnterHandler = () => {
            document.body.classList.remove('mini-mode-collapsed');
        };
        this.mouseLeaveHandler = () => {
            document.body.classList.add('mini-mode-collapsed');
        };

        this.addDomListener(appContainer, 'mouseenter', this.mouseEnterHandler);
        this.addDomListener(appContainer, 'mouseleave', this.mouseLeaveHandler);
        this.appContainer = appContainer;
    }

    private unbindHoverCollapse(): void {
        if (!this.appContainer || !this.mouseEnterHandler || !this.mouseLeaveHandler) {
            this.appContainer = null;
            this.mouseEnterHandler = null;
            this.mouseLeaveHandler = null;
            return;
        }

        this.removeDomListener(this.appContainer, 'mouseenter', this.mouseEnterHandler);
        this.removeDomListener(this.appContainer, 'mouseleave', this.mouseLeaveHandler);
        this.appContainer = null;
        this.mouseEnterHandler = null;
        this.mouseLeaveHandler = null;
    }

    private subscribePositionChanges(): void {
        this.unsubscribePositionChanges();
        this.positionUnsubscribe = playbackController.on('positionChanged', (position) => {
            this.updateLyricIndex(position);
            this.updateLyricsWordHighlight(position);
        });
    }

    private unsubscribePositionChanges(): void {
        if (!this.positionUnsubscribe) return;

        try {
            this.positionUnsubscribe();
        } catch (error) {
            console.warn('⚠️ MiniModePlayerView: 移除播放位置监听失败:', error);
        }
        this.positionUnsubscribe = null;
    }

    private updateButtonState(active: boolean): void {
        if (!this.miniModeButton) return;

        if (active) {
            this.miniModeButton.classList.add('active');
            this.miniModeButton.title = '退出迷你模式';
            return;
        }

        this.miniModeButton.classList.remove('active');
        this.miniModeButton.title = '迷你模式';
    }

    private resetLyrics(renderEmptyState: boolean): void {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        if (renderEmptyState) {
            this.showNoLyrics();
        }
    }

    private async resolveLyrics(track: Track): Promise<MiniModeLyricLine[] | null> {
        if (track.lyrics) {
            return Array.isArray(track.lyrics) ? track.lyrics as MiniModeLyricLine[] : null;
        }

        const lyricsResult = await mediaController.getLyrics(track.title, track.artist, track.album, track.filePath);
        if (!lyricsResult.success) {
            return null;
        }

        if (lyricsResult.format === 'ttml' && lyricsResult.content) {
            return mediaController.parseTTML(lyricsResult.content) as MiniModeLyricLine[];
        }
        if (lyricsResult.lrc) {
            return mediaController.parseLRC(lyricsResult.lrc) as MiniModeLyricLine[];
        }
        if (lyricsResult.content) {
            return mediaController.parseLyrics(lyricsResult.content, lyricsResult.format) as MiniModeLyricLine[];
        }

        return null;
    }

    private findLyricIndex(currentTime: number): number {
        if (this.lyrics.length === 0) {
            return -1;
        }

        let index = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                index = i;
            } else {
                break;
            }
        }

        return index === -1 ? 0 : index;
    }

    private updateLyricIndex(currentTime: number): void {
        if (this.lyrics.length === 0) {
            return;
        }

        const newIndex = this.findLyricIndex(currentTime);
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.updateLyrics();
        }
    }

    private updateLyrics(): void {
        if (!this.active) return;

        if (this.lyrics.length === 0) {
            this.showNoLyrics();
            return;
        }

        if (this.currentLyricIndex < 0 || this.currentLyricIndex >= this.lyrics.length) {
            this.showNoLyrics();
            return;
        }

        const currentLyric = this.lyrics[this.currentLyricIndex];
        const miniLyricsElement = this.getOrCreateLyricsElement();
        if (!miniLyricsElement) return;

        const isWordByWord = currentLyric.type === 'word-by-word' && currentLyric.words && currentLyric.words.length > 0;
        if (isWordByWord) {
            this.renderWordByWordLyrics(miniLyricsElement, currentLyric.words ?? []);
            return;
        }

        miniLyricsElement.classList.remove('lyrics-word-by-word');
        miniLyricsElement.textContent = currentLyric.content || '暂无歌词';
    }

    private renderWordByWordLyrics(element: HTMLElement, words: MiniModeLyricWord[]): void {
        element.classList.add('lyrics-word-by-word');
        element.innerHTML = '';

        words.forEach((word, index) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'lyric-word';
            wordSpan.setAttribute('data-word-index', String(index));
            wordSpan.setAttribute('data-word-time', String(word.time));
            wordSpan.setAttribute('data-word-text', word.text);
            wordSpan.textContent = word.text;
            wordSpan.style.setProperty('--word-progress', '0');
            element.appendChild(wordSpan);
        });
    }

    private updateLyricsWordHighlight(currentTime: number): void {
        if (!this.active) return;

        const miniLyricsElement = document.querySelector<HTMLElement>('.mini-mode-lyrics');
        if (!miniLyricsElement || !miniLyricsElement.classList.contains('lyrics-word-by-word')) {
            return;
        }

        const now = performance.now();
        if (now - this.lyricsLastUpdateTime < this.lyricsUpdateInterval) {
            return;
        }
        this.lyricsLastUpdateTime = now;

        const words = miniLyricsElement.querySelectorAll<HTMLElement>('.lyric-word');
        if (words.length === 0) return;

        this.cancelLyricsFrame();
        this.lyricsRafId = requestAnimationFrame(() => {
            this.lyricsRafId = null;
            this.renderWordProgress(words, currentTime);
        });
    }

    private renderWordProgress(words: NodeListOf<HTMLElement>, currentTime: number): void {
        for (let i = 0; i < words.length; i++) {
            const wordElement = words[i];
            const wordStartTime = parseFloat(wordElement.getAttribute('data-word-time') || '0');
            const wordEndTime = i < words.length - 1
                ? parseFloat(words[i + 1].getAttribute('data-word-time') || '0')
                : wordStartTime + 0.5;

            if (currentTime < wordStartTime) {
                wordElement.classList.remove('highlight', 'played');
                wordElement.style.setProperty('--word-progress', '0');
            } else if (currentTime >= wordEndTime) {
                wordElement.classList.remove('highlight');
                wordElement.classList.add('played');
                wordElement.style.setProperty('--word-progress', '1');
            } else {
                const duration = wordEndTime - wordStartTime;
                const progress = duration > 0 ? (currentTime - wordStartTime) / duration : 1;
                const clampedProgress = Math.max(0, Math.min(1, progress));

                wordElement.classList.add('highlight');
                wordElement.classList.remove('played');
                wordElement.style.setProperty('--word-progress', clampedProgress.toFixed(2));
            }
        }
    }

    private showNoLyrics(): void {
        const miniLyricsElement = this.getOrCreateLyricsElement();
        if (!miniLyricsElement) return;

        miniLyricsElement.classList.remove('lyrics-word-by-word');
        miniLyricsElement.textContent = '暂无歌词';
    }

    private getOrCreateLyricsElement(): HTMLElement | null {
        let miniLyricsElement = document.querySelector<HTMLElement>('.mini-mode-lyrics');
        if (miniLyricsElement) {
            return miniLyricsElement;
        }

        miniLyricsElement = document.createElement('div');
        miniLyricsElement.className = 'mini-mode-lyrics';
        const playerControls = this.rootElement?.querySelector('.controls');
        if (!playerControls) {
            return null;
        }

        playerControls.appendChild(miniLyricsElement);
        return miniLyricsElement;
    }

    private removeLyricsElement(): void {
        document.querySelectorAll('.mini-mode-lyrics').forEach((element) => {
            element.remove();
        });
    }

    private cancelLyricsFrame(): void {
        if (!this.lyricsRafId) return;

        cancelAnimationFrame(this.lyricsRafId);
        this.lyricsRafId = null;
    }

    private async extractDominantColor(imgElement: HTMLImageElement): Promise<string> {
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

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;

                for (let i = 0; i < data.length; i += 40) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                const brightness = (r + g + b) / 3;
                if (brightness > 200) {
                    r = Math.round(r * 0.6);
                    g = Math.round(g * 0.6);
                    b = Math.round(b * 0.6);
                } else if (brightness < 50) {
                    r = Math.min(255, Math.round(r * 1.5));
                    g = Math.min(255, Math.round(g * 1.5));
                    b = Math.min(255, Math.round(b * 1.5));
                }

                resolve(`${r}, ${g}, ${b}`);
            } catch (error) {
                console.error('❌ MiniModePlayerView: 读取封面像素失败:', error);
                resolve('60, 80, 120');
            }
        });
    }

    private setDefaultBackground(): void {
        document.documentElement.style.setProperty('--mini-mode-bg-color', '60, 80, 120');
    }

    private clearBackground(): void {
        document.documentElement.style.removeProperty('--mini-mode-bg-color');
    }
}

export {MiniModePlayerView};
