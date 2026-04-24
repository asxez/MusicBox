const DEFAULT_PLAYBACK_STATE = Object.freeze({
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    position: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1,
    playMode: 'sequence'
});

class PlaybackStateStore {
    constructor(initialState = {}) {
        this.state = {
            ...DEFAULT_PLAYBACK_STATE,
            ...initialState
        };
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state = {
            ...this.state,
            [key]: value
        };

        return value;
    }

    update(partialState) {
        this.state = {
            ...this.state,
            ...partialState
        };

        return this.getSnapshot();
    }

    getSnapshot() {
        return {
            ...this.state,
            playlist: [...this.state.playlist]
        };
    }

    reset() {
        this.state = {...DEFAULT_PLAYBACK_STATE};
        return this.getSnapshot();
    }
}

export {DEFAULT_PLAYBACK_STATE, PlaybackStateStore};

