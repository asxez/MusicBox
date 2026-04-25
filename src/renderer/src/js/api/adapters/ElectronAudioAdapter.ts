import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Unsubscribe} from "@api/types/common";
import type {ElectronAudioAPI} from "@api/types/electron";
import type {Track} from "@api/types/track";

class ElectronAudioAdapter extends ElectronNamespaceAdapter<'audio'> {
    constructor() {
        super('audio');
    }

    init(): ReturnType<ElectronAudioAPI['init']> {
        return this.call('init');
    }

    loadTrack(filePath: string): ReturnType<ElectronAudioAPI['loadTrack']> {
        return this.call('loadTrack', filePath);
    }

    getCurrentTrack(): ReturnType<ElectronAudioAPI['getCurrentTrack']> {
        return this.call('getCurrentTrack');
    }

    getDuration(): ReturnType<ElectronAudioAPI['getDuration']> {
        return this.call('getDuration');
    }

    play(): ReturnType<ElectronAudioAPI['play']> {
        return this.call('play');
    }

    pause(): ReturnType<ElectronAudioAPI['pause']> {
        return this.call('pause');
    }

    stop(): ReturnType<ElectronAudioAPI['stop']> {
        return this.call('stop');
    }

    seek(position: number): ReturnType<ElectronAudioAPI['seek']> {
        return this.call('seek', position);
    }

    setVolume(volume: number): ReturnType<ElectronAudioAPI['setVolume']> {
        return this.call('setVolume', volume);
    }

    setPlaylist(tracks: Track[]): ReturnType<ElectronAudioAPI['setPlaylist']> {
        return this.call('setPlaylist', tracks);
    }

    onTrackChanged(handler: Parameters<ElectronAudioAPI['onTrackChanged']>[0]): Unsubscribe {
        return this.on('onTrackChanged', handler);
    }

    onPlaybackStateChanged(handler: Parameters<ElectronAudioAPI['onPlaybackStateChanged']>[0]): Unsubscribe {
        return this.on('onPlaybackStateChanged', handler);
    }

    onPositionChanged(handler: Parameters<ElectronAudioAPI['onPositionChanged']>[0]): Unsubscribe {
        return this.on('onPositionChanged', handler);
    }
}

export const electronAudioAdapter = new ElectronAudioAdapter();

