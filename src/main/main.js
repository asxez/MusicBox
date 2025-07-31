const {app, BrowserWindow, ipcMain, dialog, shell, globalShortcut} = require('electron');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const chardet = require('chardet');
const mm = require('music-metadata');
const LibraryCacheManager = require('./library-cache-manager');

// 全局元数据解析函数
async function parseMetadata(filePath) {
    try {
        console.log(`🔍 解析音频元数据: ${filePath}`);

        // 使用 music-metadata 库解析音频文件元数据
        const metadata = await mm.parseFile(filePath);

        // 提取基本信息
        const title = metadata.common.title || path.basename(filePath, path.extname(filePath));
        const artist = metadata.common.artist || metadata.common.albumartist || '未知艺术家';
        const album = metadata.common.album || '未知专辑';
        const duration = metadata.format.duration || 0;
        const bitrate = metadata.format.bitrate || 0;
        const sampleRate = metadata.format.sampleRate || 0;
        const year = metadata.common.year || metadata.common.date || null;
        const genre = metadata.common.genre ? metadata.common.genre.join(', ') : null;
        const track = metadata.common.track ? metadata.common.track.no : null;
        const disc = metadata.common.disk ? metadata.common.disk.no : null;

        // 提取专辑封面
        let cover = null;
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            cover = {
                format: picture.format,
                data: picture.data
            };
        }

        console.log(`✅ 元数据解析成功: ${title} - ${artist}`);

        return {
            title,
            artist,
            album,
            duration,
            bitrate,
            sampleRate,
            year,
            genre,
            track,
            disc,
            cover
        };
    } catch (error) {
        console.warn(`⚠️ 使用music-metadata解析失败，回退到文件名解析: ${error.message}`);

        // 回退到文件名解析
        const fileName = path.basename(filePath, path.extname(filePath));
        let artist = '未知艺术家';
        let title = fileName;
        let album = '未知专辑';

        // 检查是否包含分隔符
        const separators = [' - ', ' – ', ' — ', '-'];
        for (const sep of separators) {
            if (fileName.includes(sep)) {
                const parts = fileName.split(sep);
                if (parts.length >= 2) {
                    artist = parts[0].trim();
                    title = parts.slice(1).join(sep).trim();
                    break;
                }
            }
        }

        // 尝试从目录结构获取专辑信息
        const dirName = path.basename(path.dirname(filePath));
        if (dirName && dirName !== '.' && !dirName.includes('\\') && !dirName.includes('/')) {
            if (dirName.length > 0 && dirName.length < 100) {
                album = dirName;
            }
        }

        return {
            title,
            artist,
            album,
            duration: 0,
            bitrate: 0,
            sampleRate: 0,
            year: null,
            genre: null,
            track: null,
            disc: null,
            cover: null
        };
    }
}

const isDev = process.env.NODE_ENV === 'development';

// Keep a global reference of the window object
let mainWindow;

async function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1080,
        minHeight: 720,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load the app
    let htmlPath;

    if (isDev) {
        // 开发环境：从源码目录加载
        htmlPath = path.join(__dirname, '../renderer/public/index.html');
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
        console.log(`✅ HTML文件加载成功: ${htmlPath}`);
    } catch (error) {
        console.error(`❌ HTML文件加载失败: ${error.message}`);
        console.error(`❌ 尝试的路径: ${htmlPath}`);

        // 如果加载失败，尝试备用路径
        const fallbackPath = path.join(__dirname, '../renderer/public/index.html');
        console.log(`🔄 尝试备用路径: ${fallbackPath}`);
        try {
            await mainWindow.loadFile(fallbackPath);
            console.log(`✅ 备用路径加载成功: ${fallbackPath}`);
        } catch (fallbackError) {
            console.error(`❌ 备用路径也失败: ${fallbackError.message}`);
        }
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: 'deny'};
    });
}

// App event handlers
app.whenReady().then(async () => {
    // 初始化缓存管理器
    await initializeCacheManager();

    createWindow();

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

// IPC handlers
ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
    return process.platform;
});

// 通用目录选择对话框（返回字符串路径，用于音乐目录扫描等）
ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Music Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0]; // 返回字符串路径，保持向后兼容
    }
    return null;
});

// 设置页面专用的目录选择对话框（返回完整对象格式）
ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return {filePaths: result.filePaths, canceled: result.canceled};
    }
    return {filePaths: [], canceled: true};
});

ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            {
                name: 'Audio Files',
                extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma']
            }
        ],
        title: 'Select Music Files'
    });

    if (!result.canceled) {
        return result.filePaths;
    }
    return [];
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

// 初始化音乐库缓存管理器
let libraryCacheManager = null;

// 初始化缓存管理器
async function initializeCacheManager() {
    try {
        libraryCacheManager = new LibraryCacheManager();
        await libraryCacheManager.loadCache();
        console.log('✅ 音乐库缓存管理器初始化成功');
        return true;
    } catch (error) {
        console.error('❌ 音乐库缓存管理器初始化失败:', error);
        return false;
    }
}

console.log('🎵 使用JavaScript音频引擎');

// 音频引擎IPC处理程序
ipcMain.handle('audio:init', async () => {
    try {
        audioEngineState.isInitialized = true;
        console.log('🎵 JavaScript音频引擎初始化成功');
        return true;
    } catch (error) {
        console.error('❌ 音频引擎初始化失败:', error);
        return false;
    }
});

ipcMain.handle('audio:loadTrack', async (event, filePath) => {
    try {
        console.log(`🔄 加载音频文件: ${filePath}`);

        // 获取完整的元数据信息
        const metadata = await parseMetadata(filePath);

        // 更新状态
        audioEngineState.currentTrack = {
            filePath: filePath,
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
            cover: metadata.cover
        };

        console.log(`✅ 音频文件信息已更新: ${audioEngineState.currentTrack.title} (${metadata.duration.toFixed(2)}s)`);
        return true;
    } catch (error) {
        console.error('❌ 加载音频文件失败:', error);
        return false;
    }
});

ipcMain.handle('audio:play', async () => {
    try {
        audioEngineState.isPlaying = true;
        console.log('▶️ 播放状态已更新');
        return true;
    } catch (error) {
        console.error('❌ 播放失败:', error);
        return false;
    }
});

ipcMain.handle('audio:pause', async () => {
    try {
        audioEngineState.isPlaying = false;
        console.log('⏸️ 暂停状态已更新');
        return true;
    } catch (error) {
        console.error('❌ 暂停失败:', error);
        return false;
    }
});

ipcMain.handle('audio:stop', async () => {
    try {
        audioEngineState.isPlaying = false;
        audioEngineState.position = 0;
        console.log('⏹️ 停止状态已更新');
        return true;
    } catch (error) {
        console.error('❌ 停止失败:', error);
        return false;
    }
});

ipcMain.handle('audio:seek', async (event, position) => {
    try {
        audioEngineState.position = Math.max(0, position);
        console.log(`⏭️ 跳转到位置: ${position.toFixed(2)}s`);
        return true;
    } catch (error) {
        console.error('❌ 跳转失败:', error);
        return false;
    }
});

ipcMain.handle('audio:setVolume', async (event, volume) => {
    try {
        audioEngineState.volume = Math.max(0, Math.min(1, volume));
        console.log(`🔊 音量设置为: ${(audioEngineState.volume * 100).toFixed(0)}%`);
        return true;
    } catch (error) {
        console.error('❌ 音量设置失败:', error);
        return false;
    }
});

ipcMain.handle('audio:getVolume', async () => {
    return audioEngineState.volume;
});

ipcMain.handle('audio:getPosition', async () => {
    return audioEngineState.position;
});

ipcMain.handle('audio:getDuration', async () => {
    return audioEngineState.currentTrack ? audioEngineState.currentTrack.duration : 0;
});

ipcMain.handle('audio:getCurrentTrack', async () => {
    return audioEngineState.currentTrack || {
        filePath: '',
        title: '未选择音频文件',
        artist: '未知艺术家',
        album: '未知专辑',
        duration: 0
    };
});

// 播放列表和导航IPC处理程序
ipcMain.handle('audio:setPlaylist', async (event, tracks) => {
    try {
        audioEngineState.playlist = tracks;
        audioEngineState.currentIndex = 0;
        console.log(`📋 播放列表已设置: ${tracks.length}首歌曲`);
        return true;
    } catch (error) {
        console.error('❌ 设置播放列表失败:', error);
        return false;
    }
});

ipcMain.handle('audio:nextTrack', async () => {
    try {
        if (audioEngineState.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        audioEngineState.currentIndex = (audioEngineState.currentIndex + 1) % audioEngineState.playlist.length;
        const nextTrack = audioEngineState.playlist[audioEngineState.currentIndex];

        console.log(`⏭️ 切换到下一首: ${nextTrack.title || nextTrack.filePath}`);

        // 更新当前曲目
        audioEngineState.currentTrack = nextTrack;
        return true;
    } catch (error) {
        console.error('❌ 播放下一首失败:', error);
        return false;
    }
});

ipcMain.handle('audio:previousTrack', async () => {
    try {
        if (audioEngineState.playlist.length === 0) {
            console.log('⚠️ 播放列表为空');
            return false;
        }

        audioEngineState.currentIndex = audioEngineState.currentIndex > 0
            ? audioEngineState.currentIndex - 1
            : audioEngineState.playlist.length - 1;

        const prevTrack = audioEngineState.playlist[audioEngineState.currentIndex];

        console.log(`⏮️ 切换到上一首: ${prevTrack.title || prevTrack.filePath}`);

        // 更新当前曲目
        audioEngineState.currentTrack = prevTrack;
        return true;
    } catch (error) {
        console.error('❌ 播放上一首失败:', error);
        return false;
    }
});

// 文件读取IPC处理程序
ipcMain.handle('file:readAudio', async (event, filePath) => {
    try {
        console.log(`📖 读取音频文件: ${filePath}`);
        const buffer = fs.readFileSync(filePath);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
        console.error('❌ 读取音频文件失败:', error);
        throw error;
    }
});

// 音乐库IPC处理程序
ipcMain.handle('library:scanDirectory', async (event, directoryPath) => {
    try {
        console.log(`📁 扫描目录: ${directoryPath}`);
        const scanStartTime = Date.now();

        // 确保缓存管理器已初始化
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        // 使用Node.js文件系统扫描音频文件
        const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
        const tracks = [];
        const tracksToCache = [];

        async function scanDir(dir) {
            try {
                const items = require('fs').readdirSync(dir);
                for (const item of items) {
                    const fullPath = require('path').join(dir, item);
                    const stat = require('fs').statSync(fullPath);

                    if (stat.isDirectory()) {
                        await scanDir(fullPath); // 递归扫描子目录
                    } else if (audioExtensions.includes(require('path').extname(item).toLowerCase())) {
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
                            fileSize: stat.size
                        };

                        tracks.push(trackData);

                        // 准备缓存数据
                        tracksToCache.push({
                            trackData,
                            filePath: fullPath,
                            stats: stat
                        });
                    }
                }
            } catch (error) {
                console.error(`扫描目录错误 ${dir}:`, error.message);
            }
        }

        await scanDir(directoryPath);

        // 添加到缓存
        if (libraryCacheManager && tracksToCache.length > 0) {
            libraryCacheManager.addTracks(tracksToCache);
            libraryCacheManager.addScannedDirectory(directoryPath);

            // 更新扫描统计
            const scanDuration = Date.now() - scanStartTime;
            libraryCacheManager.cache.statistics.lastScanTime = scanStartTime;
            libraryCacheManager.cache.statistics.scanDuration = scanDuration;

            await libraryCacheManager.saveCache();
        }

        // 存储扫描结果到内存
        audioEngineState.scannedTracks = tracks;

        console.log(`✅ 扫描完成，找到 ${tracks.length} 个音频文件`);
        return true;
    } catch (error) {
        console.error('❌ 目录扫描失败:', error);
        return false;
    }
});

ipcMain.handle('library:getTracks', async () => {
    return audioEngineState.scannedTracks || [];
});

// 音乐库缓存相关IPC处理程序
ipcMain.handle('library:loadCachedTracks', async () => {
    try {
        // 确保缓存管理器已初始化
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const cachedTracks = libraryCacheManager.getAllTracks();

        // 将缓存的音乐文件加载到内存状态
        audioEngineState.scannedTracks = cachedTracks;

        console.log(`✅ 从缓存加载 ${cachedTracks.length} 个音乐文件`);
        return cachedTracks;
    } catch (error) {
        console.error('❌ 加载缓存音乐库失败:', error);
        return [];
    }
});

ipcMain.handle('library:validateCache', async (event) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        console.log('🔍 开始验证音乐库缓存...');

        const validation = await libraryCacheManager.validateCachedTracks((progress) => {
            // 发送验证进度到渲染进程
            event.sender.send('library:cacheValidationProgress', progress);
        });

        // 移除无效的缓存条目
        if (validation.invalid.length > 0) {
            libraryCacheManager.removeInvalidTracks(validation.invalid);
        }

        // 保存更新后的缓存
        await libraryCacheManager.saveCache();

        // 更新内存中的音乐库
        const validTracks = libraryCacheManager.getAllTracks();
        audioEngineState.scannedTracks = validTracks;

        console.log(`✅ 缓存验证完成 - 有效: ${validation.valid.length}, 无效: ${validation.invalid.length}, 已修改: ${validation.modified.length}`);

        return {
            valid: validation.valid.length,
            invalid: validation.invalid.length,
            modified: validation.modified.length,
            tracks: validTracks
        };
    } catch (error) {
        console.error('❌ 缓存验证失败:', error);
        return null;
    }
});

ipcMain.handle('library:getCacheStatistics', async () => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        return libraryCacheManager.getCacheStatistics();
    } catch (error) {
        console.error('❌ 获取缓存统计失败:', error);
        return null;
    }
});

ipcMain.handle('library:clearCache', async () => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const success = await libraryCacheManager.clearCache();

        if (success) {
            // 清空内存中的音乐库
            audioEngineState.scannedTracks = [];
            console.log('✅ 音乐库缓存已清空');
        }

        return success;
    } catch (error) {
        console.error('❌ 清空缓存失败:', error);
        return false;
    }
});

ipcMain.handle('library:getTrackMetadata', async (event, filePath) => {
    try {
        console.log(`📋 获取音频文件元数据: ${filePath}`);

        // 使用统一的元数据解析函数
        const metadata = await parseMetadata(filePath);

        return {
            filePath: filePath,
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
            cover: metadata.cover
        };
    } catch (error) {
        console.error('❌ 获取元数据失败:', error);
        return null;
    }
});

ipcMain.handle('library:search', async (event, query) => {
    try {
        console.log(`🔍 搜索音乐库: ${query}`);

        if (!audioEngineState.scannedTracks) {
            return [];
        }

        const searchTerm = query.trim().toLowerCase();
        const results = audioEngineState.scannedTracks.filter(track => {
            return track.title.toLowerCase().includes(searchTerm) ||
                track.artist.toLowerCase().includes(searchTerm) ||
                track.album.toLowerCase().includes(searchTerm) ||
                track.fileName.toLowerCase().includes(searchTerm);
        });

        console.log(`✅ 搜索完成，找到 ${results.length} 个结果`);
        return results;
    } catch (error) {
        console.error('❌ 搜索失败:', error);
        return [];
    }
});

// Settings IPC Handlers
const settings = new Map();

ipcMain.handle('settings:get', async (event, key) => {
    return settings.get(key) || null;
});

ipcMain.handle('settings:set', async (event, key, value) => {
    settings.set(key, value);
    return true;
});

// 本地歌词文件IPC处理器
ipcMain.handle('lyrics:readLocalFile', async (event, filePath) => {
    try {
        console.log(`📖 读取本地歌词文件: ${filePath}`);
        const buffer = fs.readFileSync(filePath);
        const detectedEncoding = chardet.detect(buffer) || 'utf8';
        console.log(`🔍 检测到文件编码: ${detectedEncoding}`);
        const utf8Content = iconv.decode(buffer, detectedEncoding);
        console.log('✅ 文件内容转换成功');
        return {success: true, content: utf8Content};
    } catch (error) {
        console.error('❌ 读取本地歌词文件失败:', error);
        return {success: false, error: error.message};
    }
});


ipcMain.handle('lyrics:searchLocalFiles', async (event, lyricsDir, title, artist, album) => {
    try {
        console.log(`🔍 搜索本地歌词文件: ${title} - ${artist} 在目录 ${lyricsDir}`);

        if (!fs.existsSync(lyricsDir)) {
            return {success: false, error: '歌词目录不存在'};
        }

        const files = fs.readdirSync(lyricsDir);
        const lrcFiles = files.filter(file => path.extname(file).toLowerCase() === '.lrc');

        // 生成可能的文件名匹配模式
        const searchPatterns = generateLyricsSearchPatterns(title, artist, album);

        // 查找匹配的文件
        const matchedFile = findBestLyricsMatch(lrcFiles, searchPatterns);

        if (matchedFile) {
            const fullPath = path.join(lyricsDir, matchedFile);
            console.log(`✅ 找到匹配的歌词文件: ${matchedFile}`);
            return {success: true, filePath: fullPath, fileName: matchedFile};
        } else {
            console.log(`❌ 未找到匹配的歌词文件`);
            return {success: false, error: '未找到匹配的歌词文件'};
        }
    } catch (error) {
        console.error('❌ 搜索本地歌词文件失败:', error);
        return {success: false, error: error.message};
    }
});

// 生成歌词文件搜索模式
function generateLyricsSearchPatterns(title, artist, album) {
    const patterns = [];

    // 清理文件名中的特殊字符
    const cleanTitle = cleanFileName(title);
    const cleanArtist = cleanFileName(artist);
    const cleanAlbum = cleanFileName(album);

    // 生成不同的变体
    const titleVariants = generateTextVariants(cleanTitle);
    const artistVariants = generateTextVariants(cleanArtist);

    // 常见的歌词文件命名格式（按优先级排序）
    if (cleanTitle && cleanArtist) {
        // 标准格式
        for (const titleVar of titleVariants) {
            for (const artistVar of artistVariants) {
                patterns.push(`${artistVar} - ${titleVar}.lrc`);
                patterns.push(`${titleVar} - ${artistVar}.lrc`);
                patterns.push(`${artistVar}-${titleVar}.lrc`);
                patterns.push(`${titleVar}-${artistVar}.lrc`);
                patterns.push(`${artistVar}_${titleVar}.lrc`);
                patterns.push(`${titleVar}_${artistVar}.lrc`);
            }
        }
    }

    // 仅标题格式
    if (cleanTitle) {
        for (const titleVar of titleVariants) {
            patterns.push(`${titleVar}.lrc`);
        }
    }

    // 包含专辑信息的格式
    if (cleanTitle && cleanArtist && cleanAlbum) {
        const cleanAlbumVar = cleanFileName(cleanAlbum);
        patterns.push(`${cleanArtist} - ${cleanAlbumVar} - ${cleanTitle}.lrc`);
        patterns.push(`${cleanAlbumVar} - ${cleanArtist} - ${cleanTitle}.lrc`);
    }

    return patterns;
}

// 生成文本变体（处理不同的命名风格）
function generateTextVariants(text) {
    if (!text) return [''];

    const variants = new Set();
    const cleaned = cleanFileName(text);

    // 原始文本
    variants.add(cleaned);

    // 移除括号内容 (feat. xxx), [xxx], 等
    const withoutBrackets = cleaned.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim();
    if (withoutBrackets && withoutBrackets !== cleaned) {
        variants.add(withoutBrackets);
    }

    // 移除常见后缀
    const suffixesToRemove = [
        'feat\\.',
        'ft\\.',
        'featuring',
        'remix',
        'remaster',
        'remastered',
        'acoustic',
        'live',
        'radio edit',
        'extended',
        'instrumental'
    ];

    for (const suffix of suffixesToRemove) {
        const regex = new RegExp(`\\s*\\(?${suffix}.*?\\)?$`, 'gi');
        const withoutSuffix = cleaned.replace(regex, '').trim();
        if (withoutSuffix && withoutSuffix !== cleaned) {
            variants.add(withoutSuffix);
        }
    }

    // 处理数字和特殊字符
    const withoutSpecialChars = cleaned.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
    if (withoutSpecialChars && withoutSpecialChars !== cleaned) {
        variants.add(withoutSpecialChars);
    }

    return Array.from(variants).filter(v => v.length > 0);
}

// 清理文件名
function cleanFileName(str) {
    if (!str) return '';
    return str.replace(/[<>:"/\\|?*]/g, '').trim();
}

// 查找最佳匹配的歌词文件
function findBestLyricsMatch(files, patterns) {
    const matches = [];

    // 第一轮：精确匹配
    for (const pattern of patterns) {
        const exactMatch = files.find(file => file.toLowerCase() === pattern.toLowerCase());
        if (exactMatch) {
            matches.push({file: exactMatch, score: 100, type: 'exact'});
        }
    }

    if (matches.length > 0) {
        return matches[0].file; // 返回第一个精确匹配
    }

    // 第二轮：高相似度匹配
    for (const file of files) {
        const fileName = path.basename(file, '.lrc').toLowerCase();

        for (const pattern of patterns) {
            const patternName = path.basename(pattern, '.lrc').toLowerCase();
            const similarity = calculateStringSimilarity(fileName, patternName);

            if (similarity >= 0.8) { // 80%以上相似度
                matches.push({file, score: similarity * 100, type: 'high_similarity'});
            }
        }
    }

    // 第三轮：包含匹配
    if (matches.length === 0) {
        for (const file of files) {
            const fileName = path.basename(file, '.lrc').toLowerCase();

            for (const pattern of patterns) {
                const patternName = path.basename(pattern, '.lrc').toLowerCase();

                // 检查是否包含主要关键词
                const patternWords = patternName.split(/[\s\-_]+/).filter(w => w.length > 2);
                const fileWords = fileName.split(/[\s\-_]+/).filter(w => w.length > 2);

                let matchedWords = 0;
                for (const word of patternWords) {
                    if (fileWords.some(fw => fw.includes(word) || word.includes(fw))) {
                        matchedWords++;
                    }
                }

                if (matchedWords >= Math.min(2, patternWords.length)) {
                    const score = (matchedWords / patternWords.length) * 60; // 最高60分
                    matches.push({file, score, type: 'keyword_match'});
                }
            }
        }
    }

    // 按分数排序，返回最佳匹配
    if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score);
        console.log(`🎯 找到匹配文件: ${matches[0].file} (得分: ${matches[0].score.toFixed(1)}, 类型: ${matches[0].type})`);
        return matches[0].file;
    }

    return null;
}

// 计算字符串相似度（使用编辑距离算法）
function calculateStringSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,     // 删除
                matrix[i][j - 1] + 1,     // 插入
                matrix[i - 1][j - 1] + cost // 替换
            );
        }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
}

// Handle app protocol for deep linking (optional)
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('musicbox', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('musicbox');
}

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (isDev) {
        // In development, ignore certificate errors
        event.preventDefault();
        callback(true);
    } else {
        // In production, use default behavior
        callback(false);
    }
});

// 全局快捷键管理
let globalShortcutsEnabled = false;
let registeredShortcuts = new Map();

/**
 * 注册全局快捷键
 */
function registerGlobalShortcuts(shortcuts) {
    console.log('🎹 注册全局快捷键');

    // 先清除所有已注册的快捷键
    unregisterAllGlobalShortcuts();

    if (!shortcuts || typeof shortcuts !== 'object') {
        console.warn('⚠️ 无效的快捷键配置');
        return;
    }

    Object.entries(shortcuts).forEach(([id, shortcut]) => {
        if (!shortcut.enabled || !shortcut.key) {
            return;
        }

        try {
            // 转换快捷键格式（从我们的格式转换为Electron格式）
            const electronKey = convertToElectronShortcut(shortcut.key);

            const success = globalShortcut.register(electronKey, () => {
                console.log(`🎹 全局快捷键触发: ${shortcut.name} (${electronKey})`);

                // 发送消息到渲染进程
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('global-shortcut-triggered', id);
                }
            });

            if (success) {
                registeredShortcuts.set(id, electronKey);
                console.log(`✅ 全局快捷键注册成功: ${shortcut.name} (${electronKey})`);
            } else {
                console.warn(`⚠️ 全局快捷键注册失败: ${shortcut.name} (${electronKey})`);
            }
        } catch (error) {
            console.error(`❌ 注册全局快捷键失败: ${shortcut.name}`, error);
        }
    });

    console.log(`🎹 已注册 ${registeredShortcuts.size} 个全局快捷键`);
}

/**
 * 取消注册所有全局快捷键
 */
function unregisterAllGlobalShortcuts() {
    console.log('🎹 取消注册所有全局快捷键');
    globalShortcut.unregisterAll();
    registeredShortcuts.clear();
}

/**
 * 转换快捷键格式（从我们的格式转换为Electron格式）
 */
function convertToElectronShortcut(shortcutKey) {
    if (!shortcutKey) return '';

    return shortcutKey
        .replace(/Ctrl/g, 'CommandOrControl')
        .replace(/Cmd/g, 'Command')
        .replace(/ArrowUp/g, 'Up')
        .replace(/ArrowDown/g, 'Down')
        .replace(/ArrowLeft/g, 'Left')
        .replace(/ArrowRight/g, 'Right')
        .replace(/Space/g, 'Space');
}

// 全局快捷键IPC处理程序
ipcMain.handle('globalShortcuts:register', async (event, shortcuts) => {
    try {
        if (!globalShortcutsEnabled) {
            console.log('🎹 全局快捷键已禁用，跳过注册');
            return false;
        }

        registerGlobalShortcuts(shortcuts);
        return true;
    } catch (error) {
        console.error('❌ 注册全局快捷键失败:', error);
        return false;
    }
});

ipcMain.handle('globalShortcuts:unregister', async () => {
    try {
        unregisterAllGlobalShortcuts();
        return true;
    } catch (error) {
        console.error('❌ 取消注册全局快捷键失败:', error);
        return false;
    }
});

ipcMain.handle('globalShortcuts:setEnabled', async (event, enabled) => {
    try {
        globalShortcutsEnabled = enabled;
        console.log(`🎹 全局快捷键${enabled ? '已启用' : '已禁用'}`);

        if (!enabled) {
            unregisterAllGlobalShortcuts();
        }

        return true;
    } catch (error) {
        console.error('❌ 设置全局快捷键状态失败:', error);
        return false;
    }
});

ipcMain.handle('globalShortcuts:isEnabled', async () => {
    return globalShortcutsEnabled;
});

// 应用退出时清理全局快捷键
app.on('will-quit', () => {
    console.log('🎹 应用退出，清理全局快捷键');
    unregisterAllGlobalShortcuts();
});

ipcMain.on('window-close', () => {
    mainWindow.close();
});
