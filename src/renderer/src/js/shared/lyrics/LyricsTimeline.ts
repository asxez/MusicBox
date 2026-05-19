export interface LyricsTimelineEntry {
    time: number;
}

export interface FindActiveLyricIndexOptions {
    beforeFirst?: 'none' | 'first';
}

export function findActiveLyricIndex<T extends LyricsTimelineEntry>(
    lyrics: readonly T[],
    currentTime: number,
    options: FindActiveLyricIndexOptions = {}
): number {
    if (lyrics.length === 0 || !Number.isFinite(currentTime)) {
        return -1;
    }

    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        const lyricTime = lyrics[i].time;
        if (!Number.isFinite(lyricTime)) {
            continue;
        }

        if (currentTime >= lyricTime) {
            activeIndex = i;
            continue;
        }

        break;
    }

    if (activeIndex === -1 && options.beforeFirst === 'first') {
        return 0;
    }

    return activeIndex;
}
