const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
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

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'win32',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/public/index.html'));
    // mainWindow.webContents.openDevTools();
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Music Folder'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
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
