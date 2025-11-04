// 引入 electron 之前设置垃圾回收标志
process.argv.push('--expose-gc');

const path = require('path');
const fs = require('fs');
const {app, BrowserWindow, ipcMain} = require('electron');

// 加载硬件加速设置
function loadHardwareAccelerationSettings() {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'hardware-acceleration-settings.json');
    if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        return settings.enabled !== false;
    }
    return true; // 默认启用硬件加速
}

// 应用硬件加速设置
const hardwareAccelerationEnabled = loadHardwareAccelerationSettings();
if (!hardwareAccelerationEnabled) {
    console.log('🔧 主进程: 禁用硬件加速');
    app.disableHardwareAcceleration();
} else {
    console.log('✅ 主进程: 硬件加速已启用');
}

app.commandLine.appendSwitch("js-flags", "--expose-gc");

const LibraryCacheManager = require('./library-cache-manager');
const NetworkDriveManager = require('./network-drive-manager');
const NetworkFileAdapter = require('./network-file-adapter');
const metadataHandler = require('./metadata-handler');

// 导入工具函数
const metadataUtils = require('./utils/metadata');
const windowUtils = require('./utils/window');

const {registerAudioIpcHandlers} = require('./ipc/audio');
const {registerDialogIpcHandlers} = require('./ipc/dialog');
const {registerWindowIpcHandlers} = require('./ipc/window');
const {registerFsIpcHandlers} = require('./ipc/fs');
const {registerOsIpcHandlers} = require('./ipc/os');
const {registerPathIpcHandlers} = require('./ipc/path');
const {registerNetworkDriveIpcHandlers} = require('./ipc/network-drive');
const {registerDesktopLyricsIpcHandlers} = require('./ipc/desktop-lyrics');
const {registerLyricsIpcHandlers} = require('./ipc/lyrics');
const {registerCoversIpcHandlers} = require('./ipc/covers');
const {registerGlobalShortcutsIpcHandlers} = require('./ipc/global-shortcuts');
const {registerSettingsIpcHandlers} = require('./ipc/settings');
const {registerAppIpcHandlers} = require('./ipc/app');
const {registerHttpServerIpcHandlers} = require('./ipc/http-server');
const {registerTrayIpcHandlers} = require('./ipc/tray');
const {registerHardwareAccelerationIpcHandlers} = require('./ipc/hardware-acceleration');
const {registerSecurityIntegration} = require('./security/security-integration');
const {registerExtensionsIpcHandlers} = require('./ipc/extensions');

// 导入音乐库相关IPC
const {registerLibraryPlaylistIpcHandlers} = require('./ipc/library/playlist');
const {registerLibraryCacheIpcHandlers} = require('./ipc/library/cache');
const {registerLibraryQueryIpcHandlers} = require('./ipc/library/query');
const {registerLibraryScanIpcHandlers} = require('./ipc/library/scan');
const {registerLibraryMetadataIpcHandlers} = require('./ipc/library/metadata');

const {parseMetadata} = metadataUtils;

const {
    setWindowReferences,
    createWindow: createWindowFromUtils,
} = windowUtils;

// 创建包装函数以保持向后兼容性
async function parseMetadataWrapper(filePath) {
    return await parseMetadata(filePath, networkFileAdapter);
}

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let desktopLyricsWindow = null; // 桌面歌词窗口
let libraryCacheManager = null; // 初始化音乐库缓存管理器

// 初始化网络磁盘管理器
let networkDriveManager = null;
let networkFileAdapter = null;

// 初始化网络磁盘管理器
async function initializeNetworkDriveManager() {
    try {
        if (networkDriveManager) {
            console.log('🔧 NetworkDriveManager已存在，跳过重复初始化');
            return true;
        }

        console.log('🔧 创建新的NetworkDriveManager实例');
        networkDriveManager = new NetworkDriveManager();

        // 初始化WebDAV模块
        console.log('🔧 初始化WebDAV模块并加载状态');
        await networkDriveManager.initialize();

        console.log('🔧 创建NetworkFileAdapter实例');
        networkFileAdapter = new NetworkFileAdapter(networkDriveManager);

        // 监听网络磁盘事件
        networkDriveManager.on('driveConnected', (driveId, config) => {
            console.log(`🔗 网络磁盘已连接: ${config.displayName}`);
            // 通知渲染进程
            if (mainWindow) {
                mainWindow.webContents.send('network-drive:connected', driveId, config);
            }
        });

        networkDriveManager.on('driveDisconnected', (driveId, config) => {
            console.log(`🔌 网络磁盘已断开: ${config.displayName}`);
            // 通知渲染进程
            if (mainWindow) {
                mainWindow.webContents.send('network-drive:disconnected', driveId, config);
            }
        });

        networkDriveManager.on('driveError', (driveId, error) => {
            console.error(`❌ 网络磁盘错误: ${driveId} - ${error}`);
            // 通知渲染进程
            if (mainWindow) {
                mainWindow.webContents.send('network-drive:error', driveId, error);
            }
        });
        return true;
    } catch (error) {
        console.error('❌ 网络磁盘管理器初始化失败:', error);
        return false;
    }
}

// 初始化缓存管理器
async function initializeCacheManager() {
    try {
        // 确保网络磁盘管理器已初始化
        if (!networkDriveManager) {
            console.log('🔧 LibraryCacheManager: 网络磁盘管理器未初始化，先初始化...');
            await initializeNetworkDriveManager();
        } else {
            console.log('🔧 LibraryCacheManager: 复用现有的网络磁盘管理器实例');
            // 调试：显示当前已挂载的驱动器
            const mountedDrives = Array.from(networkDriveManager.mountedDrives.keys());
            console.log(`🔍 当前已挂载的驱动器: [${mountedDrives.join(', ')}]`);
        }

        // 确保网络文件适配器已初始化
        if (!networkFileAdapter) {
            console.log('🔧 LibraryCacheManager: 网络文件适配器未初始化，创建新实例');
            networkFileAdapter = new NetworkFileAdapter(networkDriveManager);
        } else {
            console.log('🔧 LibraryCacheManager: 复用现有的网络文件适配器实例');
        }

        libraryCacheManager = new LibraryCacheManager(networkFileAdapter);
        await libraryCacheManager.loadCache();

        return true;
    } catch (error) {
        console.error('❌ 音乐库缓存管理器初始化失败:', error);
        return false;
    }
}

// 窗口管理包装函数，保持全局变量同步
async function createWindow() {
    mainWindow = await createWindowFromUtils();
    setWindowReferences(mainWindow, desktopLyricsWindow);
    return mainWindow;
}

// app事件处理程序
app.whenReady().then(async () => {
    if (typeof global.gc === 'function') {
        console.log('✅ 主进程: 垃圾回收功能在 app.ready 后可用');
    } else {
        // 手动启用
        try {
            require('v8').setFlagsFromString('--expose_gc');
            global.gc = require('vm').runInNewContext('gc');
            console.log('🔧 主进程: 尝试手动启用垃圾回收功能');
        } catch (manualError) {
            console.warn('⚠️ 主进程: 手动启用垃圾回收失败:', manualError.message);
        }
    }

    const {initializeGlobalDriveRegistry} = require('./drive-registry');
    await initializeGlobalDriveRegistry();
    await initializeNetworkDriveManager();
    await initializeCacheManager();
    await metadataHandler.initialize();

    await createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (networkDriveManager) {
        networkDriveManager.cleanup();
    }
});

// 音频引擎状态管理
let audioEngineState = {
    isInitialized: false,
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    position: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1
};

// 注册音频IPC
registerAudioIpcHandlers({
    ipcMain,
    audioEngineState,
    parseMetadata: (filePath) => parseMetadataWrapper(filePath)
});

// 注册对话框IPC
registerDialogIpcHandlers({ipcMain});

// 注册窗口控制IPC
registerWindowIpcHandlers({ipcMain});

// 注册系统IPC
registerFsIpcHandlers({ipcMain});
registerOsIpcHandlers({ipcMain});
registerPathIpcHandlers({ipcMain});

// 注册封面IPC
registerCoversIpcHandlers({ipcMain});

// 注册歌词IPC
registerLyricsIpcHandlers({ipcMain, networkFileAdapter});

// 注册网络磁盘IPC
registerNetworkDriveIpcHandlers({
    ipcMain,
    getNetworkDriveManager: () => networkDriveManager,
    initializeNetworkDriveManager,
    getNetworkFileAdapter: () => networkFileAdapter,
});

// 注册桌面歌词IPC
registerDesktopLyricsIpcHandlers({ipcMain});

// 注册App IPC
registerAppIpcHandlers({ipcMain});

// 注册全局快捷键IPC
registerGlobalShortcutsIpcHandlers({ipcMain});

// 注册音乐库歌单管理IPC
registerLibraryPlaylistIpcHandlers({
    ipcMain,
    getLibraryCacheManager: () => libraryCacheManager,
    initializeCacheManager,
});

// 注册音乐库缓存管理IPC
registerLibraryCacheIpcHandlers({
    ipcMain,
    getLibraryCacheManager: () => libraryCacheManager,
    initializeCacheManager,
    audioEngineState,
    getNetworkDriveManager: () => networkDriveManager,
});

// 注册音乐库查询IPC
registerLibraryQueryIpcHandlers({ipcMain, audioEngineState});

// 注册音乐库元数据IPC
registerLibraryMetadataIpcHandlers(
    {
        ipcMain,
        parseMetadata: (filePath) => parseMetadataWrapper(filePath),
        metadataHandler,
        getNetworkFileAdapter: () => networkFileAdapter,
        getLibraryCacheManager: () => libraryCacheManager,
        audioEngineState,
    }
)

// 注册音乐库扫描IPC
registerLibraryScanIpcHandlers({
    ipcMain,
    mainWindow,
    getLibraryCacheManager: () => libraryCacheManager,
    initializeCacheManager,
    getNetworkDriveManager: () => networkDriveManager,
    getNetworkFileAdapter: () => networkFileAdapter,
    parseMetadata: (filePath) => parseMetadataWrapper(filePath),
    audioEngineState,
});

// 注册 Settings IPC
registerSettingsIpcHandlers({ipcMain});

// 注册硬件加速IPC
registerHardwareAccelerationIpcHandlers({ipcMain});

// 注册系统托盘IPC
registerTrayIpcHandlers({ipcMain});

// 加载托盘设置
const {loadTraySettings} = require('./ipc/tray');
loadTraySettings();

// 注册内存管理IPC
const {registerMemoryIpcHandlers} = require('./ipc/memory');
registerMemoryIpcHandlers({ipcMain});

// 注册HTTP服务器IPC
registerHttpServerIpcHandlers({ipcMain});

// 注册扩展管理IPC
registerExtensionsIpcHandlers({ipcMain, mainWindow});

// 注册安全/集成 IPC
registerSecurityIntegration({isDev});

// 文件读取IPC处理程序
ipcMain.handle('file:readAudio', async (event, filePath) => {
    const fs = require('fs');
    try {
        console.log(`📖 读取音频文件: ${filePath}`);

        // 检查是否为网络路径
        if (networkFileAdapter && networkFileAdapter.isNetworkPath(filePath)) {
            console.log(`🌐 读取网络音频文件: ${filePath}`);
            const buffer = await networkFileAdapter.readFile(filePath);
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } else {
            // 本地文件读取
            const buffer = fs.readFileSync(filePath);
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
    } catch (error) {
        console.error('❌ 读取音频文件失败:', error);
        throw error;
    }
});

ipcMain.on('window-close', () => {
    mainWindow.close();
});
