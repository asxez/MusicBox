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

        return {
            position: normalizedPosition,
            seeked
        };
    }

    resetPlaybackPosition(): void {
        this.lastMonotonicPosition = 0;
        this.currentPlaybackPosition = 0;
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
        const wordElements = lineElement.querySelectorAll<HTMLElement>('.lyric-word');
        if (wordElements.length === 0) {
            return;
        }

        this.cancelPendingFrame();
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            const latestTime = this.currentPlaybackPosition || currentTime;

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const wordElement = wordElements[i];
                if (!wordElement) continue;

                if (preservePlayedProgress && wordElement.classList.contains('played')) {
                    continue;
                }

                const wordStartTime = word.time;
                const wordEndTime = word.endTime
                    ?? words[i + 1]?.time
                    ?? lineEndTime
                    ?? wordStartTime + 0.5;

                this.applyWordState(wordElement, latestTime, wordStartTime, wordEndTime, preservePlayedProgress);
            }
        });
    }

    resetWordHighlightStates(rootElement: Element, seekPosition: number): void {
        const wordElements = rootElement.querySelectorAll<HTMLElement>('.lyric-word');
        for (const wordElement of wordElements) {
            const wordTime = parseFloat(wordElement.dataset.wordTime || '');
            if (wordTime > seekPosition) {
                wordElement.classList.remove('highlight', 'played');
                wordElement.style.setProperty('--word-progress', '0');
            }
        }
    }

    resetAllWordStates(rootElement: Element): void {
        const wordElements = rootElement.querySelectorAll<HTMLElement>('.lyric-word');
        for (const wordElement of wordElements) {
            wordElement.classList.remove('highlight', 'played');
            wordElement.style.setProperty('--word-progress', '0');
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
            wordElement.style.setProperty('--word-progress', '0');
            return;
        }

        if (currentTime >= wordEndTime) {
            wordElement.classList.remove('highlight');
            wordElement.classList.add('played');
            wordElement.style.setProperty('--word-progress', '1');
            return;
        }

        const duration = wordEndTime - wordStartTime;
        const progress = duration > 0 ? (currentTime - wordStartTime) / duration : 1;
        const clampedProgress = Math.max(0, Math.min(1, progress));

        wordElement.classList.add('highlight');
        if (!preservePlayedProgress) {
            wordElement.classList.remove('played');
        }

        const currentProgress = parseFloat(wordElement.style.getPropertyValue('--word-progress')) || 0;
        const newProgress = parseFloat(clampedProgress.toFixed(2));
        if (!preservePlayedProgress || newProgress > currentProgress) {
            wordElement.style.setProperty('--word-progress', newProgress.toString());
        }
    }
}

export {LyricsWordHighlightController};
export type {HighlightWord, PositionUpdateResult, WordHighlightOptions};
