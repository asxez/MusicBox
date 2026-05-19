import type {Track} from '@api/types/track';
import type {AudioEngineState} from './audioEngine';
import type {AudioEngineManagerBridge} from './AudioEngineAdapter';

type PlaybackState = {
    currentTrack: Track | null;
    duration: number;
    currentIndex: number;
    position: number;
    isPlaying: boolean;
};

type PlaybackStateSynchronizerOptions = {
    getAudioEngine: () => AudioEngineManagerBridge | null;
    getState: () => PlaybackState;
    setState: (state: Partial<PlaybackState>) => void;
};

export class PlaybackStateSynchronizer {
    private readonly getAudioEngine: () => AudioEngineManagerBridge | null;
    private readonly getState: () => PlaybackState;
    private readonly setState: (state: Partial<PlaybackState>) => void;

    constructor({getAudioEngine, getState, setState}: PlaybackStateSynchronizerOptions) {
        this.getAudioEngine = getAudioEngine;
        this.getState = getState;
        this.setState = setState;
    }

    async syncFromEngine(overrides: Partial<AudioEngineState> = {}): Promise<PlaybackState | null> {
        const audioEngine = this.getAudioEngine();
        if (!audioEngine) {
            return null;
        }

        const state = {
            ...await audioEngine.getStateSnapshot(),
            ...overrides
        };

        const playbackState = {
            currentTrack: state.currentTrack as Track | null,
            duration: state.duration,
            currentIndex: state.currentIndex,
            position: state.position,
            isPlaying: state.isPlaying
        };

        this.setState(playbackState);
        return playbackState;
    }

    applyTrackChangedState(track: unknown, state: AudioEngineState): {
        playbackState: PlaybackState;
        previousIndex: number;
        indexChanged: boolean;
    } {
        const currentState = this.getState();
        const previousIndex = currentState.currentIndex;
        const playbackState = {
            currentTrack: track as Track | null,
            duration: state.duration,
            currentIndex: state.currentIndex,
            position: state.position,
            isPlaying: state.isPlaying
        };

        this.setState(playbackState);
        return {
            playbackState,
            previousIndex,
            indexChanged: previousIndex !== playbackState.currentIndex
        };
    }
}
