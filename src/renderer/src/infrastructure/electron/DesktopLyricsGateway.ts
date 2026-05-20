import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Result, Unsubscribe} from '@api/types/common';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';
import type {Track} from '@api/types/library';

class DesktopLyricsGateway extends ElectronNamespaceAdapter<'desktopLyrics'> {
    constructor() {
        super('desktopLyrics');
    }

    close(): Promise<unknown> {
        return this.call('close');
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

    hide(): Promise<Result> {
        return this.call('hide');
    }

    isVisible(): Promise<boolean> {
        return this.call('isVisible');
    }

    updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        return this.call('updateSettings', settings);
    }

    setOpacity(opacity: number): Promise<unknown> {
        return this.call('setOpacity', opacity);
    }

    setAlwaysOnTop(flag: boolean): Promise<unknown> {
        return this.call('setAlwaysOnTop', flag);
    }

    setIgnoreMouseEvents(ignore: boolean, options?: {forward?: boolean}): Promise<unknown> {
        return this.call('setIgnoreMouseEvents', ignore, options);
    }

    centerOnScreen(): Promise<unknown> {
        return this.call('centerOnScreen');
    }

    onLyricsUpdated(handler: (lyricsData: unknown) => void): Unsubscribe {
        return this.on('onLyricsUpdated', handler);
    }

    onPositionChanged(handler: (position: number) => void): Unsubscribe {
        return this.on('onPositionChanged', handler);
    }

    onPlaybackStateChanged(handler: (state: DesktopLyricsPlaybackState) => void): Unsubscribe {
        return this.on('onPlaybackStateChanged', handler);
    }

    onTrackChanged(handler: (track: Track | null) => void): Unsubscribe {
        return this.on('onTrackChanged', handler);
    }

    onSettingsChanged(handler: (settings: DesktopLyricsSettings | MusicBoxSettings) => void): Unsubscribe {
        return this.on('onSettingsChanged', handler);
    }
}

export const desktopLyricsGateway = new DesktopLyricsGateway();
