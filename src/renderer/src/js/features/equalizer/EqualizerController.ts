import {appEventController} from '@js/features/events';
import type {MusicBoxAPIEvents} from '@api/types/events';
import type {Unsubscribe} from '@js/features/events';
import {equalizerService} from './service';
import type {AudioEngineManagerBridge} from './service';

type AudioEngineChangedHandler = (event: MusicBoxAPIEvents['audioEngineChanged']) => void | Promise<void>;

class EqualizerController {
    configure(...args: Parameters<typeof equalizerService.configure>): void {
        equalizerService.configure(...args);
    }

    getEqualizer<T = unknown>(): T | null {
        return equalizerService.getEqualizer<T>();
    }

    setEqualizerEnabled(enabled: boolean): void {
        equalizerService.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return equalizerService.getAudioEngine<T>();
    }

    onAudioEngineChanged(handler: AudioEngineChangedHandler): Unsubscribe {
        return appEventController.on('audioEngineChanged', handler);
    }
}

export const equalizerController = new EqualizerController();
export {EqualizerController};
