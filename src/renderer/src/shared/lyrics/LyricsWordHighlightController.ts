interface HighlightWord {
    time: number;
    endTime?: number | null;
}

interface PositionUpdateResult {
    position: number;
    seeked: boolean;
}

interface WordHighlightOptions {
    lineElement: Element;
    words: readonly HighlightWord[];
    currentTime: number;
    lineEndTime?: number | null;
    preservePlayedProgress?: boolean;
}

class LyricsWordHighlightController {
    private rafId: number | null = null;
    private lastWordUpdateTime = 0;
    private readonly wordUpdateInterval: number;
    private currentPlaybackPosition = 0;
    private lastMonotonicPosition = 0;
    private lastPositionTimestamp = performance.now();
    private isPlaying = false;
    private activeHighlightOptions: WordHighlightOptions | null = null;
    private readonly interpolationGraceMs = 360;

    constructor(wordUpdateInterval = 16) {
        this.wordUpdateInterval = wordUpdateInterval;
    }

    updatePlaybackPosition(position: number): PositionUpdateResult {
        const timeDiff = position - this.lastMonotonicPosition;
        let normalizedPosition = position;
        let seeked = false;

        if (timeDiff < -0.5) {
            seeked = true;
        } else if (timeDiff >= -0.05) {
            normalizedPosition = Math.max(position, this.lastMonotonicPosition);
        } else {
            seeked = true;
        }

        this.lastMonotonicPosition = normalizedPosition;
        this.currentPlaybackPosition = normalizedPosition;
        this.lastPositionTimestamp = performance.now();

        return {
            position: normalizedPosition,
            seeked
        };
    }

    resetPlaybackPosition(): void {
        this.lastMonotonicPosition = 0;
        this.currentPlaybackPosition = 0;
        this.lastPositionTimestamp = performance.now();
    }

    setPlaying(isPlaying: boolean): void {
        this.isPlaying = isPlaying;

        if (!isPlaying) {
            this.cancelPendingFrame();
            return;
        }

        this.scheduleHighlightFrame();
    }

    clearActiveHighlight(): void {
        this.activeHighlightOptions = null;
        this.cancelPendingFrame();
    }

    updateWordHighlight(
        {
            lineElement,
            words,
            currentTime,
            lineEndTime,
            preservePlayedProgress = true
        }: WordHighlightOptions
    ): void {
        if (!words || words.length === 0) {
            return;
        }

        const now = performance.now();
        const timeSinceLastUpdate = now - this.lastWordUpdateTime;
        if (timeSinceLastUpdate < this.wordUpdateInterval) {
            return;
        }

        this.lastWordUpdateTime = now;
        this.activeHighlightOptions = {
            lineElement,
            words,
            currentTime,
            lineEndTime,
            preservePlayedProgress
        };
        this.scheduleHighlightFrame();
    }

    resetWordHighlightStates(rootElement: Element, seekPosition: number): void {
        const wordElements = rootElement.querySelectorAll<HTMLElement>('.lyric-word');
        for (const wordElement of wordElements) {
            const wordTime = parseFloat(wordElement.dataset.wordTime || '');
            if (wordTime > seekPosition) {
                wordElement.classList.remove('highlight', 'played');
                this.setWordProgress(wordElement, 0, false);
            }
        }
    }

    resetAllWordStates(rootElement: Element): void {
        const wordElements = rootElement.querySelectorAll<HTMLElement>('.lyric-word');
        for (const wordElement of wordElements) {
            wordElement.classList.remove('highlight', 'played');
            this.setWordProgress(wordElement, 0, false);
        }
    }

    cancelPendingFrame(): void {
        if (!this.rafId) return;

        cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    reset(): void {
        this.cancelPendingFrame();
        this.resetPlaybackPosition();
        this.lastWordUpdateTime = 0;
        this.activeHighlightOptions = null;
    }

    private applyWordState(
        wordElement: HTMLElement,
        currentTime: number,
        wordStartTime: number,
        wordEndTime: number,
        preservePlayedProgress: boolean
    ): void {
        if (currentTime < wordStartTime) {
            wordElement.classList.remove('highlight');
            if (!preservePlayedProgress) {
                wordElement.classList.remove('played');
            }
            this.setWordProgress(wordElement, 0, false);
            return;
        }

        if (currentTime >= wordEndTime) {
            wordElement.classList.remove('highlight');
            wordElement.classList.add('played');
            this.setWordProgress(wordElement, 1, false);
            return;
        }

        const duration = wordEndTime - wordStartTime;
        const progress = duration > 0 ? (currentTime - wordStartTime) / duration : 1;
        const clampedProgress = Math.max(0, Math.min(1, progress));

        wordElement.classList.add('highlight');
        if (!preservePlayedProgress) {
            wordElement.classList.remove('played');
        }

        this.setWordProgress(wordElement, clampedProgress, preservePlayedProgress);
    }

    private scheduleHighlightFrame(): void {
        if (this.rafId !== null || !this.activeHighlightOptions) {
            return;
        }

        this.rafId = requestAnimationFrame(() => this.applyActiveWordHighlight());
    }

    private applyActiveWordHighlight(): void {
        this.rafId = null;

        const options = this.activeHighlightOptions;
        if (!options || !options.words || options.words.length === 0) {
            return;
        }

        const wordElements = options.lineElement.querySelectorAll<HTMLElement>('.lyric-word');
        if (wordElements.length === 0) {
            return;
        }

        const latestTime = this.getInterpolatedPlaybackPosition(options.currentTime);

        for (let i = 0; i < options.words.length; i++) {
            const word = options.words[i];
            const wordElement = wordElements[i];
            if (!wordElement) continue;

            if (options.preservePlayedProgress && wordElement.classList.contains('played')) {
                continue;
            }

            const wordStartTime = word.time;
            const wordEndTime = word.endTime
                ?? options.words[i + 1]?.time
                ?? options.lineEndTime
                ?? wordStartTime + 0.5;

            this.applyWordState(
                wordElement,
                latestTime,
                wordStartTime,
                wordEndTime,
                options.preservePlayedProgress ?? true
            );
        }

        if (this.shouldContinueAnimating(options, latestTime)) {
            this.scheduleHighlightFrame();
        }
    }

    private getInterpolatedPlaybackPosition(fallbackTime: number): number {
        const basePosition = this.currentPlaybackPosition || fallbackTime;
        if (!this.isPlaying) {
            return basePosition;
        }

        const elapsedMs = performance.now() - this.lastPositionTimestamp;
        if (!this.hasFreshPlaybackPosition(elapsedMs)) {
            return basePosition;
        }

        return basePosition + elapsedMs / 1000;
    }

    private hasFreshPlaybackPosition(elapsedMs = performance.now() - this.lastPositionTimestamp): boolean {
        return elapsedMs >= 0 && elapsedMs <= this.interpolationGraceMs;
    }

    private shouldContinueAnimating(options: WordHighlightOptions, currentTime: number): boolean {
        if (!this.isPlaying || !this.hasFreshPlaybackPosition()) {
            return false;
        }

        const lastWord = options.words[options.words.length - 1];
        const lineEndTime = options.lineEndTime
            ?? lastWord?.endTime
            ?? (typeof lastWord?.time === 'number' ? lastWord.time + 0.5 : currentTime);
        return currentTime <= lineEndTime + 0.1;
    }

    private setWordProgress(wordElement: HTMLElement, progress: number, preserveForwardProgress: boolean): void {
        const nextProgress = Math.max(0, Math.min(1, progress));
        const currentProgress = parseFloat(wordElement.dataset.wordProgress || '0') || 0;

        if (preserveForwardProgress && nextProgress < currentProgress) {
            return;
        }

        if (Math.abs(nextProgress - currentProgress) < 0.0005) {
            return;
        }

        const progressValue = nextProgress.toFixed(4);
        const revealInset = `${((1 - nextProgress) * 100).toFixed(2)}%`;
        wordElement.dataset.wordProgress = progressValue;
        wordElement.style.setProperty('--word-progress', progressValue);
        wordElement.style.setProperty('--word-reveal-inset', revealInset);
    }
}

export {LyricsWordHighlightController};
export type {HighlightWord, PositionUpdateResult, WordHighlightOptions};
