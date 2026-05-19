import type {RenderLyricLine} from "@ui/widgets/lyrics/LyricsTypes";
import {LyricsWordHighlightController} from "@js/shared/lyrics";

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
        this.wordHighlightController.resetPlaybackPosition();
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

    reset(): void {
        this.wordHighlightController.reset();
        this.lyrics = [];
        this.currentLyricIndex = -1;
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
