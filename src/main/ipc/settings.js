// Settings 相关 IPC

/**
 * 注册 Settings IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 */
function registerSettingsIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerSettingsIpcHandlers: 缺少 ipcMain');

    // 使用模块内部 Map 保存设置
    const settings = new Map();

    ipcMain.handle('settings:get', async (event, key) => {
        return settings.get(key) || null;
    });

    ipcMain.handle('settings:set', async (event, key, value) => {
        settings.set(key, value);
        return true;
    });
}

module.exports = {
    registerSettingsIpcHandlers,
};
