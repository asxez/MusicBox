// 网络磁盘管理器

import {EventEmitter} from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';
import SMB2 from 'node-smb2';
import {WebDAVClient, createClient} from 'webdav';
import {getGlobalDriveRegistry} from './DriveRegistry';

export interface SMBConfig {
    id: string;
    type: 'smb';
    host: string;
    share: string;
    username: string;
    password: string;
    domain?: string;
    displayName: string;
}

export interface WebDAVConfig {
    id: string;
    type: 'webdav';
    url: string;
    username?: string;
    password?: string;
    displayName: string;

    [key: string]: any;
}

export type DriveConfig = SMBConfig | WebDAVConfig;

export interface DriveInfo {
    type: 'smb' | 'webdav';
    config: DriveConfig;
    client: SMB2 | WebDAVClient;
    mountTime: number;
}

export interface ConnectionStatus {
    connected: boolean;
    lastCheck: number;
    reconnectAttempts: number;
}

interface DriveState {
    timestamp: number;
    driveConfigs: [string, DriveConfig][];
    mountedDrives: { id: string; type: string; config: DriveConfig; mountTime: number }[];
    connectionStatus: [string, ConnectionStatus][];
}

export class NetworkDriveManager extends EventEmitter {
    private mountedDrives = new Map<string, DriveInfo>();
    private connectionStatus = new Map<string, ConnectionStatus>();
    private reconnectTimers = new Map<string, NodeJS.Timeout>();
    private readonly maxReconnectAttempts = 3;
    private readonly reconnectInterval = 5000;
    private readonly monitorInterval = 120000;
    private isInitialized = false;
    private stateFilePath: string;
    private driveConfigs = new Map<string, DriveConfig>();
    private isLoadingState = false;
    private remountingDrives = new Set<string>();
    private _initPromise: Promise<boolean> | null = null;

    constructor() {
        super();
        try {
            const userDataPath = app.getPath('userData');
            this.stateFilePath = path.join(userDataPath, 'network-drives-state.json');
        } catch {
            this.stateFilePath = path.join(process.cwd(), 'network-drives-state.json');
        }
    }

    async initialize(): Promise<boolean> {
        if (this.isInitialized) return true;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                if (!this.isLoadingState) {
                    await this.loadDriveState();
                }
                this.isInitialized = true;
                return true;
            } catch (error) {
                console.error('网络磁盘管理器初始化失败:', error);
                return false;
            } finally {
                this._initPromise = null;
            }
        })();

        return this._initPromise;
    }

    async ensureInitialized(): Promise<boolean> {
        if (!this.isInitialized) return this.initialize();
        return true;
    }

    async mountSMB(config: SMBConfig): Promise<boolean> {
        const SMB2Cls = require('node-smb2') as typeof SMB2;
        try {
            const smbConfig = {
                share: `\\\\${config.host}\\${config.share}`,
                domain: config.domain || 'WORKGROUP',
                username: config.username,
                password: config.password,
                autoCloseTimeout: 0
            };

            const smbClient = new SMB2Cls(smbConfig);
            await this.testSMBConnection(smbClient);

            this.mountedDrives.set(config.id, {
                type: 'smb',
                config,
                client: smbClient,
                mountTime: Date.now()
            });

            this.connectionStatus.set(config.id, {
                connected: true,
                lastCheck: Date.now(),
                reconnectAttempts: 0
            });

            this.emit('driveConnected', config.id, config);
            this.startConnectionMonitoring(config.id);

            return true;
        } catch (error) {
            console.error(`❌ NetworkDriveManager: SMB磁盘挂载失败 ${config.displayName}:`, error);
            this.emit('driveError', config.id, (error as Error).message);
            return false;
        }
    }

    async mountWebDAV(config: WebDAVConfig): Promise<boolean> {
        try {
            const loaded = await this.ensureInitialized();
            if (!loaded) throw new Error('WebDAV模块加载失败');
            return await this.mountWebDAVDirect(config);
        } catch (error) {
            console.error(`❌ NetworkDriveManager: WebDAV磁盘挂载失败 ${config.displayName}:`, error);
            this.emit('driveError', config.id, (error as Error).message);
            return false;
        }
    }

    private async mountWebDAVDirect(config: WebDAVConfig): Promise<boolean> {
        try {
            const clientOptions: any = {};
            if (config.username) clientOptions.username = config.username;
            if (config.password) clientOptions.password = config.password;

            const webdavClient = createClient(config.url, clientOptions);
            await this.testWebDAVConnection(webdavClient);

            this.mountedDrives.set(config.id, {
                type: 'webdav',
                config,
                client: webdavClient,
                mountTime: Date.now()
            });

            this.connectionStatus.set(config.id, {
                connected: true,
                lastCheck: Date.now(),
                reconnectAttempts: 0
            });

            this.driveConfigs.set(config.id, config);

            if (!this.isLoadingState) {
                const globalRegistry = getGlobalDriveRegistry();
                await globalRegistry.registerDrive(config.id, config as unknown as import('./DriveRegistry').DriveConfig);
                await this.saveDriveState();
            }

            this.emit('driveConnected', config.id, config);
            this.startConnectionMonitoring(config.id);

            return true;
        } catch (error) {
            console.error(`❌ NetworkDriveManager: WebDAV磁盘直接挂载失败 ${(config as any).displayName}:`, error);
            this.emit('driveError', config.id, (error as Error).message);
            return false;
        }
    }

    async unmountDrive(driveId: string): Promise<boolean> {
        const {getGlobalDriveRegistry: getRegistry} = await import('./DriveRegistry');
        try {
            const driveInfo = this.mountedDrives.get(driveId);
            if (!driveInfo) {
                console.warn(`⚠️ NetworkDriveManager: 磁盘 ${driveId} 未找到`);
                return false;
            }

            this.stopConnectionMonitoring(driveId);
            this.mountedDrives.delete(driveId);
            this.connectionStatus.delete(driveId);
            this.driveConfigs.delete(driveId);

            try {
                const globalRegistry = getRegistry();
                await globalRegistry.unregisterDrive(driveId);
            } catch (error) {
                console.warn(`⚠️ NetworkDriveManager: 从全局注册表注销驱动器失败:`, error);
            }

            await this.saveDriveState();
            this.emit('driveDisconnected', driveId, driveInfo.config);
            return true;
        } catch (error) {
            console.error(`❌ NetworkDriveManager: 卸载网络磁盘失败:`, error);
            return false;
        }
    }

    private async testSMBConnection(smbClient: SMB2): Promise<void> {
        return new Promise((resolve, reject) => {
            smbClient.readdir('', (err) => {
                if (err) reject(new Error(`SMB连接测试失败: ${err.message}`));
                else resolve();
            });
        });
    }

    private async testWebDAVConnection(webdavClient: WebDAVClient): Promise<void> {
        try {
            const response = await (webdavClient as any).customRequest('/', {method: 'OPTIONS'});
            if (response.ok) return;
        } catch {
        }

        try {
            const response = await (webdavClient as any).customRequest('/', {method: 'HEAD'});
            if (response.ok) return;
        } catch {
        }

        try {
            await webdavClient.exists('/');
            return;
        } catch {
        }

        try {
            await webdavClient.getDirectoryContents('/');
            return;
        } catch (error: any) {
            if (error.message && error.message.includes('405')) {
                throw new Error(`WebDAV连接测试失败: 服务器不支持PROPFIND方法。原始错误: ${error.message}`);
            }
        }

        throw new Error('WebDAV连接测试失败: 所有测试方法都无法连接到服务器，请检查URL、用户名、密码和网络连接');
    }

    getDriveInfo(driveId: string): DriveInfo | undefined {
        return this.mountedDrives.get(driveId);
    }

    getDriveStatus(driveId: string): ConnectionStatus | undefined {
        return this.connectionStatus.get(driveId);
    }

    getMountedDrives(): Map<string, DriveInfo> {
        return this.mountedDrives;
    }

    isDriveMounted(driveId: string): boolean {
        return this.mountedDrives.has(driveId);
    }

    private startConnectionMonitoring(driveId: string): void {
        this.stopConnectionMonitoring(driveId);
        const timer = setInterval(() => {
            this.checkConnection(driveId).catch(console.error);
        }, this.monitorInterval);
        this.reconnectTimers.set(driveId, timer);
    }

    private stopConnectionMonitoring(driveId: string): void {
        const timer = this.reconnectTimers.get(driveId);
        if (timer) {
            clearInterval(timer);
            this.reconnectTimers.delete(driveId);
        }
    }

    private async checkConnection(driveId: string): Promise<void> {
        const driveInfo = this.mountedDrives.get(driveId);
        const status = this.connectionStatus.get(driveId);
        if (!driveInfo || !status) return;

        try {
            if (driveInfo.type === 'smb') {
                await this.testSMBConnection(driveInfo.client as SMB2);
            } else if (driveInfo.type === 'webdav') {
                await this.testWebDAVConnection(driveInfo.client as WebDAVClient);
            }

            if (!status.connected) {
                status.connected = true;
                status.reconnectAttempts = 0;
                console.log(`✅ NetworkDriveManager: 磁盘重新连接成功 ${driveInfo.config.displayName}`);
                this.emit('driveReconnected', driveId, driveInfo.config);
            }
            status.lastCheck = Date.now();
        } catch (error) {
            if (status.connected) {
                status.connected = false;
                this.emit('driveDisconnected', driveId, driveInfo.config);
            }

            if (status.reconnectAttempts < this.maxReconnectAttempts) {
                status.reconnectAttempts++;
                console.log(`🔄 NetworkDriveManager: 尝试重连磁盘 ${driveInfo.config.displayName} (${status.reconnectAttempts}/${this.maxReconnectAttempts})`);
                setTimeout(() => {
                    this.attemptReconnect(driveId).catch(console.error);
                }, this.reconnectInterval);
            } else {
                this.emit('driveError', driveId, '连接失败，已达到最大重试次数');
            }
        }
    }

    private async attemptReconnect(driveId: string): Promise<void> {
        const driveInfo = this.mountedDrives.get(driveId);
        if (!driveInfo) return;

        try {
            if (driveInfo.type === 'smb') {
                const SMB2Cls = require('node-smb2') as typeof SMB2;
                const cfg = driveInfo.config as SMBConfig;
                const smbConfig = {
                    share: `\\\\${cfg.host}\\${cfg.share}`,
                    domain: cfg.domain || 'WORKGROUP',
                    username: cfg.username,
                    password: cfg.password,
                    autoCloseTimeout: 0
                };
                driveInfo.client = new SMB2Cls(smbConfig);
                await this.testSMBConnection(driveInfo.client as SMB2);
            } else if (driveInfo.type === 'webdav') {
                const cfg = driveInfo.config as WebDAVConfig;
                driveInfo.client = createClient(cfg.url, {
                    username: cfg.username,
                    password: cfg.password
                });
                await this.testWebDAVConnection(driveInfo.client as WebDAVClient);
            }

            const status = this.connectionStatus.get(driveId);
            if (status) {
                status.connected = true;
                status.reconnectAttempts = 0;
                status.lastCheck = Date.now();
            }
            this.emit('driveReconnected', driveId, driveInfo.config);
        } catch (error) {
            console.error(`❌ NetworkDriveManager: 磁盘重连失败 ${driveInfo.config.displayName}:`, error);
        }
    }

    async refreshAllConnections(): Promise<void> {
        const promises = Array.from(this.mountedDrives.keys()).map(id => this.checkConnection(id));
        await Promise.all(promises);
    }

    async refreshConnection(driveId: string): Promise<void> {
        await this.checkConnection(driveId);
    }

    private async saveDriveState(): Promise<void> {
        try {
            for (const [id, config] of this.driveConfigs.entries()) {
                console.log(`📄 配置 ${id}: ${config.displayName} (${config.type})`);
            }

            const driveState: DriveState = {
                timestamp: Date.now(),
                driveConfigs: Array.from(this.driveConfigs.entries()),
                mountedDrives: Array.from(this.mountedDrives.entries()).map(([id, info]) => ({
                    id,
                    type: info.type,
                    config: info.config,
                    mountTime: info.mountTime
                })),
                connectionStatus: Array.from(this.connectionStatus.entries())
            };
            await fs.promises.writeFile(this.stateFilePath, JSON.stringify(driveState, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ NetworkDriveManager: 保存驱动器状态失败:', error);
        }
    }

    private async loadDriveState(): Promise<void> {
        if (this.isLoadingState) return;

        try {
            this.isLoadingState = true;

            try {
                await fs.promises.access(this.stateFilePath);
            } catch {
                console.log('🔄 NetworkDriveManager: 没有找到驱动器状态文件，使用空状态');
                return;
            }

            const stateData = await fs.promises.readFile(this.stateFilePath, 'utf8');
            const driveState: DriveState = JSON.parse(stateData);

            if (driveState.driveConfigs) {
                this.driveConfigs = new Map(driveState.driveConfigs);
                console.log(`📁 恢复了 ${this.driveConfigs.size} 个驱动器配置`);

                for (const [id, config] of this.driveConfigs.entries()) {
                    console.log(`📄 恢复配置 ${id}: ${config.displayName} (${config.type})`);
                }
            }

            if (driveState.mountedDrives && driveState.mountedDrives.length > 0) {
                for (const driveInfo of driveState.mountedDrives) {
                    if (!driveInfo.id || !driveInfo.config) continue;
                    if (!this.driveConfigs.has(driveInfo.id)) continue;
                    if (!this.remountingDrives.has(driveInfo.id)) {
                        console.log(`🔄 重新挂载: ${driveInfo.config.displayName} (${driveInfo.id})`);
                        await this.remountDriveFromState(driveInfo.id, driveInfo.config as DriveConfig);
                    } else {
                        console.log(`🔧 跳过重复挂载: ${driveInfo.config.displayName} (${driveInfo.id})`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ NetworkDriveManager: 加载驱动器状态失败:', error);
        } finally {
            this.isLoadingState = false;
        }
    }

    private async remountDriveFromState(driveId: string, config: DriveConfig): Promise<boolean> {
        if (this.remountingDrives.has(driveId)) return false;
        if (this.mountedDrives.has(driveId)) return true;

        try {
            this.remountingDrives.add(driveId);
            if (config.type === 'webdav') {
                return await this.mountWebDAVDirect(config as WebDAVConfig);
            }
            return false;
        } catch (error) {
            console.error(`❌ 从状态重新挂载驱动器失败 ${driveId}:`, error);
            return false;
        } finally {
            this.remountingDrives.delete(driveId);
        }
    }

    async remountDrive(driveId: string): Promise<boolean> {
        if (this.remountingDrives.has(driveId)) return false;
        if (this.mountedDrives.has(driveId)) return true;

        while (this.remountingDrives.has(driveId)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (this.mountedDrives.has(driveId)) return true;

        try {
            this.remountingDrives.add(driveId);

            let config = this.driveConfigs.get(driveId);
            if (config) {
                if (config.type === 'webdav') return this.mountWebDAVDirect(config as WebDAVConfig);
                return false;
            }

            const globalRegistry = getGlobalDriveRegistry();
            const regConfig = globalRegistry.getDriveConfig(driveId);
            if (regConfig) {
                const typedConfig = regConfig as unknown as DriveConfig;
                this.driveConfigs.set(driveId, typedConfig);
                if (typedConfig.type === 'webdav') return this.mountWebDAVDirect(typedConfig as WebDAVConfig);
                return false;
            }

            console.error(`❌ 找不到驱动器配置: ${driveId}`);
            return false;
        } finally {
            this.remountingDrives.delete(driveId);
        }
    }

    cleanup(): void {
        for (const driveId of this.reconnectTimers.keys()) {
            this.stopConnectionMonitoring(driveId);
        }
        this.mountedDrives.clear();
        this.connectionStatus.clear();
        this.reconnectTimers.clear();
    }
}
