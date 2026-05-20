import type {RenderLyricLine} from "@ui/widgets/lyrics/LyricsTypes";
import {appendLyricsWordSpans, findActiveLyricIndex, LyricsWordHighlightController} from "@/shared/lyrics";

interface LyricsRenderControllerOptions {
    lyricsDisplay: HTMLElement;
    isVisible: () => boolean;
    seek: (time: number) => Promise<void>;
}

class LyricsRenderController {
    private readonly lyricsDisplay: HTMLElement;
    private readonly isVisible: () => boolean;
    private readonly seek: (time: number) => Promise<void>;
    private lyrics: RenderLyricLine[] = [];
    private currentLyricIndex = -1;
    private readonly wordHighlightController = new LyricsWordHighlightController();
    private scrollAnimationFrame: number | null = null;
    private readonly lineScrollDurationMs = 220;

    constructor(options: LyricsRenderControllerOptions) {
        this.lyricsDisplay = options.lyricsDisplay;
        this.isVisible = options.isVisible;
        this.seek = options.seek;
    }

    setLyrics(lyrics: RenderLyricLine[]): void {
        this.lyrics = lyrics;
    }

    showLoading(): void {
        this.cancelScrollAnimation();
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <p class="lyrics-line loading">正在加载歌词...</p>
            </div>
        `;
    }

    showNoLyrics(): void {
        this.cancelScrollAnimation();
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.wordHighlightController.clearActiveHighlight();
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

        this.cancelScrollAnimation();
        this.lyricsDisplay.textContent = '';
        this.lyricsDisplay.appendChild(this.createLyricsContent());

        this.lyricsDisplay.scrollTop = 0;
        this.lyricsDisplay.querySelectorAll<HTMLElement>('.lyrics-line').forEach((line) => {
            line.addEventListener('click', () => {
                const time = parseFloat(line.dataset.time || '');
                if (!isNaN(time)) {
                    void this.seek(time);
                }
            });
        });

        this.currentLyricIndex = -1;
        this.wordHighlightController.clearActiveHighlight();
        this.wordHighlightController.resetPlaybackPosition();
    }

    private createLyricsContent(): DocumentFragment {
        const fragment = document.createDocumentFragment();
        const lyricsText = document.createElement('div');
        lyricsText.className = 'lyrics-text';
        lyricsText.appendChild(this.createSpacer());

        this.lyrics.forEach((lyric, index) => {
            lyricsText.appendChild(this.createLyricsLine(lyric, index));
        });

        lyricsText.appendChild(this.createSpacer());
        fragment.appendChild(lyricsText);

        return fragment;
    }

    private createLyricsLine(lyric: RenderLyricLine, index: number): HTMLElement {
        const line = document.createElement('p');
        line.className = 'lyrics-line';
        line.dataset.time = String(lyric.time);
        line.dataset.index = String(index);

        if (lyric.type === 'word-by-word' && lyric.words && lyric.words.length > 0) {
            line.classList.add('lyrics-word-by-word');
            appendLyricsWordSpans(line, lyric.words);
            return line;
        }

        line.textContent = lyric.content;
        return line;
    }

    private createSpacer(): HTMLElement {
        const spacer = document.createElement('div');
        spacer.className = 'lyrics-line-spacer';
        return spacer;
    }

    handlePlaybackPositionChanged(position: number): void {
        const updateResult = this.wordHighlightController.updatePlaybackPosition(position);
        if (updateResult.seeked) {
            this.resetWordHighlightStates(position);
        }

        this.updateLyricHighlight(updateResult.position);
    }

    resetPlaybackPosition(): void {
        this.wordHighlightController.resetPlaybackPosition();
    }

    setPlaying(isPlaying: boolean): void {
        this.wordHighlightController.setPlaying(isPlaying);
    }

    reset(): void {
        this.cancelScrollAnimation();
        this.wordHighlightController.reset();
        this.lyrics = [];
        this.currentLyricIndex = -1;
    }

    private updateLyricHighlight(currentTime: number): void {
        if (!this.lyrics || this.lyrics.length === 0 || !this.isVisible()) {
            return;
        }

        const newIndex = findActiveLyricIndex(this.lyrics, currentTime);

        if (newIndex !== this.currentLyricIndex) {
            if (this.currentLyricIndex >= 0) {
                const prevLine = this.lyricsDisplay.querySelector(`[data-index="${this.currentLyricIndex}"]`);
                if (prevLine) {
                    prevLine.classList.remove('highlight');
                    const words = prevLine.querySelectorAll('.lyric-word');
                    words.forEach(word => {
                        word.classList.remove('highlight');
                    });
                }
            }

            if (newIndex >= 0) {
                const currentLine = this.lyricsDisplay.querySelector<HTMLElement>(`[data-index="${newIndex}"]`);
                if (currentLine) {
                    currentLine.classList.add('highlight');

                    if (currentTime > 0 && this.currentLyricIndex >= 0) {
                        this.scrollLineIntoView(currentLine);
                    }
                }
            }
            this.currentLyricIndex = newIndex;
        }

        if (newIndex >= 0 && this.lyrics[newIndex].type === 'word-by-word') {
            this.updateWordHighlight(newIndex, currentTime);
        } else {
            this.wordHighlightController.clearActiveHighlight();
        }
    }

    private scrollLineIntoView(line: HTMLElement): void {
        const containerRect = this.lyricsDisplay.getBoundingClientRect();
        const lineRect = line.getBoundingClientRect();
        const lineCenter = lineRect.top - containerRect.top + this.lyricsDisplay.scrollTop + lineRect.height / 2;
        const targetScrollTop = lineCenter - this.lyricsDisplay.clientHeight / 2;
        const maxScrollTop = Math.max(0, this.lyricsDisplay.scrollHeight - this.lyricsDisplay.clientHeight);
        const clampedTarget = Math.max(0, Math.min(maxScrollTop, targetScrollTop));

        this.animateScrollTop(clampedTarget);
    }

    private animateScrollTop(targetScrollTop: number): void {
        this.cancelScrollAnimation();

        const startScrollTop = this.lyricsDisplay.scrollTop;
        const distance = targetScrollTop - startScrollTop;
        if (Math.abs(distance) < 1) {
            this.lyricsDisplay.scrollTop = targetScrollTop;
            return;
        }

        const startTime = performance.now();
        const step = (timestamp: number): void => {
            const progress = Math.min(1, (timestamp - startTime) / this.lineScrollDurationMs);
            const easedProgress = this.easeOutCubic(progress);
            this.lyricsDisplay.scrollTop = startScrollTop + distance * easedProgress;

            if (progress < 1) {
                this.scrollAnimationFrame = requestAnimationFrame(step);
                return;
            }

            this.scrollAnimationFrame = null;
        };

        this.scrollAnimationFrame = requestAnimationFrame(step);
    }

    private cancelScrollAnimation(): void {
        if (this.scrollAnimationFrame === null) return;

        cancelAnimationFrame(this.scrollAnimationFrame);
        this.scrollAnimationFrame = null;
    }

    private easeOutCubic(progress: number): number {
        return 1 - Math.pow(1 - progress, 3);
    }

    private updateWordHighlight(lineIndex: number, currentTime: number): void {
        const lyric = this.lyrics[lineIndex];
        if (!lyric || !lyric.words || lyric.words.length === 0) {
            return;
        }

        const currentLine = this.lyricsDisplay.querySelector(`[data-index="${lineIndex}"]`);
        if (!currentLine) {
            return;
        }

        this.wordHighlightController.updateWordHighlight({
            lineElement: currentLine,
            words: lyric.words,
            currentTime,
            lineEndTime: lyric.endTime
        });
    }

    private resetWordHighlightStates(seekPosition: number): void {
        if (!this.lyricsDisplay) return;
        this.wordHighlightController.resetWordHighlightStates(this.lyricsDisplay, seekPosition);
    }
}

export {LyricsRenderController};
