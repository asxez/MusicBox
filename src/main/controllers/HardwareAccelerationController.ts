// 硬件加速控制器

import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';

const defaultSettings = {enabled: true, lastModified: Date.now()};
type HWSettings = typeof defaultSettings;

@Controller('hardwareAcceleration')
export class HardwareAccelerationController extends BaseController {
    private settingsFilePath: string;
    private settings: HWSettings = {...defaultSettings};

    constructor() {
        super();
        this.settingsFilePath = path.join(app.getPath('userData'), 'hardware-acceleration-settings.json');
    }

    private async load(): Promise<void> {
        try {
            const data = await fs.promises.readFile(this.settingsFilePath, 'utf8');
            this.settings = {...defaultSettings, ...JSON.parse(data)};
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
            this.settings = {...defaultSettings};
            await this.save();
        }
    }

    private async save(): Promise<void> {
        await fs.promises.writeFile(this.settingsFilePath, JSON.stringify(this.settings, null, 2), 'utf8');
    }

    @IpcHandle('hardwareAcceleration:getSettings')
    async getSettings(): Promise<{ success: boolean; settings: HWSettings; error?: string }> {
        try {
            await this.load();
            return {success: true, settings: this.settings};
        } catch (error: any) {
            return {success: false, error: error.message, settings: defaultSettings};
        }
    }

    @IpcHandle('hardwareAcceleration:updateSettings')
    async updateSettings(newSettings: Partial<HWSettings>): Promise<{
        success: boolean;
        settings?: HWSettings;
        requiresRestart?: boolean;
        error?: string
    }> {
        try {
            if (typeof newSettings !== 'object' || newSettings === null) throw new Error('无效的设置对象');
            this.settings = {...this.settings, ...newSettings, lastModified: Date.now()};
            await this.save();
            return {success: true, settings: this.settings, requiresRestart: true};
        } catch (error: any) {
            console.error('❌ 更新硬件加速设置失败:', error);
            return {success: false, error: error.message};
        }
    }
}
