interface PlayerControlElements {
    playPauseBtn: HTMLButtonElement;
    prevBtn: HTMLButtonElement;
    nextBtn: HTMLButtonElement;
    playModeBtn: HTMLButtonElement;
    playIcon: HTMLElement;
    pauseIcon: HTMLElement;
    modeSequenceIcon: HTMLElement | null;
    modeShuffleIcon: HTMLElement | null;
    modeRepeatOneIcon: HTMLElement | null;
}

interface PlayerActionElements {
    lyricsBtn: HTMLButtonElement;
    playlistBtn: HTMLButtonElement;
    likeBtn: HTMLButtonElement;
    desktopLyricsBtn: HTMLButtonElement | null;
    miniModeButton: HTMLButtonElement | null;
}

interface PlayerTrackElements {
    cover: HTMLImageElement;
    coverContainer: HTMLElement;
    title: HTMLElement;
    artist: HTMLElement;
}

interface PlayerProgressElements {
    barContainer: HTMLElement;
    track: HTMLElement;
    fill: HTMLElement;
    handle: HTMLElement;
    tooltip: HTMLElement;
}

interface PlayerVolumeElements {
    button: HTMLButtonElement;
    slider: HTMLElement;
    sliderContainer: HTMLElement;
    fill: HTMLElement;
    handle: HTMLElement;
    highIcon: HTMLElement | null;
    halfIcon: HTMLElement | null;
    muteIcon: HTMLElement | null;
}

interface PlayerElements {
    controls: PlayerControlElements;
    actions: PlayerActionElements;
    track: PlayerTrackElements;
    progress: PlayerProgressElements;
    volume: PlayerVolumeElements;
}

function resolvePlayerElements(root: Element | null): PlayerElements {
    return {
        controls: resolveControlElements(root),
        actions: {
            lyricsBtn: queryRequired(root, '#lyrics-btn'),
            playlistBtn: queryRequired(root, '#playlist-btn'),
            likeBtn: queryRequired(root, '#like-btn'),
            desktopLyricsBtn: queryOptional(root, '#desktop-lyrics-btn'),
            miniModeButton: queryOptional(root, '#mini-mode-btn')
        },
        track: {
            cover: queryRequired(root, '#track-cover'),
            coverContainer: queryRequired(root, '.track-cover-container'),
            title: queryRequired(root, '#track-title'),
            artist: queryRequired(root, '#track-artist')
        },
        progress: {
            barContainer: queryRequired(root, '.progress-bar-container'),
            track: queryRequired(root, '.progress-track'),
            fill: queryRequired(root, '#progress-fill'),
            handle: queryRequired(root, '#progress-handle'),
            tooltip: queryRequired(root, '#progress-tooltip')
        },
        volume: resolveVolumeElements(root)
    };
}

function resolveControlElements(root: Element | null): PlayerControlElements {
    const playModeBtn = queryRequired<HTMLButtonElement>(root, '#play-mode-btn');
    const playPauseBtn = queryRequired<HTMLButtonElement>(root, '#play-pause-btn');

    return {
        playPauseBtn,
        prevBtn: queryRequired(root, '#prev-btn'),
        nextBtn: queryRequired(root, '#next-btn'),
        playModeBtn,
        playIcon: queryRequired(playPauseBtn, '.play-icon'),
        pauseIcon: queryRequired(playPauseBtn, '.pause-icon'),
        modeSequenceIcon: queryOptional(playModeBtn, '.mode-sequence'),
        modeShuffleIcon: queryOptional(playModeBtn, '.mode-shuffle'),
        modeRepeatOneIcon: queryOptional(playModeBtn, '.mode-repeat-one')
    };
}

function resolveVolumeElements(root: Element | null): PlayerVolumeElements {
    const button = queryRequired<HTMLButtonElement>(root, '#volume-btn');

    return {
        button,
        slider: queryRequired(root, '.volume-slider'),
        sliderContainer: queryRequired(root, '.volume-slider-container'),
        fill: queryRequired(root, '#volume-fill'),
        handle: queryRequired(root, '#volume-handle'),
        highIcon: queryOptional(button, '.volume-high'),
        halfIcon: queryOptional(button, '.volume-half'),
        muteIcon: queryOptional(button, '.volume-mute')
    };
}

function queryRequired<T extends Element>(root: Element | null, selector: string): T {
    const element = root?.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Player element not found: ${selector}`);
    }

    return element;
}

function queryOptional<T extends Element>(root: Element | null, selector: string): T | null {
    return root?.querySelector<T>(selector) ?? null;
}

export {resolvePlayerElements};
export type {PlayerElements};
