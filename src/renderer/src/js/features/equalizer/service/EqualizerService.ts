import {playbackService} from '@js/features/playback/service';
import type {AudioEngineManagerBridge} from '@js/features/playback/service/AudioEngineAdapter';

export class EqualizerService {
    getEqualizer<T = unknown>(): T | null {
        return playbackService.getEqualizer<T>();
    }

    setEqualizerEnabled(enabled: boolean): void {
        playbackService.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return playbackService.getAudioEngine<T>();
    }
}

export const equalizerService = new EqualizerService();
