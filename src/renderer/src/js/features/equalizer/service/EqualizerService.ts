import {api} from '@api/api';
import type {AudioEngineManagerBridge} from '@js/features/playback/service/AudioEngineAdapter';

export class EqualizerService {
    getEqualizer<T = unknown>(): T | null {
        return api.getEqualizer() as T | null;
    }

    setEqualizerEnabled(enabled: boolean): void {
        api.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return api.audioEngine as T | null;
    }
}

export const equalizerService = new EqualizerService();
