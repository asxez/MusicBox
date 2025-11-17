// Settings 相关 IPC

const fs = require('fs');

/**
 * 注册 Settings IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {Electron.App} deps.app
 */
function registerSettingsIpcHandlers({ipcMain, app}) {
    if (!ipcMain) throw new Error('registerSettingsIpcHandlers: 缺少 ipcMain');
    if (!app) throw new Error('registerSettingsIpcHandlers: 缺少 app');

    const path = require('path');

    // 设置文件路径
    const userDataPath = app.getPath('userData');
    const settingsFilePath = path.join(userDataPath, 'music-folders-settings.json');

    // 从文件加载设置
    function loadSettings() {
        try {
            if (fs.existsSync(settingsFilePath)) {
                const data = fs.readFileSync(settingsFilePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('加载音乐文件夹设置失败:', error);
        }
        return {
            musicFolders: [],
            autoScanEnabled: false,
            scanFrequency: 'on_startup', // on_startup, daily, weekly
            lastScanTime: 0
        };
    }

    // 保存设置到文件
    function saveSettings(settings) {
        try {
            fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('保存音乐文件夹设置失败:', error);
            return false;
        }
    }

    // 加载初始设置
    let settings = loadSettings();

    // 获取音乐文件夹列表
    ipcMain.handle('settings:getMusicFolders', async () => {
        return settings.musicFolders || [];
    });

    // 添加音乐文件夹
    ipcMain.handle('settings:addMusicFolder', async (event, folderPath) => {
        if (!folderPath) return {success: false, error: '文件夹路径不能为空'};

        // 检查路径是否存在
        if (!fs.existsSync(folderPath)) {
            return {success: false, error: '文件夹不存在'};
        }

        // 检查是否已添加
        if (settings.musicFolders.includes(folderPath)) {
            return {success: false, error: '该文件夹已添加'};
        }

        settings.musicFolders.push(folderPath);
        const saved = saveSettings(settings);

        return {
            success: saved,
            folders: settings.musicFolders
        };
    });

    // 移除音乐文件夹
    ipcMain.handle('settings:removeMusicFolder', async (event, folderPath) => {
        const index = settings.musicFolders.indexOf(folderPath);
        if (index === -1) {
            return {success: false, error: '文件夹不存在'};
        }

        settings.musicFolders.splice(index, 1);
        const saved = saveSettings(settings);

        return {
            success: saved,
            folders: settings.musicFolders
        };
    });

    // 获取自动扫描设置
    ipcMain.handle('settings:getAutoScanSettings', async () => {
        return {
            enabled: settings.autoScanEnabled || false,
            frequency: settings.scanFrequency || 'on_startup',
            lastScanTime: settings.lastScanTime || 0
        };
    });

    // 更新自动扫描设置
    ipcMain.handle('settings:updateAutoScanSettings', async (event, autoScanSettings) => {
        if (autoScanSettings.hasOwnProperty('enabled')) {
            settings.autoScanEnabled = autoScanSettings.enabled;
        }
        if (autoScanSettings.hasOwnProperty('frequency')) {
            settings.scanFrequency = autoScanSettings.frequency;
        }
        if (autoScanSettings.hasOwnProperty('lastScanTime')) {
            settings.lastScanTime = autoScanSettings.lastScanTime;
        }

        const saved = saveSettings(settings);

        // 触发自动扫描调度器重启
        if (saved) {
            const {BrowserWindow} = require('electron');
            const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('autoScanScheduler:restart');
            }
        }

        return {success: saved, settings};
    });

    // 更新上次扫描时间
    ipcMain.handle('settings:updateLastScanTime', async (event, timestamp) => {
        settings.lastScanTime = timestamp;
        const saved = saveSettings(settings);
        return {success: saved};
    });

    // 兼容旧的 settings API
    ipcMain.handle('settings:get', async (event, key) => {
        return settings[key] || null;
    });

    ipcMain.handle('settings:set', async (event, key, value) => {
        settings[key] = value;
        saveSettings(settings);
        return true;
    });
}

module.exports = {
    registerSettingsIpcHandlers,
};
