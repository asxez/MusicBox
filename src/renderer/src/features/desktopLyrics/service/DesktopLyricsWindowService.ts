import type {Result, Unsubscribe} from '@api/types/common';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';
import type {Track} from '@api/types/library';
import {desktopLyricsGateway} from '@/infrastructure/electron/DesktopLyricsGateway';

export class DesktopLyricsWindowService {
    close(): Promise<unknown> {
        return desktopLyricsGateway.close();
    }

    setOpacity(opacity: number): Promise<unknown> {
        return desktopLyricsGateway.setOpacity(opacity);
    }

    setAlwaysOnTop(flag: boolean): Promise<unknown> {
        return desktopLyricsGateway.setAlwaysOnTop(flag);
    }

    setIgnoreMouseEvents(ignore: boolean, options?: {forward?: boolean}): Promise<unknown> {
        return desktopLyricsGateway.setIgnoreMouseEvents(ignore, options);
    }

    centerOnScreen(): Promise<unknown> {
        return desktopLyricsGateway.centerOnScreen();
    }

    updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return desktopLyricsGateway.updateSettings(settings);
    }

    onLyricsUpdated(handler: (lyricsData: LyricLine[] | string | unknown) => void): Unsubscribe {
        return desktopLyricsGateway.onLyricsUpdated(handler);
    }

    onPositionChanged(handler: (position: number) => void): Unsubscribe {
        return desktopLyricsGateway.onPositionChanged(handler);
    }

    onPlaybackStateChanged(handler: (state: DesktopLyricsPlaybackState) => void): Unsubscribe {
        return desktopLyricsGateway.onPlaybackStateChanged(handler);
    }

    onTrackChanged(handler: (track: Track | null) => void): Unsubscribe {
        return desktopLyricsGateway.onTrackChanged(handler);
    }

    onSettingsChanged(handler: (settings: DesktopLyricsSettings | MusicBoxSettings) => void): Unsubscribe {
        return desktopLyricsGateway.onSettingsChanged(handler);
    }
}

export const desktopLyricsWindowService = new DesktopLyricsWindowService();
