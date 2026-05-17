import {nativeAudioGateway} from '@js/infrastructure/electron';
import type {Unsubscribe} from '@api/types/common';
import type {ElectronNativeAudioAPI} from '@api/types/electron';

export type NativeAudioEventName = 'track-ended' | 'error' | string;

export class AudioDriverService {
    isNativeAudioAvailable(): boolean {
        return nativeAudioGateway.isAvailable();
    }

    getNativeAudio(): ElectronNativeAudioAPI {
        return nativeAudioGateway.api;
    }

    onNativeAudioEvent(eventName: NativeAudioEventName, handler: (data: unknown) => void): Unsubscribe {
        return nativeAudioGateway.onNativeAudioEvent(eventName, handler);
    }
}

export const audioDriverService = new AudioDriverService();
