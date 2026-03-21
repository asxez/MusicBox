/**
 * 全局类型定义
 * 定义 Electron API 和其他全局对象的类型
 */

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
    audio: {
        init: () => Promise<boolean>;
        play: () => Promise<boolean>;
        pause: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        seek: (position: number) => Promise<boolean>;
        setVolume: (volume: number) => Promise<boolean>;

        loadTrack: (filePath: string) => Promise<boolean>;
        getCurrentTrack: () => Promise<object>;
        getPosition: () => Promise<number>;
        getDuration: () => Promise<number>;

        setPlaylist: (tracks: object[]) => Promise<boolean>;
        nextTrack: () => Promise<boolean>;
        previousTrack: () => Promise<boolean>;

        onTrackChanged: (callback: (event: any, track: any) => void) => void;
        onPlaybackStateChanged: (callback: (event: any, state: string) => void) => void;
        onPositionChanged: (callback: (event: any, position: number) => void) => void;
    };

    // 原生引擎
    nativeAudio: {
        initialize: () => Promise<object>;
        loadTrack: (filePath: string) => Promise<object>;
        play: () => Promise<object>;
        pause: () => Promise<object>;
        stop: () => Promise<object>;
        seek: (position: number) => Promise<object>;

        setVolume: (volume: number) => Promise<{
            success: boolean,
            error?: string
        }>;
        getPosition: () => Promise<object>;

        setEqualizerEnabled: (enabled: boolean) => Promise<{
            success: boolean,
            error?: string
        }>;
        isEqualizerEnabled: () => Promise<{
            success: boolean,
            error?: string
        }>;
        setEqualizerPreamp: (gain: number) => Promise<{
            success: boolean,
            error?: string
        }>;
        getEqualizerPreamp: () => Promise<{
            success: boolean,
            preamp?: number,
            error?: string
        }>;
        setEqualizerBandGain: (band: number, gain: number) => Promise<{
            success: boolean,
            error?: string
        }>;
        getEqualizerBandGain: (band: number) => Promise<{
            success: boolean,
            gain: number,
            error?: string
        }>;
        // todo太多了，下次再写
    };

    // 音乐库
    library: {
        validateCache: () => Promise<{
            valid: number,
            invalid: number,
            modified: number,
            tracks: object[]
        }>;

        scanDirectory: (path: string) => Promise<boolean>;
        scanNetworkDrive: (driveId: string | number, relativePath: string) => Promise<boolean>;

        // 扫描单个网络文件
        scanSingleFile: (networkPath: string) => Promise<object>;
        scanDirectoryForFiles: (path: string) => Promise<{
            success: boolean,
            files: object[],
            error?: string
        }>;
        addTrackToLibrary: (audioFile: object) => Promise<{
            success: boolean,
            track?: {
                fileId: string,
            },
            error?: string
            isNew?: boolean
        }>;

        getTracks: (options?: any) => Promise<any[]>;
        getPlaylists: () => Promise<any[]>;
        search: (query: string) => Promise<any[]>;

        getTrackMetadata: (filePath: string) => Promise<any>;
        getCacheStatistics: () => Promise<any>;
        clearCache: () => Promise<void>;

        //
        getPlaylistDetail: (playlistId: string) => Promise<{
            success: boolean,
            playlist?: {
                tracks: object,
                trackIds: string[],
                id: string,
                name: string,
                description: string,
                createdAt: number,
                updatedAt: number,
                coverImage: any | null
            },
            error?: string
        }>;

        // 添加歌曲到歌单
        addToPlaylist: (playlistId: string, trackIds: string[]) => Promise<{
            success: boolean,
            error?: string
        }>;

        // 从歌单移除歌曲
        removeFromPlaylist: (playlistId: string, trackIds: string[]) => Promise<{
            success: boolean,
            error?: string
        }>;

        // 清空忽略列表
        clearIgnoreList: () => Promise<{
            success: boolean,
            error?: string
        }>;

        onLibraryUpdated: (callback: (event: any, data: any) => void) => void;
        onScanProgress: (callback: (event: any, progress: any) => void) => void;

        onCacheValidationProgress: (callback: (event: any, progress: any) => void) => function;

        // todo
    };

    globalShortcuts: {
        register: (shortcuts: any) => Promise<void>;
        unregister: () => Promise<boolean>;
    };

    // 窗口
    window: {
        getSize: () => Promise<[number, number]>;
        setSize: (width: number, height: number) => Promise<{ success: boolean }>;
        getPosition: () => Promise<[number, number]>;
        getBounds: () => Promise<{
            height: number;
            width: number;
            x: number;
            y: number;
        }>;
        setBounds: (bounds: {
            height: number;
            width: number;
            x: number;
            y: number;
        }) => Promise<{
            success: boolean,
            bounds?: {
                height: number;
                width: number;
                x: number;
                y: number;
            }
            error?: string
        }>;
        isMaximized: () => Promise<boolean>;
        maximize: () => Promise<void>;
        unmaximize: () => Promise<void>;
        minimize: () => Promise<void>;
        close: () => Promise<void>;
        show: () => Promise<void>;
        hide: () => Promise<void>;
        focus: () => Promise<void>;
        setFullScreen: (flag: boolean) => Promise<void>;
        isFullScreen: () => Promise<boolean>;
        setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
        onMaximizedChanged: (callback: (isMaximized: boolean) => void) => void;
        setBackgroundThrottling: (allowed: boolean) => Promise<void>;
        setPosition: (x: number, y: number) => Promise<{
            success: boolean,
            error?: string
        }>;
        // 设置是否可拖动窗口大小
        setResizable: (resizable: boolean) => Promise<boolean>;
        // 设置是否显示在任务栏
        setSkipTaskbar: (skip: boolean) => Promise<boolean>;
        // 设置窗口最小尺寸
        setMinimumSize: (width: number, height) => Promise<boolean>;
    };

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
    desktopLyrics: {};
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
