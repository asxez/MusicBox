import type {Track} from './track';
import type {PlayMode, PlaybackStateName} from './playback';

export interface ScanProgress {
    totalFiles?: number;
    processedFiles?: number;
    current?: number;
    total?: number;
    tracks?: number;
    currentFile?: string;
    isComplete?: boolean;
}

export interface CacheValidationResult {
    valid: number;
    invalid: number;
    modified: number;
    tracks?: Track[];
}

export interface AudioEngineChangedEvent {
    engineType?: string;
}

export interface MusicBoxAPIEvents {
    trackChanged: Track | null;
    trackIndexChanged: number;
    playbackStateChanged: PlaybackStateName;
    positionChanged: number;
    durationChanged: number;
    volumeChanged: number;
    playlistChanged: Track[];
    playModeChanged: PlayMode;
    audioEngineChanged: AudioEngineChangedEvent;
    libraryUpdated: Track[];
    scanProgress: ScanProgress;
    cacheValidationProgress: ScanProgress;
    cacheValidationCompleted: CacheValidationResult;
    cacheValidationError: string;
    libraryTrackDurationUpdated: {
        filePath: string;
        duration: number;
    };
    playlistCoverUpdated: {
        playlistId: string;
        imagePath: string;
    };
    playlistCoverRemoved: {
        playlistId: string;
    };
    trackDurationUpdated: {
        filePath: string;
        duration: number;
    };
}
