import type {Result} from '@api/types/common';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';
import type {Track} from '@api/types/track';
import {
    DesktopLyricsStateSyncService,
    type DesktopLyricsStateSyncOptions,
    type DesktopLyricsSyncType
} from './DesktopLyricsStateSyncService';
import {DesktopLyricsWindowOperationsService, type DesktopLyricsToggleResult} from './DesktopLyricsWindowOperationsService';

type DesktopLyricsSyncOptions = DesktopLyricsStateSyncOptions;

export class DesktopLyricsSync {
    private readonly stateSync: DesktopLyricsStateSyncService;
    private readonly windowOperations: DesktopLyricsWindowOperationsService;

    constructor(options: DesktopLyricsSyncOptions) {
        this.stateSync = new DesktopLyricsStateSyncService(options);
        this.windowOperations = new DesktopLyricsWindowOperationsService(this.stateSync);
    }

    async syncToDesktopLyrics(
        type: DesktopLyricsSyncType,
        data: Track | DesktopLyricsPlaybackState | number | LyricLine[] | string | null
    ): Promise<void> {
        await this.stateSync.syncToDesktopLyrics(type, data);
    }

    async loadLyricsForDesktop(track: Track): Promise<void> {
        await this.stateSync.loadLyricsForDesktop(track);
    }

    async toggleDesktopLyrics(): Promise<DesktopLyricsToggleResult> {
        return await this.windowOperations.toggleDesktopLyrics();
    }

    async syncCurrentStateToDesktopLyrics(): Promise<void> {
        await this.stateSync.syncCurrentStateToDesktopLyrics();
    }

    async hideDesktopLyrics(): Promise<Result> {
        return await this.windowOperations.hideDesktopLyrics();
    }

    async isDesktopLyricsVisible(): Promise<boolean> {
        return await this.windowOperations.isDesktopLyricsVisible();
    }

    async updateDesktopLyricsSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return await this.windowOperations.updateDesktopLyricsSettings(settings);
    }
}

export type {DesktopLyricsSyncOptions, DesktopLyricsSyncType};
