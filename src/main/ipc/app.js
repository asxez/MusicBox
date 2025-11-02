// App 基础信息 IPC

const {app, shell} = require('electron');

/**
 * 注册 App 相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 */
function registerAppIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerAppIpcHandlers: 缺少 ipcMain');

    ipcMain.handle('app:getVersion', () => {
        return app.getVersion();
    });

    ipcMain.handle('app:getPlatform', () => {
        return process.platform;
    });

    ipcMain.handle('app:restart', async () => {
        app.relaunch();
        app.exit(0);
        return {success: true};
    });

    ipcMain.handle('app:getUserDataPath', () => {
        return app.getPath('userData');
    });

    ipcMain.handle('app:openUserDataFolder', async () => {
        try {
            const userDataPath = app.getPath('userData');
            await shell.openPath(userDataPath);
            return {success: true};
        } catch (error) {
            console.error('❌ 打开应用数据文件夹失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerAppIpcHandlers,
};
