/**
 * 网络磁盘管理器
 * SMB、WebDAV等网络磁盘的挂载、卸载和连接
 */

const SMB2 = require('node-smb2');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const {getGlobalDriveRegistry} = require('./drive-registry');

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
        console.log('🌐 NetworkDriveManager: 网络磁盘管理器初始化完成');
    }

    // 初始化状态文件路径
    initializeStateFile() {
        try {
            const {app} = require('electron');
            const userDataPath = app.getPath('userData');
            this.stateFilePath = path.join(userDataPath, 'network-drives-state.json');
            console.log(`🗄️ NetworkDriveManager: 状态文件路径 - ${this.stateFilePath}`);
        } catch (error) {
            // 如果在非Electron环境中运行，使用当前目录
            this.stateFilePath = path.join(process.cwd(), 'network-drives-state.json');
            console.warn('⚠️ NetworkDriveManager: 非Electron环境，使用当前目录作为状态文件路径');
        }
    }

    /**
     * 初始化WebDAV模块
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('🔧 NetworkDriveManager: 已初始化，跳过重复初始化');
            return true;
        }

        if (this.initializationInProgress) {
            console.log('🔧 NetworkDriveManager: 初始化正在进行中，等待完成...');
            // 等待初始化完成
            while (this.initializationInProgress && !this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.isInitialized;
        }

        try {
            this.initializationInProgress = true;
            console.log('🔄 NetworkDriveManager: 正在加载WebDAV模块...');
            webdavModule = await import('webdav');
            console.log('✅ NetworkDriveManager: WebDAV模块加载成功');

            // 只在首次初始化时加载保存的驱动器状态
            if (!this.isLoadingState) {
                console.log('🔄 NetworkDriveManager: 首次初始化，加载驱动器状态...');
                await this.loadDriveState();
            } else {
                console.log('🔧 NetworkDriveManager: 跳过状态加载（正在进行中）');
            }

            this.isInitialized = true;
            this.initializationInProgress = false;
            console.log('✅ NetworkDriveManager: 初始化完成');
            return true;
        } catch (error) {
            console.error('❌ NetworkDriveManager: WebDAV模块加载失败:', error);
            this.initializationInProgress = false;
            return false;
        }
    }

    /**
     * 确保WebDAV模块已加载
     * @returns {Promise<boolean>}
     */
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
        try {
            console.log(`🔗 NetworkDriveManager: 尝试挂载SMB磁盘 ${config.displayName}`);

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

            console.log(`✅ NetworkDriveManager: SMB磁盘挂载成功 ${config.displayName}`);
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
            console.log(`🔗 NetworkDriveManager: 尝试挂载WebDAV磁盘 ${config.displayName}`);

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
        try {
            console.log(`🔗 NetworkDriveManager: 直接挂载WebDAV磁盘 ${config.displayName}`);

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

            console.log(`✅ NetworkDriveManager: WebDAV磁盘直接挂载成功 ${config.displayName}`);
            console.log(`🔍 驱动器ID: "${config.id}"`);
            console.log(`🔍 当前已挂载的驱动器: [${Array.from(this.mountedDrives.keys()).join(', ')}]`);

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
        try {
            const driveInfo = this.mountedDrives.get(driveId);
            if (!driveInfo) {
                console.warn(`⚠️ NetworkDriveManager: 磁盘 ${driveId} 未找到`);
                return false;
            }

            console.log(`🔌 NetworkDriveManager: 卸载网络磁盘 ${driveInfo.config.displayName}`);

            // 停止连接监控
            this.stopConnectionMonitoring(driveId);

            // 关闭客户端连接
            if (driveInfo.type === 'smb' && driveInfo.client) {
                // SMB2客户端会自动关闭连接
            }

            // 清理数据
            this.mountedDrives.delete(driveId);
            this.connectionStatus.delete(driveId);
            console.log(`✅ NetworkDriveManager: 网络磁盘卸载成功 ${driveInfo.config.displayName}`);
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
            await webdavClient.getDirectoryContents('/');
        } catch (error) {
            throw new Error(`WebDAV连接测试失败: ${error.message}`);
        }
    }

    /**
     * 获取已挂载的磁盘列表
     * @returns {Array} 磁盘列表
     */
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

    /**
     * 检查磁盘是否已挂载
     * @param {string} driveId - 磁盘ID
     * @returns {boolean} 是否已挂载
     */
    isDriveMounted(driveId) {
        return this.mountedDrives.has(driveId);
    }

    /**
     * 获取磁盘连接状态
     * @param {string} driveId - 磁盘ID
     * @returns {Object|null} 连接状态
     */
    getDriveStatus(driveId) {
        return this.connectionStatus.get(driveId) || null;
    }

    /**
     * 获取网络磁盘客户端
     * @param {string} driveId - 磁盘ID
     * @returns {Object|null} 客户端对象
     */
    getDriveClient(driveId) {
        const driveInfo = this.mountedDrives.get(driveId);
        return driveInfo ? driveInfo.client : null;
    }

    /**
     * 获取网络磁盘信息
     * @param {string} driveId - 磁盘ID
     * @returns {Object|null} 磁盘信息
     */
    getDriveInfo(driveId) {
        const driveInfo = this.mountedDrives.get(driveId);

        // 调试
        console.log(`🔍 NetworkDriveManager: 查找驱动器 "${driveId}"`);
        console.log(`🔍 当前已挂载的驱动器: [${Array.from(this.mountedDrives.keys()).join(', ')}]`);
        console.log(`🔍 查找结果: ${driveInfo ? '✅ 找到' : '❌ 未找到'}`);

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

    /**
     * 启动连接监控
     * @param {string} driveId - 磁盘ID
     */
    startConnectionMonitoring(driveId) {
        // 清除现有定时器
        this.stopConnectionMonitoring(driveId);

        const timer = setInterval(async () => {
            await this.checkConnection(driveId);
        }, 30000); // 30秒检查一次连接

        this.reconnectTimers.set(driveId, timer);
        console.log(`🔍 NetworkDriveManager: 开始监控磁盘连接 ${driveId}`);
    }

    /**
     * 停止连接监控
     * @param {string} driveId - 磁盘ID
     */
    stopConnectionMonitoring(driveId) {
        const timer = this.reconnectTimers.get(driveId);
        if (timer) {
            clearInterval(timer);
            this.reconnectTimers.delete(driveId);
            console.log(`⏹️ NetworkDriveManager: 停止监控磁盘连接 ${driveId}`);
        }
    }

    /**
     * 检查连接状态
     * @param {string} driveId - 磁盘ID
     */
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
            console.warn(`⚠️ NetworkDriveManager: 磁盘连接检查失败 ${driveInfo.config.displayName}:`, error.message);

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
                console.error(`❌ NetworkDriveManager: 磁盘重连失败，已达到最大重试次数 ${driveInfo.config.displayName}`);
                this.emit('driveError', driveId, '连接失败，已达到最大重试次数');
            }
        }
    }

    /**
     * 尝试重新连接
     * @param {string} driveId - 磁盘ID
     */
    async attemptReconnect(driveId) {
        const driveInfo = this.mountedDrives.get(driveId);
        if (!driveInfo) {
            return;
        }

        try {
            if (driveInfo.type === 'smb') {
                // 重新创建SMB客户端
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
                // 确保WebDAV模块已加载
                const loaded = await this.ensureWebDAVLoaded();
                if (!loaded) {
                    throw new Error('WebDAV模块加载失败');
                }

                // 重新创建WebDAV客户端
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

            console.log(`✅ NetworkDriveManager: 磁盘重连成功 ${driveInfo.config.displayName}`);
            this.emit('driveReconnected', driveId, driveInfo.config);

        } catch (error) {
            console.error(`❌ NetworkDriveManager: 磁盘重连失败 ${driveInfo.config.displayName}:`, error);
        }
    }

    /**
     * 手动刷新所有磁盘的连接状态
     */
    async refreshAllConnections() {
        console.log('🔄 NetworkDriveManager: 手动刷新所有磁盘连接状态');
        const promises = [];

        for (const driveId of this.mountedDrives.keys()) {
            promises.push(this.checkConnection(driveId));
        }

        await Promise.all(promises);
        console.log('✅ NetworkDriveManager: 所有磁盘连接状态刷新完成');
    }

    /**
     * 手动刷新指定磁盘的连接状态
     * @param {string} driveId - 磁盘ID
     */
    async refreshConnection(driveId) {
        console.log(`🔄 NetworkDriveManager: 手动刷新磁盘连接状态 ${driveId}`);
        await this.checkConnection(driveId);
    }

    /**
     * 保存驱动器状态到文件
     */
    async saveDriveState() {
        try {
            console.log(`💾 NetworkDriveManager: 开始保存驱动器状态...`);
            console.log(`📁 状态文件路径: ${this.stateFilePath}`);
            console.log(`🔍 当前driveConfigs数量: ${this.driveConfigs.size}`);
            console.log(`🔍 当前mountedDrives数量: ${this.mountedDrives.size}`);

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
            console.log(`✅ NetworkDriveManager: 驱动器状态已保存到 ${this.stateFilePath}`);
            console.log(`📊 保存的数据: ${driveState.driveConfigs.length} 个配置, ${driveState.mountedDrives.length} 个挂载`);
        } catch (error) {
            console.error('❌ NetworkDriveManager: 保存驱动器状态失败:', error);
        }
    }

    /**
     * 从文件加载驱动器状态
     */
    async loadDriveState() {
        // 防止递归调用
        if (this.isLoadingState) {
            console.log('🔧 NetworkDriveManager: 状态加载正在进行中，跳过重复调用');
            return;
        }

        try {
            this.isLoadingState = true;
            console.log(`🔄 NetworkDriveManager: 开始加载驱动器状态...`);
            console.log(`📁 状态文件路径: ${this.stateFilePath}`);

            if (!fs.existsSync(this.stateFilePath)) {
                console.log('🔄 NetworkDriveManager: 没有找到驱动器状态文件，使用空状态');
                return;
            }

            const stateData = await fs.promises.readFile(this.stateFilePath, 'utf8');
            console.log(`📄 状态文件大小: ${stateData.length} 字符`);

            const driveState = JSON.parse(stateData);
            console.log(`📊 状态文件内容: 时间戳=${new Date(driveState.timestamp).toLocaleString()}`);
            console.log(`🔍 从状态文件加载驱动器配置 (${driveState.driveConfigs?.length || 0} 个)`);

            // 恢复驱动器配置
            if (driveState.driveConfigs) {
                this.driveConfigs = new Map(driveState.driveConfigs);
                console.log(`📁 恢复了 ${this.driveConfigs.size} 个驱动器配置`);

                // 详细显示恢复的配置
                for (const [id, config] of this.driveConfigs.entries()) {
                    console.log(`📄 恢复配置 ${id}: ${config.displayName} (${config.type})`);
                }
            }

            // 尝试重新挂载之前的驱动器（使用特殊的重新挂载方法）
            if (driveState.mountedDrives && driveState.mountedDrives.length > 0) {
                console.log(`🔄 尝试重新挂载 ${driveState.mountedDrives.length} 个驱动器...`);
                for (const driveInfo of driveState.mountedDrives) {
                    // 检查是否已经在重新挂载中
                    if (!this.remountingDrives.has(driveInfo.id)) {
                        console.log(`🔄 重新挂载: ${driveInfo.config.displayName} (${driveInfo.id})`);
                        await this.remountDriveFromState(driveInfo.id, driveInfo.config);
                    } else {
                        console.log(`🔧 跳过重复挂载: ${driveInfo.config.displayName} (${driveInfo.id})`);
                    }
                }
            }

            console.log(`✅ NetworkDriveManager: 驱动器状态加载完成`);
            console.log(`🔍 最终状态: ${this.driveConfigs.size} 个配置, ${this.mountedDrives.size} 个已挂载`);

        } catch (error) {
            console.error('❌ NetworkDriveManager: 加载驱动器状态失败:', error);
            console.error('❌ 错误详情:', error.stack);
        } finally {
            this.isLoadingState = false;
        }
    }

    /**
     * 重新挂载驱动器
     * @param {string} driveId - 驱动器ID
     * @param {Object} config - 驱动器配置
     */
    async remountDrive(driveId, config) {
        try {
            console.log(`🔄 尝试重新挂载驱动器: ${config.displayName} (${driveId})`);

            if (config.type === 'webdav' || !config.type) {
                const success = await this.mountWebDAV(config);
                if (success) {
                    console.log(`✅ 驱动器重新挂载成功: ${config.displayName}`);
                } else {
                    console.log(`❌ 驱动器重新挂载失败: ${config.displayName}`);
                }
                return success;
            }

            return false;
        } catch (error) {
            console.error(`❌ 重新挂载驱动器失败 ${driveId}:`, error);
            return false;
        }
    }

    /**
     * 从状态文件重新挂载驱动器（避免递归）
     * @param {string} driveId - 驱动器ID
     * @param {Object} config - 驱动器配置
     */
    async remountDriveFromState(driveId, config) {
        // 防止重复挂载
        if (this.remountingDrives.has(driveId)) {
            console.log(`🔧 驱动器正在挂载中，跳过: ${driveId}`);
            return false;
        }

        // 检查是否已经挂载
        if (this.mountedDrives.has(driveId)) {
            console.log(`✅ 驱动器已挂载，跳过: ${driveId}`);
            return true;
        }

        try {
            this.remountingDrives.add(driveId);
            console.log(`🔄 从状态文件重新挂载驱动器: ${config.displayName} (${driveId})`);

            if (config.type === 'webdav' || !config.type) {
                // 直接挂载，不触发初始化
                const success = await this.mountWebDAVDirect(config);
                if (success) {
                    console.log(`✅ 驱动器从状态重新挂载成功: ${config.displayName}`);
                } else {
                    console.log(`❌ 驱动器从状态重新挂载失败: ${config.displayName}`);
                }
                return success;
            }

            return false;
        } catch (error) {
            console.error(`❌ 从状态重新挂载驱动器失败 ${driveId}:`, error);
            return false;
        } finally {
            this.remountingDrives.delete(driveId);
        }
    }

    /**
     * 按需挂载驱动器（如果不存在则尝试从配置重新挂载）
     * @param {string} driveId - 驱动器ID
     * @returns {Promise<boolean>} 是否成功挂载或已存在
     */
    async ensureDriveMounted(driveId) {
        // 检查驱动器是否已挂载
        if (this.mountedDrives.has(driveId)) {
            console.log(`✅ 驱动器已挂载: ${driveId}`);
            return true;
        }

        // 防止重复挂载
        if (this.remountingDrives.has(driveId)) {
            console.log(`🔧 驱动器正在挂载中，等待完成: ${driveId}`);
            // 等待挂载完成
            while (this.remountingDrives.has(driveId)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.mountedDrives.has(driveId);
        }

        console.log(`🔄 驱动器未挂载，尝试重新挂载: ${driveId}`);

        try {
            this.remountingDrives.add(driveId);

            // 首先尝试从本地配置重新挂载
            let config = this.driveConfigs.get(driveId);
            if (config) {
                console.log(`🔄 从本地配置重新挂载驱动器: ${driveId}`);
                const success = await this.mountWebDAVDirect(config);
                return success;
            }

            // 若本地配置不存在，尝试从全局注册表获取
            console.log(`🔄 从全局注册表查找驱动器配置: ${driveId}`);
            const globalRegistry = getGlobalDriveRegistry();
            config = globalRegistry.getDriveConfig(driveId);

            if (config) {
                console.log(`🔄 从全局注册表重新挂载驱动器: ${driveId}`);
                // 同时更新本地配置
                this.driveConfigs.set(driveId, config);
                const success = await this.mountWebDAVDirect(config);
                return success;
            }

            console.error(`❌ 找不到驱动器配置: ${driveId}`);
            return false;
        } finally {
            this.remountingDrives.delete(driveId);
        }
    }

    /**
     * 清理所有连接
     */
    cleanup() {
        console.log('🧹 NetworkDriveManager: 清理所有网络磁盘连接');

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
