/**
 * 自动扫描调度器
 */

import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';

type ScanHandler = (folders: string[]) => Promise<void>;

interface ScanSettings {
    musicFolders: string[];
    autoScanEnabled: boolean;
    scanFrequency: 'on_startup' | 'daily' | 'weekly' | string;
    lastScanTime: number;
}

export class AutoScanScheduler {
    private timer: NodeJS.Timeout | null = null;
    private isScanning = false;
    private settings: ScanSettings | null = null;
    private scanHandler: ScanHandler | null = null;
    private settingsLoader: (() => Promise<ScanSettings>) | null = null;
    private settingsFilePath: string;

    constructor() {
        try {
            const userDataPath = app.getPath('userData');
            this.settingsFilePath = path.join(userDataPath, 'music-folders-settings.json');
        } catch {
            this.settingsFilePath = path.join(process.cwd(), 'music-folders-settings.json');
        }
    }

    initialize(scanHandler: ScanHandler, settingsLoader: () => Promise<ScanSettings>): void {
        this.scanHandler = scanHandler;
        this.settingsLoader = settingsLoader;
    }

    async start(): Promise<void> {
        if (!this.scanHandler || !this.settingsLoader) {
            console.error('❌ AutoScanScheduler: 未初始化，无法启动');
            return;
        }

        await this.loadSettings();

        if (!this.settings!.autoScanEnabled) {
            console.log('ℹ️ AutoScanScheduler: 自动扫描未启用');
            return;
        }

        if (!this.settings!.musicFolders?.length) return;

        console.log(`🎵 AutoScanScheduler: 启动调度器，扫描频率: ${this.settings!.scanFrequency}`);

        if (this.shouldScanNow()) {
            await this.executeScan();
        }

        this.scheduleNextScan();
    }

    stop(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    async restart(): Promise<void> {
        this.stop();
        await this.start();
    }

    private async loadSettings(): Promise<void> {
        this.settings = await this.settingsLoader!();
    }

    private shouldScanNow(): boolean {
        const {scanFrequency, lastScanTime} = this.settings!;
        const now = Date.now();

        if (scanFrequency === 'on_startup') return true;
        if (!lastScanTime) return true;

        const elapsed = now - lastScanTime;
        if (scanFrequency === 'daily') return elapsed >= 24 * 60 * 60 * 1000;
        if (scanFrequency === 'weekly') return elapsed >= 7 * 24 * 60 * 60 * 1000;
        return false;
    }

    private async executeScan(): Promise<void> {
        if (this.isScanning) return;
        this.isScanning = true;
        const startTime = Date.now();

        try {
            console.log(`🔍 AutoScanScheduler: 开始自动扫描 ${this.settings!.musicFolders.length} 个文件夹`);
            await this.scanHandler!(this.settings!.musicFolders);
            const duration = Date.now() - startTime;
            console.log(`✅ AutoScanScheduler: 自动扫描完成，耗时 ${(duration / 1000).toFixed(2)} 秒`);
            await this.updateLastScanTime(Date.now());
        } catch (error: any) {
            console.error('❌ AutoScanScheduler: 扫描失败:', error.message);
        } finally {
            this.isScanning = false;
        }
    }

    private scheduleNextScan(): void {
        const {scanFrequency} = this.settings!;
        let interval: number | null = null;

        if (scanFrequency === 'daily') interval = 24 * 60 * 60 * 1000;
        else if (scanFrequency === 'weekly') interval = 7 * 24 * 60 * 60 * 1000;

        if (interval) {
            this.timer = setTimeout(async () => {
                await this.executeScan();
                this.scheduleNextScan();
            }, interval);
        }
    }

    private async updateLastScanTime(timestamp: number): Promise<void> {
        if (this.settings) this.settings.lastScanTime = timestamp;
        if (!this.settingsFilePath) return;

        try {
            let existing: any = {};
            try {
                const data = await fs.promises.readFile(this.settingsFilePath, 'utf8');
                existing = JSON.parse(data);
            } catch {
            }
            existing.lastScanTime = timestamp;
            await fs.promises.writeFile(this.settingsFilePath, JSON.stringify(existing, null, 2), 'utf8');
        } catch (error: any) {
            console.error('❌ AutoScanScheduler: 保存上次扫描时间失败:', error.message);
        }
    }

    async triggerManualScan(): Promise<void> {
        await this.loadSettings();
        if (!this.settings!.musicFolders?.length) throw new Error('没有配置音乐文件夹');
        await this.executeScan();
    }
}
