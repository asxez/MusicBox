// 文件系统相关 IPC

const fs = require('fs');

/**
 * 注册文件系统相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerFsIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerFsIpcHandlers: 缺少 ipcMain');

    // 获取文件信息
    ipcMain.handle('fs:stat', async (event, filePath) => {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                mtime: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
            };
        } catch (error) {
            throw new Error(`获取文件信息失败: ${error.message}`);
        }
    });

    // 读取文件内容
    ipcMain.handle('fs:readFile', async (event, filePath) => {
        try {
            const buffer = fs.readFileSync(filePath);
            return Array.from(buffer);
        } catch (error) {
            throw new Error(`读取文件失败: ${error.message}`);
        }
    });
}

module.exports = {
    registerFsIpcHandlers
};
