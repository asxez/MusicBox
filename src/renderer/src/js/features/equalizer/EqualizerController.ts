import {api} from '@api/api';
import {appEventController} from '@js/features/events';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {AudioEngineManagerBridge} from '@api/audio/AudioEngineAdapter';
import type {Unsubscribe} from '@js/features/events';

type AudioEngineChangedHandler = (event: MusicBoxAPIEvents['audioEngineChanged']) => void | Promise<void>;

class EqualizerController {
    getEqualizer<T = unknown>(): T | null {
        return api.getEqualizer() as T | null;
    }

    setEqualizerEnabled(enabled: boolean): void {
        api.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return api.audioEngine as T | null;
    }

    onAudioEngineChanged(handler: AudioEngineChangedHandler): Unsubscribe {
        return appEventController.on('audioEngineChanged', handler);
    }
}

export const equalizerController = new EqualizerController();
export {EqualizerController};
