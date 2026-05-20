export {
    getTrackDuration,
    getTrackFilePath,
    getTrackTitle,
    normalizeTrack
} from './AudioTrack';
export type {AudioTrack, TrackSource} from './AudioTrack';

export type {
    AudioEngineBridge,
    AudioEngineConstructor,
    AudioEngineState,
    AudioEngineType
} from './AudioEngineContract';

export {
    audioEngineStateStore,
    AudioEngineStateStore,
    DEFAULT_AUDIO_ENGINE_STATE
} from './AudioEngineStateStore';

export {
    audioEngineFactory,
    AudioEngineFactory
} from './AudioEngineFactory';

export {default as AudioEngineManager} from './AudioEngineManager';

export {
    TrackMetadataLookupService,
    trackMetadataLookupService
} from './TrackMetadataLookupService';
export type {AudioTrackMetadata} from './TrackMetadataLookupService';
