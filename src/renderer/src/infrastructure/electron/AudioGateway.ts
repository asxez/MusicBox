import {ElectronNamespaceAdapter} from './ElectronBridge';
import type {Unsubscribe} from '@api/types/common';
import type {Track} from '@api/types/library';

class AudioGateway extends ElectronNamespaceAdapter<'audio'> {
    constructor() {
        super('audio');
    }

    init(): Promise<boolean> {
        return this.call('init');
    }

    play(): Promise<boolean> {
        return this.call('play');
    }

    pause(): Promise<boolean> {
        return this.call('pause');
    }

    stop(): Promise<boolean> {
        return this.call('stop');
    }

    seek(position: number): Promise<boolean> {
        return this.call('seek', position);
    }

    setVolume(volume: number): Promise<boolean> {
        return this.call('setVolume', volume);
    }

    loadTrack(filePath: string): Promise<boolean> {
        return this.call('loadTrack', filePath);
    }

    getCurrentTrack(): Promise<Track | null> {
        return this.call('getCurrentTrack');
    }

    getDuration(): Promise<number> {
        return this.call('getDuration');
    }

    setPlaylist(tracks: Track[]): Promise<boolean> {
        return this.call('setPlaylist', tracks);
    }

    onTrackChanged(handler: (track: Track | null) => void): Unsubscribe {
        return this.on('onTrackChanged', (_event: unknown, track: Track | null) => handler(track));
    }

    onPlaybackStateChanged(handler: (state: string) => void): Unsubscribe {
        return this.on('onPlaybackStateChanged', (_event: unknown, state: string) => handler(state));
    }

    onPositionChanged(handler: (position: number) => void): Unsubscribe {
        return this.on('onPositionChanged', (_event: unknown, position: number) => handler(position));
    }
}

export const audioGateway = new AudioGateway();
