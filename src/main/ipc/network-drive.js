// 网络磁盘相关 IPC

/**
 * 注册网络磁盘相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 * @param {function} deps.getNetworkDriveManager - 返回当前 NetworkDriveManager 实例的函数
 * @param {function} deps.initializeNetworkDriveManager - 初始化 NetworkDriveManager 的函数
 */
function registerNetworkDriveIpcHandlers({ipcMain, getNetworkDriveManager, initializeNetworkDriveManager}) {
    if (!ipcMain) throw new Error('registerNetworkDriveIpcHandlers: 缺少 ipcMain');

    // 挂载SMB网络磁盘
    ipcMain.handle('network-drive:mountSMB', async (event, config) => {
        try {
            let mgr = getNetworkDriveManager();
            if (!mgr) {
                await initializeNetworkDriveManager();
                mgr = getNetworkDriveManager();
            }
            return await mgr.mountSMB(config);
        } catch (error) {
            console.error('❌ 挂载SMB磁盘失败:', error);
            return false;
        }
    });

    // 挂载WebDAV网络磁盘
    ipcMain.handle('network-drive:mountWebDAV', async (event, config) => {
        try {
            let mgr = getNetworkDriveManager();
            if (!mgr) {
                await initializeNetworkDriveManager();
                mgr = getNetworkDriveManager();
            }
            return await mgr.mountWebDAV(config);
        } catch (error) {
            console.error('❌ 挂载WebDAV磁盘失败:', error);
            return false;
        }
    });

    // 卸载网络磁盘
    ipcMain.handle('network-drive:unmount', async (event, driveId) => {
        try {
            const mgr = getNetworkDriveManager();
            if (!mgr) {
                return false;
            }
            return await mgr.unmountDrive(driveId);
        } catch (error) {
            console.error('❌ 卸载网络磁盘失败:', error);
            return false;
        }
    });

    // 获取已挂载的磁盘列表
    ipcMain.handle('network-drive:getMountedDrives', async () => {
        try {
            const mgr = getNetworkDriveManager();
            if (!mgr) {
                return [];
            }
            return mgr.getMountedDrives();
        } catch (error) {
            console.error('❌ 获取挂载磁盘列表失败:', error);
            return [];
        }
    });

    // 检查磁盘连接状态
    ipcMain.handle('network-drive:getStatus', async (event, driveId) => {
        try {
            const mgr = getNetworkDriveManager();
            if (!mgr) {
                return null;
            }
            return mgr.getDriveStatus(driveId);
        } catch (error) {
            console.error('❌ 获取磁盘状态失败:', error);
            return null;
        }
    });

    // 测试网络连接
    ipcMain.handle('network-drive:testConnection', async (event, config) => {
        try {
            let mgr = getNetworkDriveManager();
            if (!mgr) {
                await initializeNetworkDriveManager();
                mgr = getNetworkDriveManager();
            }

            if (config.type === 'smb') {
                const SMB2 = require('node-smb2');
                const smbConfig = {
                    share: `\\\\${config.host}\\${config.share}`,
                    domain: config.domain || 'WORKGROUP',
                    username: config.username,
                    password: config.password,
                    autoCloseTimeout: 0,
                };
                const smbClient = new SMB2(smbConfig);
                await mgr.testSMBConnection(smbClient);
                return true;
            } else if (config.type === 'webdav') {
                const loaded = await mgr.ensureWebDAVLoaded();
                if (!loaded) throw new Error('WebDAV模块加载失败');

                const webdavModule = await import('webdav');
                const webdavClient = webdavModule.createClient(config.url, {
                    username: config.username,
                    password: config.password,
                });
                await mgr.testWebDAVConnection(webdavClient);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ 测试网络连接失败:', error);
            throw error;
        }
    });

    // 刷新网络磁盘连接状态
    ipcMain.handle('network-drive:refreshConnections', async () => {
        try {
            const mgr = getNetworkDriveManager();
            if (!mgr) {
                return false;
            }
            await mgr.refreshAllConnections();
            return true;
        } catch (error) {
            console.error('❌ 刷新网络磁盘连接状态失败:', error);
            return false;
        }
    });

    // 刷新指定网络磁盘连接状态
    ipcMain.handle('network-drive:refreshConnection', async (event, driveId) => {
        try {
            const mgr = getNetworkDriveManager();
            if (!mgr) {
                return false;
            }
            await mgr.refreshConnection(driveId);
            return true;
        } catch (error) {
            console.error('❌ 刷新网络磁盘连接状态失败:', error);
            return false;
        }
    });
}

module.exports = {
    registerNetworkDriveIpcHandlers
};
