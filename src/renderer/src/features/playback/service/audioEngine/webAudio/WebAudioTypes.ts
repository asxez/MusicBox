import type {AudioTrack} from '../AudioTrack';

export interface WebAudioTrack extends AudioTrack {
    filePath: string;
    title?: string;
    artist?: string;
    album?: string;
    duration: number;
    bitrate?: number;
    sampleRate?: number;
    year?: number;
    genre?: string;
    track?: number;
    disc?: number;
    cover?: unknown;
    [key: string]: unknown;
}

export interface CoverData {
    data?: BlobPart;
    format?: string;
    [key: string]: unknown;
}

export interface TrackMetadata {
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    year?: number;
    genre?: string;
    track?: number;
    disc?: number;
    cover?: unknown;
    [key: string]: unknown;
}

export type LoadedWebAudioTrack = {
    buffer: AudioBuffer;
    duration: number;
    track: WebAudioTrack;
};
