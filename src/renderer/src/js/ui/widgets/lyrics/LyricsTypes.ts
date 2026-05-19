import type {LyricLine} from "@api/types/lyrics";
import type {Track} from "@api/types/track";

type WordLyric = {
    text: string;
    time: number;
    endTime?: number;
};

type RenderLyricLine = LyricLine & {
    type?: string;
    words?: WordLyric[];
    endTime?: number;
};

type LyricsTrack = Track & {
    path?: string;
    lyrics?: string | RenderLyricLine[];
    lrcText?: string;
    lyricsContent?: string;
    lyricsFormat?: string;
};

export type {LyricsTrack, RenderLyricLine, WordLyric};
