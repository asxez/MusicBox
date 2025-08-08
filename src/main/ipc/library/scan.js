// 音乐库 - 扫描 IPC

const fs = require('fs');
const path = require('path');

/**
 * 注册音乐库扫描相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {Electron.BrowserWindow} [deps.mainWindow] - 主窗口，用于发送 library:updated
 * @param {() => any} deps.getLibraryCacheManager
 * @param {() => Promise<boolean>} deps.initializeCacheManager
 * @param {() => any} deps.getNetworkDriveManager
 * @param {() => any} deps.getNetworkFileAdapter
 * @param {(filePath: string) => Promise<any>} deps.parseMetadata
 * @param {object} deps.audioEngineState
 */
function registerLibraryScanIpcHandlers(
    {
        ipcMain,
        mainWindow,
        getLibraryCacheManager,
        initializeCacheManager,
        getNetworkDriveManager,
        getNetworkFileAdapter,
        parseMetadata,
        audioEngineState,
    }
) {
    if (!ipcMain) throw new Error('registerLibraryScanIpcHandlers: 缺少 ipcMain');
    if (!getLibraryCacheManager) throw new Error('registerLibraryScanIpcHandlers: 缺少 getLibraryCacheManager');
    if (!initializeCacheManager) throw new Error('registerLibraryScanIpcHandlers: 缺少 initializeCacheManager');
    if (!getNetworkDriveManager) throw new Error('registerLibraryScanIpcHandlers: 缺少 getNetworkDriveManager');
    if (!getNetworkFileAdapter) throw new Error('registerLibraryScanIpcHandlers: 缺少 getNetworkFileAdapter');
    if (!parseMetadata) throw new Error('registerLibraryScanIpcHandlers: 缺少 parseMetadata');
    if (!audioEngineState) throw new Error('registerLibraryScanIpcHandlers: 缺少 audioEngineState');

    ipcMain.handle('library:scanDirectory', async (event, directoryPath) => {
        try {
            const scanStartTime = Date.now();

            if (!getLibraryCacheManager()) {
                await initializeCacheManager();
            }

            const networkFileAdapter = getNetworkFileAdapter();
            const isNetworkPath = networkFileAdapter && networkFileAdapter.isNetworkPath(directoryPath);
            if (isNetworkPath) {
                return await scanNetworkDirectory(directoryPath, scanStartTime);
            } else {
                return await scanLocalDirectory(directoryPath, scanStartTime);
            }
        } catch (error) {
            console.error('目录扫描失败:', error);
            return false;
        }
    });

    ipcMain.handle('library:scanNetworkDrive', async (event, driveId, relativePath = '/') => {
        try {
            const networkDriveManager = getNetworkDriveManager();
            const networkFileAdapter = getNetworkFileAdapter();
            if (!networkDriveManager || !networkFileAdapter) {
                throw new Error('网络磁盘管理器未初始化');
            }

            if (!getLibraryCacheManager()) {
                console.log('🔧 初始化缓存管理器...');
                await initializeCacheManager();
            }

            const driveInfo = networkDriveManager.getDriveInfo(driveId);
            if (!driveInfo) throw new Error(`网络磁盘 ${driveId} 未找到`);

            const status = networkDriveManager.getDriveStatus(driveId);
            if (!status || !status.connected) throw new Error(`网络磁盘 ${driveId} 未连接`);

            const networkPath = networkFileAdapter.buildNetworkPath(driveId, relativePath);
            console.log(`🌐 扫描网络磁盘: ${driveInfo.config.displayName} - ${networkPath}`);

            const scanStartTime = Date.now();
            return await scanNetworkDirectory(networkPath, scanStartTime);
        } catch (error) {
            console.error('❌ 网络磁盘扫描失败:', error);
            return false;
        }
    });

    // 扫描本地目录
    async function scanLocalDirectory(directoryPath, scanStartTime) {
        const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
        const tracks = [];
        const tracksToCache = [];

        async function scanDir(dir) {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        await scanDir(fullPath);
                    } else if (audioExtensions.includes(path.extname(item).toLowerCase())) {
                        const metadata = await parseMetadata(fullPath);
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
                        tracks.push(trackData);
                        tracksToCache.push({trackData, filePath: fullPath, stats: stat});
                    }
                }
            } catch (error) {
                console.error(`扫描目录错误 ${dir}:`, error.message);
            }
        }

        await scanDir(directoryPath);

        const libraryCacheManager = getLibraryCacheManager();
        if (libraryCacheManager && tracksToCache.length > 0) {
            libraryCacheManager.addTracks(tracksToCache);
            libraryCacheManager.addScannedDirectory(directoryPath);
            const scanDuration = Date.now() - scanStartTime;
            libraryCacheManager.cache.statistics.lastScanTime = scanStartTime;
            libraryCacheManager.cache.statistics.scanDuration = scanDuration;
            await libraryCacheManager.saveCache();
        }

        audioEngineState.scannedTracks = tracks;
        if (mainWindow) {
            mainWindow.webContents.send('library:updated', tracks);
        }
        return true;
    }

    // 扫描网络目录
    async function scanNetworkDirectory(networkPath, scanStartTime) {
        const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
        const tracks = [];
        const tracksToCache = [];
        const networkFileAdapter = getNetworkFileAdapter();

        async function scanNetworkDir(dirPath) {
            try {
                const items = await networkFileAdapter.readdir(dirPath);
                for (const item of items) {
                    const fullPath = networkFileAdapter.joinNetworkPath(dirPath, item);
                    try {
                        const stat = await networkFileAdapter.stat(fullPath);
                        if (stat.isDirectory()) {
                            await scanNetworkDir(fullPath);
                        } else if (audioExtensions.includes(path.extname(item).toLowerCase())) {
                            const metadata = await parseMetadata(fullPath);
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
                                isNetworkFile: true,
                            };
                            tracks.push(trackData);
                            tracksToCache.push({trackData, filePath: fullPath, stats: stat});
                        }
                    } catch (fileError) {
                        console.warn(`⚠️ 处理网络文件失败 ${fullPath}:`, fileError.message);
                    }
                }
            } catch (error) {
                console.error(`❌ 扫描网络目录错误 ${dirPath}:`, error.message);
            }
        }

        await scanNetworkDir(networkPath);

        const libraryCacheManager = getLibraryCacheManager();
        if (libraryCacheManager && tracksToCache.length > 0) {
            libraryCacheManager.addTracks(tracksToCache);
            libraryCacheManager.addScannedDirectory(networkPath);
            const scanDuration = Date.now() - scanStartTime;
            libraryCacheManager.cache.statistics.lastScanTime = scanStartTime;
            libraryCacheManager.cache.statistics.scanDuration = scanDuration;
            await libraryCacheManager.saveCache();
        }

        audioEngineState.scannedTracks = tracks;
        console.log(`✅ 网络扫描完成，找到 ${tracks.length} 个音频文件`);
        if (mainWindow) {
            mainWindow.webContents.send('library:updated', tracks);
        }
        return true;
    }
}

module.exports = {
    registerLibraryScanIpcHandlers,
};
