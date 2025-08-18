const os = require('os');
const {OS_ALLOWED, PATH_ALLOWED, FS_ALLOWED} = require('../utils/allowed_func');


/**
 * 注册操作系统相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerOsIpcHandlers({ipcMain}) {
    ipcMain.handle('os:call', (event, {prop, args}) => {
        if (OS_ALLOWED.indexOf(prop) === -1) {
            throw new Error('not allowed');
        }
        const val = os[prop];
        if (typeof val === 'function') {
            return val.apply(os, args || []);
        }
        return val;
    });
}

module.exports = {
    registerOsIpcHandlers
};
