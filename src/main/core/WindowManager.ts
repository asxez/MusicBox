/**
 * 窗口管理器
 * 负责创建和管理应用窗口
 */

import {app, BrowserWindow} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

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

interface SavedWindowConfig {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    desktopLyrics?: { x?: number; y?: number };
    lastUpdated?: number;
}

/**
 * 窗口管理器类
 */
export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private desktopLyricsWindow: BrowserWindow | null = null;
    private preloadPath: string;
    private windowConfigPath: string;
    private getTraySettingsCallback: (() => { enabled: boolean; closeToTray: boolean }) | null = null;

    constructor() {
        this.preloadPath = path.join(__dirname, '../preload.js');
        this.windowConfigPath = path.join(app.getPath('userData'), 'window-config.json');
    }

    setTraySettingsGetter(fn: () => { enabled: boolean; closeToTray: boolean }): void {
        this.getTraySettingsCallback = fn;
    }

    private async loadWindowConfig(): Promise<SavedWindowConfig> {
        try {
            const data = await fs.promises.readFile(this.windowConfigPath, 'utf8');
            const config = JSON.parse(data);
            if (this.isValidWindowConfig(config)) return config;
        } catch (e: any) {
            if (e.code !== 'ENOENT') console.error('❌ 加载窗口配置失败:', e);
        }
        return {width: 1440, height: 900, minWidth: 1080, minHeight: 720};
    }

    private async saveWindowConfig(config: SavedWindowConfig): Promise<void> {
        try {
            if (!this.isValidWindowConfig(config)) return;
            await fs.promises.writeFile(
                this.windowConfigPath,
                JSON.stringify({...config, lastUpdated: Date.now()}, null, 2),
                'utf8'
            );
        } catch (e) {
            console.error('❌ 保存窗口配置失败:', e);
        }
    }

    private isValidWindowConfig(config: any): config is SavedWindowConfig {
        if (!config || typeof config !== 'object') return false;
        const {width, height} = config;
        return (
            typeof width === 'number' && typeof height === 'number' &&
            width >= 1080 && width <= 3840 &&
            height >= 720 && height <= 2160
        );
    }

    /**
     * 创建主窗口
     */
    async createMainWindow(): Promise<BrowserWindow> {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.focus();
            return this.mainWindow;
        }

        const windowConfig = await this.loadWindowConfig();

        this.mainWindow = new BrowserWindow({
            width: windowConfig.width,
            height: windowConfig.height,
            minWidth: windowConfig.minWidth || 1080,
            minHeight: windowConfig.minHeight || 720,
            titleBarStyle: 'hidden',
            frame: false,
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
        const isDev = !app.isPackaged;
        let htmlPath: string;
        if (isDev) {
            htmlPath = path.join(__dirname, '../../../src/renderer/public/index.html');
            console.log(`🔧 开发环境 - Loading HTML from: ${htmlPath}`);
        } else {
            htmlPath = path.join(app.getAppPath(), 'src/renderer/public/index.html');
            console.log(`📦 生产环境 - Loading HTML from: ${htmlPath}`);
        }

        try {
            await fs.promises.access(htmlPath);
            await this.mainWindow.loadFile(htmlPath);
        } catch {
            console.warn(`⚠️ ${htmlPath}不存在，尝试备用路径`);
            const fallbackPath = path.join(__dirname, '../../renderer/public/index.html');
            console.log(`🔄 尝试备用路径: ${fallbackPath}`);
            try {
                await this.mainWindow.loadFile(fallbackPath);
            } catch (fallbackError: any) {
                console.error(`❌ 备用路径也失败: ${fallbackError.message}`);
            }
        }

        // 窗口准备好后显示
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
        });

        // 保存窗口尺寸（防抖1秒）
        let saveTimeout: NodeJS.Timeout | null = null;
        this.mainWindow.on('resize', () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isMaximized()) {
                    const [width, height] = this.mainWindow.getSize();
                    const config = await this.loadWindowConfig();
                    config.width = width;
                    config.height = height;
                    await this.saveWindowConfig(config);
                }
            }, 1000);
        });

        // 关闭事件：检查是否最小化到托盘
        this.mainWindow.on('close', (event) => {
            try {
                if (this.getTraySettingsCallback) {
                    const traySettings = this.getTraySettingsCallback();
                    if (traySettings.enabled && traySettings.closeToTray) {
                        event.preventDefault();
                        this.mainWindow?.hide();
                        return;
                    }
                }
            } catch (error: any) {
                console.warn('⚠️ 读取托盘设置失败:', error.message);
            }
        });

        // 窗口关闭时清理引用
        this.mainWindow.on('closed', () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            this.mainWindow = null;
            if (this.desktopLyricsWindow) {
                this.closeDesktopLyricsWindow();
            }
        });

        // 最大化状态变化事件
        this.mainWindow.on('maximize', () => this.sendToMainWindow('window:maximized', true));
        this.mainWindow.on('unmaximize', () => this.sendToMainWindow('window:maximized', false));

        // 拦截开发者工具快捷键
        this.mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                event.preventDefault();
            } else if (input.key === 'F12') {
                event.preventDefault();
                if (this.mainWindow && !this.mainWindow.webContents.isDevToolsOpened()) {
                    this.mainWindow.webContents.openDevTools({mode: 'detach'});
                }
            }
        });

        return this.mainWindow;
    }

    /**
     * 创建桌面歌词窗口
     */
    async createDesktopLyricsWindow(config?: WindowConfig): Promise<BrowserWindow> {
        if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
            this.desktopLyricsWindow.show();
            return this.desktopLyricsWindow;
        }

        // 加载已保存的窗口位置
        const windowConfig = await this.loadWindowConfig();
        let lyricsX: number | undefined;
        let lyricsY: number | undefined;
        if (
            windowConfig.desktopLyrics &&
            typeof windowConfig.desktopLyrics.x === 'number' &&
            typeof windowConfig.desktopLyrics.y === 'number'
        ) {
            lyricsX = windowConfig.desktopLyrics.x;
            lyricsY = windowConfig.desktopLyrics.y;
        } else {
            const mainBounds = this.mainWindow ? this.mainWindow.getBounds() : {x: 100, y: 100};
            lyricsX = mainBounds.x + 50;
            lyricsY = mainBounds.y + 20;
        }

        const defaultConfig: WindowConfig = {
            width: 1000,
            height: 150,
            x: lyricsX,
            y: lyricsY,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            movable: true,
            focusable: false,
            show: false,
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
        const lyricsHtmlPath = path.join(__dirname, '../../../src/renderer/public/DesktopLyrics.html');
        await this.desktopLyricsWindow.loadFile(lyricsHtmlPath);

        // 页面加载完成后显示
        this.desktopLyricsWindow.once('ready-to-show', () => {
            // this.desktopLyricsWindow?.webContents.openDevTools({mode: 'detach'});
            this.desktopLyricsWindow?.show();
        });

        // 监听窗口移动，保存位置
        let moveTimeout: NodeJS.Timeout | null = null;
        this.desktopLyricsWindow.on('move', () => {
            if (moveTimeout) clearTimeout(moveTimeout);
            moveTimeout = setTimeout(async () => {
                if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
                    const [x, y] = this.desktopLyricsWindow.getPosition();
                    const savedConfig = await this.loadWindowConfig();
                    savedConfig.desktopLyrics = {x, y};
                    await this.saveWindowConfig(savedConfig);
                }
            }, 500);
        });

        // 窗口关闭时清理引用
        this.desktopLyricsWindow.on('closed', () => {
            if (moveTimeout) clearTimeout(moveTimeout);
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
