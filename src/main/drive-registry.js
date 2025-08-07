// 全局驱动器注册表

const fs = require('fs');
const path = require('path');

class DriveRegistry {
    constructor() {
        this.registryFilePath = null;
        this.driveConfigs = new Map();
        this.initializeRegistryFile();
    }

    initializeRegistryFile() {
        try {
            const {app} = require('electron');
            const userDataPath = app.getPath('userData');
            this.registryFilePath = path.join(userDataPath, 'drive-registry.json');
        } catch (error) {
            this.registryFilePath = path.join(process.cwd(), 'drive-registry.json');
        }
    }

    async registerDrive(driveId, config) {
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

    getDriveConfig(driveId) {
        return this.driveConfigs.get(driveId);
    }

    getAllDriveConfigs() {
        return Array.from(this.driveConfigs.entries());
    }

    async unregisterDrive(driveId) {
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
        } catch (error) {
            console.error('保存注册表失败:', error);
        }
    }

    async loadRegistry() {
        try {
            if (!fs.existsSync(this.registryFilePath)) {
                return;
            }

            const registryData = await fs.promises.readFile(this.registryFilePath, 'utf8');
            const data = JSON.parse(registryData);

            if (data.driveConfigs) {
                this.driveConfigs = new Map(data.driveConfigs);
            }
        } catch (error) {
            console.error('加载注册表失败:', error);
        }
    }

    async cleanupExpiredDrives(maxAge = 30 * 24 * 60 * 60 * 1000) {
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

    isDriveRegistered(driveId) {
        return this.driveConfigs.has(driveId);
    }

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
