import {ElectronNamespaceAdapter} from './ElectronBridge';

export interface EqualizerPresetFileResult {
    success: boolean;
    filePath?: string;
    content?: string;
    cancelled?: boolean;
    error?: string;
}

class EqualizerPresetGateway extends ElectronNamespaceAdapter<'equalizerPresets'> {
    constructor() {
        super('equalizerPresets');
    }

    exportPreset(defaultName: string, content: string): Promise<EqualizerPresetFileResult> {
        return this.call('exportPreset', defaultName, content);
    }

    importPreset(): Promise<EqualizerPresetFileResult> {
        return this.call('importPreset');
    }
}

export const equalizerPresetGateway = new EqualizerPresetGateway();
