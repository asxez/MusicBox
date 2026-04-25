import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {LyricLine} from "@api/types/lyrics";
import type {DesktopLyricsPlaybackState} from "@api/types/playback";
import type {DesktopLyricsSettings, MusicBoxSettings} from "@api/types/settings";
import type {Track} from "@api/types/track";

class ElectronDesktopLyricsAdapter extends ElectronNamespaceAdapter<'desktopLyrics'> {
    constructor() {
        super('desktopLyrics');
    }

    updateTrack(track: Track | null): Promise<unknown> {
        return this.call('updateTrack', track);
    }

    updateLyrics(lyrics: LyricLine[] | string): Promise<unknown> {
        return this.call('updateLyrics', lyrics);
    }

    updatePlaybackState(state: DesktopLyricsPlaybackState): Promise<unknown> {
        return this.call('updatePlaybackState', state);
    }

    updatePosition(position: number): Promise<unknown> {
        return this.call('updatePosition', position);
    }

    toggle(): Promise<{success: boolean; visible?: boolean; error?: string}> {
        return this.call('toggle');
    }

    hide(): Promise<unknown> {
        return this.call('hide');
    }

    isVisible(): Promise<boolean> {
        return this.call('isVisible');
    }

    updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<unknown> {
        return this.call('updateSettings', settings);
    }
}

export const electronDesktopLyricsAdapter = new ElectronDesktopLyricsAdapter();

