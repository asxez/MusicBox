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

    // 扫描单个网络文件
    ipcMain.handle('library:scanSingleFile', async (event, networkPath) => {
        try {
            const networkFileAdapter = getNetworkFileAdapter();
            if (!networkFileAdapter) {
                throw new Error('NetworkFileAdapter 未初始化');
            }

            if (!getLibraryCacheManager()) {
                await initializeCacheManager();
            }

            const libraryCacheManager = getLibraryCacheManager();

            // 检查文件是否已在缓存中
            const existingTrack = libraryCacheManager.cache.tracks.find(
                track => track.filePath === networkPath
            );

            if (existingTrack) {
                console.log(`✅ 文件已在缓存中: ${networkPath}`);
                return {success: true, track: existingTrack, isNew: false};
            }

            // 检查文件扩展名
            const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.ape'];
            const ext = path.extname(networkPath).toLowerCase();
            if (!audioExtensions.includes(ext)) {
                return {success: false, error: '不支持的音频格式'};
            }

            // 获取文件统计信息
            const stats = await networkFileAdapter.stat(networkPath);
            const isDir = typeof stats.isDirectory === 'function'
                ? stats.isDirectory()
                : Boolean(stats.isDirectory);

            if (isDir) {
                return {success: false, error: '这是一个文件夹，不是音频文件'};
            }

            // 解析元数据
            console.log(`🎵 开始扫描单个文件: ${networkPath}`);
            const metadata = await parseMetadata(networkPath);
            const fileName = path.basename(networkPath);

            const trackData = {
                filePath: networkPath,
                fileName: fileName,
                title: metadata.title || path.basename(fileName, ext),
                artist: metadata.artist || '未知艺术家',
                album: metadata.album || '未知专辑',
                duration: metadata.duration || 0,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                year: metadata.year,
                genre: metadata.genre,
                track: metadata.track,
                disc: metadata.disc,
                fileSize: stats.size || 0,
                embeddedLyrics: metadata.embeddedLyrics,
                isNetworkFile: true,
            };

            // 添加到缓存
            const addedTracks = libraryCacheManager.addTracks([{
                trackData,
                filePath: networkPath,
                stats: stats
            }]);

            await libraryCacheManager.saveCache();

            console.log(`✅ 单个文件扫描完成: ${trackData.title} - ${trackData.artist}`);

            // 通知渲染进程更新
            if (mainWindow) {
                mainWindow.webContents.send('library:updated', [trackData]);
            }

            return {success: true, track: addedTracks[0], isNew: true};
        } catch (error) {
            console.error('❌ 扫描单个文件失败:', error);
            return {success: false, error: error.message};
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

    // 扫描文件夹中的音频文件但不添加到音乐库
    // 歌单添加功能
    ipcMain.handle('library:scanDirectoryForFiles', async (event, directoryPath) => {
        try {
            const audioExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma'];
            const audioFiles = [];
            const fsPromises = fs.promises;
            const BATCH_SIZE = 20;

            async function collectFiles(dir) {
                const files = [];
                try {
                    const items = await fsPromises.readdir(dir);
                    const itemPaths = items.map(item => path.join(dir, item));
                    const stats = await Promise.all(
                        itemPaths.map(p => fsPromises.stat(p).catch(() => null))
                    );

                    for (let i = 0; i < items.length; i++) {
                        const stat = stats[i];
                        if (!stat) continue;

                        if (stat.isDirectory()) {
                            const subFiles = await collectFiles(itemPaths[i]);
                            files.push(...subFiles);
                        } else if (audioExtensions.includes(path.extname(items[i]).toLowerCase())) {
                            files.push({path: itemPaths[i], stat, name: items[i]});
                        }
                    }
                } catch (error) {
                    console.error(`扫描目录错误 ${dir}:`, error.message);
                }
                return files;
            }

            const files = await collectFiles(directoryPath);

            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                const results = await Promise.all(batch.map(async ({path: fullPath, stat, name}) => {
                    try {
                        const metadata = await parseMetadata(fullPath, null, {skipCover: true, skipLyrics: true});
                        return {
                            filePath: fullPath,
                            fileName: name,
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
                    } catch (metadataError) {
                        console.warn(`⚠️ 解析元数据失败: ${fullPath}`, metadataError.message);
                        return {
                            filePath: fullPath,
                            fileName: name,
                            title: path.basename(name, path.extname(name)),
                            artist: '未知艺术家',
                            album: '未知专辑',
                            duration: 0,
                            fileSize: stat.size,
                        };
                    }
                }));
                audioFiles.push(...results);
            }

            return {success: true, files: audioFiles};
        } catch (error) {
            console.error('❌ 扫描文件夹失败:', error);
            return {success: false, error: error.message, files: []};
        }
    });

    // 添加单个音频文件到音乐库
    ipcMain.handle('library:addTrackToLibrary', async (event, audioFile) => {
        try {
            if (!getLibraryCacheManager()) {
                await initializeCacheManager();
            }

            const libraryCacheManager = getLibraryCacheManager();

            // 检查文件是否已存在
            const existingTrack = libraryCacheManager.cache.tracks.find(
                track => track.filePath === audioFile.filePath
            );

            if (existingTrack) {
                return {success: true, track: existingTrack, isNew: false};
            }

            // 获取文件统计信息
            const fs = require('fs');
            const stats = fs.statSync(audioFile.filePath);

            // 添加到音乐库
            const trackData = {
                title: audioFile.title,
                artist: audioFile.artist,
                album: audioFile.album,
                duration: audioFile.duration,
                bitrate: audioFile.bitrate,
                sampleRate: audioFile.sampleRate,
                year: audioFile.year,
                genre: audioFile.genre,
                track: audioFile.track,
                disc: audioFile.disc,
                embeddedLyrics: audioFile.embeddedLyrics,
            };

            const cacheTrack = libraryCacheManager.addTrack(trackData, audioFile.filePath, stats);
            await libraryCacheManager.saveCache();

            // 更新音频引擎状态
            const tracks = libraryCacheManager.cache.tracks;
            audioEngineState.scannedTracks = tracks;

            // 触发音乐库更新事件
            if (mainWindow) {
                mainWindow.webContents.send('library:updated', tracks);
            }
            return {success: true, track: cacheTrack, isNew: true};
        } catch (error) {
            console.error('❌ 添加音频文件到音乐库失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 扫描本地目录
    async function scanLocalDirectory(directoryPath, scanStartTime) {
        const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
        const tracks = [];
        const tracksToCache = [];
        const fsPromises = fs.promises;
        const BATCH_SIZE = 20;

        async function collectFiles(dir) {
            const files = [];
            try {
                const items = await fsPromises.readdir(dir);
                const itemPaths = items.map(item => path.join(dir, item));
                const stats = await Promise.all(
                    itemPaths.map(p => fsPromises.stat(p).catch(() => null))
                );

                for (let i = 0; i < items.length; i++) {
                    const stat = stats[i];
                    if (!stat) continue;

                    if (stat.isDirectory()) {
                        const subFiles = await collectFiles(itemPaths[i]);
                        files.push(...subFiles);
                    } else if (audioExtensions.includes(path.extname(items[i]).toLowerCase())) {
                        files.push({path: itemPaths[i], stat, name: items[i]});
                    }
                }
            } catch (error) {
                console.error(`扫描目录错误 ${dir}:`, error.message);
            }
            return files;
        }

        async function processBatch(batch) {
            return Promise.all(batch.map(async ({path: fullPath, stat, name}) => {
                try {
                    const metadata = await parseMetadata(fullPath, null, {skipCover: true, skipLyrics: true});
                    return {
                        trackData: {
                            filePath: fullPath,
                            fileName: name,
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
                        },
                        filePath: fullPath,
                        stats: stat
                    };
                } catch (error) {
                    console.warn(`解析失败 ${fullPath}:`, error.message);
                    return null;
                }
            }));
        }

        const files = await collectFiles(directoryPath);
        console.log(`找到 ${files.length} 个音频文件，开始解析...`);

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const results = await processBatch(batch);

            for (const result of results) {
                if (result) {
                    tracks.push(result.trackData);
                    tracksToCache.push(result);
                }
            }

            if (mainWindow && tracks.length > 0) {
                mainWindow.webContents.send('library:scan-progress', {
                    current: i + batch.length,
                    total: files.length,
                    tracks: tracks.length
                });
            }
        }

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
        const BATCH_SIZE = 20;

        async function collectNetworkFiles(dirPath) {
            const files = [];
            try {
                const items = await networkFileAdapter.readdir(dirPath);
                const itemPaths = items.map(item => networkFileAdapter.joinNetworkPath(dirPath, item));
                const stats = await Promise.all(
                    itemPaths.map(p => networkFileAdapter.stat(p).catch(() => null))
                );

                for (let i = 0; i < items.length; i++) {
                    const stat = stats[i];
                    if (!stat) continue;

                    if (stat.isDirectory()) {
                        const subFiles = await collectNetworkFiles(itemPaths[i]);
                        files.push(...subFiles);
                    } else if (audioExtensions.includes(path.extname(items[i]).toLowerCase())) {
                        files.push({path: itemPaths[i], stat, name: items[i]});
                    }
                }
            } catch (error) {
                console.error(`❌ 扫描网络目录错误 ${dirPath}:`, error.message);
            }
            return files;
        }

        async function processBatch(batch) {
            return Promise.all(batch.map(async ({path: fullPath, stat, name}) => {
                try {
                    const metadata = await parseMetadata(fullPath, networkFileAdapter, {
                        skipCover: true,
                        skipLyrics: true
                    });
                    return {
                        trackData: {
                            filePath: fullPath,
                            fileName: name,
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
                        },
                        filePath: fullPath,
                        stats: stat
                    };
                } catch (error) {
                    console.warn(`⚠️ 处理网络文件失败 ${fullPath}:`, error.message);
                    return null;
                }
            }));
        }

        const files = await collectNetworkFiles(networkPath);
        console.log(`找到 ${files.length} 个网络音频文件，开始解析...`);

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const results = await processBatch(batch);

            for (const result of results) {
                if (result) {
                    tracks.push(result.trackData);
                    tracksToCache.push(result);
                }
            }

            if (mainWindow && tracks.length > 0) {
                mainWindow.webContents.send('library:scan-progress', {
                    current: i + batch.length,
                    total: files.length,
                    tracks: tracks.length
                });
            }
        }

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
