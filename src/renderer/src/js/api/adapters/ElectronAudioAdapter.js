import {ElectronNamespaceAdapter} from './ElectronBridge';

class ElectronAudioAdapter extends ElectronNamespaceAdapter {
    constructor() {
        super('audio');
    }

    init() {
        return this.call('init');
    }

    loadTrack(filePath) {
        return this.call('loadTrack', filePath);
    }

    getCurrentTrack() {
        return this.call('getCurrentTrack');
    }

    getDuration() {
        return this.call('getDuration');
    }

    play() {
        return this.call('play');
    }

    pause() {
        return this.call('pause');
    }

    stop() {
        return this.call('stop');
    }

    seek(position) {
        return this.call('seek', position);
    }

    setVolume(volume) {
        return this.call('setVolume', volume);
    }

    setPlaylist(tracks) {
        return this.call('setPlaylist', tracks);
    }

    onTrackChanged(handler) {
        return this.on('onTrackChanged', handler);
    }

    onPlaybackStateChanged(handler) {
        return this.on('onPlaybackStateChanged', handler);
    }

    onPositionChanged(handler) {
        return this.on('onPositionChanged', handler);
    }
}

export const electronAudioAdapter = new ElectronAudioAdapter();

