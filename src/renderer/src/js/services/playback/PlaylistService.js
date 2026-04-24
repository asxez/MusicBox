const PLAY_MODES = Object.freeze(['sequence', 'shuffle', 'repeat-one']);
const MAX_HISTORY_LENGTH = 50;

class PlaylistService {
    constructor({getState, setState}) {
        this.getState = getState;
        this.setState = setState;
        this.playHistory = [];
    }

    setPlaylist(tracks, currentIndex = -1) {
        this.clearHistory();
        this.setState({
            playlist: tracks,
            currentIndex
        });
    }

    getPlaylist() {
        return this.getState().playlist;
    }

    getCurrentIndex() {
        return this.getState().currentIndex;
    }

    setCurrentIndex(currentIndex) {
        this.setState({currentIndex});
    }

    setPlayMode(mode) {
        if (!PLAY_MODES.includes(mode)) {
            return false;
        }

        this.setState({playMode: mode});
        return true;
    }

    getPlayMode() {
        return this.getState().playMode;
    }

    togglePlayMode() {
        const currentMode = this.getPlayMode();
        const currentIndex = PLAY_MODES.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % PLAY_MODES.length;
        const nextMode = PLAY_MODES[nextIndex];

        this.setPlayMode(nextMode);
        return nextMode;
    }

    pushHistory(index) {
        if (index === -1 || index === null || index === undefined) {
            return;
        }

        this.playHistory.push(index);

        if (this.playHistory.length > MAX_HISTORY_LENGTH) {
            this.playHistory.shift();
        }
    }

    popHistoryIfMatches(index) {
        if (this.playHistory.length > 0 && this.playHistory[this.playHistory.length - 1] === index) {
            this.playHistory.pop();
        }
    }

    clearHistory() {
        this.playHistory = [];
    }

    getHistory() {
        return [...this.playHistory];
    }

    getNextTrackIndex() {
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

    getPreviousTrackIndex() {
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

    getRandomDifferentIndex(length, currentIndex) {
        if (length === 1) return 0;

        let randomIndex = Math.floor(Math.random() * length);
        while (randomIndex === currentIndex) {
            randomIndex = Math.floor(Math.random() * length);
        }

        return randomIndex;
    }
}

export {PLAY_MODES, PlaylistService};

