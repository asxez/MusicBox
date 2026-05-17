import type {Result} from '@api/types/common';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';
import {desktopLyricsService} from './service';
import type {DesktopLyricsToggleResult} from './service';

class DesktopLyricsController {
    async toggle(): Promise<DesktopLyricsToggleResult> {
        return await desktopLyricsService.toggle();
    }

    async isVisible(): Promise<boolean> {
        return await desktopLyricsService.isVisible();
    }

    async hide(): Promise<Result> {
        return await desktopLyricsService.hide();
    }

    async updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return await desktopLyricsService.updateSettings(settings);
    }

    async syncLyrics(lyrics: LyricLine[] | string): Promise<void> {
        await desktopLyricsService.syncLyrics(lyrics);
    }
}

export const desktopLyricsController = new DesktopLyricsController();
export {DesktopLyricsController};
export type {DesktopLyricsToggleResult};
