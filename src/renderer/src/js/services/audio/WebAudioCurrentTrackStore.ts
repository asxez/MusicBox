import type {LoadedWebAudioTrack, WebAudioTrack} from './WebAudioTypes';

type WebAudioCurrentTrackState = {
    buffer: AudioBuffer | null;
    duration: number;
    track: WebAudioTrack | null;
};

class WebAudioCurrentTrackStore {
    private state: WebAudioCurrentTrackState;

    constructor() {
        this.state = {
            buffer: null,
            duration: 0,
            track: null
        };
    }

    setLoadedTrack(loadedTrack: LoadedWebAudioTrack): void {
        this.state = {
            buffer: loadedTrack.buffer,
            duration: loadedTrack.duration,
            track: loadedTrack.track
        };
    }

    setBuffer(buffer: AudioBuffer | null): void {
        this.state = {
            ...this.state,
            buffer
        };
    }

    getBuffer(): AudioBuffer | null {
        return this.state.buffer;
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

    clearBuffer(): boolean {
        if (!this.state.buffer) {
            return false;
        }

        this.state = {
            ...this.state,
            buffer: null
        };
        return true;
    }

    clear(): void {
        this.state = {
            buffer: null,
            duration: 0,
            track: null
        };
    }
}

export {WebAudioCurrentTrackStore};
export default WebAudioCurrentTrackStore;
