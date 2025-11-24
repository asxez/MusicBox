// 文件系统相关 IPC

const fs = require('fs');
const fsPromises = require('fs').promises;
const {FS_ALLOWED} = require('../utils/AllowedFunc');

/**
 * 注册文件系统相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerFsIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerFsIpcHandlers: 缺少 ipcMain');

    ipcMain.handle('fs:call', async (event, {prop, args}) => {
        if (FS_ALLOWED.indexOf(prop) === -1) {
            throw new Error('not allowed');
        }

        console.log('🔧 fs:call 调用:', prop, args);

        // 使用Promise版本的fs方法
        try {
            switch (prop) {
                case 'readdir':
                    return await fsPromises.readdir(args[0]);
                case 'access':
                    await fsPromises.access(args[0]);
                    return true; // access成功返回true
                case 'stat':
                    return await fsPromises.stat(args[0]);
                case 'lstat':
                    return await fsPromises.lstat(args[0]);
                case 'readFile':
                    return await fsPromises.readFile(args[0], args[1]);
                case 'realpath':
                    return await fsPromises.realpath(args[0]);
                default:
                    // 其他方法，暂时使用原始方式
                    const val = fs[prop];
                    if (typeof val === 'function') {
                        return val.apply(fs, args || []);
                    }
                    return val;
            }
        } catch (error) {
            console.error('🔧 fs:call 错误:', prop, args, error.message);
            throw error;
        }
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

    // 写入文件内容
    ipcMain.handle('fs:writeFile', async (event, filePath, data, encoding = 'utf8') => {
        try {
            fs.writeFileSync(filePath, data, encoding);
            console.log(`💾 写入文件成功: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`❌ 写入文件失败: ${filePath}`, error);
            return false;
        }
    });
}

module.exports = {
    registerFsIpcHandlers
};
