/**
 * 窗口管理工具模块
 * 提供主窗口和桌面歌词窗口的创建、管理功能
 */

const {BrowserWindow, shell} = require('electron');
const path = require('path');

// 窗口实例引用
let mainWindow = null;
let desktopLyricsWindow = null;

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
    const {app} = require('electron');
    const fs = require('fs');
    const isDev = process.env.NODE_ENV === 'development';

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1080,
        minHeight: 720,
        titleBarStyle: false,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../preload.js')
        }
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
        console.log(`📦 生产环境 - __dirname: ${__dirname}`);
        console.log(`📦 生产环境 - File exists: ${fs.existsSync(htmlPath)}`);
    }

    try {
        await mainWindow.loadFile(htmlPath);
    } catch (error) {
        console.error(`❌ HTML文件加载失败: ${error.message}`);
        console.error(`❌ 尝试的路径: ${htmlPath}`);

        // 如果加载失败，尝试备用路径
        const fallbackPath = path.join(__dirname, '../../renderer/public/index.html');
        console.log(`🔄 尝试备用路径: ${fallbackPath}`);
        try {
            await mainWindow.loadFile(fallbackPath);
        } catch (fallbackError) {
            console.error(`❌ 备用路径也失败: ${fallbackError.message}`);
        }
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (desktopLyricsWindow) desktopLyricsWindow.close();
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
        resizable: true,
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
    const lyricsHtmlPath = path.join(__dirname, '../../renderer/public/desktop-lyrics.html');
    await desktopLyricsWindow.loadFile(lyricsHtmlPath);

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
    sendToDesktopLyrics
};
