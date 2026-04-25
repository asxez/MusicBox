/**
 * 全局类型定义
 * 定义 Electron API 和其他全局对象的类型
 */

import type {
    ElectronAudioAPI,
    ElectronDesktopLyricsAPI,
    ElectronGlobalShortcutsAPI,
    ElectronLibraryAPI,
    ElectronNativeAudioAPI,
    ElectronWindowAPI
} from '@api/types/electron';

/**
 * Electron API 类型定义
 */
interface ElectronAPI {
    // 获取Electron版本
    getVersion: () => Promise<string>;

    // 获取当前平台
    getPlatform: () => Promise<string>;

    // 获取应用数据目录
    getUserDataPath: () => Promise<string>;

    // 获取当前的应用目录
    getAppPath: () => Promise<string>;

    // 获取系统临时目录
    getTempPath: () => Promise<string>;

    // 打开应用数据目录
    openUserDataFolder: () => Promise<{ success: boolean, error?: string }>;

    // 获取默认封面缓存路径
    getDefaultCoverCachePath: () => Promise<{ success: boolean, path?: string, error?: string }>;

    // 创建目录（确认目录存在，不存在则创建）
    ensureDirectoryExists: (dirPath: string) => Promise<{ success: boolean, path?: string, error?: string }>;

    // 打开开发工具
    openDevTools: () => Promise<{ success: boolean, error?: string }>;

    // 打开指定目录
    openPath: (path: string) => Promise<{ success: boolean, error?: string }>;

    // 文件对话框
    // 通用目录选择对话框（返回字符串路径，用于音乐目录扫描等）
    openDirectory: () => Promise<string | null>;

    // 选择多个音乐文件
    openFiles: () => Promise<string[]>;

    // 设置页面专用的目录选择对话框（返回完整对象格式）
    selectFolder: () => Promise<{
        filePaths: string[];
        canceled: boolean;
    }>;

    // 图片文件选择对话框（用于歌单封面）
    openImageFile: () => Promise<string | null>;

    // dialog对象
    dialog: {
        // 通用文件选择对话框
        showOpenDialog: (options) => Promise<{
            canceled: boolean
            filePaths: string[]
            bookmarks?: string[]
        }>;

        // 通用文件打开对话框（用于导入文件）
        openFile: (options) => Promise<{
            success: boolean
            filePaths: string[],
            canceled: boolean
        }>;

        // 通用文件保存对话框（用于导出文件）
        saveFile: (options) => Promise<{
            success: boolean
            filePath: string[],
            canceled: boolean
        }>;
    }

    // 文件系统
    fs: {
        // nodejs fs
        fs: object;

        // 获取文件信息
        stat: (filePath: string) => Promise<{
            size: number
            mtime: any
            isFile: boolean
            isDirectory: boolean
        }>;

        // 读取文件内容
        readFile: (filePath: string, encoding: string | null) => Promise<string | []>;

        // 写入文件内容
        writeFile: (filePath: string, data: string, encoding: string | null) => Promise<boolean>;
    }

    // nodejs
    os: object;
    path: object;

    // WebAudio音频引擎
    audio: ElectronAudioAPI;

    // 原生引擎
    nativeAudio: ElectronNativeAudioAPI;

    // 音乐库
    library: ElectronLibraryAPI;

    globalShortcuts: ElectronGlobalShortcutsAPI;

    // 窗口
    window: ElectronWindowAPI;

    extensions: {
        selectPackage: () => Promise<string | null>;
        installFromFile: (filePath: string) => Promise<{
            success: boolean,
            extension: any,
            error?: string
        }>;
        uninstall: (extensionId: string, keepData: boolean) => Promise<{
            success: boolean,
            error?: string
        }>;
        enable: (extensionId: string) => Promise<{
            success: boolean,
            error?: string
        }>;
        disable: (extensionId: string) => Promise<{
            success: boolean,
            error?: string
        }>;
        getInstalled: () => Promise<{
            success: boolean,
            extensions: any[],
            error?: string
        }>;
        scanUserExtensions: () => Promise<{
            success: boolean,
            extensions: any[],
            error?: string
        }>;
        readExtensionFile: (extensionId: string, filePath: string) => Promise<{
            success: boolean,
            content: string,
            error?: string
        }>;
    };

    // 托盘
    tray: {
        create: () => Promise<void>;
        destroy: () => Promise<void>;
        updateSettings: (settings: any) => Promise<void>;
        onQuit: (callback: () => void) => void;
    };

    // 用户数据
    userdata: {
        getMoodHistory: () => Promise<any[]>;
        saveMood: (moodData: any) => Promise<any>;
        getDiaryHistory: () => Promise<any[]>;
        saveDiary: (diaryData: any) => Promise<any>;
        deleteMood: (timestamp: number) => Promise<any>;
        deleteDiary: (timestamp: number) => Promise<any>;
    };

    // 桌面歌词
    desktopLyrics: ElectronDesktopLyricsAPI;
    networkDrive: {};

    // 设置相关
    settings: {};
    hardwareAcceleration: {};

    // 应用控制
    app: {};
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
        createExtensionAPI?: () => {};
    }
}

export {};
