import type {PlaybackStateSnapshot, PlayMode} from "@api/types/playback";
import type {Track} from "@api/types/track";

export interface PlaybackState extends PlaybackStateSnapshot {
    volume: number;
    duration: number;
    playMode: PlayMode;
}

const DEFAULT_PLAYBACK_STATE: Readonly<PlaybackState> = Object.freeze({
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    position: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1,
    playMode: 'sequence'
});

export type PlaybackStateKey = keyof PlaybackState;

class PlaybackStateStore {
    private state: PlaybackState;

    constructor(initialState: Partial<PlaybackState> = {}) {
        this.state = {
            ...DEFAULT_PLAYBACK_STATE,
            ...initialState
        };
    }

    get<K extends PlaybackStateKey>(key: K): PlaybackState[K] {
        return this.state[key];
    }

    set<K extends PlaybackStateKey>(key: K, value: PlaybackState[K]): PlaybackState[K] {
        this.state = {
            ...this.state,
            [key]: value
        };

        return value;
    }

    update(partialState: Partial<PlaybackState>): PlaybackState {
        this.state = {
            ...this.state,
            ...partialState
        };

        return this.getSnapshot();
    }

    getSnapshot(): PlaybackState {
        return {
            ...this.state,
            playlist: [...this.state.playlist]
        };
    }

    reset(): PlaybackState {
        this.state = {
            ...DEFAULT_PLAYBACK_STATE,
            playlist: [] as Track[]
        };
        return this.getSnapshot();
    }
}

export {DEFAULT_PLAYBACK_STATE, PlaybackStateStore};

