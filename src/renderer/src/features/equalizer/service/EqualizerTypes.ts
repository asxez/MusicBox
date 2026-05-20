export type AudioEngineType = 'webaudio' | 'wasapi' | string;

interface NativeEngineBridge {
    getShareMode?(): Promise<unknown>;
}

export interface EqualizerCurrentEngineBridge {
    nativeEngine?: NativeEngineBridge;
    switchShareMode?(mode: string): Promise<boolean>;
}

export interface AudioEngineManagerBridge {
    currentEngine?: EqualizerCurrentEngineBridge | null;
    getEngineType(): AudioEngineType;
}
