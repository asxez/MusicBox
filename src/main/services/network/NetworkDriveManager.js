// 网络磁盘管理器

const EventEmitter = require('events');

// WebDAV模块需要动态导入
let webdavModule = null;

class NetworkDriveManager extends EventEmitter {
    constructor() {
        super();
        this.mountedDrives = new Map(); // 存储已挂载的网络磁盘
        this.connectionStatus = new Map(); // 存储连接状态
        this.reconnectTimers = new Map(); // 重连定时器
        this.maxReconnectAttempts = 3;
        this.reconnectInterval = 5000; // 5秒重连间隔
        this.isInitialized = false;
        this.stateFilePath = null; // 状态文件路径
        this.driveConfigs = new Map(); // 存储驱动器配置，用于重新挂载
        this.isLoadingState = false; // 是否正在加载状态
        this.remountingDrives = new Set(); // 正在重新挂载的驱动器ID集合
        this.initializationInProgress = false; // 是否正在初始化
        this.initializeStateFile();
    }

    initializeStateFile() {
        const {app} = require('electron');
        const path = require('path');

        try {
            const userDataPath = app.getPath('userData');
            this.stateFilePath = path.join(userDataPath, 'network-drives-state.json');
        } catch (error) {
            this.stateFilePath = path.join(process.cwd(), 'network-drives-state.json');
        }
    }

    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        if (this.initializationInProgress) {
            while (this.initializationInProgress && !this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.isInitialized;
        }

        try {
            this.initializationInProgress = true;
            webdavModule = await import('webdav');

            if (!this.isLoadingState) {
                await this.loadDriveState();
            }

            this.isInitialized = true;
            this.initializationInProgress = false;
            return true;
        } catch (error) {
            console.error('WebDAV模块加载失败:', error);
            this.initializationInProgress = false;
            return false;
        }
    }

    async ensureWebDAVLoaded() {
        if (!this.isInitialized) {
            return await this.initialize();
        }
        return true;
    }

    /**
     * 挂载SMB网络磁盘
     * @param {Object} config - SMB配置
     * @param {string} config.id - 磁盘唯一标识
     * @param {string} config.host - 服务器地址
     * @param {string} config.share - 共享名称
     * @param {string} config.username - 用户名
     * @param {string} config.password - 密码
     * @param {string} config.domain - 域名（可选）
     * @param {string} config.displayName - 显示名称
     * @returns {Promise<boolean>} 挂载是否成功
     */
    async mountSMB(config) {
        const SMB2 = require('node-smb2');
        try {
            const smbConfig = {
                share: `\\\\${config.host}\\${config.share}`,
                domain: config.domain || 'WORKGROUP',
                username: config.username,
                password: config.password,
                autoCloseTimeout: 0 // 保持连接
            };

            const smbClient = new SMB2(smbConfig);

            // 测试连接
            await this.testSMBConnection(smbClient);

            // 存储挂载信息
            this.mountedDrives.set(config.id, {
                type: 'smb',
                config: config,
                client: smbClient,
                mountTime: Date.now()
            });

            this.connectionStatus.set(config.id, {
                connected: true,
                lastCheck: Date.now(),
                reconnectAttempts: 0
            });

            this.emit('driveConnected', config.id, config);

            // 启动连接监控
            this.startConnectionMonitoring(config.id);

            return true;
        } catch (error) {
            console.error(`❌ NetworkDriveManager: SMB磁盘挂载失败 ${config.displayName}:`, error);
            this.emit('driveError', config.id, error.message);
            return false;
        }
    }

    /**
     * 挂载WebDAV网络磁盘
     * @param {Object} config - WebDAV配置
     * @param {string} config.id - 磁盘唯一标识
     * @param {string} config.url - WebDAV服务器URL
     * @param {string} config.username - 用户名
     * @param {string} config.password - 密码
     * @param {string} config.displayName - 显示名称
     * @returns {Promise<boolean>} 挂载是否成功
     */
    async mountWebDAV(config) {
        try {

            // 确保WebDAV模块已加载
            const loaded = await this.ensureWebDAVLoaded();
            if (!loaded) {
                throw new Error('WebDAV模块加载失败');
            }

            return await this.mountWebDAVDirect(config);
        } catch (error) {
            console.error(`❌ NetworkDriveManager: WebDAV磁盘挂载失败 ${config.displayName}:`, error);
            this.emit('driveError', config.id, error.message);
            return false;
        }
    }

    /**
     * 直接挂载WebDAV网络磁盘（不触发初始化）
     * @param {Object} config - 配置对象
     * @returns {Promise<boolean>} 挂载是否成功
     */
    async mountWebDAVDirect(config) {
        const {getGlobalDriveRegistry} = require('./DriveRegistry');
        try {

            // 检查WebDAV模块是否已加载
            if (!webdavModule) {
                console.error('❌ WebDAV模块未加载，无法直接挂载');
                return false;
            }

            const webdavClient = webdavModule.createClient(config.url, {
                username: config.username,
                password: config.password
            });

            // 测试连接
            await this.testWebDAVConnection(webdavClient);

            // 存储挂载信息
            this.mountedDrives.set(config.id, {
                type: 'webdav',
                config: config,
                client: webdavClient,
                mountTime: Date.now()
            });

            this.connectionStatus.set(config.id, {
                connected: true,
                lastCheck: Date.now(),
                reconnectAttempts: 0
            });


            // 保存驱动器配置以便后续重新挂载
            this.driveConfigs.set(config.id, config);

            // 只在非状态加载期间注册到全局注册表和保存状态
            if (!this.isLoadingState) {
                // 注册到全局驱动器注册表
                const globalRegistry = getGlobalDriveRegistry();
                await globalRegistry.registerDrive(config.id, config);

                // 保存状态到文件
                await this.saveDriveState();
            }

            this.emit('driveConnected', config.id, config);

            // 启动连接监控
            this.startConnectionMonitoring(config.id);

            return true;
        } catch (error) {
            console.error(`❌ NetworkDriveManager: WebDAV磁盘直接挂载失败 ${config.displayName}:`, error);
            this.emit('driveError', config.id, error.message);
            return false;
        }
    }

    /**
     * 卸载网络磁盘
     * @param {string} driveId - 磁盘ID
     * @returns {boolean} 卸载是否成功
     */
    async unmountDrive(driveId) {
        const {getGlobalDriveRegistry} = require('./DriveRegistry');
        try {
            const driveInfo = this.mountedDrives.get(driveId);
            if (!driveInfo) {
                console.warn(`⚠️ NetworkDriveManager: 磁盘 ${driveId} 未找到`);
                return false;
            }

            // 停止连接监控
            this.stopConnectionMonitoring(driveId);

            // 关闭客户端连接
            if (driveInfo.type === 'smb' && driveInfo.client) {
                // SMB2客户端会自动关闭连接
            }

            // 清理内存数据
            this.mountedDrives.delete(driveId);
            this.connectionStatus.delete(driveId);

            // 清理驱动器配置
            this.driveConfigs.delete(driveId);

            // 从全局驱动器注册表中注销
            try {
                const globalRegistry = getGlobalDriveRegistry();
                await globalRegistry.unregisterDrive(driveId);
            } catch (error) {
                console.warn(`⚠️ NetworkDriveManager: 从全局注册表注销驱动器失败:`, error);
            }

            // 保存更新后的状态到文件
            await this.saveDriveState();

            this.emit('driveDisconnected', driveId, driveInfo.config);
            return true;
        } catch (error) {
            console.error(`❌ NetworkDriveManager: 卸载网络磁盘失败:`, error);
            return false;
        }
    }

    /**
     * 测试SMB连接
     * @param {SMB2} smbClient - SMB客户端
     * @returns {Promise<void>}
     */
    async testSMBConnection(smbClient) {
        return new Promise((resolve, reject) => {
            smbClient.readdir('', (err, files) => {
                if (err) {
                    reject(new Error(`SMB连接测试失败: ${err.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 测试WebDAV连接
     * @param {WebDAVClient} webdavClient - WebDAV客户端
     * @returns {Promise<void>}
     */
    async testWebDAVConnection(webdavClient) {
        try {
            const response = await webdavClient.customRequest('/', {
                method: 'OPTIONS'
            });

            if (response.ok) {
                return;
            }
        } catch (error) {
        }

        try {
            const response = await webdavClient.customRequest('/', {
                method: 'HEAD'
            });

            if (response.ok) {
                return;
            }
        } catch (error) {
        }

        try {
            const exists = await webdavClient.exists('/');
            return;
        } catch (error) {
        }

        try {
            await webdavClient.getDirectoryContents('/');
            return;
        } catch (error) {
            // 如果是405错误，提供更友好的错误信息
            if (error.message && error.message.includes('405')) {
                throw new Error(`WebDAV连接测试失败: 服务器不支持PROPFIND方法，这可能是NAS WebDAV服务器的兼容性问题。请检查服务器配置或尝试其他WebDAV客户端。原始错误: ${error.message}`);
            }
        }

        // 所有方法都失败了
        throw new Error('WebDAV连接测试失败: 所有测试方法都无法连接到服务器，请检查URL、用户名、密码和网络连接');
    }

    // 获取已挂载的磁盘列表
    getMountedDrives() {
        const drives = [];
        for (const [id, driveInfo] of this.mountedDrives) {
            const status = this.connectionStatus.get(id);
            drives.push({
                id: id,
                type: driveInfo.type,
                config: driveInfo.config,
                connected: status ? status.connected : false,
                mountTime: driveInfo.mountTime
            });
        }
        return drives;
    }

    // 检查磁盘是否已挂载
    isDriveMounted(driveId) {
        return this.mountedDrives.has(driveId);
    }

    // 获取磁盘连接状态
    getDriveStatus(driveId) {
        return this.connectionStatus.get(driveId) || null;
    }

    // 获取网络磁盘客户端
    getDriveClient(driveId) {
        const driveInfo = this.mountedDrives.get(driveId);
        return driveInfo ? driveInfo.client : null;
    }

    // 获取网络磁盘信息
    getDriveInfo(driveId) {
        const driveInfo = this.mountedDrives.get(driveId);

        if (!driveInfo) {
            console.error(`❌ NetworkDriveManager: 网络磁盘 ${driveId} 未找到`);
            console.error(`❌ 可能的原因:`);
            console.error(`   1. 驱动器未挂载`);
            console.error(`   2. 驱动器ID不匹配`);
            console.error(`   3. 驱动器已被卸载`);
            console.error(`   4. NetworkDriveManager实例被重新创建`);
        }
        return driveInfo;
    }

    // 启动连接监控
    startConnectionMonitoring(driveId) {
        // 清除现有定时器
        this.stopConnectionMonitoring(driveId);
        const timer = setInterval(async () => {
            await this.checkConnection(driveId);
        }, 120000);
        this.reconnectTimers.set(driveId, timer);
    }

    // 停止连接监控
    stopConnectionMonitoring(driveId) {
        const timer = this.reconnectTimers.get(driveId);
        if (timer) {
            clearInterval(timer);
            this.reconnectTimers.delete(driveId);
        }
    }

    // 检查连接状态
    async checkConnection(driveId) {
        const driveInfo = this.mountedDrives.get(driveId);
        const status = this.connectionStatus.get(driveId);

        if (!driveInfo || !status) {
            return;
        }

        try {
            if (driveInfo.type === 'smb') {
                await this.testSMBConnection(driveInfo.client);
            } else if (driveInfo.type === 'webdav') {
                await this.testWebDAVConnection(driveInfo.client);
            }

            // 连接正常
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

            // 尝试重连
            if (status.reconnectAttempts < this.maxReconnectAttempts) {
                status.reconnectAttempts++;
                console.log(`🔄 NetworkDriveManager: 尝试重连磁盘 ${driveInfo.config.displayName} (${status.reconnectAttempts}/${this.maxReconnectAttempts})`);
                setTimeout(async () => {
                    await this.attemptReconnect(driveId);
                }, this.reconnectInterval);
            } else {
                this.emit('driveError', driveId, '连接失败，已达到最大重试次数');
            }
        }
    }

    // 尝试重新连接
    async attemptReconnect(driveId) {
        const SMB2 = require('node-smb2');

        const driveInfo = this.mountedDrives.get(driveId);
        if (!driveInfo) {
            return;
        }

        try {
            if (driveInfo.type === 'smb') {
                const smbConfig = {
                    share: `\\\\${driveInfo.config.host}\\${driveInfo.config.share}`,
                    domain: driveInfo.config.domain || 'WORKGROUP',
                    username: driveInfo.config.username,
                    password: driveInfo.config.password,
                    autoCloseTimeout: 0
                };
                driveInfo.client = new SMB2(smbConfig);
                await this.testSMBConnection(driveInfo.client);

            } else if (driveInfo.type === 'webdav') {
                const loaded = await this.ensureWebDAVLoaded();
                if (!loaded) {
                    throw new Error('WebDAV模块加载失败');
                }

                driveInfo.client = webdavModule.createClient(driveInfo.config.url, {
                    username: driveInfo.config.username,
                    password: driveInfo.config.password
                });
                await this.testWebDAVConnection(driveInfo.client);
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

    // 刷新所有磁盘的连接状态
    async refreshAllConnections() {
        const promises = [];

        for (const driveId of this.mountedDrives.keys()) {
            promises.push(this.checkConnection(driveId));
        }
        await Promise.all(promises);
    }

    // 刷新指定磁盘的连接状态
    async refreshConnection(driveId) {
        await this.checkConnection(driveId);
    }

    // 保存驱动器状态到文件
    async saveDriveState() {
        const fs = require('fs');

        try {
            // 详细显示要保存的配置
            for (const [id, config] of this.driveConfigs.entries()) {
                console.log(`📄 配置 ${id}: ${config.displayName} (${config.type})`);
            }

            const driveState = {
                timestamp: Date.now(),
                driveConfigs: Array.from(this.driveConfigs.entries()),
                mountedDrives: Array.from(this.mountedDrives.entries()).map(([id, info]) => ({
                    id: id,
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

    // 从文件加载驱动器状态
    async loadDriveState() {
        const fs = require('fs');

        if (this.isLoadingState) {
            return;
        }

        try {
            this.isLoadingState = true;

            try {
                await fs.promises.access(this.stateFilePath);
            } catch {
                console.log('🔄 NetworkDriveManager: 没有找到驱动器状态文件，使用空状态');
                return;
            }

            const stateData = await fs.promises.readFile(this.stateFilePath, 'utf8');
            const driveState = JSON.parse(stateData);

            // 恢复驱动器配置
            if (driveState.driveConfigs) {
                this.driveConfigs = new Map(driveState.driveConfigs);
                console.log(`📁 恢复了 ${this.driveConfigs.size} 个驱动器配置`);

                // 详细显示恢复的配置
                for (const [id, config] of this.driveConfigs.entries()) {
                    console.log(`📄 恢复配置 ${id}: ${config.displayName} (${config.type})`);
                }
            }

            // 尝试重新挂载之前的驱动器
            if (driveState.mountedDrives && driveState.mountedDrives.length > 0) {
                for (const driveInfo of driveState.mountedDrives) {
                    // 验证驱动器信息的完整性
                    if (!driveInfo.id || !driveInfo.config) {
                        continue;
                    }

                    // 检查驱动器配置是否仍然存在（如果不存在说明已被卸载）
                    if (!this.driveConfigs.has(driveInfo.id)) {
                        continue;
                    }

                    // 检查是否已经在重新挂载中
                    if (!this.remountingDrives.has(driveInfo.id)) {
                        console.log(`🔄 重新挂载: ${driveInfo.config.displayName} (${driveInfo.id})`);
                        await this.remountDriveFromState(driveInfo.id, driveInfo.config);
                    } else {
                        console.log(`🔧 跳过重复挂载: ${driveInfo.config.displayName} (${driveInfo.id})`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ NetworkDriveManager: 加载驱动器状态失败:', error);
            console.error('❌ 错误详情:', error.stack);
        } finally {
            this.isLoadingState = false;
        }
    }

    // 重新挂载驱动器
    async remountDrive(driveId, config) {
        try {
            if (config.type === 'webdav' || !config.type) {
                return await this.mountWebDAV(config);
            }
            return false;
        } catch (error) {
            console.error(`❌ 重新挂载驱动器失败 ${driveId}:`, error);
            return false;
        }
    }

    // 从状态文件重新挂载驱动器
    async remountDriveFromState(driveId, config) {
        if (this.remountingDrives.has(driveId)) {
            return false;
        }

        // 检查是否已经挂载
        if (this.mountedDrives.has(driveId)) {
            return true;
        }

        try {
            this.remountingDrives.add(driveId);
            if (config.type === 'webdav' || !config.type) {
                // 直接挂载，不触发初始化
                return await this.mountWebDAVDirect(config);
            }
            return false;
        } catch (error) {
            console.error(`❌ 从状态重新挂载驱动器失败 ${driveId}:`, error);
            return false;
        } finally {
            this.remountingDrives.delete(driveId);
        }
    }

    // 按需挂载驱动器（如果不存在则尝试从配置重新挂载）
    async ensureDriveMounted(driveId) {
        const {getGlobalDriveRegistry} = require('./DriveRegistry');
        // 检查驱动器是否已挂载
        if (this.mountedDrives.has(driveId)) {
            return true;
        }

        // 防止重复挂载
        if (this.remountingDrives.has(driveId)) {
            // 等待挂载完成
            while (this.remountingDrives.has(driveId)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.mountedDrives.has(driveId);
        }

        try {
            this.remountingDrives.add(driveId);

            // 首先尝试从本地配置重新挂载
            let config = this.driveConfigs.get(driveId);
            if (config) {
                return await this.mountWebDAVDirect(config);
            }

            // 若本地配置不存在，尝试从全局注册表获取
            const globalRegistry = getGlobalDriveRegistry();
            config = globalRegistry.getDriveConfig(driveId);
            if (config) {
                // 同时更新本地配置
                this.driveConfigs.set(driveId, config);
                return await this.mountWebDAVDirect(config);
            }
            console.error(`❌ 找不到驱动器配置: ${driveId}`);
            return false;
        } finally {
            this.remountingDrives.delete(driveId);
        }
    }

    // 清理所有连接
    cleanup() {
        // 停止所有监控定时器
        for (const driveId of this.reconnectTimers.keys()) {
            this.stopConnectionMonitoring(driveId);
        }

        // 清理所有挂载的磁盘
        this.mountedDrives.clear();
        this.connectionStatus.clear();
        this.reconnectTimers.clear();
    }
}

module.exports = NetworkDriveManager;
