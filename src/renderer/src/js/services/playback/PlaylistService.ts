import type {PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";
import type {PlaybackState} from "./PlaybackStateStore";

const PLAY_MODES = Object.freeze(['sequence', 'shuffle', 'repeat-one'] as const);
const MAX_HISTORY_LENGTH = 50;

interface PlaylistServiceOptions {
    getState: () => PlaybackState;
    setState: (partialState: Partial<PlaybackState>) => void;
}

class PlaylistService {
    private readonly getState: () => PlaybackState;
    private readonly setState: (partialState: Partial<PlaybackState>) => void;
    private playHistory: number[];

    constructor({getState, setState}: PlaylistServiceOptions) {
        this.getState = getState;
        this.setState = setState;
        this.playHistory = [];
    }

    setPlaylist(tracks: Track[], currentIndex = -1): void {
        this.clearHistory();
        this.setState({
            playlist: tracks,
            currentIndex
        });
    }

    getPlaylist(): Track[] {
        return this.getState().playlist;
    }

    getCurrentIndex(): number {
        return this.getState().currentIndex;
    }

    setCurrentIndex(currentIndex: number): void {
        this.setState({currentIndex});
    }

    setPlayMode(mode: PlayMode): boolean {
        if (!PLAY_MODES.includes(mode)) {
            return false;
        }

        this.setState({playMode: mode});
        return true;
    }

    getPlayMode(): PlayMode {
        return this.getState().playMode;
    }

    togglePlayMode(): PlayMode {
        const currentMode = this.getPlayMode();
        const currentIndex = PLAY_MODES.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % PLAY_MODES.length;
        const nextMode = PLAY_MODES[nextIndex];

        this.setPlayMode(nextMode);
        return nextMode;
    }

    pushHistory(index: number | null | undefined): void {
        if (index === -1 || index === null || index === undefined) {
            return;
        }

        this.playHistory.push(index);

        if (this.playHistory.length > MAX_HISTORY_LENGTH) {
            this.playHistory.shift();
        }
    }

    popHistoryIfMatches(index: number): void {
        if (this.playHistory.length > 0 && this.playHistory[this.playHistory.length - 1] === index) {
            this.playHistory.pop();
        }
    }

    clearHistory(): void {
        this.playHistory = [];
    }

    getHistory(): number[] {
        return [...this.playHistory];
    }

    getNextTrackIndex(): number {
        const {playlist, currentIndex, playMode} = this.getState();

        if (playlist.length === 0) return -1;

        switch (playMode) {
            case 'sequence':
                return (currentIndex + 1) % playlist.length;
            case 'shuffle':
                return this.getRandomDifferentIndex(playlist.length, currentIndex);
            case 'repeat-one':
                return currentIndex;
            default:
                return (currentIndex + 1) % playlist.length;
        }
    }

    getPreviousTrackIndex(): number {
        const {playlist, currentIndex, playMode} = this.getState();

        if (playlist.length === 0) return -1;

        if (this.playHistory.length > 0) {
            return this.playHistory[this.playHistory.length - 1];
        }

        switch (playMode) {
            case 'sequence':
                return currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
            case 'shuffle':
                return this.getRandomDifferentIndex(playlist.length, currentIndex);
            case 'repeat-one':
                return currentIndex;
            default:
                return currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
        }
    }

    getRandomDifferentIndex(length: number, currentIndex: number): number {
        if (length === 1) return 0;

        let randomIndex = Math.floor(Math.random() * length);
        while (randomIndex === currentIndex) {
            randomIndex = Math.floor(Math.random() * length);
        }

        return randomIndex;
    }
}

export {PLAY_MODES, PlaylistService};

