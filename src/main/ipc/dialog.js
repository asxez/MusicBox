// 对话框相关 IPC

const {dialog} = require('electron');
const {getMainWindow} = require('../utils/window');

/**
 * 注册对话框相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerDialogIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerDialogIpcHandlers: 缺少 ipcMain');

    // 通用目录选择对话框（返回字符串路径，用于音乐目录扫描等）
    ipcMain.handle('dialog:openDirectory', async () => {
        const win = getMainWindow();
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Select Music Folder'
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    // 设置页面专用的目录选择对话框（返回完整对象格式）
    ipcMain.handle('dialog:selectFolder', async () => {
        const win = getMainWindow();
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Select Folder'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return {filePaths: result.filePaths, canceled: result.canceled};
        }
        return {filePaths: [], canceled: true};
    });

    // 选择多个音乐文件
    ipcMain.handle('dialog:openFiles', async () => {
        const win = getMainWindow();
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile', 'multiSelections'],
            filters: [
                {
                    name: 'Audio Files',
                    extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma']
                }
            ],
            title: 'Select Music Files'
        });

        if (!result.canceled) {
            return result.filePaths;
        }
        return [];
    });

    // 通用文件选择对话框
    ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
        const win = getMainWindow();
        return await dialog.showOpenDialog(win, options);
    });

    // 图片文件选择对话框（用于歌单封面）
    ipcMain.handle('dialog:openImageFile', async () => {
        const win = getMainWindow();
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [
                {name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']},
                {name: 'JPEG 图片', extensions: ['jpg', 'jpeg']},
                {name: 'PNG 图片', extensions: ['png']},
                {name: 'GIF 图片', extensions: ['gif']},
                {name: 'WebP 图片', extensions: ['webp']}
            ],
            title: '选择歌单封面图片'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });
}

module.exports = {
    registerDialogIpcHandlers
};
