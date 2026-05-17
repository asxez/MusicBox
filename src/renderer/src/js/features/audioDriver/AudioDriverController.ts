import type {Unsubscribe} from '@api/types/common';
import type {ElectronNativeAudioAPI} from '@api/types/electron';
import {audioDriverService} from './service';
import type {NativeAudioEventName} from './service';

class AudioDriverController {
    isNativeAudioAvailable(): boolean {
        return audioDriverService.isNativeAudioAvailable();
    }

    getNativeAudio(): ElectronNativeAudioAPI {
        return audioDriverService.getNativeAudio();
    }

    onNativeAudioEvent(eventName: NativeAudioEventName, handler: (data: unknown) => void): Unsubscribe {
        return audioDriverService.onNativeAudioEvent(eventName, handler);
    }
}

export const audioDriverController = new AudioDriverController();
export {AudioDriverController};
export type {NativeAudioEventName};
