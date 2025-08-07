const {app, BrowserWindow, ipcMain, dialog, shell, globalShortcut} = require('electron');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const chardet = require('chardet');
const mm = require('music-metadata');
const { spawn } = require('child_process');
const LibraryCacheManager = require('./library-cache-manager');
const NetworkDriveManager = require('./network-drive-manager');
const NetworkFileAdapter = require('./network-file-adapter');
const metadataHandler = require('./metadata-handler');

// 字符串编码
function fixStringEncoding(str) {
    if (!str || typeof str !== 'string') {
        return str;
    }

    try {
        // 检测字符串是否包含乱码字符
        const hasGarbledChars = /[\u00C0-\u00FF][\u0080-\u00BF]+/.test(str);

        if (hasGarbledChars) {
            // 尝试将错误解码的UTF-8字符串重新解码
            const buffer = Buffer.from(str, 'latin1');
            const detectedEncoding = chardet.detect(buffer) || 'utf8';
            console.log(`🔍 检测到字符串编码: ${detectedEncoding} for "${str}"`);

            // 如果检测到的编码不是UTF-8则转换
            if (detectedEncoding.toLowerCase() !== 'utf8' && detectedEncoding.toLowerCase() !== 'utf-8') {
                const fixedStr = iconv.decode(buffer, detectedEncoding);
                console.log(`🔧 编码修复: "${str}" -> "${fixedStr}"`);
                return fixedStr;
            }
        }
        return str;
    } catch (error) {
        console.warn(`⚠️ 字符串编码修复失败: ${error.message}, 返回原字符串`);
        return str;
    }
}

// 提取内嵌歌词函数
function extractEmbeddedLyrics(metadata) {
    if (!metadata || !metadata.native) {
        console.log('🔍 内嵌歌词提取: 元数据或原生标签为空');
        return null;
    }

    console.log('🔍 内嵌歌词提取: 开始分析元数据');
    console.log(`🔍 可用格式: ${Object.keys(metadata.native).join(', ')}`);

    let embeddedLyrics = null;
    let allFoundTags = []; // 记录所有找到的相关标签

    // 遍历所有原生标签格式
    for (const [format, tags] of Object.entries(metadata.native)) {
        if (!Array.isArray(tags)) continue;

        console.log(`🔍 检查格式: ${format}, 标签数量: ${tags.length}`);

        for (const tag of tags) {
            const tagId = tag.id ? tag.id.toUpperCase() : '';

            // 记录所有标签用于调试
            if (tagId) {
                console.log(`🔍 发现标签: ${format}.${tagId}`, {
                    value: typeof tag.value === 'string' ? tag.value.substring(0, 100) + '...' : tag.value
                });
            }

            // 扩展歌词标签识别范围
            if (isLyricsTag(tagId, format)) {
                allFoundTags.push({format, tagId, tag});

                if (tagId === 'USLT' || tagId === 'LYRICS' || tagId === 'UNSYNCED LYRICS' ||
                    tagId === 'UNSYNCEDLYRICS' || tagId === '©LYR' || tagId === 'LYR') {
                    // 无同步歌词 (Unsynchronized Lyrics)
                    const lyricsText = extractLyricsText(tag.value);
                    if (lyricsText) {
                        embeddedLyrics = {
                            type: 'USLT',
                            format: format,
                            language: tag.value?.language || 'unknown',
                            description: tag.value?.description || '',
                            text: lyricsText,
                            synchronized: false
                        };
                        console.log(`✅ 找到USLT歌词 (${format}.${tagId}): ${lyricsText.substring(0, 50)}...`);
                        break;
                    }
                } else if (tagId === 'SYLT' || tagId === 'SYNCHRONIZED LYRICS' || tagId === 'SYNCEDLYRICS') {
                    // 同步歌词 (Synchronized Lyrics)
                    const syncLyrics = extractSynchronizedLyrics(tag.value);
                    if (syncLyrics) {
                        embeddedLyrics = {
                            type: 'SYLT',
                            format: format,
                            language: tag.value?.language || 'unknown',
                            description: tag.value?.description || '',
                            text: syncLyrics.text,
                            timestamps: syncLyrics.timestamps,
                            synchronized: true
                        };
                        console.log(`✅ 找到SYLT同步歌词 (${format}.${tagId}): ${syncLyrics.timestamps.length} 个时间戳`);
                        break;
                    }
                } else if (tagId === 'TXXX' && tag.value?.description) {
                    // 自定义文本标签中的歌词
                    const desc = tag.value.description.toUpperCase();
                    if (desc.includes('LYRIC') || desc.includes('歌词') || desc.includes('LYRICS')) {
                        const lyricsText = tag.value.text;
                        if (lyricsText && typeof lyricsText === 'string' && lyricsText.trim()) {
                            embeddedLyrics = {
                                type: 'TXXX',
                                format: format,
                                description: tag.value.description,
                                text: lyricsText.trim(),
                                synchronized: false
                            };
                            console.log(`✅ 找到TXXX歌词 (${format}.${tagId}): ${tag.value.description}`);
                            break;
                        }
                    }
                }
            }
        }
        // 如果已经找到歌词，跳出外层循环
        if (embeddedLyrics) break;
    }

    // 显示所有找到的相关标签
    if (allFoundTags.length > 0) {
        console.log(`🔍 找到 ${allFoundTags.length} 个歌词相关标签:`,
            allFoundTags.map(t => `${t.format}.${t.tagId}`).join(', '));
    } else {
        console.log('🔍 未找到任何歌词相关标签');
    }

    return embeddedLyrics;
}

// 判断是否为歌词标签
function isLyricsTag(tagId, format) {
    const lyricsTagIds = [
        'USLT', 'LYRICS', 'UNSYNCED LYRICS', 'UNSYNCEDLYRICS',
        'SYLT', 'SYNCHRONIZED LYRICS', 'SYNCEDLYRICS',
        'TXXX', '©LYR', 'LYR', 'LYRICIST'
    ];

    // 对于Vorbis Comments格式，还要检查其他可能的标签
    if (format === 'vorbis') {
        lyricsTagIds.push('LYRICS', 'UNSYNCEDLYRICS', 'SYNCEDLYRICS');
    }

    // 对于APE格式
    if (format === 'APEv2') {
        lyricsTagIds.push('Lyrics', 'LYRICS');
    }

    return lyricsTagIds.includes(tagId);
}

// 提取歌词文本内容
function extractLyricsText(value) {
    console.log('🔍 提取歌词文本:', {
        type: typeof value,
        isArray: Array.isArray(value),
        keys: typeof value === 'object' && value ? Object.keys(value) : null
    });

    if (!value) {
        console.log('🔍 歌词值为空');
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        console.log(`🔍 字符串歌词: ${trimmed.substring(0, 100)}...`);
        return trimmed || null;
    }

    if (typeof value === 'object') {
        console.log('🔍 对象歌词，检查属性:', Object.keys(value));

        // USLT格式通常有text属性
        if (value.text && typeof value.text === 'string') {
            const trimmed = value.text.trim();
            console.log(`🔍 找到text属性: ${trimmed.substring(0, 100)}...`);
            return trimmed || null;
        }

        // 有些格式可能直接是歌词内容
        if (value.lyrics && typeof value.lyrics === 'string') {
            const trimmed = value.lyrics.trim();
            console.log(`🔍 找到lyrics属性: ${trimmed.substring(0, 100)}...`);
            return trimmed || null;
        }

        // 检查其他可能的属性名
        const possibleKeys = ['lyric', 'content', 'data', 'value'];
        for (const key of possibleKeys) {
            if (value[key] && typeof value[key] === 'string') {
                const trimmed = value[key].trim();
                console.log(`🔍 找到${key}属性: ${trimmed.substring(0, 100)}...`);
                return trimmed || null;
            }
        }

        // 如果是数组，尝试提取第一个字符串元素
        if (Array.isArray(value) && value.length > 0) {
            for (const item of value) {
                if (typeof item === 'string') {
                    const trimmed = item.trim();
                    console.log(`🔍 数组中找到字符串: ${trimmed.substring(0, 100)}...`);
                    return trimmed || null;
                } else if (typeof item === 'object' && item.text) {
                    const trimmed = item.text.trim();
                    console.log(`🔍 数组对象中找到text: ${trimmed.substring(0, 100)}...`);
                    return trimmed || null;
                }
            }
        }

        console.log('🔍 对象中未找到有效的歌词文本');
    }

    console.log('🔍 无法提取歌词文本');
    return null;
}

// 提取同步歌词
function extractSynchronizedLyrics(value) {
    console.log('🔍 提取同步歌词:', {
        type: typeof value,
        isArray: Array.isArray(value),
        keys: typeof value === 'object' && value ? Object.keys(value) : null
    });

    if (!value || typeof value !== 'object') {
        console.log('🔍 同步歌词值无效');
        return null;
    }

    try {
        let timestamps = [];
        let text = '';

        if (Array.isArray(value.synchronizedText)) {
            // 标准SYLT格式
            console.log(`🔍 标准SYLT格式，同步文本数量: ${value.synchronizedText.length}`);
            for (const item of value.synchronizedText) {
                console.log('🔍 SYLT项目:', {text: item.text, timeStamp: item.timeStamp});
                if (item.text && typeof item.timeStamp === 'number') {
                    timestamps.push({
                        time: item.timeStamp / 1000, // 转换为秒
                        text: item.text.trim()
                    });
                    text += item.text.trim() + '\n';
                }
            }
        } else if (value.text && value.timeStamps) {
            // 其他可能的格式
            console.log('🔍 文本+时间戳格式');
            const textLines = value.text.split('\n');
            const timeStamps = Array.isArray(value.timeStamps) ? value.timeStamps : [];

            console.log(`🔍 文本行数: ${textLines.length}, 时间戳数: ${timeStamps.length}`);

            for (let i = 0; i < Math.min(textLines.length, timeStamps.length); i++) {
                if (textLines[i].trim() && typeof timeStamps[i] === 'number') {
                    timestamps.push({
                        time: timeStamps[i] / 1000,
                        text: textLines[i].trim()
                    });
                }
            }
            text = value.text;
        } else if (Array.isArray(value)) {
            // 有些格式可能直接是数组
            console.log(`🔍 数组格式，长度: ${value.length}`);
            for (const item of value) {
                if (item && typeof item === 'object' && item.text && typeof item.time === 'number') {
                    timestamps.push({
                        time: item.time / 1000,
                        text: item.text.trim()
                    });
                    text += item.text.trim() + '\n';
                }
            }
        } else {
            // 尝试其他可能的属性名
            console.log('🔍 检查其他可能的同步歌词格式');
            const possibleKeys = ['lyrics', 'lines', 'entries', 'items'];
            for (const key of possibleKeys) {
                if (Array.isArray(value[key])) {
                    console.log(`🔍 找到${key}数组，长度: ${value[key].length}`);
                    for (const item of value[key]) {
                        if (item && typeof item === 'object') {
                            const timeKey = item.time !== undefined ? 'time' :
                                item.timestamp !== undefined ? 'timestamp' :
                                    item.timeStamp !== undefined ? 'timeStamp' : null;
                            const textKey = item.text !== undefined ? 'text' :
                                item.lyric !== undefined ? 'lyric' :
                                    item.content !== undefined ? 'content' : null;

                            if (timeKey && textKey && typeof item[timeKey] === 'number' && typeof item[textKey] === 'string') {
                                timestamps.push({
                                    time: item[timeKey] / 1000,
                                    text: item[textKey].trim()
                                });
                                text += item[textKey].trim() + '\n';
                            }
                        }
                    }
                    break;
                }
            }
        }

        console.log(`🔍 提取到 ${timestamps.length} 个时间戳`);
        if (timestamps.length > 0) {
            const sortedTimestamps = timestamps.sort((a, b) => a.time - b.time);
            console.log(`🔍 同步歌词时间范围: ${sortedTimestamps[0].time}s - ${sortedTimestamps[sortedTimestamps.length - 1].time}s`);
            return {
                timestamps: sortedTimestamps,
                text: text.trim()
            };
        }
    } catch (error) {
        console.error(`❌ 解析同步歌词失败: ${error.message}`, error);
    }

    console.log('🔍 未找到有效的同步歌词');
    return null;
}

// 全局元数据解析函数
async function parseMetadata(filePath) {
    try {
        console.log(`🔍 解析音频元数据: ${filePath}`);
        const metadata = await mm.parseFile(filePath);

        // 提取基本信息并修复编码
        const title = fixStringEncoding(metadata.common.title) || path.basename(filePath, path.extname(filePath));
        const artist = fixStringEncoding(metadata.common.artist || metadata.common.albumartist) || '未知艺术家';
        const album = fixStringEncoding(metadata.common.album) || '未知专辑';
        const duration = metadata.format.duration || 0;
        const bitrate = metadata.format.bitrate || 0;
        const sampleRate = metadata.format.sampleRate || 0;
        const year = metadata.common.year || metadata.common.date || null;

        // 处理流派数组并修复编码
        let genre = null;
        if (metadata.common.genre && Array.isArray(metadata.common.genre)) {
            genre = metadata.common.genre.map(g => fixStringEncoding(g)).join(', ');
        }

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

        // 提取内嵌歌词
        let embeddedLyrics = null;
        try {
            embeddedLyrics = extractEmbeddedLyrics(metadata);
            if (embeddedLyrics) {
                console.log(`🎵 发现内嵌歌词: ${embeddedLyrics.type} 格式`);
            }
        } catch (error) {
            console.warn(`⚠️ 提取内嵌歌词失败: ${error.message}`);
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
            cover,
            embeddedLyrics
        };
    } catch (error) {
        console.warn(`⚠️ 使用music-metadata解析失败，回退到文件名解析: ${error.message}`);

        // 回退到文件名解析
        const fileName = fixStringEncoding(path.basename(filePath, path.extname(filePath)));
        let artist = '未知艺术家';
        let title = fileName;
        let album = '未知专辑';

        // 检查是否包含分隔符
        const separators = [' - ', ' – ', ' — ', '-'];
        for (const sep of separators) {
            if (fileName.includes(sep)) {
                const parts = fileName.split(sep);
                if (parts.length >= 2) {
                    artist = fixStringEncoding(parts[0].trim());
                    title = fixStringEncoding(parts.slice(1).join(sep).trim());
                    break;
                }
            }
        }

        // 尝试从目录结构获取专辑信息
        const dirName = fixStringEncoding(path.basename(path.dirname(filePath)));
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
            cover: null,
            embeddedLyrics: null
        };
    }
}

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let desktopLyricsWindow = null; // 桌面歌词窗口
// 主动尺寸保护机制 - 缓存原始窗口尺寸
let cachedOriginalSize = null;

async function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1080,
        minHeight: 720,
        titleBarStyle: false,
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

    // 监听窗口最大化/还原状态变化
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window:maximized', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window:maximized', false);
    });
}

// 创建桌面歌词窗口
async function createDesktopLyricsWindow() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.focus();
        return;
    }

    // 获取主窗口位置和尺寸
    const mainBounds = mainWindow ? mainWindow.getBounds() : {x: 100, y: 100, width: 1440, height: 900};

    // 计算桌面歌词窗口的初始位置（在主窗口下方）
    const lyricsX = mainBounds.x + 50;
    const lyricsY = mainBounds.y + 20;

    desktopLyricsWindow = new BrowserWindow({
        width: 500,
        height: 120,
        x: lyricsX,
        y: lyricsY,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        movable: true,
        focusable: false, // 防止抢夺焦点
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 加载桌面歌词页面
    const lyricsHtmlPath = path.join(__dirname, '../renderer/public/desktop-lyrics.html');
    await desktopLyricsWindow.loadFile(lyricsHtmlPath);
    // desktopLyricsWindow.openDevTools();
    console.log('✅ 桌面歌词窗口加载成功');

    // 窗口事件处理
    desktopLyricsWindow.once('ready-to-show', () => {
        desktopLyricsWindow.show();
        console.log('🎵 桌面歌词窗口显示');
    });

    desktopLyricsWindow.on('closed', () => {
        desktopLyricsWindow = null;
        console.log('🎵 桌面歌词窗口已关闭');
    });

    // 防止窗口失去焦点时隐藏
    desktopLyricsWindow.on('blur', () => {
        // 保持窗口可见
    });
}

// 显示桌面歌词窗口
function showDesktopLyrics() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.show();
        return true;
    }
    return false;
}

// 隐藏桌面歌词窗口
function hideDesktopLyrics() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.hide();
        closeDesktopLyrics();
        return true;
    }
    return false;
}

// 关闭桌面歌词窗口
function closeDesktopLyrics() {
    if (desktopLyricsWindow) {
        desktopLyricsWindow.close();
        desktopLyricsWindow = null;
        return true;
    }
    return false;
}

// 检查桌面歌词窗口是否存在且可见
function isDesktopLyricsVisible() {
    return desktopLyricsWindow && desktopLyricsWindow.isVisible();
}

// 向桌面歌词窗口发送数据
function sendToDesktopLyrics(channel, data) {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        desktopLyricsWindow.webContents.send(channel, data);
        return true;
    }
    return false;
}

// App event handlers
app.whenReady().then(async () => {
    console.log('🚀 应用启动，开始初始化...');

    // 初始化全局驱动器注册表
    console.log('🔧 步骤1: 初始化全局驱动器注册表');
    const {initializeGlobalDriveRegistry} = require('./drive-registry');
    await initializeGlobalDriveRegistry();

    // 初始化网络磁盘管理器
    console.log('🔧 步骤2: 初始化网络磁盘管理器');
    await initializeNetworkDriveManager();

    // 初始化缓存管理器（会复用网络磁盘管理器）
    console.log('🔧 步骤3: 初始化缓存管理器');
    await initializeCacheManager();

    // 初始化元数据处理器
    console.log('🔧 步骤4: 初始化元数据处理器');
    await metadataHandler.initialize();

    console.log('🔧 步骤5: 创建主窗口');
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

app.on('before-quit', () => {
    // 清理网络磁盘连接
    if (networkDriveManager) {
        console.log('🧹 应用退出，清理网络磁盘连接');
        networkDriveManager.cleanup();
    }
});

// IPC handlers
ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
    return process.platform;
});

// 窗口控制 IPC handlers
ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window:close', () => {
    if (mainWindow) {
        mainWindow.close();
        if (desktopLyricsWindow) desktopLyricsWindow.close();
    }
});

// 处理窗口拖拽，electron远古bug原因，自实现拖拽功能时会出现窗口尺寸变大的问题，需要主动尺寸保护机制
// 说白了就是尺寸变大了再恢复回去😂
ipcMain.on('custom-adsorption', (event, res) => {
    if (mainWindow && !mainWindow.isMaximized()) {
        // 主动尺寸保护机制 - 缓存原始尺寸信息
        if (res.originalWidth && res.originalHeight) {
            cachedOriginalSize = {
                width: res.originalWidth,
                height: res.originalHeight
            };
        }

        // 记录调用前的窗口状态
        const [beforeX, beforeY] = mainWindow.getPosition();
        const [beforeWidth, beforeHeight] = mainWindow.getSize();

        console.log('🔍 拖拽前窗口状态:', {
            position: {x: beforeX, y: beforeY},
            size: {width: beforeWidth, height: beforeHeight},
            received: {x: res.appX, y: res.appY},
            cachedOriginalSize: cachedOriginalSize
        });

        let x = Math.round(res.appX);
        let y = Math.round(res.appY);

        // 使用setBounds确保尺寸不变
        const targetWidth = cachedOriginalSize ? cachedOriginalSize.width : beforeWidth;
        const targetHeight = cachedOriginalSize ? cachedOriginalSize.height : beforeHeight;

        mainWindow.setBounds({
            x: x,
            y: y,
            width: targetWidth,
            height: targetHeight
        });

        // 主动尺寸保护机制 - 立即检查并恢复尺寸
        setTimeout(() => {
            const [afterX, afterY] = mainWindow.getPosition();
            const [afterWidth, afterHeight] = mainWindow.getSize();

            console.log('🔍 拖拽后窗口状态:', {
                position: {x: afterX, y: afterY},
                size: {width: afterWidth, height: afterHeight}
            });

            // 检查尺寸是否与目标尺寸一致
            if (afterWidth !== targetWidth || afterHeight !== targetHeight) {
                console.warn('⚠️ 检测到窗口尺寸偏差，正在强制恢复:', {
                    current: {width: afterWidth, height: afterHeight},
                    target: {width: targetWidth, height: targetHeight},
                    delta: {width: afterWidth - targetWidth, height: afterHeight - targetHeight}
                });

                // 强制恢复到目标尺寸
                try {
                    mainWindow.setSize(targetWidth, targetHeight);
                    console.log('✅ 窗口尺寸已强制恢复');

                    // 再次验证
                    const [finalWidth, finalHeight] = mainWindow.getSize();
                    if (finalWidth !== targetWidth || finalHeight !== targetHeight) {
                        console.error('❌ 尺寸恢复失败:', {
                            expected: {width: targetWidth, height: targetHeight},
                            actual: {width: finalWidth, height: finalHeight}
                        });
                    }
                } catch (error) {
                    console.error('❌ 强制恢复窗口尺寸失败:', error);
                }
            }
        }, 0); // 使用setTimeout确保在下一个事件循环中执行检查
    }
});

// 主动尺寸保护机制 - 清理缓存的尺寸信息
ipcMain.on('clear-size-cache', () => {
    cachedOriginalSize = null;
    console.log('🧹 已清理缓存的窗口尺寸信息');
});

ipcMain.handle('window:getPosition', () => {
    if (mainWindow) {
        return mainWindow.getPosition();
    }
    return [0, 0];
});

ipcMain.handle('window:getSize', () => {
    if (mainWindow) {
        return mainWindow.getSize();
    }
    return [1440, 900]; // 默认尺寸
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

// 通用文件选择对话框
ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

// 文件系统相关IPC处理
ipcMain.handle('fs:stat', async (event, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return {
            size: stats.size,
            mtime: stats.mtime,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory()
        };
    } catch (error) {
        throw new Error(`获取文件信息失败: ${error.message}`);
    }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        return Array.from(buffer);
    } catch (error) {
        throw new Error(`读取文件失败: ${error.message}`);
    }
});

// 图片文件选择对话框（用于歌单封面）
ipcMain.handle('dialog:openImageFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            {
                name: '图片文件',
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
            },
            {
                name: 'JPEG 图片',
                extensions: ['jpg', 'jpeg']
            },
            {
                name: 'PNG 图片',
                extensions: ['png']
            },
            {
                name: 'GIF 图片',
                extensions: ['gif']
            },
            {
                name: 'WebP 图片',
                extensions: ['webp']
            }
        ],
        title: '选择歌单封面图片'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
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

// 初始化网络磁盘管理器
let networkDriveManager = null;
let networkFileAdapter = null;

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
        console.log('✅ 音乐库缓存管理器初始化成功');
        return true;
    } catch (error) {
        console.error('❌ 音乐库缓存管理器初始化失败:', error);
        return false;
    }
}

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

        console.log('✅ 网络磁盘管理器初始化完成');
        return true;
    } catch (error) {
        console.error('❌ 网络磁盘管理器初始化失败:', error);
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

        // 处理封面数据 - 确保不直接传递对象
        let coverUrl = null;
        if (metadata.cover && metadata.cover.data) {
            console.log('🔍 main.js: 检测到内嵌封面，但不在主进程转换URL');
            // 注意：不在主进程转换封面为URL，让渲染进程的封面管理器处理
            // 这样可以避免在主进程中处理大量的封面数据转换
            coverUrl = null; // 设置为null，让渲染进程异步获取
        }

        console.log('🔍 main.js: 封面处理结果', {
            hasOriginalCover: !!(metadata.cover && metadata.cover.data),
            coverUrl: coverUrl,
            willUseEmbeddedManager: !coverUrl && !!(metadata.cover && metadata.cover.data)
        });

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
            cover: coverUrl, // 确保这里是URL字符串或null，不是对象
            embeddedLyrics: metadata.embeddedLyrics
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

// 音乐库IPC处理程序
ipcMain.handle('library:scanDirectory', async (event, directoryPath) => {
    try {
        console.log(`📁 扫描目录: ${directoryPath}`);
        const scanStartTime = Date.now();

        // 确保缓存管理器已初始化
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        // 确保网络磁盘管理器已初始化
        if (!networkDriveManager) {
            await initializeNetworkDriveManager();
        }

        // 检查是否为网络路径
        const isNetworkPath = networkFileAdapter && networkFileAdapter.isNetworkPath(directoryPath);

        if (isNetworkPath) {
            console.log(`🌐 扫描网络目录: ${directoryPath}`);
            return await scanNetworkDirectory(directoryPath, scanStartTime);
        } else {
            console.log(`💾 扫描本地目录: ${directoryPath}`);
            return await scanLocalDirectory(directoryPath, scanStartTime);
        }
    } catch (error) {
        console.error('❌ 目录扫描失败:', error);
        return false;
    }
});

// 扫描本地目录
async function scanLocalDirectory(directoryPath, scanStartTime) {
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
                        fileSize: stat.size,
                        embeddedLyrics: metadata.embeddedLyrics
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
    console.log(`✅ 本地扫描完成，找到 ${tracks.length} 个音频文件`);
    return true;
}

// 扫描网络目录
async function scanNetworkDirectory(networkPath, scanStartTime) {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
    const tracks = [];
    const tracksToCache = [];

    async function scanNetworkDir(dirPath) {
        try {
            console.log(`🌐 扫描网络目录: ${dirPath}`);
            const items = await networkFileAdapter.readdir(dirPath);

            for (const item of items) {
                // 使用安全的网络路径连接方法
                const fullPath = networkFileAdapter.joinNetworkPath(dirPath, item);
                console.log(`🔍 构建网络文件路径: ${fullPath}`);

                try {
                    const stat = await networkFileAdapter.stat(fullPath);

                    if (stat.isDirectory()) {
                        await scanNetworkDir(fullPath); // 递归扫描子目录
                    } else if (audioExtensions.includes(require('path').extname(item).toLowerCase())) {
                        console.log(`🎵 发现网络音频文件: ${fullPath}`);

                        // 网络文件需要特殊处理元数据解析
                        const metadata = await parseNetworkMetadata(fullPath);
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
                            isNetworkFile: true // 标记为网络文件
                        };

                        tracks.push(trackData);

                        // 准备缓存数据
                        tracksToCache.push({
                            trackData,
                            filePath: fullPath,
                            stats: stat
                        });
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

    // 添加到缓存
    if (libraryCacheManager && tracksToCache.length > 0) {
        libraryCacheManager.addTracks(tracksToCache);
        libraryCacheManager.addScannedDirectory(networkPath);

        // 更新扫描统计
        const scanDuration = Date.now() - scanStartTime;
        libraryCacheManager.cache.statistics.lastScanTime = scanStartTime;
        libraryCacheManager.cache.statistics.scanDuration = scanDuration;
        await libraryCacheManager.saveCache();
    }

    // 存储扫描结果到内存
    audioEngineState.scannedTracks = tracks;
    console.log(`✅ 网络扫描完成，找到 ${tracks.length} 个音频文件`);
    return true;
}

// 解析网络文件元数据
async function parseNetworkMetadata(networkPath) {
    try {
        console.log(`🔍 解析网络文件元数据: ${networkPath}`);

        // 读取网络文件内容并解析
        const buffer = await networkFileAdapter.readFile(networkPath);
        const metadata = await mm.parseBuffer(buffer, {
            mimeType: getMimeTypeFromExtension(networkPath),
            size: buffer.length
        });

        // 提取并修复字符串编码
        const title = fixStringEncoding(metadata.common.title || path.basename(networkPath, path.extname(networkPath)));
        const artist = fixStringEncoding(metadata.common.artist || '未知艺术家');
        const album = fixStringEncoding(metadata.common.album || '未知专辑');
        const genre = fixStringEncoding(metadata.common.genre ? metadata.common.genre.join(', ') : '');

        // 提取内嵌歌词
        const embeddedLyrics = extractEmbeddedLyrics(metadata);

        return {
            title: title,
            artist: artist,
            album: album,
            duration: metadata.format.duration || 0,
            bitrate: metadata.format.bitrate || 0,
            sampleRate: metadata.format.sampleRate || 0,
            year: metadata.common.year || null,
            genre: genre,
            track: metadata.common.track ? metadata.common.track.no : null,
            disc: metadata.common.disk ? metadata.common.disk.no : null,
            embeddedLyrics: embeddedLyrics
        };
    } catch (error) {
        console.error(`❌ 解析网络文件元数据失败 ${networkPath}:`, error);

        const fileName = path.basename(networkPath);
        return {
            title: path.basename(fileName, path.extname(fileName)),
            artist: '未知艺术家',
            album: '未知专辑',
            duration: 0,
            bitrate: 0,
            sampleRate: 0,
            year: null,
            genre: '',
            track: null,
            disc: null,
            embeddedLyrics: null
        };
    }
}

// 根据文件扩展名获取MIME类型
function getMimeTypeFromExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
}

ipcMain.handle('library:getTracks', async () => {
    const tracks = audioEngineState.scannedTracks || [];

    // 确保返回的tracks中的cover字段不是对象
    const cleanedTracks = tracks.map(track => {
        const cleanedTrack = { ...track };

        // 如果cover是对象，设置为null，让渲染进程的封面管理器处理
        if (cleanedTrack.cover && typeof cleanedTrack.cover === 'object') {
            console.log(`🔍 main.js: 清理track.cover对象 - ${track.title}`);
            cleanedTrack.cover = null; // 设置为null，让渲染进程异步获取
        }

        return cleanedTrack;
    });

    console.log(`📚 main.js: 返回 ${cleanedTracks.length} 个tracks，已清理cover对象`);
    return cleanedTracks;
});

// 扫描网络磁盘
ipcMain.handle('library:scanNetworkDrive', async (event, driveId, relativePath = '/') => {
    try {
        if (!networkDriveManager || !networkFileAdapter) {
            throw new Error('网络磁盘管理器未初始化');
        }

        // 确保缓存管理器已初始化
        if (!libraryCacheManager) {
            console.log('🔧 初始化缓存管理器...');
            await initializeCacheManager();
        }

        const driveInfo = networkDriveManager.getDriveInfo(driveId);
        if (!driveInfo) {
            throw new Error(`网络磁盘 ${driveId} 未找到`);
        }

        const status = networkDriveManager.getDriveStatus(driveId);
        if (!status || !status.connected) {
            throw new Error(`网络磁盘 ${driveId} 未连接`);
        }

        // 构建网络路径
        const networkPath = networkFileAdapter.buildNetworkPath(driveId, relativePath);
        console.log(`🌐 扫描网络磁盘: ${driveInfo.config.displayName} - ${networkPath}`);

        // 使用现有的扫描逻辑
        const scanStartTime = Date.now();
        return await scanNetworkDirectory(networkPath, scanStartTime);
    } catch (error) {
        console.error('❌ 网络磁盘扫描失败:', error);
        return false;
    }
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

        // 清理返回给渲染进程的tracks中的cover对象
        const cleanedTracks = cachedTracks.map(track => {
            const cleanedTrack = { ...track };

            // 如果cover是对象，设置为null，让渲染进程的封面管理器处理
            if (cleanedTrack.cover && typeof cleanedTrack.cover === 'object') {
                console.log(`🔍 main.js: 清理缓存track.cover对象 - ${track.title}`);
                cleanedTrack.cover = null; // 设置为null，让渲染进程异步获取
            }

            return cleanedTrack;
        });

        console.log(`✅ 从缓存加载 ${cleanedTracks.length} 个音乐文件，已清理cover对象`);
        return cleanedTracks;
    } catch (error) {
        console.error('❌ 加载缓存音乐库失败:', error);
        return [];
    }
});

ipcMain.handle('library:validateCache', async (event) => {
    try {
        // 调试：检查NetworkDriveManager状态
        if (networkDriveManager) {
            const mountedDrives = Array.from(networkDriveManager.mountedDrives.keys());
            console.log(`🔍 缓存验证前，已挂载的驱动器: [${mountedDrives.join(', ')}]`);
        } else {
            console.log(`⚠️ 缓存验证前，NetworkDriveManager未初始化`);
        }

        if (!libraryCacheManager) {
            console.log('🔧 缓存管理器未初始化，开始初始化...');
            await initializeCacheManager();

            // 调试：检查初始化后的状态
            if (networkDriveManager) {
                const mountedDrives = Array.from(networkDriveManager.mountedDrives.keys());
                console.log(`🔍 缓存管理器初始化后，已挂载的驱动器: [${mountedDrives.join(', ')}]`);
            }
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
            cover: metadata.cover,
            embeddedLyrics: metadata.embeddedLyrics
        };
    } catch (error) {
        console.error('❌ 获取元数据失败:', error);
        return null;
    }
});

// 更新歌曲元数据
ipcMain.handle('library:updateTrackMetadata', async (event, updatedData) => {
    // 启用详细调试日志
    const DEBUG_METADATA_UPDATE = true;

    try {
        console.log(`📝 更新音频文件元数据: ${updatedData.filePath}`);
        if (DEBUG_METADATA_UPDATE) {
            console.log(`🔍 调试信息 - 更新数据:`, updatedData);
        }

        const { filePath, title, artist, album, year, genre, cover } = updatedData;

        // 验证文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error('文件不存在');
        }

        // 检查文件权限
        try {
            fs.accessSync(filePath, fs.constants.W_OK);
            console.log(`✅ 文件写入权限验证通过: ${filePath}`);
        } catch (permissionError) {
            throw new Error(`文件没有写入权限: ${permissionError.message}`);
        }

        // 获取文件扩展名以确定处理方式
        const fileExtension = path.extname(filePath).toLowerCase();
        console.log(`🔍 文件格式: ${fileExtension}`);

        // 备份原始文件修改时间，用于后续缓存同步
        const originalStats = fs.statSync(filePath);
        console.log(`📊 原始文件修改时间: ${originalStats.mtime}`);

        // 检查格式是否支持
        if (!metadataHandler.isFormatSupported(filePath)) {
            throw new Error(`不支持的音频格式: ${fileExtension}。目前支持的格式: MP3, FLAC, M4A, OGG`);
        }

        // 准备元数据
        const metadata = {
            title: (title || '').toString().trim(),
            artist: (artist || '').toString().trim(),
            album: (album || '').toString().trim(),
            year: year ? parseInt(year) : null,
            genre: (genre || '').toString().trim(),
            cover: cover && Array.isArray(cover) ? cover : null
        };

        console.log(`📝 准备写入的元数据:`, {
            ...metadata,
            cover: metadata.cover ? `[封面数据: ${metadata.cover.length} 字节]` : null
        });

        // 使用新的元数据处理器
        const result = await metadataHandler.updateMetadata(filePath, metadata);

        if (!result.success) {
            throw new Error(result.error || '元数据更新失败');
        }

        console.log(`✅ 元数据更新成功 (使用方法: ${result.method})`);

        // 等待一小段时间确保文件系统同步
        await new Promise(resolve => setTimeout(resolve, 100));

        // 重新解析元数据以验证写入是否成功
        console.log(`🔄 重新读取文件以验证元数据更新...`);
        const updatedMetadata = await parseMetadata(filePath);

        // 验证关键字段是否正确更新
        const verificationResults = {
            title: updatedMetadata.title === metadata.title,
            artist: updatedMetadata.artist === metadata.artist,
            album: updatedMetadata.album === metadata.album,
            year: metadata.year ? (updatedMetadata.year?.toString() === metadata.year.toString()) : true,
            genre: updatedMetadata.genre === metadata.genre
        };

        console.log(`🔍 元数据验证结果:`, verificationResults);

        const failedFields = Object.entries(verificationResults)
            .filter(([field, success]) => !success)
            .map(([field]) => field);

        if (failedFields.length > 0) {
            console.warn(`⚠️ 以下字段可能未正确写入: ${failedFields.join(', ')}`);
            console.warn(`期望值:`, metadata);
            console.warn(`实际值:`, {
                title: updatedMetadata.title,
                artist: updatedMetadata.artist,
                album: updatedMetadata.album,
                year: updatedMetadata.year,
                genre: updatedMetadata.genre
            });

            // 如果关键字段（title, artist）写入失败，抛出错误
            const criticalFields = ['title', 'artist'];
            const failedCriticalFields = failedFields.filter(field => criticalFields.includes(field));
            if (failedCriticalFields.length > 0) {
                throw new Error(`关键元数据字段写入失败: ${failedCriticalFields.join(', ')}。这可能是由于文件格式不支持或文件损坏导致的。`);
            }
        } else {
            console.log(`✅ 所有元数据字段验证通过`);
        }

        // 获取更新后的文件状态
        const updatedStats = fs.statSync(filePath);
        console.log(`📊 更新后文件修改时间: ${updatedStats.mtime}`);

        // 更新内存中的歌曲数据
        if (audioEngineState.scannedTracks) {
            const trackIndex = audioEngineState.scannedTracks.findIndex(track => track.filePath === filePath);
            if (trackIndex !== -1) {
                audioEngineState.scannedTracks[trackIndex] = {
                    ...audioEngineState.scannedTracks[trackIndex],
                    title: updatedMetadata.title,
                    artist: updatedMetadata.artist,
                    album: updatedMetadata.album,
                    year: updatedMetadata.year,
                    genre: updatedMetadata.genre,
                    cover: updatedMetadata.cover,
                    lastModified: updatedStats.mtime.getTime() // 更新修改时间
                };
                console.log(`✅ 已更新内存中的歌曲数据: ${updatedMetadata.title}`);
            }
        }

        // 更新缓存，使用正确的文件修改时间和新的fileId
        if (libraryCacheManager) {
            try {
                // 生成新的fileId以匹配更新后的文件状态
                const newFileId = libraryCacheManager.generateFileId(filePath, updatedStats);

                const cacheUpdateSuccess = libraryCacheManager.updateTrackInCache(filePath, {
                    fileId: newFileId, // 更新fileId以匹配新的文件状态
                    title: updatedMetadata.title,
                    artist: updatedMetadata.artist,
                    album: updatedMetadata.album,
                    year: updatedMetadata.year,
                    genre: updatedMetadata.genre,
                    cover: updatedMetadata.cover,
                    lastModified: updatedStats.mtime.getTime(), // 使用实际的文件修改时间
                    fileSize: updatedStats.size
                });

                if (cacheUpdateSuccess) {
                    // 立即保存缓存以确保持久化
                    await libraryCacheManager.saveCache();
                    console.log(`✅ 已更新并保存缓存中的歌曲数据: ${updatedMetadata.title}`);
                    console.log(`🔑 已更新缓存中的fileId: ${newFileId}`);
                } else {
                    console.warn(`⚠️ 缓存更新失败，歌曲可能不在缓存中: ${filePath}`);
                }
            } catch (cacheError) {
                console.error('❌ 更新缓存失败:', cacheError);
                // 即使缓存更新失败，也不应该影响元数据写入的成功状态
            }
        }

        console.log(`✅ 歌曲元数据更新成功: ${updatedMetadata.title} - ${updatedMetadata.artist}`);

        // 检查是否更新了封面
        const coverUpdated = metadata.cover && Array.isArray(metadata.cover) && metadata.cover.length > 0;

        if (coverUpdated) {
            console.log('封面已更新，通知渲染进程刷新显示');

            const eventData = {
                filePath: filePath,
                title: updatedMetadata.title,
                artist: updatedMetadata.artist,
                album: updatedMetadata.album,
                timestamp: Date.now()
            };

            // 向所有窗口发送封面更新事件
            const allWindows = BrowserWindow.getAllWindows();
            allWindows.forEach(window => {
                if (window && !window.isDestroyed()) {
                    window.webContents.send('cover-updated', eventData);
                }
            });
        }

        return {
            success: true,
            coverUpdated: coverUpdated,
            updatedMetadata: {
                filePath: filePath,
                title: updatedMetadata.title,
                artist: updatedMetadata.artist,
                album: updatedMetadata.album,
                year: updatedMetadata.year,
                genre: updatedMetadata.genre,
                cover: updatedMetadata.cover
            }
        };
    } catch (error) {
        console.error('❌ 更新歌曲元数据失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// 清理封面缓存
ipcMain.handle('covers:clearCache', async (event, filePath) => {
    try {
        console.log(`🧹 清理封面缓存: ${filePath}`);

        // 这里主要是为了日志记录，实际的缓存清理在渲染进程中进行
        // 因为封面缓存管理器在渲染进程中

        return {
            success: true,
            message: '封面缓存清理请求已处理'
        };
    } catch (error) {
        console.error('❌ 清理封面缓存失败:', error);
        return {
            success: false,
            error: error.message
        };
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

// 歌单管理IPC
// 创建新歌单
ipcMain.handle('library:createPlaylist', async (event, name, description = '') => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const playlist = libraryCacheManager.createPlaylist(name, description);
        await libraryCacheManager.saveCache();
        console.log(`✅ 创建歌单成功: ${playlist.name}`);
        return {success: true, playlist};
    } catch (error) {
        console.error('❌ 创建歌单失败:', error);
        return {success: false, error: error.message};
    }
});

// 获取所有歌单
ipcMain.handle('library:getPlaylists', async () => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const playlists = libraryCacheManager.getAllPlaylists();
        console.log(`📋 获取歌单列表: ${playlists.length} 个歌单`);
        return playlists;
    } catch (error) {
        console.error('❌ 获取歌单列表失败:', error);
        return [];
    }
});

// 获取歌单详情（包含歌曲）
ipcMain.handle('library:getPlaylistDetail', async (event, playlistId) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const playlist = libraryCacheManager.getPlaylistById(playlistId);
        if (!playlist) {
            return {success: false, error: '歌单不存在'};
        }

        const tracks = libraryCacheManager.getPlaylistTracks(playlistId);
        console.log(`📋 获取歌单详情: ${playlist.name} (${tracks.length} 首歌曲)`);
        return {
            success: true,
            playlist: {
                ...playlist,
                tracks
            }
        };
    } catch (error) {
        console.error('❌ 获取歌单详情失败:', error);
        return {success: false, error: error.message};
    }
});

// 删除歌单
ipcMain.handle('library:deletePlaylist', async (event, playlistId) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const playlist = libraryCacheManager.getPlaylistById(playlistId);
        if (!playlist) {
            return {success: false, error: '歌单不存在'};
        }

        const playlistName = playlist.name;
        libraryCacheManager.deletePlaylist(playlistId);
        await libraryCacheManager.saveCache();

        console.log(`🗑️ 删除歌单成功: ${playlistName}`);
        return {success: true};
    } catch (error) {
        console.error('❌ 删除歌单失败:', error);
        return {success: false, error: error.message};
    }
});

// 重命名歌单
ipcMain.handle('library:renamePlaylist', async (event, playlistId, newName) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const playlist = libraryCacheManager.renamePlaylist(playlistId, newName);
        await libraryCacheManager.saveCache();

        console.log(`✏️ 重命名歌单成功: ${playlist.name}`);
        return {success: true, playlist};
    } catch (error) {
        console.error('❌ 重命名歌单失败:', error);
        return {success: false, error: error.message};
    }
});

// 添加歌曲到歌单
ipcMain.handle('library:addToPlaylist', async (event, playlistId, trackFileIds) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        // 支持单个歌曲或多个歌曲
        const trackIds = Array.isArray(trackFileIds) ? trackFileIds : [trackFileIds];
        const results = [];

        for (const trackId of trackIds) {
            try {
                libraryCacheManager.addTrackToPlaylist(playlistId, trackId);
                results.push({trackId, success: true});
            } catch (error) {
                results.push({trackId, success: false, error: error.message});
                console.warn(`⚠️ 添加歌曲到歌单失败: ${trackId} - ${error.message}`);
            }
        }

        await libraryCacheManager.saveCache();

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ 添加歌曲到歌单: ${successCount}/${trackIds.length} 成功`);

        return {success: true, results};
    } catch (error) {
        console.error('❌ 添加歌曲到歌单失败:', error);
        return {success: false, error: error.message};
    }
});

// 更新歌单封面
ipcMain.handle('library:updatePlaylistCover', async (event, playlistId, imagePath) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const success = libraryCacheManager.updatePlaylistCover(playlistId, imagePath);
        if (success) {
            await libraryCacheManager.saveCache();
            console.log(`✅ 更新歌单封面成功: ${playlistId} -> ${imagePath}`);
            return {success: true};
        } else {
            return {success: false, error: '更新歌单封面失败'};
        }
    } catch (error) {
        console.error('❌ 更新歌单封面失败:', error);
        return {success: false, error: error.message};
    }
});

// 获取歌单封面
ipcMain.handle('library:getPlaylistCover', async (event, playlistId) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const coverPath = libraryCacheManager.getPlaylistCover(playlistId);
        return {success: true, coverPath};
    } catch (error) {
        console.error('❌ 获取歌单封面失败:', error);
        return {success: false, error: error.message};
    }
});

// 移除歌单封面
ipcMain.handle('library:removePlaylistCover', async (event, playlistId) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const success = libraryCacheManager.removePlaylistCover(playlistId);
        if (success) {
            await libraryCacheManager.saveCache();
            console.log(`✅ 移除歌单封面成功: ${playlistId}`);
            return {success: true};
        } else {
            return {success: false, error: '移除歌单封面失败'};
        }
    } catch (error) {
        console.error('❌ 移除歌单封面失败:', error);
        return {success: false, error: error.message};
    }
});

// 从歌单移除歌曲
ipcMain.handle('library:removeFromPlaylist', async (event, playlistId, trackFileIds) => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        // 支持单个歌曲或多个歌曲
        const trackIds = Array.isArray(trackFileIds) ? trackFileIds : [trackFileIds];
        const results = [];

        for (const trackId of trackIds) {
            try {
                libraryCacheManager.removeTrackFromPlaylist(playlistId, trackId);
                results.push({trackId, success: true});
            } catch (error) {
                results.push({trackId, success: false, error: error.message});
                console.warn(`⚠️ 从歌单移除歌曲失败: ${trackId} - ${error.message}`);
            }
        }

        await libraryCacheManager.saveCache();

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ 从歌单移除歌曲: ${successCount}/${trackIds.length} 成功`);

        return {success: true, results};
    } catch (error) {
        console.error('❌ 从歌单移除歌曲失败:', error);
        return {success: false, error: error.message};
    }
});


// 清理歌单中的无效歌曲引用
ipcMain.handle('library:cleanupPlaylists', async () => {
    try {
        if (!libraryCacheManager) {
            await initializeCacheManager();
        }

        const cleanedCount = libraryCacheManager.cleanupPlaylistTracks();
        if (cleanedCount > 0) {
            await libraryCacheManager.saveCache();
        }

        console.log(`🧹 清理歌单完成: 移除了 ${cleanedCount} 个无效引用`);
        return {success: true, cleanedCount};
    } catch (error) {
        console.error('❌ 清理歌单失败:', error);
        return {success: false, error: error.message};
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

// Network Drive IPC
// 挂载SMB网络磁盘
ipcMain.handle('network-drive:mountSMB', async (event, config) => {
    try {
        if (!networkDriveManager) {
            await initializeNetworkDriveManager();
        }
        return await networkDriveManager.mountSMB(config);
    } catch (error) {
        console.error('❌ 挂载SMB磁盘失败:', error);
        return false;
    }
});

// 挂载WebDAV网络磁盘
ipcMain.handle('network-drive:mountWebDAV', async (event, config) => {
    try {
        if (!networkDriveManager) {
            await initializeNetworkDriveManager();
        }
        return await networkDriveManager.mountWebDAV(config);
    } catch (error) {
        console.error('❌ 挂载WebDAV磁盘失败:', error);
        return false;
    }
});

// 卸载网络磁盘
ipcMain.handle('network-drive:unmount', async (event, driveId) => {
    try {
        if (!networkDriveManager) {
            return false;
        }
        return await networkDriveManager.unmountDrive(driveId);
    } catch (error) {
        console.error('❌ 卸载网络磁盘失败:', error);
        return false;
    }
});

// 获取已挂载的磁盘列表
ipcMain.handle('network-drive:getMountedDrives', async () => {
    try {
        if (!networkDriveManager) {
            return [];
        }
        return networkDriveManager.getMountedDrives();
    } catch (error) {
        console.error('❌ 获取挂载磁盘列表失败:', error);
        return [];
    }
});

// 检查磁盘连接状态
ipcMain.handle('network-drive:getStatus', async (event, driveId) => {
    try {
        if (!networkDriveManager) {
            return null;
        }
        return networkDriveManager.getDriveStatus(driveId);
    } catch (error) {
        console.error('❌ 获取磁盘状态失败:', error);
        return null;
    }
});

// 测试网络连接
ipcMain.handle('network-drive:testConnection', async (event, config) => {
    try {
        if (!networkDriveManager) {
            await initializeNetworkDriveManager();
        }

        if (config.type === 'smb') {
            const SMB2 = require('node-smb2');
            const smbConfig = {
                share: `\\\\${config.host}\\${config.share}`,
                domain: config.domain || 'WORKGROUP',
                username: config.username,
                password: config.password,
                autoCloseTimeout: 0
            };
            const smbClient = new SMB2(smbConfig);
            await networkDriveManager.testSMBConnection(smbClient);
            return true;
        } else if (config.type === 'webdav') {
            // 确保网络磁盘管理器已初始化WebDAV模块
            const loaded = await networkDriveManager.ensureWebDAVLoaded();
            if (!loaded) {
                throw new Error('WebDAV模块加载失败');
            }

            // 使用网络磁盘管理器的WebDAV模块
            const webdavModule = await import('webdav');
            const webdavClient = webdavModule.createClient(config.url, {
                username: config.username,
                password: config.password
            });
            await networkDriveManager.testWebDAVConnection(webdavClient);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ 测试网络连接失败:', error);
        throw error;
    }
});

// 刷新网络磁盘连接状态
ipcMain.handle('network-drive:refreshConnections', async () => {
    try {
        if (!networkDriveManager) {
            return false;
        }
        await networkDriveManager.refreshAllConnections();
        return true;
    } catch (error) {
        console.error('❌ 刷新网络磁盘连接状态失败:', error);
        return false;
    }
});

// 刷新指定网络磁盘连接状态
ipcMain.handle('network-drive:refreshConnection', async (event, driveId) => {
    try {
        if (!networkDriveManager) {
            return false;
        }
        await networkDriveManager.refreshConnection(driveId);
        return true;
    } catch (error) {
        console.error('❌ 刷新网络磁盘连接状态失败:', error);
        return false;
    }
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


// 内嵌歌词IPC处理器
ipcMain.handle('lyrics:getEmbedded', async (event, filePath) => {
    try {
        // 参数验证
        if (!filePath || typeof filePath !== 'string') {
            console.error('❌ 内嵌歌词获取失败: 无效的文件路径参数');
            return {
                success: false,
                error: '无效的文件路径参数'
            };
        }

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.error(`❌ 内嵌歌词获取失败: 文件不存在 - ${filePath}`);
            return {
                success: false,
                error: '指定的音频文件不存在'
            };
        }

        console.log(`🎵 获取内嵌歌词: ${filePath}`);

        // 使用music-metadata解析文件
        const metadata = await mm.parseFile(filePath);

        if (!metadata) {
            console.error(`❌ 内嵌歌词获取失败: 无法解析音频文件元数据 - ${filePath}`);
            return {
                success: false,
                error: '无法解析音频文件元数据'
            };
        }

        // 输出详细的元数据调试信息
        console.log('🔍 音频文件元数据概览:');
        console.log(`  - 格式: ${metadata.format?.container || '未知'}`);
        console.log(`  - 编解码器: ${metadata.format?.codec || '未知'}`);
        console.log(`  - 标题: ${metadata.common?.title || '未知'}`);
        console.log(`  - 艺术家: ${metadata.common?.artist || '未知'}`);

        if (metadata.native) {
            console.log('🔍 原生标签格式:');
            for (const [format, tags] of Object.entries(metadata.native)) {
                console.log(`  - ${format}: ${tags.length} 个标签`);
                // 显示前几个标签的ID
                const tagIds = tags.slice(0, 5).map(tag => tag.id).filter(id => id);
                if (tagIds.length > 0) {
                    console.log(`    标签ID: ${tagIds.join(', ')}${tags.length > 5 ? '...' : ''}`);
                }
            }
        } else {
            console.log('🔍 未找到原生标签数据');
        }

        const embeddedLyrics = extractEmbeddedLyrics(metadata);

        if (embeddedLyrics) {
            console.log(`✅ 成功提取内嵌歌词: ${embeddedLyrics.type} 格式 (语言: ${embeddedLyrics.language || '未知'})`);
            return {
                success: true,
                lyrics: embeddedLyrics,
                source: 'embedded'
            };
        } else {
            console.log(`ℹ️ 未找到内嵌歌词: ${filePath}`);
            return {
                success: false,
                error: '文件中未包含内嵌歌词'
            };
        }
    } catch (error) {
        console.error('❌ 获取内嵌歌词失败:', error);

        // 根据错误类型提供更具体的错误信息
        let errorMessage = error.message;
        if (error.code === 'ENOENT') {
            errorMessage = '音频文件不存在或无法访问';
        } else if (error.code === 'EACCES') {
            errorMessage = '没有权限访问音频文件';
        } else if (error.message.includes('unsupported format')) {
            errorMessage = '不支持的音频文件格式';
        } else if (error.message.includes('corrupted')) {
            errorMessage = '音频文件已损坏';
        }

        return {
            success: false,
            error: errorMessage
        };
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
        console.log(`📁 找到 ${lrcFiles.length} 个歌词文件`);

        // 生成可能的文件名匹配模式
        const searchPatterns = generateLyricsSearchPatterns(title, artist, album);
        console.log(`🔍 生成 ${searchPatterns.length} 个搜索模式:`, searchPatterns);

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
    const withoutBrackets = cleaned.replace(/[(\[{].*?[)\]}]/g, '').trim();
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
    console.log(`🔍 开始匹配 ${files.length} 个文件与 ${patterns.length} 个模式`);

    // 第一轮：精确匹配
    console.log(`🎯 第一轮：精确匹配`);
    for (const pattern of patterns) {
        const exactMatch = files.find(file => file.toLowerCase() === pattern.toLowerCase());
        if (exactMatch) {
            console.log(`✅ 精确匹配: ${exactMatch} = ${pattern}`);
            matches.push({file: exactMatch, score: 100, type: 'exact'});
        }
    }

    if (matches.length > 0) {
        console.log(`🎯 找到 ${matches.length} 个精确匹配，返回第一个`);
        return matches[0].file; // 返回第一个精确匹配
    }

    // 第二轮：高相似度匹配
    console.log(`🎯 第二轮：高相似度匹配 (阈值: 80%)`);
    for (const file of files) {
        const fileName = path.basename(file, '.lrc').toLowerCase();

        for (const pattern of patterns) {
            const patternName = path.basename(pattern, '.lrc').toLowerCase();
            const similarity = calculateStringSimilarity(fileName, patternName);
            if (similarity >= 0.8) { // 80%以上相似度
                console.log(`📊 高相似度匹配: ${file} vs ${patternName} - 相似度: ${(similarity * 100).toFixed(1)}%`);
                matches.push({file, score: similarity * 100, type: 'high_similarity'});
            }
        }
    }

    // 第三轮：包含匹配
    if (matches.length === 0) {
        console.log(`🎯 第三轮：关键词匹配 (要求: 至少1个精确匹配 + 70%总匹配度)`);
        for (const file of files) {
            const fileName = path.basename(file, '.lrc').toLowerCase();

            for (const pattern of patterns) {
                const patternName = path.basename(pattern, '.lrc').toLowerCase();

                // 解析模式，提取歌曲标题和艺术家
                const patternInfo = parseFileNamePattern(patternName);
                const fileInfo = parseFileNamePattern(fileName);
                if (!patternInfo.title || !fileInfo.title) {
                    // console.log(`⚠️ 跳过无法解析的模式: ${patternName}`);
                    continue;
                }

                // 计算标题匹配度（权重更高）
                const titleMatch = calculateWordMatch(fileInfo.title, patternInfo.title);

                // 计算艺术家匹配度（权重较低）
                const artistMatch = patternInfo.artist && fileInfo.artist ?
                    calculateWordMatch(fileInfo.artist, patternInfo.artist) : 0;

                // 评分机制：
                // 1. 标题匹配是必须的，权重70%
                // 2. 艺术家匹配是加分项，权重30%
                // 3. 标题匹配度必须>=0.6才考虑
                if (titleMatch >= 0.6) {
                    const score = (titleMatch * 0.7 + artistMatch * 0.3) * 60;
                    console.log(`🎯 有效匹配: ${file} - 综合得分: ${score.toFixed(1)} (标题: ${titleMatch.toFixed(2)}, 艺术家: ${artistMatch.toFixed(2)})`);
                    matches.push({file, score, type: 'keyword_match'});
                }
            }
        }
    }

    // 按分数排序，返回最佳匹配
    if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score);

        // 设置更严格的最低匹配分数阈值
        const bestMatch = matches[0];
        const minScoreThreshold = {
            'exact': 100,           // 精确匹配必须100分
            'high_similarity': 80,  // 高相似度至少80分
            'keyword_match': 50     // 关键词匹配至少50分
        };

        const requiredScore = minScoreThreshold[bestMatch.type] || 0;
        if (bestMatch.score >= requiredScore) {
            console.log(`🎯 找到匹配文件: ${bestMatch.file} (得分: ${bestMatch.score.toFixed(1)}, 类型: ${bestMatch.type})`);
            return bestMatch.file;
        }
    }
    return null;
}

// 解析文件名模式，提取标题和艺术家
function parseFileNamePattern(fileName) {
    // 常见的分隔符模式
    const separators = [' - ', ' – ', ' — ', '-', '_'];

    for (const sep of separators) {
        if (fileName.includes(sep)) {
            const parts = fileName.split(sep);
            if (parts.length >= 2) {
                // 尝试不同的组合：艺术家-标题 或 标题-艺术家
                return {
                    title: parts[1].trim(),
                    artist: parts[0].trim(),
                    originalFormat: 'artist-title'
                };
            }
        }
    }

    // 如果没有分隔符，整个文件名作为标题
    return {
        title: fileName.trim(),
        artist: '',
        originalFormat: 'title-only'
    };
}

// 计算词匹配度
function calculateWordMatch(str1, str2) {
    if (!str1 || !str2) return 0;

    const words1 = str1.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 1);
    const words2 = str2.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 1);

    if (words1.length === 0 || words2.length === 0) return 0;

    let matchedWords = 0;
    let totalWords = Math.max(words1.length, words2.length);

    for (const word1 of words1) {
        for (const word2 of words2) {
            // 精确匹配
            if (word1 === word2) {
                matchedWords += 1;
                break;
            }
            // 包含匹配（权重较低）
            else if (word1.includes(word2) || word2.includes(word1)) {
                matchedWords += 0.7;
                break;
            }
            // 相似度匹配（权重更低）
            else if (calculateStringSimilarity(word1, word2) >= 0.8) {
                matchedWords += 0.5;
                break;
            }
        }
    }
    return matchedWords / totalWords;
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

// 桌面歌词IPC
ipcMain.handle('desktopLyrics:create', async () => {
    try {
        await createDesktopLyricsWindow();
        return {success: true};
    } catch (error) {
        console.error('❌ 创建桌面歌词窗口失败:', error);
        return {success: false, error: error.message};
    }
});

ipcMain.handle('desktopLyrics:show', () => {
    const result = showDesktopLyrics();
    return {success: result};
});

ipcMain.handle('desktopLyrics:hide', () => {
    const result = hideDesktopLyrics();
    return {success: result};
});

ipcMain.handle('desktopLyrics:close', () => {
    const result = closeDesktopLyrics();
    return {success: result};
});

ipcMain.handle('desktopLyrics:isVisible', () => {
    return isDesktopLyricsVisible();
});

ipcMain.handle('desktopLyrics:toggle', async () => {
    try {
        if (!desktopLyricsWindow) {
            await createDesktopLyricsWindow();
            return {success: true, visible: true};
        } else if (desktopLyricsWindow.isVisible()) {
            hideDesktopLyrics();
            return {success: true, visible: false};
        } else {
            showDesktopLyrics();
            return {success: true, visible: true};
        }
    } catch (error) {
        console.error('❌ 切换桌面歌词窗口失败:', error);
        return {success: false, error: error.message};
    }
});

// 向桌面歌词窗口发送播放状态
ipcMain.handle('desktopLyrics:updatePlaybackState', (event, state) => {
    const result = sendToDesktopLyrics('playback:stateChanged', state);
    return {success: result};
});

// 向桌面歌词窗口发送歌词数据
ipcMain.handle('desktopLyrics:updateLyrics', (event, lyricsData) => {
    const result = sendToDesktopLyrics('lyrics:updated', lyricsData);
    return {success: result};
});

// 向桌面歌词窗口发送播放进度
ipcMain.handle('desktopLyrics:updatePosition', (event, position) => {
    const result = sendToDesktopLyrics('playback:positionChanged', position);
    return {success: result};
});

// 向桌面歌词窗口发送当前歌曲信息
ipcMain.handle('desktopLyrics:updateTrack', (event, trackInfo) => {
    const result = sendToDesktopLyrics('track:changed', trackInfo);
    return {success: result};
});

// 桌面歌词窗口位置和大小控制
ipcMain.handle('desktopLyrics:setPosition', (event, x, y) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        try {
            const posX = parseInt(x);
            const posY = parseInt(y);
            if (isNaN(posX) || isNaN(posY)) {
                return {success: false, error: '无效的窗口位置参数'};
            }
            desktopLyricsWindow.setPosition(posX, posY);
            return {success: true};
        } catch (error) {
            console.error('❌ 设置桌面歌词窗口位置失败:', error);
            return {success: false, error: error.message};
        }
    }
    return {success: false, error: '桌面歌词窗口不存在'};
});

ipcMain.handle('desktopLyrics:setSize', (event, width, height) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        try {
            const w = parseInt(width);
            const h = parseInt(height);

            // 统一尺寸限制
            const minWidth = 10;
            const minHeight = 10;
            const maxWidth = 2000;
            const maxHeight = 1500;

            if (isNaN(w) || isNaN(h) || w < minWidth || h < minHeight || w > maxWidth || h > maxHeight) {
                console.warn(`❌ 桌面歌词窗口尺寸验证失败: (${w}x${h}), 限制: ${minWidth}-${maxWidth} x ${minHeight}-${maxHeight}`);
                return {
                    success: false,
                    error: `窗口尺寸超出限制范围 (${minWidth}-${maxWidth} x ${minHeight}-${maxHeight})`
                };
            }

            desktopLyricsWindow.setSize(w, h);
            console.log(`✅ 桌面歌词窗口尺寸已设置: (${w}x${h})`);
            return {success: true};
        } catch (error) {
            console.error('❌ 设置桌面歌词窗口大小失败:', error);
            return {success: false, error: error.message};
        }
    }
    return {success: false, error: '桌面歌词窗口不存在'};
});

ipcMain.handle('desktopLyrics:setOpacity', (event, opacity) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        desktopLyricsWindow.setOpacity(opacity);
        return {success: true};
    }
    return {success: false};
});

ipcMain.handle('desktopLyrics:getPosition', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        return {success: true, position: desktopLyricsWindow.getPosition()};
    }
    return {success: false};
});

ipcMain.handle('desktopLyrics:getSize', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        return {success: true, size: desktopLyricsWindow.getSize()};
    }
    return {success: false};
});


// 封面缓存IPC
// 检查本地封面缓存是否存在
ipcMain.handle('covers:checkLocalCover', async (event, coverDir, title, artist, album) => {
    try {
        console.log(`🔍 检查本地封面缓存: ${title} - ${artist} 在目录 ${coverDir}`);

        if (!fs.existsSync(coverDir)) {
            return {success: false, error: '封面缓存目录不存在'};
        }

        const files = fs.readdirSync(coverDir);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        });

        const searchPatterns = generateCoverSearchPatterns(title, artist, album);
        const matchedFile = findBestCoverMatch(imageFiles, searchPatterns);
        if (matchedFile) {
            const fullPath = path.join(coverDir, matchedFile);
            console.log(`✅ 找到匹配的封面文件: ${matchedFile}`);
            return {success: true, filePath: fullPath, fileName: matchedFile};
        } else {
            console.log(`❌ 未找到匹配的封面文件`);
            return {success: false, error: '未找到匹配的封面文件'};
        }
    } catch (error) {
        console.error('❌ 检查本地封面缓存失败:', error);
        return {success: false, error: error.message};
    }
});

// 保存封面文件到本地缓存
ipcMain.handle('covers:saveCoverFile', async (event, coverDir, fileName, imageData, dataType) => {
    try {
        console.log(`💾 保存封面文件: ${fileName} 到目录 ${coverDir} (数据类型: ${dataType})`);

        // 确保封面缓存目录存在
        if (!fs.existsSync(coverDir)) {
            fs.mkdirSync(coverDir, {recursive: true});
            console.log(`📁 创建封面缓存目录: ${coverDir}`);
        }

        const fullPath = path.join(coverDir, fileName);

        // 根据数据类型处理图片数据
        if (dataType === 'arrayBuffer') {
            // ArrayBuffer数据（从Blob转换而来）
            const buffer = Buffer.from(imageData);
            fs.writeFileSync(fullPath, buffer);
            console.log(`✅ 封面文件保存成功 (arrayBuffer): ${fileName}`);
            return {success: true, filePath: fullPath, fileName: fileName};
        } else if (dataType === 'string' || typeof imageData === 'string') {
            // 字符串数据（URL或base64）
            if (imageData.startsWith('http')) {
                const downloadResult = await downloadImageFromUrl(imageData, fullPath);
                if (downloadResult.success) {
                    console.log(`✅ 封面文件下载并保存成功: ${fileName}`);
                    return {success: true, filePath: fullPath, fileName: fileName};
                } else {
                    return {success: false, error: downloadResult.error};
                }
            } else {
                const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                fs.writeFileSync(fullPath, base64Data, 'base64');
                console.log(`✅ 封面文件保存成功 (base64): ${fileName}`);
                return {success: true, filePath: fullPath, fileName: fileName};
            }
        } else if (imageData instanceof Buffer) {
            // 如果是Buffer数据（向后兼容）
            fs.writeFileSync(fullPath, imageData);
            console.log(`✅ 封面文件保存成功 (buffer): ${fileName}`);
            return {success: true, filePath: fullPath, fileName: fileName};
        } else {
            console.error(`❌ 不支持的图片数据格式: ${typeof imageData}, dataType: ${dataType}`);
            return {success: false, error: `不支持的图片数据格式: ${typeof imageData}`};
        }
    } catch (error) {
        console.error('❌ 保存封面文件失败:', error);
        return {success: false, error: error.message};
    }
});

// 从URL下载图片
async function downloadImageFromUrl(url, filePath) {
    try {
        const https = require('https');
        const http = require('http');

        return new Promise((resolve) => {
            const client = url.startsWith('https') ? https : http;

            const request = client.get(url, (response) => {
                if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(filePath);
                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve({success: true});
                    });

                    fileStream.on('error', (error) => {
                        fs.unlink(filePath, () => {
                        }); // 删除部分下载的文件
                        resolve({success: false, error: error.message});
                    });
                } else {
                    resolve({success: false, error: `HTTP ${response.statusCode}`});
                }
            });

            request.on('error', (error) => {
                resolve({success: false, error: error.message});
            });

            request.setTimeout(10000, () => {
                request.destroy();
                resolve({success: false, error: '下载超时'});
            });
        });
    } catch (error) {
        return {success: false, error: error.message};
    }
}

// 生成封面文件搜索模式
function generateCoverSearchPatterns(title, artist, album) {
    const patterns = [];

    // 清理文件名中的特殊字符
    const cleanTitle = cleanFileName(title);
    const cleanArtist = cleanFileName(artist);
    const cleanAlbum = cleanFileName(album);

    // 生成不同的变体
    const titleVariants = generateTextVariants(cleanTitle);
    const artistVariants = generateTextVariants(cleanArtist);

    // 常见的封面文件命名格式（按优先级排序）
    if (cleanTitle && cleanArtist) {
        // 标准格式
        for (const titleVar of titleVariants) {
            for (const artistVar of artistVariants) {
                patterns.push(`${artistVar}_${titleVar}_${cleanAlbum}`);
                patterns.push(`${artistVar}_${titleVar}`);
                patterns.push(`${artistVar} - ${titleVar}`);
                patterns.push(`${titleVar} - ${artistVar}`);
                patterns.push(`${artistVar}-${titleVar}`);
                patterns.push(`${titleVar}-${artistVar}`);
            }
        }
    }

    // 只有歌曲名的情况
    if (cleanTitle) {
        for (const titleVar of titleVariants) {
            patterns.push(titleVar);
        }
    }
    // 只有艺术家名的情况
    if (cleanArtist) {
        for (const artistVar of artistVariants) {
            patterns.push(artistVar);
        }
    }
    return patterns;
}

// 查找最佳封面文件匹配
function findBestCoverMatch(imageFiles, searchPatterns) {
    let bestMatch = null;
    let bestScore = 0;

    for (const file of imageFiles) {
        const fileNameWithoutExt = path.parse(file).name.toLowerCase();

        for (let i = 0; i < searchPatterns.length; i++) {
            const pattern = searchPatterns[i].toLowerCase();
            const score = calculateCoverMatchScore(fileNameWithoutExt, pattern, i);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = file;
            }
        }
    }
    return bestMatch;
}

// 计算封面文件匹配分数
function calculateCoverMatchScore(fileName, pattern, patternIndex) {
    if (!fileName || !pattern) return 0;

    if (fileName === pattern) {
        return 1000 - patternIndex; // 优先级越高分数越高
    }
    if (fileName.includes(pattern)) {
        return 500 - patternIndex;
    }
    // 模糊匹配，计算相似度
    const similarity = calculateStringSimilarity(fileName, pattern);
    if (similarity > 0.7) {
        return Math.floor(similarity * 300) - patternIndex;
    }
    return 0;
}
