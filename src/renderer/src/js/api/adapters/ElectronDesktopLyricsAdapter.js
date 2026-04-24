import {ElectronNamespaceAdapter} from './ElectronBridge';

class ElectronDesktopLyricsAdapter extends ElectronNamespaceAdapter {
    constructor() {
        super('desktopLyrics');
    }

    updateTrack(track) {
        return this.call('updateTrack', track);
    }

    updateLyrics(lyrics) {
        return this.call('updateLyrics', lyrics);
    }

    updatePlaybackState(state) {
        return this.call('updatePlaybackState', state);
    }

    updatePosition(position) {
        return this.call('updatePosition', position);
    }

    toggle() {
        return this.call('toggle');
    }

    hide() {
        return this.call('hide');
    }

    isVisible() {
        return this.call('isVisible');
    }

    updateSettings(settings) {
        return this.call('updateSettings', settings);
    }
}

export const electronDesktopLyricsAdapter = new ElectronDesktopLyricsAdapter();

