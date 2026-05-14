import type {AudioEngineBridge, AudioEngineState} from './AudioEngineContract';

export const DEFAULT_AUDIO_ENGINE_STATE: AudioEngineState = {
    volume: 0.7,
    playlist: [],
    currentIndex: -1,
    position: 0,
    isPlaying: false,
    gaplessEnabled: true
};

class AudioEngineStateStore {
    createDefaultState(): AudioEngineState {
        return {
            ...DEFAULT_AUDIO_ENGINE_STATE,
            playlist: []
        };
    }

    async capture(engine: AudioEngineBridge): Promise<AudioEngineState> {
        return {
            volume: engine.getVolume(),
            playlist: engine.playlist || [],
            currentIndex: engine.currentIndex || -1,
            position: await engine.getPosition(),
            isPlaying: engine.isPlaying,
            gaplessEnabled: engine.getGaplessPlayback(),
            currentTrack: engine.getCurrentTrack()
        };
    }

    async apply(engine: AudioEngineBridge, state: AudioEngineState): Promise<void> {
        engine.setVolume(state.volume);
        engine.setGaplessPlayback(state.gaplessEnabled);
        engine.setPlaylist(state.playlist, state.currentIndex);
    }
}

export const audioEngineStateStore = new AudioEngineStateStore();
export {AudioEngineStateStore};
