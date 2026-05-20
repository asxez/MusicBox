import type {Unsubscribe} from '@api/types/common';
import type {ElectronNativeAudioAPI} from '@api/types/electron';
import {getElectronAPI, hasElectronNamespace} from './ElectronBridge';

class NativeAudioGateway {
    isAvailable(): boolean {
        return hasElectronNamespace('nativeAudio');
    }

    get api(): ElectronNativeAudioAPI {
        const nativeAudio = getElectronAPI().nativeAudio;
        if (!nativeAudio) {
            throw new Error('electronAPI.nativeAudio is not available');
        }

        return nativeAudio;
    }

    onNativeAudioEvent(eventName: string, handler: (data: unknown) => void): Unsubscribe {
        const electronAPI = getElectronAPI();
        if (typeof electronAPI.onNativeAudioEvent !== 'function') {
            return () => {};
        }

        return electronAPI.onNativeAudioEvent(eventName, handler) || (() => {});
    }
}

export const nativeAudioGateway = new NativeAudioGateway();
