import type {Unsubscribe} from '@api/types/common';
import type {ElectronNativeAudioAPI} from '@api/types/electron';

function getElectronAPI(): Window['electronAPI'] {
    if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
    }

    return window.electronAPI;
}

class NativeAudioGateway {
    isAvailable(): boolean {
        return Boolean(window.electronAPI && window.electronAPI.nativeAudio);
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
