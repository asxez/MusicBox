import type {DesktopLyricsSettings as ApiDesktopLyricsSettings} from '@api/types/settings';

export interface DesktopLyricWord {
    time: number;
    endTime?: number;
    text: string;
}

export interface DesktopLyricLine {
    time: number;
    endTime?: number;
    content?: string;
    type?: string;
    words?: DesktopLyricWord[];
}

export interface DesktopLyricsSettings extends ApiDesktopLyricsSettings {
    layoutMode: 'default' | 'center';
    themeColor: string;
    fontColor: string;
    opacity: number;
    fontSize: number;
}

export interface DesktopLyricsElements {
    container: HTMLElement;
    currentLyricEl: HTMLElement;
    nextLyricEl: HTMLElement;
    controlsBar: HTMLElement;
    lockBtn: HTMLElement;
    lockIcon: HTMLElement;
    unlockIcon: HTMLElement;
    closeBtn: HTMLElement;
}
