export class PlaybackQueue {
    constructor({emit, persistPlayMode}) {
        this.emit = emit;
        this.persistPlayMode = persistPlayMode;
        this.playHistory = [];
        this.playMode = 'sequence';
    }

    clearHistory() {
        this.playHistory = [];
    }

    pushHistory(index) {
        if (index === -1) return;

        this.playHistory.push(index);
        if (this.playHistory.length > 50) {
            this.playHistory.shift();
        }
    }

    removeLastHistoryIndexIfMatches(index) {
        if (this.playHistory.length > 0 && this.playHistory[this.playHistory.length - 1] === index) {
            this.playHistory.pop();
        }
    }

    setPlayMode(mode) {
        const validModes = ['sequence', 'shuffle', 'repeat-one'];
        if (!validModes.includes(mode)) {
            return false;
        }

        this.playMode = mode;
        this.emit('playModeChanged', mode);
        this.persistPlayMode(mode);
        return true;
    }

    getPlayMode() {
        return this.playMode;
    }

    togglePlayMode() {
        const modes = ['sequence', 'shuffle', 'repeat-one'];
        const currentIndex = modes.indexOf(this.playMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setPlayMode(modes[nextIndex]);
        return this.playMode;
    }

    getNextTrackIndex(playlist, currentIndex) {
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

    getPreviousTrackIndex(playlist, currentIndex) {
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
