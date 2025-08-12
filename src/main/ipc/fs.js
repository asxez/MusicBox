// 文件系统相关 IPC

const fs = require('fs');
const {OS_ALLOWED, PATH_ALLOWED, FS_ALLOWED} = require('../utils/allowed_func');

/**
 * 注册文件系统相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerFsIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerFsIpcHandlers: 缺少 ipcMain');

    ipcMain.handle('fs:call', (event, {prop, args}) => {
        if (!FS_ALLOWED.has(prop)) {
            throw new Error('not allowed');
        }
        const val = fs[prop];
        if (typeof val === 'function') {
            return val.apply(fs, args || []);
        }
        return val;
    });

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
    ipcMain.handle('fs:readFile', async (event, filePath, encoding = null) => {
        try {
            if (encoding) {
                // 若指定了编码，返回文本内容
                const content = fs.readFileSync(filePath, encoding);
                console.log(`📖 读取文本文件: ${filePath}, 编码: ${encoding}, 长度: ${content.length} 字符`);
                return content;
            } else {
                // 若没有指定编码，返回二进制数据数组
                // 向后兼容
                const buffer = fs.readFileSync(filePath);
                console.log(`📖 读取二进制文件: ${filePath}, 长度: ${buffer.length} 字节`);
                return Array.from(buffer);
            }
        } catch (error) {
            console.error(`❌ 读取文件失败: ${filePath}`, error);
            throw new Error(`读取文件失败: ${error.message}`);
        }
    });
}

module.exports = {
    registerFsIpcHandlers
};
