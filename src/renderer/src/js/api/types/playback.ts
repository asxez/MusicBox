import type {Track} from './track';

export type PlayMode = 'sequence' | 'shuffle' | 'repeat-one';

export type PlaybackStateName = 'playing' | 'paused' | 'stopped';

export interface PlaybackStateSnapshot {
    currentTrack: Track | null;
    position: number;
    isPlaying: boolean;
    playlist: Track[];
    currentIndex: number;
    playMode: PlayMode;
    timestamp?: number;
}

export interface DesktopLyricsPlaybackState {
    isPlaying: boolean;
    position: number;
}
