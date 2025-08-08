// App 基础信息 IPC

const {app} = require('electron');

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
}

module.exports = {
    registerAppIpcHandlers,
};
