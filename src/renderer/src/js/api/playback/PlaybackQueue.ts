import type {Track} from '@api/types/track';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';

type Emit = <K extends keyof MusicBoxAPIEvents>(event: K, data: MusicBoxAPIEvents[K]) => void;

interface PlaybackQueueOptions {
    emit: Emit;
    persistPlayMode: (mode: PlayMode) => void;
}

export class PlaybackQueue {
    private readonly emit: Emit;
    private readonly persistPlayMode: (mode: PlayMode) => void;
    private playHistory: number[] = [];
    private playMode: PlayMode = 'sequence';

    constructor({emit, persistPlayMode}: PlaybackQueueOptions) {
        this.emit = emit;
        this.persistPlayMode = persistPlayMode;
    }

    clearHistory(): void {
        this.playHistory = [];
    }

    pushHistory(index: number): void {
        if (index === -1) return;

        this.playHistory.push(index);
        if (this.playHistory.length > 50) {
            this.playHistory.shift();
        }
    }

    removeLastHistoryIndexIfMatches(index: number): void {
        if (this.playHistory.length > 0 && this.playHistory[this.playHistory.length - 1] === index) {
            this.playHistory.pop();
        }
    }

    setPlayMode(mode: unknown): boolean {
        const validModes: PlayMode[] = ['sequence', 'shuffle', 'repeat-one'];
        if (!validModes.includes(mode as PlayMode)) {
            return false;
        }

        this.playMode = mode as PlayMode;
        this.emit('playModeChanged', this.playMode);
        this.persistPlayMode(this.playMode);
        return true;
    }

    getPlayMode(): PlayMode {
        return this.playMode;
    }

    togglePlayMode(): PlayMode {
        const modes: PlayMode[] = ['sequence', 'shuffle', 'repeat-one'];
        const currentIndex = modes.indexOf(this.playMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setPlayMode(modes[nextIndex]);
        return this.playMode;
    }

    getNextTrackIndex(playlist: Track[], currentIndex: number): number {
        if (playlist.length === 0) return -1;

        switch (this.playMode) {
            case 'sequence':
                return (currentIndex + 1) % playlist.length;
            case 'shuffle':
                if (playlist.length === 1) return 0;
                let randomIndex = Math.floor(Math.random() * playlist.length);
                while (randomIndex === currentIndex) {
                    randomIndex = Math.floor(Math.random() * playlist.length);
                }
                return randomIndex;
            case 'repeat-one':
                return currentIndex;
            default:
                return (currentIndex + 1) % playlist.length;
        }
    }

    getPreviousTrackIndex(playlist: Track[], currentIndex: number): number {
        if (playlist.length === 0) return -1;

        if (this.playHistory.length > 0) {
            return this.playHistory[this.playHistory.length - 1];
        }

        switch (this.playMode) {
            case 'sequence':
                return currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
            case 'shuffle':
                if (playlist.length === 1) return 0;
                let randomIndex = Math.floor(Math.random() * playlist.length);
                while (randomIndex === currentIndex) {
                    randomIndex = Math.floor(Math.random() * playlist.length);
                }
                return randomIndex;
            case 'repeat-one':
                return currentIndex;
            default:
                return currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
        }
    }
}
