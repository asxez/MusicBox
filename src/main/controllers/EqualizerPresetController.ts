import * as fs from 'fs';
import * as path from 'path';
import {dialog} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

interface EqualizerPresetFileResult {
    success: boolean;
    filePath?: string;
    content?: string;
    cancelled?: boolean;
    error?: string;
}

const PRESET_FILTERS: Electron.FileFilter[] = [
    {name: '参量均衡器预设', extensions: ['peq.json', 'json']},
    {name: '所有文件', extensions: ['*']}
];

@Controller('equalizer-presets')
export class EqualizerPresetController extends BaseController {
    constructor(private windowManager: WindowManager) {
        super();
    }

    @IpcHandle('equalizer-presets:export')
    async exportPreset(defaultName: string, content: string): Promise<EqualizerPresetFileResult> {
        try {
            const win = this.windowManager.getMainWindow();
            const result = await dialog.showSaveDialog(win as any, {
                title: '导出参量均衡器设置',
                defaultPath: this.createDefaultFileName(defaultName),
                filters: PRESET_FILTERS
            });

            if (result.canceled || !result.filePath) {
                return {success: false, cancelled: true};
            }

            await fs.promises.writeFile(result.filePath, content, 'utf-8');
            return {success: true, filePath: result.filePath};
        } catch (error) {
            return {success: false, error: this.getErrorMessage(error)};
        }
    }

    @IpcHandle('equalizer-presets:import')
    async importPreset(): Promise<EqualizerPresetFileResult> {
        try {
            const win = this.windowManager.getMainWindow();
            const result = await dialog.showOpenDialog(win as any, {
                title: '导入参量均衡器设置',
                filters: PRESET_FILTERS,
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) {
                return {success: false, cancelled: true};
            }

            const filePath = result.filePaths[0];
            if (!this.isJsonPresetFile(filePath)) {
                return {success: false, error: '请选择 .json 或 .peq.json 预设文件'};
            }

            const content = await fs.promises.readFile(filePath, 'utf-8');
            return {success: true, filePath, content};
        } catch (error) {
            return {success: false, error: this.getErrorMessage(error)};
        }
    }

    private createDefaultFileName(name: string): string {
        const safeName = (name || 'parametric-equalizer')
            .replace(/[<>:"/\\|?*]/g, '_')
            .trim() || 'parametric-equalizer';

        return safeName.endsWith('.json') ? safeName : `${safeName}.peq.json`;
    }

    private isJsonPresetFile(filePath: string): boolean {
        return path.extname(filePath).toLowerCase() === '.json';
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
