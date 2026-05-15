import type {TrackSource} from '@services/audio/domain';

type WebAudioSessionState = {
    playlist: TrackSource[];
    currentIndex: number;
    gaplessPlaybackEnabled: boolean;
};

class WebAudioSessionStore {
    private state: WebAudioSessionState;

    constructor() {
        this.state = {
            playlist: [],
            currentIndex: -1,
            gaplessPlaybackEnabled: true
        };
    }

    setPlaylist(playlist: TrackSource[], currentIndex = -1): void {
        this.state = {
            ...this.state,
            playlist,
            currentIndex
        };
    }

    getPlaylist(): TrackSource[] {
        return this.state.playlist;
    }

    setCurrentIndex(currentIndex: number): void {
        this.state = {
            ...this.state,
            currentIndex
        };
    }

    getCurrentIndex(): number {
        return this.state.currentIndex;
    }

    setGaplessPlayback(enabled: boolean): void {
        this.state = {
            ...this.state,
            gaplessPlaybackEnabled: enabled
        };
    }

    getGaplessPlayback(): boolean {
        return this.state.gaplessPlaybackEnabled;
    }

    clear(): void {
        this.state = {
            playlist: [],
            currentIndex: -1,
            gaplessPlaybackEnabled: true
        };
    }
}

export {WebAudioSessionStore};
export default WebAudioSessionStore;
