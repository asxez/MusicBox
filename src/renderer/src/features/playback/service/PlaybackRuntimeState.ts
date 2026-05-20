import type {PlayMode, PlaybackStateSnapshot} from '@api/types/playback';
import type {Track} from '@api/types/track';

export interface PlaybackRuntimeStateSnapshot {
    currentTrack: Track | null;
    isPlaying: boolean;
    volume: number;
    position: number;
    duration: number;
    playlist: Track[];
    currentIndex: number;
    playMode: PlayMode;
}

export class PlaybackRuntimeState {
    private state: PlaybackRuntimeStateSnapshot;

    constructor(initialState?: Partial<PlaybackRuntimeStateSnapshot>) {
        this.state = {
            currentTrack: null,
            isPlaying: false,
            volume: 0.7,
            position: 0,
            duration: 0,
            playlist: [],
            currentIndex: -1,
            playMode: 'sequence',
            ...initialState
        };
    }

    get currentTrack(): Track | null {
        return this.state.currentTrack;
    }

    set currentTrack(track: Track | null) {
        this.state.currentTrack = track;
    }

    get isPlaying(): boolean {
        return this.state.isPlaying;
    }

    set isPlaying(isPlaying: boolean) {
        this.state.isPlaying = isPlaying;
    }

    get volume(): number {
        return this.state.volume;
    }

    set volume(volume: number) {
        this.state.volume = volume;
    }

    get position(): number {
        return this.state.position;
    }

    set position(position: number) {
        this.state.position = position;
    }

    get duration(): number {
        return this.state.duration;
    }

    set duration(duration: number) {
        this.state.duration = duration;
    }

    get playlist(): Track[] {
        return this.state.playlist;
    }

    set playlist(playlist: Track[]) {
        this.state.playlist = playlist;
    }

    get currentIndex(): number {
        return this.state.currentIndex;
    }

    set currentIndex(currentIndex: number) {
        this.state.currentIndex = currentIndex;
    }

    get playMode(): PlayMode {
        return this.state.playMode;
    }

    set playMode(playMode: PlayMode) {
        this.state.playMode = playMode;
    }

    getSnapshot(): Readonly<PlaybackRuntimeStateSnapshot> {
        return {
            ...this.state
        };
    }

    patch(state: Partial<PlaybackRuntimeStateSnapshot>): void {
        this.state = {
            ...this.state,
            ...state
        };
    }

    toPlaybackStateSnapshot(): PlaybackStateSnapshot {
        return {
            currentTrack: this.currentTrack,
            position: this.position,
            isPlaying: this.isPlaying,
            playlist: this.playlist,
            currentIndex: this.currentIndex,
            playMode: this.playMode
        };
    }
}
