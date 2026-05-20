export type TrackSource = string | {
    filePath?: string;
    path?: string;
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    cover?: unknown;
    [key: string]: unknown;
};

export interface AudioTrack {
    filePath: string;
    title?: string;
    artist?: string;
    album?: string;
    duration: number;
    cover?: unknown;
    [key: string]: unknown;
}

export function getTrackFilePath(track: TrackSource | null | undefined): string | null {
    if (!track) {
        return null;
    }

    if (typeof track === 'string') {
        return track;
    }

    return track.filePath || track.path || null;
}

export function getTrackTitle(track: TrackSource | null | undefined): string | undefined {
    return track && typeof track !== 'string' ? track.title : undefined;
}

export function getTrackDuration(track: TrackSource | null | undefined): number | undefined {
    return track && typeof track !== 'string' ? track.duration : undefined;
}

export function normalizeTrack<TTrack extends AudioTrack = AudioTrack>(
    track: TrackSource,
    filePath: string,
    duration: number
): TTrack {
    if (typeof track === 'string') {
        return {
            filePath,
            duration
        } as TTrack;
    }

    return {
        ...track,
        filePath,
        duration
    } as TTrack;
}
