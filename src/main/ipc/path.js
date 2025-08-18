const path = require('path');
const {OS_ALLOWED, PATH_ALLOWED, FS_ALLOWED} = require('../utils/allowed_func');

/**
 * 注册文件系统相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerPathIpcHandlers({ipcMain}) {
    ipcMain.handle('path:call', (event, {prop, args}) => {
        if (PATH_ALLOWED.indexOf(prop) === -1) {
            throw new Error('not allowed');
        }
        const val = path[prop];
        if (typeof val === 'function') {
            return val.apply(path, args || []);
        }
        return val;
    });
}

module.exports = {
    registerPathIpcHandlers
};
