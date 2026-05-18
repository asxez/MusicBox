import type {AudioEngineManagerBridge} from './EqualizerTypes';

interface EqualizerServiceDependencies {
    getEqualizer<T = unknown>(): T | null;
    setEqualizerEnabled(enabled: boolean): void;
    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null;
}

export class EqualizerService {
    private dependencies: EqualizerServiceDependencies;

    constructor() {
        this.dependencies = {
            getEqualizer: () => null,
            setEqualizerEnabled: () => undefined,
            getAudioEngine: () => null
        };
    }

    configure(dependencies: EqualizerServiceDependencies): void {
        this.dependencies = dependencies;
    }

    getEqualizer<T = unknown>(): T | null {
        return this.dependencies.getEqualizer<T>();
    }

    setEqualizerEnabled(enabled: boolean): void {
        this.dependencies.setEqualizerEnabled(enabled);
    }

    getAudioEngine<T extends AudioEngineManagerBridge = AudioEngineManagerBridge>(): T | null {
        return this.dependencies.getAudioEngine<T>();
    }
}

export const equalizerService = new EqualizerService();
