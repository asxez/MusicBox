import type {DesktopLyricsElements} from './DesktopLyricsTypes';

function requireElement<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Desktop lyrics element missing: ${selector}`);
    }
    return element;
}

export function resolveDesktopLyricsElements(): DesktopLyricsElements {
    const container = requireElement<HTMLElement>('#desktop-lyrics');
    const lockBtn = requireElement<HTMLElement>('#lock-btn');

    return {
        container,
        currentLyricEl: requireElement<HTMLElement>('.current-lyric .lyric-text'),
        nextLyricEl: requireElement<HTMLElement>('.next-lyric .lyric-text'),
        controlsBar: requireElement<HTMLElement>('.controls-bar'),
        lockBtn,
        lockIcon: requireElement<HTMLElement>('.lock-icon', lockBtn),
        unlockIcon: requireElement<HTMLElement>('.unlock-icon', lockBtn),
        closeBtn: requireElement<HTMLElement>('#close-btn')
    };
}
