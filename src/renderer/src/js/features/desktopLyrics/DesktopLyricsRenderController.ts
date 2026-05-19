import {
    appendLyricsWordSpans,
    getLyricsWordText,
    LyricsWordHighlightController
} from '@js/shared/lyrics';
import type {DesktopLyricLine, DesktopLyricsElements} from './DesktopLyricsTypes';

export class DesktopLyricsRenderController {
    private lyrics: DesktopLyricLine[] = [];
    private currentLyricIndex = -1;
    private readonly wordHighlightController = new LyricsWordHighlightController();

    constructor(
        private readonly elements: Pick<DesktopLyricsElements, 'currentLyricEl' | 'nextLyricEl'>
    ) {
    }

    showDefaultLyrics(): void {
        this.elements.currentLyricEl.textContent = '暂无歌词';
        this.elements.nextLyricEl.textContent = '';
    }

    updateLyrics(lyricsData: DesktopLyricLine[] | string | unknown): void {
        if (!Array.isArray(lyricsData)) {
            this.lyrics = [];
            this.showDefaultLyrics();
            return;
        }

        this.lyrics = lyricsData;
        this.currentLyricIndex = -1;
        this.renderCurrentLyric();
    }

    updatePosition(position: number): number | null {
        if (typeof position !== 'number' || isNaN(position)) {
            return null;
        }

        const updateResult = this.wordHighlightController.updatePlaybackPosition(position);
        if (updateResult.seeked) {
            this.wordHighlightController.resetWordHighlightStates(
                this.elements.currentLyricEl,
                updateResult.position
            );
        }

        this.updateLyricHighlight(updateResult.position);
        return updateResult.position;
    }

    reset(): void {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.wordHighlightController.reset();
        this.showDefaultLyrics();
    }

    private updateLyricHighlight(currentTime: number): void {
        if (this.lyrics.length === 0) {
            return;
        }

        const newIndex = this.findLyricIndex(currentTime);
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.renderCurrentLyric();
        }

        if (newIndex >= 0 && this.lyrics[newIndex].type === 'word-by-word') {
            this.updateWordHighlight(newIndex, currentTime);
        }
    }

    private findLyricIndex(currentTime: number): number {
        let newIndex = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }
        return newIndex;
    }

    private renderCurrentLyric(): void {
        if (this.currentLyricIndex < 0 || this.currentLyricIndex >= this.lyrics.length) {
            this.showDefaultLyrics();
            return;
        }

        const currentLyric = this.lyrics[this.currentLyricIndex];
        const nextLyric = this.lyrics[this.currentLyricIndex + 1];

        this.renderCurrentLine(currentLyric);
        this.elements.nextLyricEl.textContent = nextLyric ? this.getLyricText(nextLyric) : '';
    }

    private renderCurrentLine(lyric: DesktopLyricLine): void {
        if (lyric.type !== 'word-by-word' || !lyric.words) {
            this.elements.currentLyricEl.textContent = lyric.content || '';
            return;
        }

        appendLyricsWordSpans(this.elements.currentLyricEl, lyric.words);
    }

    private getLyricText(lyric: DesktopLyricLine): string {
        if (lyric.type === 'word-by-word' && lyric.words) {
            return getLyricsWordText(lyric.words);
        }

        return lyric.content || '';
    }

    private updateWordHighlight(lineIndex: number, currentTime: number): void {
        const lyric = this.lyrics[lineIndex];
        if (!lyric?.words || lyric.words.length === 0) {
            return;
        }

        this.wordHighlightController.updateWordHighlight({
            lineElement: this.elements.currentLyricEl,
            words: lyric.words,
            currentTime,
            lineEndTime: lyric.endTime
        });
    }
}
