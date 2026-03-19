/**
 * 窗口管理工具模块
 * 提供主窗口和桌面歌词窗口的创建、管理功能
 */

const {BrowserWindow} = require('electron');
const path = require('path');
const fs = require('fs');

// 窗口实例引用
let mainWindow = null;
let desktopLyricsWindow = null;

// 窗口配置文件路径
let windowConfigPath = null;

// 初始化窗口配置文件路径
function initWindowConfigPath() {
    try {
        const {app} = require('electron');
        const userDataPath = app.getPath('userData');
        windowConfigPath = path.join(userDataPath, 'window-config.json');
    } catch (error) {
        windowConfigPath = path.join(process.cwd(), 'window-config.json');
    }
}

// 加载窗口配置
async function loadWindowConfig() {
    try {
        if (!windowConfigPath) {
            initWindowConfigPath();
        }

        let configData;
        try {
            configData = await fs.promises.readFile(windowConfigPath, 'utf8');
        } catch (e) {
            if (e.code === 'ENOENT') return getDefaultWindowConfig();
            throw e;
        }
        const config = JSON.parse(configData);

        if (isValidWindowConfig(config)) {
            return config;
        } else {
            return getDefaultWindowConfig();
        }
    } catch (error) {
        console.error('❌ 加载窗口配置失败:', error);
        return getDefaultWindowConfig();
    }
}

// 保存窗口配置
async function saveWindowConfig(config) {
    try {
        if (!windowConfigPath) {
            initWindowConfigPath();
        }

        if (!isValidWindowConfig(config)) {
            return false;
        }

        const configData = {
            ...config,
            lastUpdated: Date.now(),
        };
        await fs.promises.writeFile(windowConfigPath, JSON.stringify(configData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('❌ 保存窗口配置失败:', error);
        return false;
    }
}

// 获取默认窗口配置
function getDefaultWindowConfig() {
    return {
        width: 1440,
        height: 900,
        minWidth: 1080,
        minHeight: 720
    };
}

// 验证窗口配置有效性
function isValidWindowConfig(config) {
    if (!config || typeof config !== 'object') {
        return false;
    }

    const {width, height} = config;
    const minWidth = 1080;
    const minHeight = 720;
    const maxWidth = 3840;
    const maxHeight = 2160;

    return (
        typeof width === 'number' &&
        typeof height === 'number' &&
        width >= minWidth && width <= maxWidth &&
        height >= minHeight && height <= maxHeight
    );
}

/**
 * 设置窗口实例引用
 * @param {BrowserWindow} main - 主窗口实例
 * @param {BrowserWindow} desktop - 桌面歌词窗口实例
 */
function setWindowReferences(main, desktop) {
    mainWindow = main;
    desktopLyricsWindow = desktop;
}

/**
 * 获取主窗口实例
 * @returns {BrowserWindow|null} 主窗口实例
 */
function getMainWindow() {
    return mainWindow;
}

/**
 * 获取桌面歌词窗口实例
 * @returns {BrowserWindow|null} 桌面歌词窗口实例
 */
function getDesktopLyricsWindow() {
    return desktopLyricsWindow;
}

/**
 * 创建主窗口
 * @returns {BrowserWindow} 创建的主窗口实例
 */
async function createWindow() {
    const {app, shell} = require('electron');
    const isDev = !app.isPackaged

    // 加载窗口配置
    const windowConfig = await loadWindowConfig();

    mainWindow = new BrowserWindow({
        width: windowConfig.width,
        height: windowConfig.height,
        minWidth: windowConfig.minWidth || 1080,
        minHeight: windowConfig.minHeight || 720,
        titleBarStyle: 'hidden',
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, '../preload.js'),
        },
    });

    // 加载HTML文件
    let htmlPath;
    if (isDev) {
        // 开发环境：从源码目录加载
        htmlPath = path.join(__dirname, '../../renderer/public/index.html');
        console.log(`🔧 开发环境 - Loading HTML from: ${htmlPath}`);
    } else {
        // 生产环境：使用app.getAppPath()获取正确路径
        const appPath = app.getAppPath();
        htmlPath = path.join(appPath, 'src/renderer/public/index.html');
        console.log(`📦 生产环境 - App path: ${appPath}`);
        console.log(`📦 生产环境 - Loading HTML from: ${htmlPath}`);
    }

    try {
        await fs.promises.access(htmlPath);
        await mainWindow.loadFile(htmlPath);
    } catch {
        console.warn(`⚠️ ${htmlPath}不存在，尝试备用路径`);
        const fallbackPath = path.join(__dirname, '../../renderer/public/index.html');
        console.log(`🔄 尝试备用路径: ${fallbackPath}`);
        try {
            await mainWindow.loadFile(fallbackPath);
        } catch (fallbackError) {
            console.error(`❌ 备用路径也失败: ${fallbackError.message}`);
        }
    }

    mainWindow.once('ready-to-show', async () => {
        // 检查是否需要启动时最小化到托盘
        let shouldStartMinimized = false;
        try {
            // 读取设置文件检查启动时最小化选项
            const {app} = require('electron');
            const userDataPath = app.getPath('userData');
            const settingsPath = path.join(userDataPath, 'tray-settings.json');

            try {
                const settingsData = await fs.promises.readFile(settingsPath, 'utf8');
                const settings = JSON.parse(settingsData);
                shouldStartMinimized = settings.enabled && settings.startMinimized;
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
            }
        } catch (error) {}

        if (!shouldStartMinimized) {
            // mainWindow.webContents.openDevTools({mode: 'detach'});
            mainWindow.show();
        }
    });

    // 监听窗口尺寸变化
    let saveTimeout = null;
    mainWindow.on('resize', () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        saveTimeout = setTimeout(async () => {
            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
                const [width, height] = mainWindow.getSize();
                const config = {
                    width,
                    height,
                    minWidth: 1080,
                    minHeight: 720
                };
                await saveWindowConfig(config);
            }
        }, 1000);
    });

    // 窗口关闭事件处理
    mainWindow.on('close', (event) => {
        // 检查托盘设置，决定是关闭还是隐藏到托盘
        try {
            const {getTraySettings} = require('../ipc/tray');
            const traySettings = getTraySettings();

            if (traySettings.enabled && traySettings.closeToTray) {
                event.preventDefault();
                mainWindow.hide();
            }
        } catch (error) {
            console.warn('⚠️ 读取托盘设置失败:', error.message);
        }
    });

    mainWindow.on('closed', () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        mainWindow = null;
        if (desktopLyricsWindow) {
            desktopLyricsWindow.close();
            desktopLyricsWindow = null;
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: 'deny'};
    });

    // 监听窗口最大化/还原状态变化
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximized', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:maximized', false);
    });

    // 拦截开发者工具快捷键
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // 拦截 Ctrl+Shift+I 和 F12
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            event.preventDefault();
        } else if (input.key === 'F12') {
            event.preventDefault();
            if (!mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.openDevTools({mode: 'detach'});
            }
        }
    });

    return mainWindow;
}

/**
 * 创建桌面歌词窗口
 * @returns {Promise<BrowserWindow>} 创建的桌面歌词窗口实例
 */
async function createDesktopLyricsWindow() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.focus();
        return desktopLyricsWindow;
    }

    // 获取主窗口位置和尺寸
    const mainBounds = mainWindow ? mainWindow.getBounds() : {x: 100, y: 100, width: 1440, height: 900};

    // 计算桌面歌词窗口的初始位置（在主窗口下方）
    const lyricsX = mainBounds.x + 50;
    const lyricsY = mainBounds.y + 20;

    desktopLyricsWindow = new BrowserWindow({
        width: 500,
        height: 120,
        x: lyricsX,
        y: lyricsY,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: true,
        focusable: false, // 防止抢夺焦点
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    // 加载桌面歌词页面
    const lyricsHtmlPath = path.join(__dirname, '../../renderer/public/DesktopLyrics.html');
    await desktopLyricsWindow.loadFile(lyricsHtmlPath);
    // desktopLyricsWindow.webContents.openDevTools({mode: 'detach'});

    // 窗口事件处理
    desktopLyricsWindow.once('ready-to-show', () => {
        desktopLyricsWindow.show();
    });

    desktopLyricsWindow.on('closed', () => {
        desktopLyricsWindow = null;
    });

    // 防止窗口失去焦点时隐藏
    desktopLyricsWindow.on('blur', () => {
        // 保持窗口可见
    });

    return desktopLyricsWindow;
}

/**
 * 显示桌面歌词窗口
 * @returns {boolean} 是否成功显示
 */
function showDesktopLyrics() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.show();
        return true;
    }
    return false;
}

/**
 * 隐藏桌面歌词窗口
 * @returns {boolean} 是否成功隐藏
 */
function hideDesktopLyrics() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.hide();
        closeDesktopLyrics();
        return true;
    }
    return false;
}

/**
 * 关闭桌面歌词窗口
 * @returns {boolean} 是否成功关闭
 */
function closeDesktopLyrics() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.close();
        desktopLyricsWindow = null;
        return true;
    }
    return false;
}

/**
 * 检查桌面歌词窗口是否存在且可见
 * @returns {boolean} 是否可见
 */
function isDesktopLyricsVisible() {
    return desktopLyricsWindow && desktopLyricsWindow.isVisible();
}

/**
 * 向桌面歌词窗口发送数据
 * @param {string} channel - IPC通道名称
 * @param {any} data - 要发送的数据
 * @returns {boolean} 是否成功发送
 */
function sendToDesktopLyrics(channel, data) {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        desktopLyricsWindow.webContents.send(channel, data);
        return true;
    }
    return false;
}

module.exports = {
    setWindowReferences,
    getMainWindow,
    getDesktopLyricsWindow,
    createWindow,
    createDesktopLyricsWindow,
    showDesktopLyrics,
    hideDesktopLyrics,
    closeDesktopLyrics,
    isDesktopLyricsVisible,
    sendToDesktopLyrics,
};
