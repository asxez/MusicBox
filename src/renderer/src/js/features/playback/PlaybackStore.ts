import type {PlaybackStateName, PlayMode} from '@api/types/playback';
import type {Track} from '@api/types/track';

export interface PlaybackState {
    currentTrack: Track | null;
    currentIndex: number;
    playlist: Track[];
    isPlaying: boolean;
    position: number;
    duration: number;
    volume: number;
    playMode: PlayMode;
}

export type PlaybackStoreChange =
    | {type: 'trackChanged'; payload: Track | null}
    | {type: 'trackIndexChanged'; payload: number}
    | {type: 'playbackStateChanged'; payload: PlaybackStateName}
    | {type: 'positionChanged'; payload: number}
    | {type: 'durationChanged'; payload: number}
    | {type: 'volumeChanged'; payload: number}
    | {type: 'playModeChanged'; payload: PlayMode}
    | {type: 'playlistChanged'; payload: Track[]};

export type PlaybackStoreListener = (
    state: Readonly<PlaybackState>,
    change: PlaybackStoreChange
) => void | Promise<void>;

export type Unsubscribe = () => void;

export class PlaybackStore {
    private state: PlaybackState;
    private readonly listeners = new Set<PlaybackStoreListener>();

    constructor(initialState: PlaybackState) {
        this.state = {...initialState};
    }

    getState(): Readonly<PlaybackState> {
        return this.state;
    }

    subscribe(listener: PlaybackStoreListener): Unsubscribe {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    setTrack(track: Track | null): void {
        this.patch({currentTrack: track}, {type: 'trackChanged', payload: track});
    }

    setTrackIndex(index: number): void {
        this.patch({currentIndex: index}, {type: 'trackIndexChanged', payload: index});
    }

    setPlaylist(playlist: Track[]): void {
        this.patch({playlist}, {type: 'playlistChanged', payload: playlist});
    }

    setPlaybackState(state: PlaybackStateName): void {
        this.patch({isPlaying: state === 'playing'}, {type: 'playbackStateChanged', payload: state});
    }

    setPosition(position: number): void {
        this.patch({position}, {type: 'positionChanged', payload: position});
    }

    setDuration(duration: number): void {
        this.patch({duration}, {type: 'durationChanged', payload: duration});
    }

    setVolume(volume: number): void {
        this.patch({volume}, {type: 'volumeChanged', payload: volume});
    }

    setPlayMode(playMode: PlayMode): void {
        this.patch({playMode}, {type: 'playModeChanged', payload: playMode});
    }

    private patch(patch: Partial<PlaybackState>, change: PlaybackStoreChange): void {
        this.state = {...this.state, ...patch};
        this.emit(change);
    }

    private emit(change: PlaybackStoreChange): void {
        const snapshot = this.getState();

        this.listeners.forEach((listener) => {
            void Promise.resolve(listener(snapshot, change)).catch((error) => {
                console.error('❌ PlaybackStore: 监听器执行失败:', error);
            });
        });
    }
}
