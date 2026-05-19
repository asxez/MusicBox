import type {RenderLyricLine} from "@ui/widgets/lyrics/LyricsTypes";

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
    private currentPlaybackPosition = 0;
    private lastMonotonicPosition = 0;
    private rafId: number | null = null;
    private lastWordUpdateTime = 0;
    private readonly wordUpdateInterval = 16;

    constructor(options: LyricsRenderControllerOptions) {
        this.lyricsDisplay = options.lyricsDisplay;
        this.isVisible = options.isVisible;
        this.seek = options.seek;
    }

    setLyrics(lyrics: RenderLyricLine[]): void {
        this.lyrics = lyrics;
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
            }

            return `<p class="lyrics-line" data-time="${lyric.time}" data-index="${index}">${lyric.content}</p>`;
        }).join('');

        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                ${lyricsHTML}
                <div class="lyrics-line-spacer"></div>
            </div>
        `;

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
        this.lastMonotonicPosition = 0;
    }

    handlePlaybackPositionChanged(position: number): void {
        const timeDiff = position - this.lastMonotonicPosition;

        if (timeDiff < -0.5) {
            this.lastMonotonicPosition = position;
            this.currentPlaybackPosition = position;
            this.resetWordHighlightStates(position);
        } else if (timeDiff >= -0.05) {
            const monotonicTime = Math.max(position, this.lastMonotonicPosition);
            this.lastMonotonicPosition = monotonicTime;
            this.currentPlaybackPosition = monotonicTime;
            position = monotonicTime;
        } else {
            this.lastMonotonicPosition = position;
            this.currentPlaybackPosition = position;
            this.resetWordHighlightStates(position);
        }

        this.updateLyricHighlight(position);
    }

    resetPlaybackPosition(): void {
        this.lastMonotonicPosition = 0;
        this.currentPlaybackPosition = 0;
    }

    reset(): void {
        this.cancelPendingFrame();
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.resetPlaybackPosition();
    }

    private updateLyricHighlight(currentTime: number): void {
        if (!this.lyrics || this.lyrics.length === 0 || !this.isVisible()) {
            return;
        }

        let newIndex = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

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
                const currentLine = this.lyricsDisplay.querySelector(`[data-index="${newIndex}"]`);
                if (currentLine) {
                    currentLine.classList.add('highlight');

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

        if (newIndex >= 0 && this.lyrics[newIndex].type === 'word-by-word') {
            this.updateWordHighlight(newIndex, currentTime);
        }
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

        const now = performance.now();
        const timeSinceLastUpdate = now - this.lastWordUpdateTime;
        if (timeSinceLastUpdate < this.wordUpdateInterval) {
            return;
        }

        this.lastWordUpdateTime = now;
        const lyricWords = lyric.words || [];
        const words = currentLine.querySelectorAll<HTMLElement>('.lyric-word');

        this.cancelPendingFrame();
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            const latestTime = this.currentPlaybackPosition !== undefined ? this.currentPlaybackPosition : currentTime;

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
                    if (wordElement.classList.contains('highlight')) {
                        wordElement.classList.remove('highlight');
                        wordElement.style.setProperty('--word-progress', '0');
                    }
                } else if (latestTime >= wordEndTime) {
                    wordElement.classList.remove('highlight');
                    wordElement.classList.add('played');
                    wordElement.style.setProperty('--word-progress', '1');
                } else {
                    const duration = wordEndTime - wordStartTime;
                    const progress = duration > 0 ? (latestTime - wordStartTime) / duration : 1;
                    const clampedProgress = Math.max(0, Math.min(1, progress));

                    if (!wordElement.classList.contains('highlight')) {
                        wordElement.classList.add('highlight');
                    }

                    const currentProgress = parseFloat(wordElement.style.getPropertyValue('--word-progress')) || 0;
                    const newProgress = parseFloat(clampedProgress.toFixed(2));
                    if (newProgress > currentProgress) {
                        wordElement.style.setProperty('--word-progress', newProgress.toString());
                    }
                }
            }
        });
    }

    private resetWordHighlightStates(seekPosition: number): void {
        if (!this.lyricsDisplay) return;

        const allLines = this.lyricsDisplay.querySelectorAll<HTMLElement>('.lyrics-line.lyrics-word-by-word');
        for (const line of allLines) {
            const words = line.querySelectorAll<HTMLElement>('.lyric-word');

            for (const wordElement of words) {
                const wordTime = parseFloat(wordElement.dataset.wordTime || '');

                if (wordTime > seekPosition) {
                    wordElement.classList.remove('highlight', 'played');
                    wordElement.style.setProperty('--word-progress', '0');
                }
            }
        }
    }

    private cancelPendingFrame(): void {
        if (!this.rafId) return;

        cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }
}

export {LyricsRenderController};
