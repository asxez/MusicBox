import {api} from '@api/api';
import type {Result} from '@api/types/common';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';

export type DesktopLyricsToggleResult = {
    success: boolean;
    visible?: boolean;
    error?: string;
};

class DesktopLyricsController {
    async toggle(): Promise<DesktopLyricsToggleResult> {
        return await api.toggleDesktopLyrics();
    }

    async isVisible(): Promise<boolean> {
        return await api.isDesktopLyricsVisible();
    }

    async hide(): Promise<Result> {
        return await api.hideDesktopLyrics();
    }

    async updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return await api.updateDesktopLyricsSettings(settings);
    }
}

export const desktopLyricsController = new DesktopLyricsController();
export {DesktopLyricsController};
