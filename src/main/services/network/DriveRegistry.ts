/**
 * 全局驱动器注册表
 * 管理网络驱动器配置的持久化存储
 */

import * as path from 'path';
import * as fs from 'fs';
import {app} from 'electron';

/**
 * 驱动器配置
 */
export interface DriveConfig {
    type: 'smb' | 'webdav';
    name: string;
    host: string;
    username?: string;
    password?: string;
    share?: string;
    registeredAt?: number;

    [key: string]: any;
}

/**
 * 注册表数据结构
 */
interface RegistryData {
    version: string;
    timestamp: number;
    driveConfigs: [string, DriveConfig][];
}

/**
 * 驱动器注册表类
 */
export class DriveRegistry {
    private registryFilePath: string | null;
    private driveConfigs: Map<string, DriveConfig>;

    constructor() {
        this.registryFilePath = null;
        this.driveConfigs = new Map();
        this.initializeRegistryFile();
    }

    /**
     * 初始化注册表文件路径
     */
    private initializeRegistryFile(): void {
        try {
            const userDataPath = app.getPath('userData');
            this.registryFilePath = path.join(userDataPath, 'drive-registry.json');
        } catch (error) {
            this.registryFilePath = path.join(process.cwd(), 'drive-registry.json');
        }
    }

    /**
     * 注册驱动器
     */
    async registerDrive(driveId: string, config: DriveConfig): Promise<void> {
        try {
            this.driveConfigs.set(driveId, {
                ...config,
                registeredAt: Date.now()
            });
            await this.saveRegistry();
        } catch (error) {
            console.error(`注册驱动器失败 ${driveId}:`, error);
        }
    }

    /**
     * 获取驱动器配置
     */
    getDriveConfig(driveId: string): DriveConfig | undefined {
        return this.driveConfigs.get(driveId);
    }

    /**
     * 获取所有驱动器配置
     */
    getAllDriveConfigs(): [string, DriveConfig][] {
        return Array.from(this.driveConfigs.entries());
    }

    /**
     * 注销驱动器
     */
    async unregisterDrive(driveId: string): Promise<boolean> {
        try {
            const removed = this.driveConfigs.delete(driveId);
            if (removed) {
                await this.saveRegistry();
            }
            return removed;
        } catch (error) {
            console.error(`注销驱动器失败 ${driveId}:`, error);
            return false;
        }
    }

    /**
     * 保存注册表到文件
     */
    async saveRegistry(): Promise<void> {
        if (!this.registryFilePath) return;

        try {
            const registryData: RegistryData = {
                version: '1.0',
                timestamp: Date.now(),
                driveConfigs: Array.from(this.driveConfigs.entries())
            };

            await fs.promises.writeFile(
                this.registryFilePath,
                JSON.stringify(registryData, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('保存注册表失败:', error);
        }
    }

    /**
     * 从文件加载注册表
     */
    async loadRegistry(): Promise<void> {
        if (!this.registryFilePath) return;

        try {
            let registryData: string;
            try {
                registryData = await fs.promises.readFile(this.registryFilePath, 'utf8');
            } catch (e: any) {
                if (e.code === 'ENOENT') return;
                throw e;
            }
            const data: RegistryData = JSON.parse(registryData);

            if (data.driveConfigs) {
                this.driveConfigs = new Map(data.driveConfigs);
            }
        } catch (error) {
            console.error('加载注册表失败:', error);
        }
    }

    /**
     * 清理过期的驱动器
     */
    async cleanupExpiredDrives(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
        try {
            const now = Date.now();
            let removedCount = 0;

            for (const [driveId, config] of this.driveConfigs.entries()) {
                const age = now - (config.registeredAt || 0);
                if (age > maxAge) {
                    this.driveConfigs.delete(driveId);
                    removedCount++;
                }
            }

            if (removedCount > 0) {
                await this.saveRegistry();
            }

            return removedCount;
        } catch (error) {
            console.error('清理过期驱动器失败:', error);
            return 0;
        }
    }

    /**
     * 检查驱动器是否已注册
     */
    isDriveRegistered(driveId: string): boolean {
        return this.driveConfigs.has(driveId);
    }

    /**
     * 获取统计信息
     */
    getStats(): { totalDrives: number; registryFilePath: string | null } {
        return {
            totalDrives: this.driveConfigs.size,
            registryFilePath: this.registryFilePath,
        };
    }
}

// 全局单例
let globalDriveRegistry: DriveRegistry | null = null;

/**
 * 获取全局驱动器注册表实例
 */
export function getGlobalDriveRegistry(): DriveRegistry {
    if (!globalDriveRegistry) {
        globalDriveRegistry = new DriveRegistry();
    }
    return globalDriveRegistry;
}

/**
 * 初始化全局驱动器注册表
 */
export async function initializeGlobalDriveRegistry(): Promise<DriveRegistry> {
    const registry = getGlobalDriveRegistry();
    await registry.loadRegistry();
    return registry;
}
