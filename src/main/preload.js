const {contextBridge, ipcRenderer} = require('electron');

const OS_ALLOWED = [
    'platform', 'type', 'arch', 'release',
    'uptime', 'freemem', 'totalmem', 'cpus', 'loadavg', 'endianness'
];
const PATH_ALLOWED = [
    'join', 'resolve', 'normalize', 'basename', 'dirname',
    'extname', 'isAbsolute', 'relative', 'parse', 'format', 'sep'
];
const FS_ALLOWED = [
    'stat', 'lstat', 'readdir', 'readFile', 'realpath', 'access'
];

const osApi = {};
const pathApi = {};
const fsApi = {};
for (const prop of OS_ALLOWED) {
    osApi[prop] = (...args) => ipcRenderer.invoke('os:call', { prop, args });
}
for (const prop of PATH_ALLOWED) {
    pathApi[prop] = (...args) => ipcRenderer.invoke('path:call', { prop, args });
}
for (const prop of FS_ALLOWED) {
    fsApi[prop] = (...args) => ipcRenderer.invoke('fs:call', { prop, args });
}

// 暴露安全的IPC方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 应用信息
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
    getTempPath: () => ipcRenderer.invoke('app:getTempPath'),
    openUserDataFolder: () => ipcRenderer.invoke('app:openUserDataFolder'),
    getDefaultCoverCachePath: () => ipcRenderer.invoke('app:getDefaultCoverCachePath'),
    ensureDirectoryExists: (dirPath) => ipcRenderer.invoke('app:ensureDirectoryExists', dirPath),
    openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
    openPath: (path) => ipcRenderer.invoke('app:openPath', path),

    // 文件对话框
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    openImageFile: () => ipcRenderer.invoke('dialog:openImageFile'),

    // 对话框API
    dialog: {
        showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
    },

    // 文件系统API
    fs: {
        fs: fsApi,
        stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
        readFile: (filePath, encoding) => ipcRenderer.invoke('fs:readFile', filePath, encoding)
    },

    // 系统API
    os: osApi,
    path: pathApi,

    // HTTP服务器API
    httpServer: {
        create: (config) => ipcRenderer.invoke('httpServer:create', config),
        start: (serverId) => ipcRenderer.invoke('httpServer:start', serverId),
        stop: (serverId) => ipcRenderer.invoke('httpServer:stop', serverId),
        destroy: (serverId) => ipcRenderer.invoke('httpServer:destroy', serverId),
        getStatus: (serverId) => ipcRenderer.invoke('httpServer:getStatus', serverId),
        list: () => ipcRenderer.invoke('httpServer:list'),
        registerHandler: (serverId, method, path, handlerId) =>
            ipcRenderer.invoke('httpServer:registerHandler', serverId, method, path, handlerId),

        // 处理HTTP请求的回调注册
        onHandleRequest: (callback) => {
            const wrappedCallback = async (event, requestData) => {
                try {
                    const response = await callback(requestData);
                    const responseData = {
                        ...response,
                        requestId: requestData.requestId
                    };
                    ipcRenderer.send('httpServer:handleResponse', responseData);

                } catch (error) {
                    console.error('插件处理失败:', error);
                    const errorResponse = {
                        success: false,
                        error: error.message,
                        statusCode: 500,
                        requestId: requestData.requestId
                    };
                    ipcRenderer.send('httpServer:handleResponse', errorResponse);
                }
            };

            ipcRenderer.on('httpServer:handleRequest', wrappedCallback);
            return () => {
                ipcRenderer.removeListener('httpServer:handleRequest', wrappedCallback);
            };
        }
    },

    // 音频引擎（传统IPC音频引擎，作为后备）
    audio: {
        // Initialize the audio engine
        init: () => ipcRenderer.invoke('audio:init'),

        // Playback controls
        play: () => ipcRenderer.invoke('audio:play'),
        pause: () => ipcRenderer.invoke('audio:pause'),
        stop: () => ipcRenderer.invoke('audio:stop'),
        seek: (position) => ipcRenderer.invoke('audio:seek', position),
        setVolume: (volume) => ipcRenderer.invoke('audio:setVolume', volume),

        // Track management
        loadTrack: (filePath) => ipcRenderer.invoke('audio:loadTrack', filePath),
        getCurrentTrack: () => ipcRenderer.invoke('audio:getCurrentTrack'),
        getPosition: () => ipcRenderer.invoke('audio:getPosition'),
        getDuration: () => ipcRenderer.invoke('audio:getDuration'),

        // Playlist management
        setPlaylist: (tracks) => ipcRenderer.invoke('audio:setPlaylist', tracks),
        nextTrack: () => ipcRenderer.invoke('audio:nextTrack'),
        previousTrack: () => ipcRenderer.invoke('audio:previousTrack'),

        // Event listeners
        onTrackChanged: (callback) => {
            ipcRenderer.on('audio:trackChanged', callback);
            return () => ipcRenderer.removeListener('audio:trackChanged', callback);
        },
        onPlaybackStateChanged: (callback) => {
            ipcRenderer.on('audio:playbackStateChanged', callback);
            return () => ipcRenderer.removeListener('audio:playbackStateChanged', callback);
        },
        onPositionChanged: (callback) => {
            ipcRenderer.on('audio:positionChanged', callback);
            return () => ipcRenderer.removeListener('audio:positionChanged', callback);
        }
    },

    // Native音频引擎（WASAPI独占模式）
    nativeAudio: {
        // 初始化Native音频引擎
        initialize: () => ipcRenderer.invoke('native-audio:initialize'),

        // 播放控制
        loadTrack: (filePath) => ipcRenderer.invoke('native-audio:load-track', filePath),
        play: () => ipcRenderer.invoke('native-audio:play'),
        pause: () => ipcRenderer.invoke('native-audio:pause'),
        stop: () => ipcRenderer.invoke('native-audio:stop'),
        seek: (position) => ipcRenderer.invoke('native-audio:seek', position),

        // 音量控制
        setVolume: (volume) => ipcRenderer.invoke('native-audio:set-volume', volume),
        getVolume: () => ipcRenderer.invoke('native-audio:get-volume'),

        // 播放状态查询
        getPosition: () => ipcRenderer.invoke('native-audio:get-position'),
        getDuration: () => ipcRenderer.invoke('native-audio:get-duration'),
        isPlaying: () => ipcRenderer.invoke('native-audio:is-playing'),

        // 销毁引擎
        destroy: () => ipcRenderer.invoke('native-audio:destroy'),
    },

    // Native音频引擎事件监听
    onNativeAudioEvent: (eventName, callback) => {
        const channel = `native-audio:${eventName}`;
        const wrappedCallback = (event, data) => callback(data);
        ipcRenderer.on(channel, wrappedCallback);
        return () => ipcRenderer.removeListener(channel, wrappedCallback);
    },

    // 音乐库
    library: {
        // Scan for music files
        scanDirectory: (path) => ipcRenderer.invoke('library:scanDirectory', path),
        scanNetworkDrive: (driveId, relativePath) => ipcRenderer.invoke('library:scanNetworkDrive', driveId, relativePath),
        scanSingleFile: (networkPath) => ipcRenderer.invoke('library:scanSingleFile', networkPath),
        scanDirectoryForFiles: (path) => ipcRenderer.invoke('library:scanDirectoryForFiles', path),
        addTrackToLibrary: (audioFile) => ipcRenderer.invoke('library:addTrackToLibrary', audioFile),

        // Get library data
        getTracks: (options) => ipcRenderer.invoke('library:getTracks', options),
        getAlbums: () => ipcRenderer.invoke('library:getAlbums'),
        getArtists: () => ipcRenderer.invoke('library:getArtists'),
        getPlaylists: () => ipcRenderer.invoke('library:getPlaylists'),

        // Search
        search: (query) => ipcRenderer.invoke('library:search', query),

        // Metadata
        getTrackMetadata: (filePath) => ipcRenderer.invoke('library:getTrackMetadata', filePath),
        updateTrackMetadata: (trackId, metadata) => ipcRenderer.invoke('library:updateTrackMetadata', trackId, metadata),

        // Cover cache management
        clearCoverCache: (filePath) => ipcRenderer.invoke('covers:clearCache', filePath),

        // Playlists
        createPlaylist: (name, description) => ipcRenderer.invoke('library:createPlaylist', name, description),
        // getPlaylists: () => ipcRenderer.invoke('library:getPlaylists'),
        getPlaylistDetail: (playlistId) => ipcRenderer.invoke('library:getPlaylistDetail', playlistId),
        deletePlaylist: (playlistId) => ipcRenderer.invoke('library:deletePlaylist', playlistId),
        renamePlaylist: (playlistId, newName) => ipcRenderer.invoke('library:renamePlaylist', playlistId, newName),
        addToPlaylist: (playlistId, trackIds) => ipcRenderer.invoke('library:addToPlaylist', playlistId, trackIds),
        removeFromPlaylist: (playlistId, trackIds) => ipcRenderer.invoke('library:removeFromPlaylist', playlistId, trackIds),
        cleanupPlaylists: () => ipcRenderer.invoke('library:cleanupPlaylists'),

        // 缓存管理
        loadCachedTracks: () => ipcRenderer.invoke('library:loadCachedTracks'),
        validateCache: () => ipcRenderer.invoke('library:validateCache'),
        getCacheStatistics: () => ipcRenderer.invoke('library:getCacheStatistics'),
        clearCache: () => ipcRenderer.invoke('library:clearCache'),
        removeTrack: (trackFileId) => ipcRenderer.invoke('library:removeTrack', trackFileId),
        getTracksByDrive: (driveId) => ipcRenderer.invoke('library:getTracksByDrive', driveId),
        removeTracksByDrive: (driveId) => ipcRenderer.invoke('library:removeTracksByDrive', driveId),
        clearIgnoreList: () => ipcRenderer.invoke('library:clearIgnoreList'),

        // 歌单封面
        updatePlaylistCover: (playlistId, imagePath) => ipcRenderer.invoke('library:updatePlaylistCover', playlistId, imagePath),
        getPlaylistCover: (playlistId) => ipcRenderer.invoke('library:getPlaylistCover', playlistId),
        removePlaylistCover: (playlistId) => ipcRenderer.invoke('library:removePlaylistCover', playlistId),

        // Event listeners
        onLibraryUpdated: (callback) => {
            ipcRenderer.on('library:updated', callback);
            return () => ipcRenderer.removeListener('library:updated', callback);
        },
        onScanProgress: (callback) => {
            ipcRenderer.on('library:scanProgress', callback);
            return () => ipcRenderer.removeListener('library:scanProgress', callback);
        },
        onCacheValidationProgress: (callback) => {
            ipcRenderer.on('library:cacheValidationProgress', (event, progress) => callback(progress));
            return () => ipcRenderer.removeListener('library:cacheValidationProgress', callback);
        },
        onCoverUpdated: (callback) => {
            ipcRenderer.on('cover-updated', (event, data) => callback(data));
            return () => ipcRenderer.removeListener('cover-updated', callback);
        }
    },

    // 音乐文件操作
    readAudioFile: (filePath) => ipcRenderer.invoke('file:readAudio', filePath),

    // 设置
    settings: {
        get: (key) => ipcRenderer.invoke('settings:get', key),
        set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        reset: () => ipcRenderer.invoke('settings:reset'),

        // 音乐文件夹管理
        getMusicFolders: () => ipcRenderer.invoke('settings:getMusicFolders'),
        addMusicFolder: (folderPath) => ipcRenderer.invoke('settings:addMusicFolder', folderPath),
        removeMusicFolder: (folderPath) => ipcRenderer.invoke('settings:removeMusicFolder', folderPath),

        // 自动扫描设置
        getAutoScanSettings: () => ipcRenderer.invoke('settings:getAutoScanSettings'),
        updateAutoScanSettings: (settings) => ipcRenderer.invoke('settings:updateAutoScanSettings', settings),
        updateLastScanTime: (timestamp) => ipcRenderer.invoke('settings:updateLastScanTime', timestamp)
    },

    // 硬件加速
    hardwareAcceleration: {
        getSettings: () => ipcRenderer.invoke('hardwareAcceleration:getSettings'),
        updateSettings: (settings) => ipcRenderer.invoke('hardwareAcceleration:updateSettings', settings),
        resetSettings: () => ipcRenderer.invoke('hardwareAcceleration:resetSettings')
    },

    // 应用控制
    app: {
        restart: () => ipcRenderer.invoke('app:restart'),
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        getPlatform: () => ipcRenderer.invoke('app:getPlatform')
    },

    // 网络磁盘
    networkDrive: {
        mountSMB: (config) => ipcRenderer.invoke('network-drive:mountSMB', config),
        mountWebDAV: (config) => ipcRenderer.invoke('network-drive:mountWebDAV', config),
        unmount: (driveId) => ipcRenderer.invoke('network-drive:unmount', driveId),
        getMountedDrives: () => ipcRenderer.invoke('network-drive:getMountedDrives'),
        getStatus: (driveId) => ipcRenderer.invoke('network-drive:getStatus', driveId),
        testConnection: (config) => ipcRenderer.invoke('network-drive:testConnection', config),
        refreshConnections: () => ipcRenderer.invoke('network-drive:refreshConnections'),
        refreshConnection: (driveId) => ipcRenderer.invoke('network-drive:refreshConnection', driveId),
        getDirectoryStructure: (driveId, dirPath) => ipcRenderer.invoke('network-drive:getDirectoryStructure', driveId, dirPath),

        // 监听网络磁盘事件
        onConnected: (callback) => ipcRenderer.on('network-drive:connected', callback),
        onDisconnected: (callback) => ipcRenderer.on('network-drive:disconnected', callback),
        onError: (callback) => ipcRenderer.on('network-drive:error', callback),

        removeListener: (event, callback) => ipcRenderer.removeListener(`network-drive:${event}`, callback)
    },

    // 歌词管理
    lyrics: {
        // 本地歌词文件
        readLocalFile: (filePath) => ipcRenderer.invoke('lyrics:readLocalFile', filePath),
        searchLocalFiles: (lyricsDir, title, artist, album, extension) =>
            ipcRenderer.invoke('lyrics:searchLocalFiles', lyricsDir, title, artist, album, extension),
        saveToLocal: (lyricsDir, title, artist, album, content, format) =>
            ipcRenderer.invoke('lyrics:saveToLocal', lyricsDir, title, artist, album, content, format),

        // 内嵌歌词
        getEmbedded: (filePath) => ipcRenderer.invoke('lyrics:getEmbedded', filePath),
    },

    // 本地封面缓存
    covers: {
        checkLocalCover: (coverDir, title, artist, album, isAlbum = false) =>
            ipcRenderer.invoke('covers:checkLocalCover', coverDir, title, artist, album, isAlbum),
        saveCoverFile: (coverDir, fileName, imageData, dataType) =>
            ipcRenderer.invoke('covers:saveCoverFile', coverDir, fileName, imageData, dataType)
    },

    // 全局快捷键
    globalShortcuts: {
        register: (shortcuts) => ipcRenderer.invoke('globalShortcuts:register', shortcuts),
        unregister: () => ipcRenderer.invoke('globalShortcuts:unregister'),
        setEnabled: (enabled) => ipcRenderer.invoke('globalShortcuts:setEnabled', enabled),
        isEnabled: () => ipcRenderer.invoke('globalShortcuts:isEnabled'),

        // 监听全局快捷键触发器
        onTriggered: (callback) => {
            ipcRenderer.on('global-shortcut-triggered', callback);
            return () => ipcRenderer.removeListener('global-shortcut-triggered', callback);
        }
    },

    // 窗口控制
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
        close: () => ipcRenderer.invoke('window:close'),
        getPosition: () => ipcRenderer.invoke('window:getPosition'),
        getSize: () => ipcRenderer.invoke('window:getSize'),
        setSize: (width, height) => ipcRenderer.invoke('window:setSize', width, height),
        sendPosition: (data) => ipcRenderer.send('custom-adsorption', data),
        // 主动尺寸保护机制 - 清理缓存的尺寸信息
        clearSizeCache: () => ipcRenderer.send('clear-size-cache'),
        // 监听窗口状态变化
        onMaximizedChanged: (callback) => {
            ipcRenderer.on('window:maximized', (event, isMaximized) => callback(isMaximized));
            return () => ipcRenderer.removeListener('window:maximized', callback);
        }
    },

    // 桌面歌词
    desktopLyrics: {
        // 窗口控制
        create: () => ipcRenderer.invoke('desktopLyrics:create'),
        show: () => ipcRenderer.invoke('desktopLyrics:show'),
        hide: () => ipcRenderer.invoke('desktopLyrics:hide'),
        close: () => ipcRenderer.invoke('desktopLyrics:close'),
        toggle: () => ipcRenderer.invoke('desktopLyrics:toggle'),
        isVisible: () => ipcRenderer.invoke('desktopLyrics:isVisible'),

        // 数据同步
        updatePlaybackState: (state) => ipcRenderer.invoke('desktopLyrics:updatePlaybackState', state),
        updateLyrics: (lyricsData) => ipcRenderer.invoke('desktopLyrics:updateLyrics', lyricsData),
        updatePosition: (position) => ipcRenderer.invoke('desktopLyrics:updatePosition', position),
        updateTrack: (trackInfo) => ipcRenderer.invoke('desktopLyrics:updateTrack', trackInfo),
        updateSettings: (settings) => ipcRenderer.invoke('desktopLyrics:updateSettings', settings),

        // 窗口控制
        setPosition: (x, y) => ipcRenderer.invoke('desktopLyrics:setPosition', x, y),
        setSize: (width, height) => ipcRenderer.invoke('desktopLyrics:setSize', width, height),
        setOpacity: (opacity) => ipcRenderer.invoke('desktopLyrics:setOpacity', opacity),
        setAlwaysOnTop: (flag) => ipcRenderer.invoke('desktopLyrics:setAlwaysOnTop', flag),
        setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('desktopLyrics:setIgnoreMouseEvents', ignore, options),
        getPosition: () => ipcRenderer.invoke('desktopLyrics:getPosition'),
        getSize: () => ipcRenderer.invoke('desktopLyrics:getSize'),
        centerOnScreen: () => ipcRenderer.invoke('desktopLyrics:centerOnScreen'),

        // 事件监听（用于桌面歌词窗口）
        onPlaybackStateChanged: (callback) => {
            ipcRenderer.on('playback:stateChanged', (event, state) => callback(state));
            return () => ipcRenderer.removeListener('playback:stateChanged', callback);
        },
        onLyricsUpdated: (callback) => {
            ipcRenderer.on('lyrics:updated', (event, lyricsData) => callback(lyricsData));
            return () => ipcRenderer.removeListener('lyrics:updated', callback);
        },
        onPositionChanged: (callback) => {
            ipcRenderer.on('playback:positionChanged', (event, position) => callback(position));
            return () => ipcRenderer.removeListener('playback:positionChanged', callback);
        },
        onTrackChanged: (callback) => {
            ipcRenderer.on('track:changed', (event, trackInfo) => callback(trackInfo));
            return () => ipcRenderer.removeListener('track:changed', callback);
        },
        onSettingsChanged: (callback) => {
            ipcRenderer.on('settings:changed', (event, settings) => callback(settings));
            return () => ipcRenderer.removeListener('settings:changed', callback);
        }
    },

    // 系统托盘
    tray: {
        create: () => ipcRenderer.invoke('tray:create'),
        destroy: () => ipcRenderer.invoke('tray:destroy'),
        updateSettings: (settings) => ipcRenderer.invoke('tray:updateSettings', settings),
        getSettings: () => ipcRenderer.invoke('tray:getSettings'),
        // 监听托盘退出事件
        onQuit: (callback) => {
            ipcRenderer.on('tray:quit', callback);
            return () => ipcRenderer.removeListener('tray:quit', callback);
        }
    },

    // 内存管理
    memory: {
        forceGC: () => ipcRenderer.invoke('memory:forceGC'),
    },

    extensions: {
        selectPackage: () => ipcRenderer.invoke('extensions:selectPackage'),
        installFromFile: (filePath) => ipcRenderer.invoke('extensions:installFromFile', filePath),
        uninstall: (extensionId, keepData) => ipcRenderer.invoke('extensions:uninstall', extensionId, keepData),
        enable: (extensionId) => ipcRenderer.invoke('extensions:enable', extensionId),
        disable: (extensionId) => ipcRenderer.invoke('extensions:disable', extensionId),
        getInstalled: () => ipcRenderer.invoke('extensions:getInstalled'),
        scanUserExtensions: () => ipcRenderer.invoke('extensions:scanUserExtensions'),
        readExtensionFile: (extensionId, filePath) => ipcRenderer.invoke('extensions:readExtensionFile', extensionId, filePath),
    },

    userdata: {
        getMoodHistory: () => ipcRenderer.invoke('userdata:getMoodHistory'),
        saveMood: (moodData) => ipcRenderer.invoke('userdata:saveMood', moodData),
        getDiaryHistory: () => ipcRenderer.invoke('userdata:getDiaryHistory'),
        saveDiary: (diaryData) => ipcRenderer.invoke('userdata:saveDiary', diaryData),
        deleteMood: (timestamp) => ipcRenderer.invoke('userdata:deleteMood', timestamp),
        deleteDiary: (timestamp) => ipcRenderer.invoke('userdata:deleteDiary', timestamp),
    }
});
