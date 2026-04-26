import {contextBridge, ipcRenderer} from 'electron';

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

const osApi: Record<string, (...args: any[]) => Promise<any>> = {};
const pathApi: Record<string, (...args: any[]) => Promise<any>> = {};
const fsApi: Record<string, (...args: any[]) => Promise<any>> = {};
for (const prop of OS_ALLOWED) {
    osApi[prop] = (...args) => ipcRenderer.invoke('os:call', {prop, args});
}
for (const prop of PATH_ALLOWED) {
    pathApi[prop] = (...args) => ipcRenderer.invoke('path:call', {prop, args});
}
for (const prop of FS_ALLOWED) {
    fsApi[prop] = (...args) => ipcRenderer.invoke('fs:call', {prop, args});
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
    ensureDirectoryExists: (dirPath: string) => ipcRenderer.invoke('app:ensureDirectoryExists', dirPath),
    openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
    openPath: (path: string) => ipcRenderer.invoke('app:openPath', path),

    // 文件对话框
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    openImageFile: () => ipcRenderer.invoke('dialog:openImageFile'),

    // 对话框API
    dialog: {
        showOpenDialog: (options: unknown) => ipcRenderer.invoke('dialog:showOpenDialog', options),
        openFile: (options: unknown) => ipcRenderer.invoke('dialog:openFile', options),
        saveFile: (options: unknown) => ipcRenderer.invoke('dialog:saveFile', options),
    },

    // 文件系统API
    fs: {
        stat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
        readFile: (filePath: string, encoding: string) => ipcRenderer.invoke('fs:readFile', filePath, encoding),
        writeFile: (filePath: string, data: unknown, encoding: string) => ipcRenderer.invoke('fs:writeFile', filePath, data, encoding)
    },

    // 系统API
    os: osApi,
    path: pathApi,

    // HTTP服务器API
    httpServer: {
        create: (config: any) => ipcRenderer.invoke('httpServer:create', config),
        start: (serverId: string) => ipcRenderer.invoke('httpServer:start', serverId),
        stop: (serverId: string) => ipcRenderer.invoke('httpServer:stop', serverId),
        destroy: (serverId: string) => ipcRenderer.invoke('httpServer:destroy', serverId),
        getStatus: (serverId: string) => ipcRenderer.invoke('httpServer:getStatus', serverId),
        list: () => ipcRenderer.invoke('httpServer:list'),
        registerHandler: (serverId: string, method: string, path: string, handlerId: string) =>
            ipcRenderer.invoke('httpServer:registerHandler', serverId, method, path, handlerId),

        // 处理HTTP请求的回调注册
        onHandleRequest: (callback: Function) => {
            const wrappedCallback = async (_event: unknown, requestData: any) => {
                try {
                    const response = await callback(requestData);
                    const responseData = {
                        ...response,
                        requestId: requestData.requestId
                    };
                    ipcRenderer.send('httpServer:handleResponse', responseData);

                } catch (error: any) {
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
        seek: (position: number) => ipcRenderer.invoke('audio:seek', position),
        setVolume: (volume: number) => ipcRenderer.invoke('audio:setVolume', volume),

        // Track management
        loadTrack: (filePath: string) => ipcRenderer.invoke('audio:loadTrack', filePath),
        getCurrentTrack: () => ipcRenderer.invoke('audio:getCurrentTrack'),
        getPosition: () => ipcRenderer.invoke('audio:getPosition'),
        getDuration: () => ipcRenderer.invoke('audio:getDuration'),

        // Playlist management
        setPlaylist: (tracks: []) => ipcRenderer.invoke('audio:setPlaylist', tracks),
        nextTrack: () => ipcRenderer.invoke('audio:nextTrack'),
        previousTrack: () => ipcRenderer.invoke('audio:previousTrack'),

        // Event listeners
        onTrackChanged: (callback: (...args: any[]) => void) => {
            ipcRenderer.on('audio:trackChanged', callback);
            return () => ipcRenderer.removeListener('audio:trackChanged', callback);
        },
        onPlaybackStateChanged: (callback: (...args: any[]) => void) => {
            ipcRenderer.on('audio:playbackStateChanged', callback);
            return () => ipcRenderer.removeListener('audio:playbackStateChanged', callback);
        },
        onPositionChanged: (callback: (...args: any[]) => void) => {
            ipcRenderer.on('audio:positionChanged', callback);
            return () => ipcRenderer.removeListener('audio:positionChanged', callback);
        }
    },

    // Native音频引擎（WASAPI独占模式）
    nativeAudio: {
        // 初始化Native音频引擎
        initialize: () => ipcRenderer.invoke('native-audio:initialize'),

        // 播放控制
        loadTrack: (filePath: string) => ipcRenderer.invoke('native-audio:load-track', filePath),
        play: () => ipcRenderer.invoke('native-audio:play'),
        pause: () => ipcRenderer.invoke('native-audio:pause'),
        stop: () => ipcRenderer.invoke('native-audio:stop'),
        seek: (position: number) => ipcRenderer.invoke('native-audio:seek', position),

        // 音量控制
        setVolume: (volume: number) => ipcRenderer.invoke('native-audio:set-volume', volume),

        // 播放状态查询
        getPosition: () => ipcRenderer.invoke('native-audio:get-position'),

        // 均衡器控制
        setEqualizerEnabled: (enabled: boolean) => ipcRenderer.invoke('native-audio:set-equalizer-enabled', enabled),
        isEqualizerEnabled: () => ipcRenderer.invoke('native-audio:is-equalizer-enabled'),
        setEqualizerPreamp: (gain: number) => ipcRenderer.invoke('native-audio:set-equalizer-preamp', gain),
        getEqualizerPreamp: () => ipcRenderer.invoke('native-audio:get-equalizer-preamp'),
        setEqualizerBandGain: (band: number, gain: number) => ipcRenderer.invoke('native-audio:set-equalizer-band-gain', band, gain),
        getEqualizerBandGain: (band: number) => ipcRenderer.invoke('native-audio:get-equalizer-band-gain', band),
        setEqualizerBandQ: (band: number, q: number) => ipcRenderer.invoke('native-audio:set-equalizer-band-q', band, q),
        getEqualizerBandQ: (band: number) => ipcRenderer.invoke('native-audio:get-equalizer-band-q', band),
        resetEqualizer: () => ipcRenderer.invoke('native-audio:reset-equalizer'),
        applyEqualizerPreset: (preset: any) => ipcRenderer.invoke('native-audio:apply-equalizer-preset', preset),
        getEqualizerFrequencyResponse: () => ipcRenderer.invoke('native-audio:get-equalizer-frequency-response'),

        // 均衡器模式切换
        setEqualizerMode: (mode: string) => ipcRenderer.invoke('native-audio:set-equalizer-mode', mode),
        getEqualizerMode: () => ipcRenderer.invoke('native-audio:get-equalizer-mode'),

        // 参量均衡器控制
        parametricSetEnabled: (enabled: boolean) => ipcRenderer.invoke('native-audio:parametric-set-enabled', enabled),
        parametricIsEnabled: () => ipcRenderer.invoke('native-audio:parametric-is-enabled'),
        parametricSetPreamp: (gain: number) => ipcRenderer.invoke('native-audio:parametric-set-preamp', gain),
        parametricGetPreamp: () => ipcRenderer.invoke('native-audio:parametric-get-preamp'),
        parametricAddBand: (config: any) => ipcRenderer.invoke('native-audio:parametric-add-band', config),
        parametricRemoveBand: (bandId: unknown) => ipcRenderer.invoke('native-audio:parametric-remove-band', bandId),
        parametricUpdateBand: (config: any) => ipcRenderer.invoke('native-audio:parametric-update-band', config),
        parametricGetBands: () => ipcRenderer.invoke('native-audio:parametric-get-bands'),
        parametricGetBand: (bandId: unknown) => ipcRenderer.invoke('native-audio:parametric-get-band', bandId),
        parametricReset: () => ipcRenderer.invoke('native-audio:parametric-reset'),
        parametricClearBands: () => ipcRenderer.invoke('native-audio:parametric-clear-bands'),

        // WASAPI 模式切换
        setShareMode: (mode: string) => ipcRenderer.invoke('native-audio:set-share-mode', mode),
        getShareMode: () => ipcRenderer.invoke('native-audio:get-share-mode'),
        switchShareMode: (mode: string) => ipcRenderer.invoke('native-audio:switch-share-mode', mode),

        // 销毁引擎
        destroy: () => ipcRenderer.invoke('native-audio:destroy'),
    },

    // Native音频引擎事件监听
    onNativeAudioEvent: (eventName: string, callback: (data: any) => void) => {
        const channel = `native-audio:${eventName}`;
        const wrappedCallback = (_event: any, data: any) => callback(data);
        ipcRenderer.on(channel, wrappedCallback);
        return () => ipcRenderer.removeListener(channel, wrappedCallback);
    },

    // 音乐库
    library: {
        // Scan for music files
        scanDirectory: (path: string) => ipcRenderer.invoke('library:scanDirectory', path),
        scanNetworkDrive: (driveId: string, relativePath: string) => ipcRenderer.invoke('library:scanNetworkDrive', driveId, relativePath),
        scanSingleFile: (networkPath: string) => ipcRenderer.invoke('library:scanSingleFile', networkPath),
        scanDirectoryForFiles: (path: string) => ipcRenderer.invoke('library:scanDirectoryForFiles', path),
        addTrackToLibrary: (audioFile: any) => ipcRenderer.invoke('library:addTrackToLibrary', audioFile),

        // Get library data
        getTracks: (options: any) => ipcRenderer.invoke('library:getTracks', options),
        getPlaylists: () => ipcRenderer.invoke('library:getPlaylists'),

        // Search
        search: (query: string) => ipcRenderer.invoke('library:search', query),

        // Metadata
        getTrackMetadata: (filePath: string) => ipcRenderer.invoke('library:getTrackMetadata', filePath),
        updateTrackMetadata: (trackId: string, metadata: any) => ipcRenderer.invoke('library:updateTrackMetadata', trackId, metadata),

        // Playlists
        createPlaylist: (name: string, description: string) => ipcRenderer.invoke('library:createPlaylist', name, description),
        getPlaylistDetail: (playlistId: string) => ipcRenderer.invoke('library:getPlaylistDetail', playlistId),
        deletePlaylist: (playlistId: string) => ipcRenderer.invoke('library:deletePlaylist', playlistId),
        renamePlaylist: (playlistId: string, newName: string) => ipcRenderer.invoke('library:renamePlaylist', playlistId, newName),
        addToPlaylist: (playlistId: string, trackIds: string[]) => ipcRenderer.invoke('library:addToPlaylist', playlistId, trackIds),
        removeFromPlaylist: (playlistId: string, trackIds: string[]) => ipcRenderer.invoke('library:removeFromPlaylist', playlistId, trackIds),
        cleanupPlaylists: () => ipcRenderer.invoke('library:cleanupPlaylists'),

        // 缓存管理
        loadCachedTracks: () => ipcRenderer.invoke('library:loadCachedTracks'),
        validateCache: () => ipcRenderer.invoke('library:validateCache'),
        getCacheStatistics: () => ipcRenderer.invoke('library:getCacheStatistics'),
        clearCache: () => ipcRenderer.invoke('library:clearCache'),
        removeTrack: (trackFileId: string) => ipcRenderer.invoke('library:removeTrack', trackFileId),
        getTracksByDrive: (driveId: string) => ipcRenderer.invoke('library:getTracksByDrive', driveId),
        removeTracksByDrive: (driveId: string) => ipcRenderer.invoke('library:removeTracksByDrive', driveId),
        clearIgnoreList: () => ipcRenderer.invoke('library:clearIgnoreList'),

        // 歌单封面
        updatePlaylistCover: (playlistId: string, imagePath: string) => ipcRenderer.invoke('library:updatePlaylistCover', playlistId, imagePath),
        getPlaylistCover: (playlistId: string) => ipcRenderer.invoke('library:getPlaylistCover', playlistId),
        removePlaylistCover: (playlistId: string) => ipcRenderer.invoke('library:removePlaylistCover', playlistId),

        // Event listeners
        onLibraryUpdated: (callback: (...args: any[]) => void) => {
            ipcRenderer.on('library:updated', callback);
            return () => ipcRenderer.removeListener('library:updated', callback);
        },
        onScanProgress: (callback: (...args: any[]) => void) => {
            ipcRenderer.on('library:scanProgress', callback);
            return () => ipcRenderer.removeListener('library:scanProgress', callback);
        },
        onCacheValidationProgress: (callback: (progress: any) => void) => {
            const wrapper = (_event: any, progress: any) => callback(progress);
            ipcRenderer.on('library:cacheValidationProgress', wrapper);
            return () => ipcRenderer.removeListener('library:cacheValidationProgress', wrapper);
        },
        onCoverUpdated: (callback: (data: any) => void) => {
            const wrapper = (_event: any, data: any) => callback(data);
            ipcRenderer.on('cover-updated', wrapper);
            return () => ipcRenderer.removeListener('cover-updated', wrapper);
        }
    },

    // 音乐文件操作
    readAudioFile: (filePath: string) => ipcRenderer.invoke('file:readAudio', filePath),

    // 设置
    settings: {
        get: (key: string) => ipcRenderer.invoke('settings:get', key),
        set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        reset: () => ipcRenderer.invoke('settings:reset'),

        // 音乐文件夹管理
        getMusicFolders: () => ipcRenderer.invoke('settings:getMusicFolders'),
        addMusicFolder: (folderPath: string) => ipcRenderer.invoke('settings:addMusicFolder', folderPath),
        removeMusicFolder: (folderPath: string) => ipcRenderer.invoke('settings:removeMusicFolder', folderPath),

        // 自动扫描设置
        getAutoScanSettings: () => ipcRenderer.invoke('settings:getAutoScanSettings'),
        updateAutoScanSettings: (settings: any) => ipcRenderer.invoke('settings:updateAutoScanSettings', settings),
        updateLastScanTime: (timestamp: number) => ipcRenderer.invoke('settings:updateLastScanTime', timestamp)
    },

    // 硬件加速
    hardwareAcceleration: {
        getSettings: () => ipcRenderer.invoke('hardwareAcceleration:getSettings'),
        updateSettings: (settings: any) => ipcRenderer.invoke('hardwareAcceleration:updateSettings', settings),
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
        mountSMB: (config: any) => ipcRenderer.invoke('network-drive:mountSMB', config),
        mountWebDAV: (config: any) => ipcRenderer.invoke('network-drive:mountWebDAV', config),
        unmount: (driveId: string) => ipcRenderer.invoke('network-drive:unmount', driveId),
        getMountedDrives: () => ipcRenderer.invoke('network-drive:getMountedDrives'),
        getStatus: (driveId: string) => ipcRenderer.invoke('network-drive:getStatus', driveId),
        testConnection: (config: any) => ipcRenderer.invoke('network-drive:testConnection', config),
        refreshConnections: () => ipcRenderer.invoke('network-drive:refreshConnections'),
        refreshConnection: (driveId: string) => ipcRenderer.invoke('network-drive:refreshConnection', driveId),
        getDirectoryStructure: (driveId: string, dirPath: string) => ipcRenderer.invoke('network-drive:getDirectoryStructure', driveId, dirPath),

        // 监听网络磁盘事件
        onConnected: (callback: (...args: any[]) => void) => ipcRenderer.on('network-drive:connected', callback),
        onDisconnected: (callback: (...args: any[]) => void) => ipcRenderer.on('network-drive:disconnected', callback),
        onError: (callback: (...args: any[]) => void) => ipcRenderer.on('network-drive:error', callback),

        removeListener: (event: string, callback: (...args: any[]) => void) => ipcRenderer.removeListener(`network-drive:${event}`, callback)
    },

    // 歌词管理
    lyrics: {
        // 本地歌词文件
        readLocalFile: (filePath: string) => ipcRenderer.invoke('lyrics:readLocalFile', filePath),
        searchLocalFiles: (lyricsDir: string, title: string, artist: string, album: string, extension: string) =>
            ipcRenderer.invoke('lyrics:searchLocalFiles', lyricsDir, title, artist, album, extension),
        saveToLocal: (lyricsDir: string, title: string, artist: string, album: string, content: string, format: string) =>
            ipcRenderer.invoke('lyrics:saveToLocal', lyricsDir, title, artist, album, content, format),

        // 内嵌歌词
        getEmbedded: (filePath: string) => ipcRenderer.invoke('lyrics:getEmbedded', filePath),
    },

    // 本地封面缓存
    covers: {
        checkLocalCover: (coverDir: string, title: string, artist: string, album: string, isAlbum = false) =>
            ipcRenderer.invoke('covers:checkLocalCover', coverDir, title, artist, album, isAlbum),
        saveCoverFile: (coverDir: string, fileName: string, imageData: any, dataType: string) =>
            ipcRenderer.invoke('covers:saveCoverFile', coverDir, fileName, imageData, dataType)
    },

    // 全局快捷键
    globalShortcuts: {
        register: (shortcuts: any) => ipcRenderer.invoke('globalShortcuts:register', shortcuts),
        unregister: () => ipcRenderer.invoke('globalShortcuts:unregister'),
        setEnabled: (enabled: boolean) => ipcRenderer.invoke('globalShortcuts:setEnabled', enabled),
        isEnabled: () => ipcRenderer.invoke('globalShortcuts:isEnabled'),

        // 监听全局快捷键触发器
        onTriggered: (callback: (...args: any[]) => void) => {
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
        setSize: (width: number, height: number) => ipcRenderer.invoke('window:setSize', width, height),
        setBackgroundThrottling: (allowed: boolean) => ipcRenderer.invoke('window:setBackgroundThrottling', allowed),
        // 监听窗口状态变化
        onMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
            const wrapper = (_event: any, isMaximized: boolean) => callback(isMaximized);
            ipcRenderer.on('window:maximized', wrapper);
            return () => ipcRenderer.removeListener('window:maximized', wrapper);
        },
        // 迷你模式控制
        setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
        isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
        setBounds: (bounds: any) => ipcRenderer.invoke('window:setBounds', bounds),
        getBounds: () => ipcRenderer.invoke('window:getBounds'),
        setResizable: (resizable: boolean) => ipcRenderer.invoke('window:setResizable', resizable),
        setMaximizable: (maximizable: boolean) => ipcRenderer.invoke('window:setMaximizable', maximizable),
        setMaximumSize: (width: number, height: number) => ipcRenderer.invoke('window:setMaximumSize', width, height),
        setMiniModeWindowState: (options: any) => ipcRenderer.invoke('window:setMiniModeWindowState', options),
        setPosition: (x: number, y: number) => ipcRenderer.invoke('window:setPosition', x, y),
        setSkipTaskbar: (skip: boolean) => ipcRenderer.invoke('window:setSkipTaskbar', skip),
        setMinimumSize: (width: number, height: number) => ipcRenderer.invoke('window:setMinimumSize', width, height),
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
        updatePlaybackState: (state: any) => ipcRenderer.invoke('desktopLyrics:updatePlaybackState', state),
        updateLyrics: (lyricsData: any) => ipcRenderer.invoke('desktopLyrics:updateLyrics', lyricsData),
        updatePosition: (position: any) => ipcRenderer.invoke('desktopLyrics:updatePosition', position),
        updateTrack: (trackInfo: any) => ipcRenderer.invoke('desktopLyrics:updateTrack', trackInfo),
        updateSettings: (settings: any) => ipcRenderer.invoke('desktopLyrics:updateSettings', settings),

        // 窗口控制
        setPosition: (x: number, y: number) => ipcRenderer.invoke('desktopLyrics:setPosition', x, y),
        setSize: (width: number, height: number) => ipcRenderer.invoke('desktopLyrics:setSize', width, height),
        setOpacity: (opacity: number) => ipcRenderer.invoke('desktopLyrics:setOpacity', opacity),
        setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('desktopLyrics:setAlwaysOnTop', flag),
        setIgnoreMouseEvents: (ignore: boolean, options: any) => ipcRenderer.invoke('desktopLyrics:setIgnoreMouseEvents', ignore, options),
        getPosition: () => ipcRenderer.invoke('desktopLyrics:getPosition'),
        getSize: () => ipcRenderer.invoke('desktopLyrics:getSize'),
        centerOnScreen: () => ipcRenderer.invoke('desktopLyrics:centerOnScreen'),

        // 事件监听（用于桌面歌词窗口）
        onPlaybackStateChanged: (callback: (state: any) => void) => {
            const wrapper = (_event: any, state: any) => callback(state);
            ipcRenderer.on('playback:stateChanged', wrapper);
            return () => ipcRenderer.removeListener('playback:stateChanged', wrapper);
        },
        onLyricsUpdated: (callback: (lyricsData: any) => void) => {
            const wrapper = (_event: any, lyricsData: any) => callback(lyricsData);
            ipcRenderer.on('lyrics:updated', wrapper);
            return () => ipcRenderer.removeListener('lyrics:updated', wrapper);
        },
        onPositionChanged: (callback: (position: any) => void) => {
            const wrapper = (_event: any, position: any) => callback(position);
            ipcRenderer.on('playback:positionChanged', wrapper);
            return () => ipcRenderer.removeListener('playback:positionChanged', wrapper);
        },
        onTrackChanged: (callback: (trackInfo: any) => void) => {
            const wrapper = (_event: any, trackInfo: any) => callback(trackInfo);
            ipcRenderer.on('track:changed', wrapper);
            return () => ipcRenderer.removeListener('track:changed', wrapper);
        },
        onSettingsChanged: (callback: (settings: any) => void) => {
            const wrapper = (_event: any, settings: any) => callback(settings);
            ipcRenderer.on('settings:changed', wrapper);
            return () => ipcRenderer.removeListener('settings:changed', wrapper);
        }
    },

    // 系统托盘
    tray: {
        create: () => ipcRenderer.invoke('tray:create'),
        destroy: () => ipcRenderer.invoke('tray:destroy'),
        updateSettings: (settings: any) => ipcRenderer.invoke('tray:updateSettings', settings),
        getSettings: () => ipcRenderer.invoke('tray:getSettings'),
        // 监听托盘退出事件
        onQuit: (callback: (...args: any[]) => void) => {
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
        installFromFile: (filePath: string) => ipcRenderer.invoke('extensions:installFromFile', filePath),
        uninstall: (extensionId: string, keepData: boolean) => ipcRenderer.invoke('extensions:uninstall', extensionId, keepData),
        enable: (extensionId: string) => ipcRenderer.invoke('extensions:enable', extensionId),
        disable: (extensionId: string) => ipcRenderer.invoke('extensions:disable', extensionId),
        getInstalled: () => ipcRenderer.invoke('extensions:getInstalled'),
        scanUserExtensions: () => ipcRenderer.invoke('extensions:scanUserExtensions'),
        readExtensionFile: (extensionId: string, filePath: string) => ipcRenderer.invoke('extensions:readExtensionFile', extensionId, filePath),
    },

    userdata: {
        getMoodHistory: () => ipcRenderer.invoke('userdata:getMoodHistory'),
        saveMood: (moodData: any) => ipcRenderer.invoke('userdata:saveMood', moodData),
        getDiaryHistory: () => ipcRenderer.invoke('userdata:getDiaryHistory'),
        saveDiary: (diaryData: any) => ipcRenderer.invoke('userdata:saveDiary', diaryData),
        deleteMood: (timestamp: number) => ipcRenderer.invoke('userdata:deleteMood', timestamp),
        deleteDiary: (timestamp: number) => ipcRenderer.invoke('userdata:deleteDiary', timestamp),
    }
});
