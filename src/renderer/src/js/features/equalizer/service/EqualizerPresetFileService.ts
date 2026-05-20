import {equalizerPresetGateway} from '@js/infrastructure/electron/EqualizerPresetGateway';

export interface EqualizerPresetFileResult {
    success: boolean;
    filePath?: string;
    content?: string;
    cancelled?: boolean;
    error?: string;
}

export class EqualizerPresetFileService {
    exportPreset(defaultName: string, content: string): Promise<EqualizerPresetFileResult> {
        return equalizerPresetGateway.exportPreset(defaultName, content);
    }

    importPreset(): Promise<EqualizerPresetFileResult> {
        return equalizerPresetGateway.importPreset();
    }
}

export const equalizerPresetFileService = new EqualizerPresetFileService();
