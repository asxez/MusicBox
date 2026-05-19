import {mediaController} from "@js/features/media";
import {playbackController} from "@js/features/playback";
import type {Unsubscribe} from "@js/features/playback";
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

class MiniModeLyricsController {
    private readonly rootElement: Element | null;
    private readonly lyricsUpdateInterval = 16;

    private active = false;
    private lyricsRafId: number | null = null;
    private lyricsLastUpdateTime = 0;
    private currentLyricIndex = -1;
    private lyrics: MiniModeLyricLine[] = [];
    private positionUnsubscribe: Unsubscribe | null = null;

    constructor(rootElement: Element | null) {
        this.rootElement = rootElement;
    }

    start(): void {
        this.active = true;
        this.subscribePositionChanges();
    }

    stop(): void {
        this.active = false;
        this.unsubscribePositionChanges();
        this.cancelLyricsFrame();
        this.resetLyrics(false);
        this.removeElement();
    }

    clear(): void {
        this.resetLyrics(true);
    }

    removeElement(): void {
        document.querySelectorAll('.mini-mode-lyrics').forEach((element) => {
            element.remove();
        });
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
            console.log(`✅ MiniModeLyricsController: 迷你模式歌词加载成功，共${parsedLyrics.length}行，当前索引:${this.currentLyricIndex}，播放位置:${currentTime.toFixed(2)}s`);
            this.updateLyrics();
        } catch (error) {
            console.error('❌ MiniModeLyricsController: 迷你模式歌词加载失败:', error);
            this.resetLyrics(true);
        }
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
            console.warn('⚠️ MiniModeLyricsController: 移除播放位置监听失败:', error);
        }
        this.positionUnsubscribe = null;
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

    private cancelLyricsFrame(): void {
        if (!this.lyricsRafId) return;

        cancelAnimationFrame(this.lyricsRafId);
        this.lyricsRafId = null;
    }
}

export {MiniModeLyricsController};
