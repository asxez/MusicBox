// 设置控制器

import * as fs from 'fs';
import * as path from 'path';
import {app, BrowserWindow} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';

const DEFAULT_SETTINGS = {
    musicFolders: [] as string[],
    autoScanEnabled: false,
    scanFrequency: 'on_startup' as string,
    lastScanTime: 0
};

type Settings = typeof DEFAULT_SETTINGS;

@Controller('settings')
export class SettingsController extends BaseController {
    private settingsFilePath: string;
    private settings: Settings | null = null;

    constructor() {
        super();
        this.settingsFilePath = path.join(app.getPath('userData'), 'music-folders-settings.json');
    }

    private async loadSettings(): Promise<Settings> {
        try {
            const data = await fs.promises.readFile(this.settingsFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error: any) {
            if (error.code !== 'ENOENT') console.error('⚠️ 加载音乐文件夹设置失败:', error);
            return {...DEFAULT_SETTINGS};
        }
    }

    private async saveSettings(s: Settings): Promise<boolean> {
        try {
            await fs.promises.writeFile(this.settingsFilePath, JSON.stringify(s, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('❌ 保存音乐文件夹设置失败:', error);
            return false;
        }
    }

    private async ensureSettings(): Promise<Settings> {
        if (!this.settings) this.settings = await this.loadSettings();
        return this.settings!;
    }

    @IpcHandle('settings:getMusicFolders')
    async getMusicFolders(): Promise<string[]> {
        const s = await this.ensureSettings();
        return s.musicFolders || [];
    }

    @IpcHandle('settings:addMusicFolder')
    async addMusicFolder(folderPath: string): Promise<{ success: boolean; settings?: Settings }> {
        const s = await this.ensureSettings();
        if (!s.musicFolders) s.musicFolders = [];
        if (!s.musicFolders.includes(folderPath)) {
            s.musicFolders.push(folderPath);
            await this.saveSettings(s);
        }
        return {success: true, settings: s};
    }

    @IpcHandle('settings:removeMusicFolder')
    async removeMusicFolder(folderPath: string): Promise<{ success: boolean; settings?: Settings }> {
        const s = await this.ensureSettings();
        s.musicFolders = (s.musicFolders || []).filter(f => f !== folderPath);
        await this.saveSettings(s);
        return {success: true, settings: s};
    }

    @IpcHandle('settings:getAutoScanSettings')
    async getAutoScanSettings(): Promise<Settings> {
        return this.ensureSettings();
    }

    @IpcHandle('settings:updateAutoScanSettings')
    async updateAutoScanSettings(newSettings: Partial<Settings>): Promise<{ success: boolean; settings?: Settings }> {
        const s = await this.ensureSettings();
        Object.assign(s, newSettings);
        const saved = await this.saveSettings(s);
        if (saved) {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('autoScanScheduler:restart');
        }
        return {success: saved, settings: s};
    }

    @IpcHandle('settings:updateLastScanTime')
    async updateLastScanTime(timestamp: number): Promise<{ success: boolean }> {
        const s = await this.ensureSettings();
        s.lastScanTime = timestamp;
        return {success: await this.saveSettings(s)};
    }

    @IpcHandle('settings:get')
    async get(key: string): Promise<any> {
        const s = await this.ensureSettings();
        return (s as any)[key] ?? null;
    }

    @IpcHandle('settings:set')
    async set(key: string, value: any): Promise<boolean> {
        const s = await this.ensureSettings();
        (s as any)[key] = value;
        return this.saveSettings(s);
    }
}
