/**
 * 全局驱动器注册表
 * 独立于 NetworkDriveManager 实例的驱动器配置存储
 */

const fs = require('fs');
const path = require('path');

class DriveRegistry {
    constructor() {
        this.registryFilePath = null;
        this.driveConfigs = new Map();
        this.initializeRegistryFile();
        console.log('📋 DriveRegistry: 全局驱动器注册表初始化');
    }

    // 初始化注册表文件路径
    initializeRegistryFile() {
        try {
            const {app} = require('electron');
            const userDataPath = app.getPath('userData');
            this.registryFilePath = path.join(userDataPath, 'drive-registry.json');
            console.log(`📋 DriveRegistry: 注册表文件路径 - ${this.registryFilePath}`);
        } catch (error) {
            // 如果在非Electron环境中运行，使用当前目录
            this.registryFilePath = path.join(process.cwd(), 'drive-registry.json');
            console.warn('⚠️ DriveRegistry: 非Electron环境，使用当前目录作为注册表文件路径');
        }
    }

    // 注册驱动器配置
    async registerDrive(driveId, config) {
        try {
            console.log(`📋 DriveRegistry: 注册驱动器 ${driveId} - ${config.displayName}`);
            this.driveConfigs.set(driveId, {
                ...config,
                registeredAt: Date.now()
            });
            await this.saveRegistry();
            console.log(`✅ DriveRegistry: 驱动器注册成功 ${driveId}`);
        } catch (error) {
            console.error(`❌ DriveRegistry: 注册驱动器失败 ${driveId}:`, error);
        }
    }

    // 获取驱动器配置
    getDriveConfig(driveId) {
        const config = this.driveConfigs.get(driveId);
        console.log(`📋 DriveRegistry: 查找驱动器配置 ${driveId} - ${config ? '✅ 找到' : '❌ 未找到'}`);
        return config;
    }

    // 获取所有已注册的驱动器
    getAllDriveConfigs() {
        return Array.from(this.driveConfigs.entries());
    }

    // 注销驱动器
    async unregisterDrive(driveId) {
        try {
            console.log(`📋 DriveRegistry: 注销驱动器 ${driveId}`);
            const removed = this.driveConfigs.delete(driveId);
            if (removed) {
                await this.saveRegistry();
                console.log(`✅ DriveRegistry: 驱动器注销成功 ${driveId}`);
            } else {
                console.log(`⚠️ DriveRegistry: 驱动器不存在 ${driveId}`);
            }
            return removed;
        } catch (error) {
            console.error(`❌ DriveRegistry: 注销驱动器失败 ${driveId}:`, error);
            return false;
        }
    }

    // 保存注册表到文件
    async saveRegistry() {
        try {
            const registryData = {
                version: '1.0',
                timestamp: Date.now(),
                driveConfigs: Array.from(this.driveConfigs.entries())
            };

            await fs.promises.writeFile(
                this.registryFilePath,
                JSON.stringify(registryData, null, 2),
                'utf8'
            );
            console.log(`💾 DriveRegistry: 注册表已保存 (${this.driveConfigs.size} 个驱动器)`);
        } catch (error) {
            console.error('❌ DriveRegistry: 保存注册表失败:', error);
        }
    }

    // 从文件加载注册表
    async loadRegistry() {
        try {
            console.log(`📋 DriveRegistry: 开始加载注册表...`);

            if (!fs.existsSync(this.registryFilePath)) {
                console.log('📋 DriveRegistry: 注册表文件不存在，使用空注册表');
                return;
            }

            const registryData = await fs.promises.readFile(this.registryFilePath, 'utf8');
            const data = JSON.parse(registryData);

            console.log(`📋 DriveRegistry: 注册表版本 ${data.version}, 时间戳 ${new Date(data.timestamp).toLocaleString()}`);

            if (data.driveConfigs) {
                this.driveConfigs = new Map(data.driveConfigs);
                console.log(`📋 DriveRegistry: 加载了 ${this.driveConfigs.size} 个驱动器配置`);

                // 显示加载的驱动器
                for (const [id, config] of this.driveConfigs.entries()) {
                    console.log(`📄 加载驱动器: ${id} - ${config.displayName} (${config.type})`);
                }
            }

            console.log(`✅ DriveRegistry: 注册表加载完成`);
        } catch (error) {
            console.error('❌ DriveRegistry: 加载注册表失败:', error);
        }
    }

    // 清理过期的驱动器配置
    async cleanupExpiredDrives(maxAge = 30 * 24 * 60 * 60 * 1000) { // 默认30天
        try {
            const now = Date.now();
            let removedCount = 0;

            for (const [driveId, config] of this.driveConfigs.entries()) {
                const age = now - (config.registeredAt || 0);
                if (age > maxAge) {
                    this.driveConfigs.delete(driveId);
                    removedCount++;
                    console.log(`🗑️ DriveRegistry: 清理过期驱动器 ${driveId}`);
                }
            }

            if (removedCount > 0) {
                await this.saveRegistry();
                console.log(`🧹 DriveRegistry: 清理了 ${removedCount} 个过期驱动器`);
            }

            return removedCount;
        } catch (error) {
            console.error('❌ DriveRegistry: 清理过期驱动器失败:', error);
            return 0;
        }
    }

    // 检查驱动器是否已注册
    isDriveRegistered(driveId) {
        return this.driveConfigs.has(driveId);
    }

    // 获取注册表统计信息
    getStats() {
        return {
            totalDrives: this.driveConfigs.size,
            registryFilePath: this.registryFilePath,
            fileExists: fs.existsSync(this.registryFilePath)
        };
    }
}

let globalDriveRegistry = null;

function getGlobalDriveRegistry() {
    if (!globalDriveRegistry) {
        globalDriveRegistry = new DriveRegistry();
    }
    return globalDriveRegistry;
}

// 初始化全局注册表
async function initializeGlobalDriveRegistry() {
    const registry = getGlobalDriveRegistry();
    await registry.loadRegistry();
    return registry;
}

module.exports = {
    DriveRegistry,
    getGlobalDriveRegistry,
    initializeGlobalDriveRegistry
};
