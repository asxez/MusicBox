/**
 * 窗口管理器
 * 负责创建和管理应用窗口
 */

import {BrowserWindow, screen} from 'electron';
import * as path from 'path';

/**
 * 窗口配置接口
 */
export interface WindowConfig {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    frame?: boolean;
    transparent?: boolean;
    alwaysOnTop?: boolean;
    skipTaskbar?: boolean;
    resizable?: boolean;

    [key: string]: any;
}

/**
 * 窗口管理器类
 */
export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private desktopLyricsWindow: BrowserWindow | null = null;
    private preloadPath: string;

    constructor() {
        this.preloadPath = path.join(__dirname, '../preload.js');
    }

    /**
     * 创建主窗口
     */
    createMainWindow(): BrowserWindow {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.focus();
            return this.mainWindow;
        }

        const {width, height} = screen.getPrimaryDisplay().workAreaSize;

        this.mainWindow = new BrowserWindow({
            width: Math.min(1400, width),
            height: Math.min(900, height),
            minWidth: 1000,
            minHeight: 600,
            frame: false,
            transparent: false,
            backgroundColor: '#1a1a1a',
            show: false,
            webPreferences: {
                preload: this.preloadPath,
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                allowRunningInsecureContent: false
            }
        });

        // 加载页面
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
            this.mainWindow.loadURL('http://localhost:8080');
        } else {
            this.mainWindow.loadFile(path.join(__dirname, '../../../src/renderer/public/index.html'));
        }

        // 窗口准备好后显示
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
        });

        // 窗口关闭时清理引用
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // 最大化状态变化事件
        this.mainWindow.on('maximize', () => this.sendToMainWindow('window:maximized', true));
        this.mainWindow.on('unmaximize', () => this.sendToMainWindow('window:maximized', false));

        return this.mainWindow;
    }

    /**
     * 创建桌面歌词窗口
     */
    createDesktopLyricsWindow(config?: WindowConfig): BrowserWindow {
        if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
            this.desktopLyricsWindow.show();
            return this.desktopLyricsWindow;
        }

        const defaultConfig: WindowConfig = {
            width: 800,
            height: 120,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            ...config
        };

        this.desktopLyricsWindow = new BrowserWindow({
            ...defaultConfig,
            webPreferences: {
                preload: this.preloadPath,
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // 加载桌面歌词页面
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
            this.desktopLyricsWindow.loadURL('http://localhost:8080/DesktopLyrics.html');
        } else {
            this.desktopLyricsWindow.loadFile(
                path.join(__dirname, '../../../src/renderer/public/DesktopLyrics.html')
            );
        }

        // 窗口关闭时清理引用
        this.desktopLyricsWindow.on('closed', () => {
            this.desktopLyricsWindow = null;
        });

        return this.desktopLyricsWindow;
    }

    /**
     * 获取主窗口
     */
    getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    /**
     * 获取桌面歌词窗口
     */
    getDesktopLyricsWindow(): BrowserWindow | null {
        return this.desktopLyricsWindow;
    }

    /**
     * 关闭桌面歌词窗口
     */
    closeDesktopLyricsWindow(): void {
        if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
            this.desktopLyricsWindow.close();
        }
    }

    /**
     * 检查是否有打开的窗口
     */
    hasWindows(): boolean {
        return (
            (this.mainWindow !== null && !this.mainWindow.isDestroyed()) ||
            (this.desktopLyricsWindow !== null && !this.desktopLyricsWindow.isDestroyed())
        );
    }

    /**
     * 关闭所有窗口
     */
    closeAllWindows(): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.close();
        }
        if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
            this.desktopLyricsWindow.close();
        }
    }

    /**
     * 向主窗口发送消息
     */
    sendToMainWindow(channel: string, ...args: any[]): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, ...args);
        }
    }

    /**
     * 向桌面歌词窗口发送消息
     */
    sendToDesktopLyrics(channel: string, ...args: any[]): void {
        if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
            this.desktopLyricsWindow.webContents.send(channel, ...args);
        }
    }
}
