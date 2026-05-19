import type {LyricsLayoutElements} from "@ui/widgets/lyrics/LyricsLayoutController";
import type {LyricsPlaybackControlElements} from "@ui/widgets/lyrics/LyricsPlaybackControlsController";

interface LyricsElements {
    page: HTMLElement;
    background: HTMLElement;
    closeBtn: HTMLElement;
    trackCover: HTMLImageElement;
    trackTitle: HTMLElement;
    trackArtist: HTMLElement;
    lyricsDisplay: HTMLElement;
    layout: LyricsLayoutElements;
    playback: LyricsPlaybackControlElements;
}

function resolveLyricsElements(root: Element | null): LyricsElements {
    const page = requireRoot(root, '#lyrics-page');
    const fullscreenBtn = queryRequired(page, '#lyrics-fullscreen');
    const trackCover = queryRequired<HTMLImageElement>(page, '#lyrics-cover-image');
    const lyricsMain = queryRequired(page, '.lyrics-main');
    const leftSide = queryRequired(page, '.lyrics-left-side');
    const playBtn = queryRequired(page, '#lyrics-play-btn');
    const volumeBtn = queryRequired(page, '#lyrics-volume-btn');
    const playModeBtn = queryRequired(page, '#lyrics-playmode-btn');

    return {
        page,
        background: queryRequired(page, '.lyrics-background'),
        closeBtn: queryRequired(page, '#lyrics-close'),
        trackCover,
        trackTitle: queryRequired(page, '#lyrics-track-title'),
        trackArtist: queryRequired(page, '#lyrics-track-artist'),
        lyricsDisplay: queryRequired(page, '#lyrics-display'),
        layout: {
            page,
            fullscreenBtn,
            fullscreenIcon: queryRequired(fullscreenBtn, '.fullscreen-icon'),
            fullscreenExitIcon: queryRequired(fullscreenBtn, '.fullscreen-exit-icon'),
            trackCover,
            lyricsMain,
            leftSide
        },
        playback: {
            playBtn,
            prevBtn: queryRequired(page, '#lyrics-prev-btn'),
            nextBtn: queryRequired(page, '#lyrics-next-btn'),
            playIcon: queryRequired(playBtn, '.play-icon'),
            pauseIcon: queryRequired(playBtn, '.pause-icon'),
            progressBar: queryRequired(page, '#lyrics-progress-bar'),
            progressFill: queryRequired(page, '#lyrics-progress-fill'),
            progressHandle: queryRequired(page, '#lyrics-progress-handle'),
            currentTimeEl: queryRequired(page, '#lyrics-current-time'),
            durationEl: queryRequired(page, '#lyrics-duration'),
            volumeBtn,
            volumeSliderContainer: queryRequired(page, '.volume-slider-container'),
            volumeFill: queryRequired(page, '#lyrics-volume-fill'),
            volumeHandle: queryRequired(page, '#lyrics-volume-handle'),
            volumeIcon: queryRequired(volumeBtn, '.volume-icon'),
            volumeMuteIcon: queryRequired(volumeBtn, '.volume-mute-icon'),
            volumeHalfIcon: queryRequired(volumeBtn, '.volume-half-icon'),
            playModeBtn,
            modeSequenceIcon: queryRequired(playModeBtn, '.lyrics-mode-sequence'),
            modeShuffleIcon: queryRequired(playModeBtn, '.lyrics-mode-shuffle'),
            modeRepeatOneIcon: queryRequired(playModeBtn, '.lyrics-mode-repeat-one')
        }
    };
}

function requireRoot<T extends HTMLElement = HTMLElement>(root: Element | null, selector: string): T {
    if (root instanceof HTMLElement) {
        return root as T;
    }

    throw new Error(`Lyrics element not found: ${selector}`);
}

function queryRequired<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Lyrics element not found: ${selector}`);
    }

    return element;
}

export {resolveLyricsElements};
export type {LyricsElements};
