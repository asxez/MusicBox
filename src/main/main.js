const path = require('path');
const fs = require('fs');
const {app, BrowserWindow, ipcMain, Menu} = require('electron');

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

const LibraryCacheManager = require('./services/library/LibraryCacheManager');
const NetworkDriveManager = require('./services/network/NetworkDriveManager');
const NetworkFileAdapter = require('./services/network/NetworkFileAdapter');
const metadataHandler = require('./services/library/MetadataHandler');

// 导入工具函数
const metadataUtils = require('./utils/metadata');
const windowUtils = require('./core/window');

const {registerAudioIpcHandlers} = require('./ipc/audio');
const {registerDialogIpcHandlers} = require('./ipc/dialog');
const {registerWindowIpcHandlers} = require('./ipc/window');
const {registerFsIpcHandlers} = require('./ipc/fs');
const {registerOsIpcHandlers} = require('./ipc/os');
const {registerPathIpcHandlers} = require('./ipc/path');
const {registerNetworkDriveIpcHandlers} = require('./ipc/NetworkDrive');
const {registerDesktopLyricsIpcHandlers} = require('./ipc/DesktopLyrics');
const {registerLyricsIpcHandlers} = require('./ipc/lyrics');
const {registerCoversIpcHandlers} = require('./ipc/covers');
const {registerGlobalShortcutsIpcHandlers} = require('./ipc/GlobalShortcuts');
const {registerSettingsIpcHandlers} = require('./ipc/settings');
const {registerAppIpcHandlers} = require('./ipc/app');
const {registerHttpServerIpcHandlers} = require('./ipc/HttpServer');
const {registerTrayIpcHandlers} = require('./ipc/tray');
const {registerHardwareAccelerationIpcHandlers} = require('./ipc/HardwareAcceleration');
const {registerSecurityIntegration} = require('./security/SecurityIntegration');
const {registerExtensionsIpcHandlers} = require('./ipc/extensions');
const {registerUserDataIpcHandlers} = require('./ipc/userdata');

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

const isDev = !app.isPackaged;
let mainWindow;
let desktopLyricsWindow = null; // 桌面歌词窗口
let libraryCacheManager = null; // 初始化音乐库缓存管理器
let autoScanScheduler = null; // 自动扫描调度器

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

// 初始化网络磁盘管理器
let networkDriveManager = null;
let networkFileAdapter = null;

// 初始化网络磁盘管理器
async function initializeNetworkDriveManager() {
    try {
        if (networkDriveManager) {
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
            if (mainWindow) {
                mainWindow.webContents.send('network-drive:disconnected', driveId, config);
            }
        });

        networkDriveManager.on('driveError', (driveId, error) => {
            console.error(`❌ 网络磁盘错误: ${driveId} - ${error}`);
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

// 初始化自动扫描调度器
async function initializeAutoScanScheduler() {
    try {
        if (autoScanScheduler) {
            return true;
        }

        const AutoScanScheduler = require('./services/library/AutoScanScheduler');
        autoScanScheduler = new AutoScanScheduler();

        // 扫描处理函数
        const scanHandler = async (folders) => {
            for (const folder of folders) {
                try {
                    console.log(`🔍 自动扫描文件夹: ${folder}`);
                    await scanLocalDirectory(folder);
                } catch (error) {
                    console.error(`❌ 扫描文件夹失败 ${folder}:`, error);
                }
            }
        };

        // 设置加载函数
        const settingsLoader = async () => {
            const userDataPath = app.getPath('userData');
            const settingsFilePath = path.join(userDataPath, 'music-folders-settings.json');

            try {
                const data = await fs.promises.readFile(settingsFilePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                // 文件不存在或解析失败
            }

            return {
                musicFolders: [],
                autoScanEnabled: false,
                scanFrequency: 'on_startup',
                lastScanTime: 0
            };
        };

        // 扫描本地目录的辅助函数
        const scanLocalDirectory = async (directoryPath) => {
            const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.ape'];
            const tracksToCache = [];

            async function scanDir(dir) {
                try {
                    const items = await fs.promises.readdir(dir);
                    for (const item of items) {
                        const fullPath = path.join(dir, item);
                        const stat = await fs.promises.stat(fullPath);
                        if (stat.isDirectory()) {
                            await scanDir(fullPath);
                        } else if (audioExtensions.includes(path.extname(item).toLowerCase())) {
                            try {
                                const metadata = await parseMetadataWrapper(fullPath);
                                const trackData = {
                                    filePath: fullPath,
                                    fileName: item,
                                    title: metadata.title,
                                    artist: metadata.artist,
                                    album: metadata.album,
                                    duration: metadata.duration,
                                    bitrate: metadata.bitrate,
                                    sampleRate: metadata.sampleRate,
                                    year: metadata.year,
                                    genre: metadata.genre,
                                    track: metadata.track,
                                    disc: metadata.disc,
                                    fileSize: stat.size,
                                    embeddedLyrics: metadata.embeddedLyrics,
                                };
                                tracksToCache.push({trackData, filePath: fullPath, stats: stat});
                            } catch (metadataError) {
                                console.warn(`⚠️ 解析元数据失败: ${fullPath}`, metadataError.message);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`扫描目录错误 ${dir}:`, error.message);
                }
            }

            await scanDir(directoryPath);

            if (libraryCacheManager) {
                if (tracksToCache.length > 0) {
                    libraryCacheManager.addTracks(tracksToCache);
                    libraryCacheManager.addScannedDirectory(directoryPath);
                    await libraryCacheManager.saveCache();
                }

                // 更新audioEngineState并通知渲染进程
                const allTracks = libraryCacheManager.getAllTracks();
                audioEngineState.scannedTracks = allTracks;

                if (mainWindow && mainWindow.webContents) {
                    console.log(`📢 AutoScan: 通知渲染进程更新，本次扫描 ${tracksToCache.length} 首，总计 ${allTracks.length} 首歌曲`);
                    mainWindow.webContents.send('library:updated', allTracks);
                }
            }
        };

        autoScanScheduler.initialize(scanHandler, settingsLoader);
        return true;
    } catch (error) {
        console.error('❌ 自动扫描调度器初始化失败:', error);
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
    Menu.setApplicationMenu(null);
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

    const {initializeGlobalDriveRegistry} = require('./services/network/DriveRegistry');
    await initializeGlobalDriveRegistry();
    await initializeNetworkDriveManager();
    await initializeCacheManager();
    await metadataHandler.initialize();

    await createWindow();

    // 确保渲染进程已准备好接收library:updated事件
    if (mainWindow) {
        // 初始化并启动自动扫描调度器
        await initializeAutoScanScheduler();
        if (autoScanScheduler) {
            await autoScanScheduler.start();
        }
    }

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

const {cleanupTempFile} = require('./ipc/NativeAudio');
app.on('before-quit', () => {
    if (networkDriveManager) {
        networkDriveManager.cleanup();
    }
    if (autoScanScheduler) {
        autoScanScheduler.stop();
    }
    cleanupTempFile();
});

// 注册音频IPC
registerAudioIpcHandlers({
    ipcMain,
    audioEngineState,
    parseMetadata: (filePath) => parseMetadataWrapper(filePath)
});

// 注册原生音频引擎IPC
const {registerNativeAudioIpcHandlers} = require('./ipc/NativeAudio');
const nativeModulePath = path.join(__dirname, 'NativeAudio.node');
if (fs.existsSync(nativeModulePath)) {
    const nativeAudioModule = require(nativeModulePath);
    registerNativeAudioIpcHandlers({
        ipcMain,
        nativeAudioModule,
        getMainWindow: () => mainWindow,
        getNetworkFileAdapter: () => networkFileAdapter
    });
    console.log('✅ Native音频模块加载成功');
} else {
    console.log('ℹ️ Native音频模块不存在，将使用WebAudio引擎');
}

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
    getMainWindow: () => mainWindow,
    getLibraryCacheManager: () => libraryCacheManager,
    initializeCacheManager,
    getNetworkDriveManager: () => networkDriveManager,
    getNetworkFileAdapter: () => networkFileAdapter,
    parseMetadata: (filePath) => parseMetadataWrapper(filePath),
    audioEngineState,
});

// 注册 Settings IPC
registerSettingsIpcHandlers({ipcMain, app});

// 注册用户数据IPC
registerUserDataIpcHandlers({ipcMain, app});

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
registerExtensionsIpcHandlers({ipcMain, getMainWindow: () => mainWindow});

// 注册安全/集成 IPC
registerSecurityIntegration({isDev});

// 文件读取IPC处理程序
ipcMain.handle('file:readAudio', async (event, filePath) => {
    try {
        console.log(`📖 读取音频文件: ${filePath}`);

        // 检查是否为网络路径
        if (networkFileAdapter && networkFileAdapter.isNetworkPath(filePath)) {
            console.log(`🌐 读取网络音频文件: ${filePath}`);
            const buffer = await networkFileAdapter.readFile(filePath);
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } else {
            // 本地文件读取
            const buffer = await fs.promises.readFile(filePath);
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
    } catch (error) {
        console.error('❌ 读取音频文件失败:', error);
        throw error;
    }
});

ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
});
