import type {LoadedWebAudioTrack, WebAudioTrack} from './WebAudioTypes';

type WebAudioCurrentTrackState = {
    duration: number;
    track: WebAudioTrack | null;
};

class WebAudioCurrentTrackStore {
    private state: WebAudioCurrentTrackState;

    constructor() {
        this.state = {
            duration: 0,
            track: null
        };
    }

    setLoadedTrack(loadedTrack: LoadedWebAudioTrack): void {
        this.state = {
            duration: loadedTrack.duration,
            track: loadedTrack.track
        };
    }

    setDuration(duration: number): void {
        this.state = {
            ...this.state,
            duration
        };
    }

    getDuration(): number {
        return this.state.duration;
    }

    setTrack(track: WebAudioTrack | null): void {
        this.state = {
            ...this.state,
            track
        };
    }

    getTrack(): WebAudioTrack | null {
        return this.state.track;
    }

    clearTrack(): boolean {
        if (!this.state.track && this.state.duration === 0) {
            return false;
        }

        this.state = {
            duration: 0,
            track: null
        };
        return true;
    }

    clear(): void {
        this.state = {
            duration: 0,
            track: null
        };
    }
}

export {WebAudioCurrentTrackStore};
export default WebAudioCurrentTrackStore;
