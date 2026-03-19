// Settings 相关 IPC

const fs = require('fs');
const path = require('path');
const {BrowserWindow} = require('electron');

const DEFAULT_SETTINGS = {
    musicFolders: [],
    autoScanEnabled: false,
    scanFrequency: 'on_startup', // on_startup, daily, weekly
    lastScanTime: 0
};

/**
 * 注册 Settings IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {Electron.App} deps.app
 */
function registerSettingsIpcHandlers({ipcMain, app}) {
    if (!ipcMain) throw new Error('registerSettingsIpcHandlers: 缺少 ipcMain');
    if (!app) throw new Error('registerSettingsIpcHandlers: 缺少 app');

    // 设置文件路径
    const userDataPath = app.getPath('userData');
    const settingsFilePath = path.join(userDataPath, 'music-folders-settings.json');

    // 从文件异步加载设置
    async function loadSettings() {
        try {
            const data = await fs.promises.readFile(settingsFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('⚠️ 加载音乐文件夹设置失败:', error);
            }
            return {...DEFAULT_SETTINGS};
        }
    }

    // 异步保存设置到文件
    async function saveSettings(settings) {
        try {
            await fs.promises.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('❌ 保存音乐文件夹设置失败:', error);
            return false;
        }
    }

    // 懒加载：首次访问时初始化
    let settings = null;
    async function ensureSettings() {
        if (!settings) {
            settings = await loadSettings();
        }
        return settings;
    }

    // 获取音乐文件夹列表
    ipcMain.handle('settings:getMusicFolders', async () => {
        const s = await ensureSettings();
        return s.musicFolders || [];
    });

    // 添加音乐文件夹
    ipcMain.handle('settings:addMusicFolder', async (event, folderPath) => {
        if (!folderPath) return {success: false, error: '文件夹路径不能为空'};

        // 检查路径是否存在
        try {
            await fs.promises.access(folderPath);
        } catch {
            return {success: false, error: '文件夹不存在'};
        }

        const s = await ensureSettings();

        // 检查是否已添加
        if (s.musicFolders.includes(folderPath)) {
            return {success: false, error: '该文件夹已添加'};
        }

        s.musicFolders.push(folderPath);
        const saved = await saveSettings(s);

        return {success: saved, folders: s.musicFolders};
    });

    // 移除音乐文件夹
    ipcMain.handle('settings:removeMusicFolder', async (event, folderPath) => {
        const s = await ensureSettings();
        const index = s.musicFolders.indexOf(folderPath);
        if (index === -1) {
            return {success: false, error: '文件夹不存在'};
        }

        s.musicFolders.splice(index, 1);
        const saved = await saveSettings(s);

        return {success: saved, folders: s.musicFolders};
    });

    // 获取自动扫描设置
    ipcMain.handle('settings:getAutoScanSettings', async () => {
        const s = await ensureSettings();
        return {
            enabled: s.autoScanEnabled || false,
            frequency: s.scanFrequency || 'on_startup',
            lastScanTime: s.lastScanTime || 0
        };
    });

    // 更新自动扫描设置
    ipcMain.handle('settings:updateAutoScanSettings', async (event, autoScanSettings) => {
        const s = await ensureSettings();

        if (Object.prototype.hasOwnProperty.call(autoScanSettings, 'enabled')) {
            s.autoScanEnabled = autoScanSettings.enabled;
        }
        if (Object.prototype.hasOwnProperty.call(autoScanSettings, 'frequency')) {
            s.scanFrequency = autoScanSettings.frequency;
        }
        if (Object.prototype.hasOwnProperty.call(autoScanSettings, 'lastScanTime')) {
            s.lastScanTime = autoScanSettings.lastScanTime;
        }

        const saved = await saveSettings(s);

        // 触发自动扫描调度器重启
        if (saved) {
            const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('autoScanScheduler:restart');
            }
        }

        return {success: saved, settings: s};
    });

    // 更新上次扫描时间
    ipcMain.handle('settings:updateLastScanTime', async (event, timestamp) => {
        const s = await ensureSettings();
        s.lastScanTime = timestamp;
        const saved = await saveSettings(s);
        return {success: saved};
    });

    // 兼容旧的 settings API
    ipcMain.handle('settings:get', async (event, key) => {
        const s = await ensureSettings();
        return s[key] ?? null;
    });

    ipcMain.handle('settings:set', async (event, key, value) => {
        const s = await ensureSettings();
        s[key] = value;
        await saveSettings(s);
        return true;
    });
}

module.exports = {
    registerSettingsIpcHandlers,
};
