// 系统托盘相关 IPC

const {Tray, Menu, nativeImage} = require('electron');
const path = require('path');
const fs = require('fs');
const {getMainWindow} = require('../utils/window');

let tray = null;
let traySettings = {
    enabled: true,
    closeToTray: false,
    startMinimized: false
};
let settingsFilePath = null;

/**
 * 注册系统托盘相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerTrayIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerTrayIpcHandlers: 缺少 ipcMain');

    // 创建托盘
    ipcMain.handle('tray:create', () => {
        try {
            createTray();
            return {success: true};
        } catch (error) {
            console.error('❌ 创建系统托盘失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 销毁托盘
    ipcMain.handle('tray:destroy', () => {
        try {
            destroyTray();
            return {success: true};
        } catch (error) {
            console.error('❌ 销毁系统托盘失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 更新托盘设置
    ipcMain.handle('tray:updateSettings', async (event, settings) => {
        try {
            traySettings = {...traySettings, ...settings};
            await saveTraySettings();

            if (tray && settings.enabled === false) {
                destroyTray();
            } else if (!tray && settings.enabled === true) {
                createTray();
            }
            return {success: true};
        } catch (error) {
            console.error('❌ 更新托盘设置失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 获取托盘设置
    ipcMain.handle('tray:getSettings', () => {
        return traySettings;
    });
}

// 创建系统托盘
function createTray() {
    if (tray) return;

    try {
        // 使用应用图标作为托盘图标
        let trayIcon;

        trayIcon = createTrayIcon();

        tray = new Tray(trayIcon);
        tray.setToolTip('MusicBox');

        // 创建托盘菜单
        updateTrayMenu();

        // 托盘点击事件
        tray.on('click', () => {
            toggleMainWindow();
        });
    } catch (error) {
        console.error('❌ 创建系统托盘失败:', error);
        throw error;
    }
}

// 销毁系统托盘
function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

// 更新托盘菜单
function updateTrayMenu() {
    if (!tray) return;
    const contextMenu = Menu.buildFromTemplate([
        {type: 'separator'},
        {
            label: '显示主窗口',
            click: () => {
                showMainWindow();
            }
        },
        {type: 'separator'},
        {
            label: '退出',
            click: () => {
                const win = getMainWindow();
                if (win) {
                    win.webContents.send('tray:quit');
                }
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}

// 切换主窗口显示/隐藏
function toggleMainWindow() {
    const win = getMainWindow();
    if (!win) return;

    if (win.isVisible()) {
        if (win.isFocused()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    } else {
        showMainWindow();
    }
}

// 显示主窗口
function showMainWindow() {
    const win = getMainWindow();
    if (!win) return;

    if (win.isMinimized()) {
        win.restore();
    }
    win.show();
    win.focus();
}

// 隐藏主窗口到托盘
function hideMainWindow() {
    const win = getMainWindow();
    if (win) {
        win.hide();
    }
}

// 获取托盘实例
function getTray() {
    return tray;
}

// 获取托盘设置
function getTraySettings() {
    return traySettings;
}

// 设置托盘设置
function setTraySettings(settings) {
    traySettings = {...traySettings, ...settings};
}

// 初始化设置文件路径
function initSettingsPath() {
    if (!settingsFilePath) {
        try {
            const {app} = require('electron');
            const userDataPath = app.getPath('userData');
            settingsFilePath = path.join(userDataPath, 'tray-settings.json');
        } catch (error) {
            settingsFilePath = path.join(process.cwd(), 'tray-settings.json');
        }
    }
}

// 保存托盘设置到文件
async function saveTraySettings() {
    try {
        initSettingsPath();
        await fs.promises.writeFile(settingsFilePath, JSON.stringify(traySettings, null, 2), 'utf8');
    } catch (error) {
        console.error('❌ 保存托盘设置失败:', error);
    }
}

// 从文件加载托盘设置
async function loadTraySettings() {
    try {
        initSettingsPath();
        if (fs.existsSync(settingsFilePath)) {
            const settingsData = await fs.promises.readFile(settingsFilePath, 'utf8');
            const settings = JSON.parse(settingsData);
            traySettings = {...traySettings, ...settings};
        }
    } catch (error) {
        console.error('❌ 加载托盘设置失败:', error);
    }
}

// 创建托盘图标
function createTrayIcon() {
    try {
        const {app} = require('electron');
        const appPath = app.getAppPath();

        const iconPaths = [
            path.join(__dirname, '../../renderer/public/assets/images/favicon.ico'),
            path.join(appPath, 'src/renderer/public/favicon.ico'),
            path.join(appPath, 'src/renderer/src/assets/images/favicon.ico'),
            path.join(appPath, 'public/favicon.ico'),
            path.join(appPath, 'assets/favicon.ico')
        ];

        for (const iconPath of iconPaths) {
            if (fs.existsSync(iconPath)) {
                const icon = nativeImage.createFromPath(iconPath);
                if (!icon.isEmpty()) {
                    return icon.resize({width: 16, height: 16});
                }
            }
        }
    } catch (error) {
        console.error('❌ 创建托盘图标失败:', error);
    }
}

module.exports = {
    registerTrayIpcHandlers,
    getTraySettings,
    loadTraySettings
};
