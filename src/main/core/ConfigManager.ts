/**
 * 配置管理器
 * 负责加载和保存应用配置
 */

import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';

/**
 * 配置管理器类
 */
export class ConfigManager {
    private configDir: string;
    private configs = new Map<string, any>();

    constructor() {
        this.configDir = app.getPath('userData');
    }

    /**
     * 加载硬件加速设置
     */
    loadHardwareAccelerationSettings(): boolean {
        const settingsPath = path.join(this.configDir, 'hardware-acceleration-settings.json');

        if (fs.existsSync(settingsPath)) {
            try {
                const settingsData = fs.readFileSync(settingsPath, 'utf8');
                const settings = JSON.parse(settingsData);
                return settings.enabled !== false;
            } catch (error) {
                console.error('❌ 加载硬件加速设置失败:', error);
            }
        }

        return true; // 默认启用
    }

    /**
     * 保存硬件加速设置
     */
    async saveHardwareAccelerationSettings(enabled: boolean): Promise<void> {
        const settingsPath = path.join(this.configDir, 'hardware-acceleration-settings.json');

        try {
            await fs.promises.writeFile(
                settingsPath,
                JSON.stringify({enabled}, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('❌ 保存硬件加速设置失败:', error);
            throw error;
        }
    }

    /**
     * 加载配置文件
     */
    async loadConfig<T = any>(name: string): Promise<T | null> {
        if (this.configs.has(name)) {
            return this.configs.get(name);
        }

        const configPath = path.join(this.configDir, `${name}.json`);

        try {
            if (!fs.existsSync(configPath)) {
                return null;
            }

            const data = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            this.configs.set(name, config);
            return config;
        } catch (error) {
            console.error(`❌ 加载配置失败 ${name}:`, error);
            return null;
        }
    }

    /**
     * 保存配置文件
     */
    async saveConfig(name: string, data: any): Promise<void> {
        const configPath = path.join(this.configDir, `${name}.json`);

        try {
            await fs.promises.writeFile(
                configPath,
                JSON.stringify(data, null, 2),
                'utf8'
            );
            this.configs.set(name, data);
        } catch (error) {
            console.error(`❌ 保存配置失败 ${name}:`, error);
            throw error;
        }
    }

    /**
     * 获取配置值
     */
    get<T = any>(name: string, key: string, defaultValue?: T): T | undefined {
        const config = this.configs.get(name);
        if (!config) return defaultValue;
        return config[key] ?? defaultValue;
    }

    /**
     * 设置配置值
     */
    async set(name: string, key: string, value: any): Promise<void> {
        let config = this.configs.get(name) || {};
        config[key] = value;
        await this.saveConfig(name, config);
    }

    /**
     * 删除配置文件
     */
    async deleteConfig(name: string): Promise<void> {
        const configPath = path.join(this.configDir, `${name}.json`);

        try {
            if (fs.existsSync(configPath)) {
                await fs.promises.unlink(configPath);
            }
            this.configs.delete(name);
        } catch (error) {
            console.error(`❌ 删除配置失败 ${name}:`, error);
            throw error;
        }
    }

    /**
     * 获取配置目录路径
     */
    getConfigDir(): string {
        return this.configDir;
    }
}
