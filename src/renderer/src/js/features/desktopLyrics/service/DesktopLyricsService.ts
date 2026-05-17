import type {Result} from '@api/types/common';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';
import {playbackController} from '@js/features/playback';
import {DesktopLyricsSync} from './DesktopLyricsSync';

export type DesktopLyricsToggleResult = {
    success: boolean;
    visible?: boolean;
    error?: string;
};

export class DesktopLyricsService {
    private readonly sync: DesktopLyricsSync;

    constructor() {
        this.sync = new DesktopLyricsSync({
            getCurrentState: () => {
                const snapshot = playbackController.getPlaybackSnapshot();
                return {
                    currentTrack: snapshot.currentTrack,
                    isPlaying: snapshot.isPlaying,
                    position: snapshot.position
                };
            }
        });
    }

    async toggle(): Promise<DesktopLyricsToggleResult> {
        return await this.sync.toggleDesktopLyrics();
    }

    async isVisible(): Promise<boolean> {
        return await this.sync.isDesktopLyricsVisible();
    }

    async hide(): Promise<Result> {
        return await this.sync.hideDesktopLyrics();
    }

    async updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return await this.sync.updateDesktopLyricsSettings(settings);
    }

    async syncLyrics(lyrics: LyricLine[] | string): Promise<void> {
        await this.sync.syncToDesktopLyrics('lyrics', lyrics);
    }
}

export const desktopLyricsService = new DesktopLyricsService();
