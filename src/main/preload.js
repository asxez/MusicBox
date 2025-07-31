const {contextBridge, ipcRenderer} = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

    // File dialogs
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'),

    // 音频引擎
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

    // 音乐库
    library: {
        // Scan for music files
        scanDirectory: (path) => ipcRenderer.invoke('library:scanDirectory', path),

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

        // Playlists
        createPlaylist: (name) => ipcRenderer.invoke('library:createPlaylist', name),
        addToPlaylist: (playlistId, trackIds) => ipcRenderer.invoke('library:addToPlaylist', playlistId, trackIds),
        removeFromPlaylist: (playlistId, trackIds) => ipcRenderer.invoke('library:removeFromPlaylist', playlistId, trackIds),

        // Cache management
        loadCachedTracks: () => ipcRenderer.invoke('library:loadCachedTracks'),
        validateCache: () => ipcRenderer.invoke('library:validateCache'),
        getCacheStatistics: () => ipcRenderer.invoke('library:getCacheStatistics'),
        clearCache: () => ipcRenderer.invoke('library:clearCache'),

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
        }
    },

    // 音乐文件操作
    readAudioFile: (filePath) => ipcRenderer.invoke('file:readAudio', filePath),

    // 设置
    settings: {
        get: (key) => ipcRenderer.invoke('settings:get', key),
        set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        reset: () => ipcRenderer.invoke('settings:reset')
    },

    // 本地歌词
    lyrics: {
        readLocalFile: (filePath) => ipcRenderer.invoke('lyrics:readLocalFile', filePath),
        searchLocalFiles: (lyricsDir, title, artist, album) =>
            ipcRenderer.invoke('lyrics:searchLocalFiles', lyricsDir, title, artist, album)
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
        sendPosition: (data) => ipcRenderer.send('custom-adsorption', data),
        // 主动尺寸保护机制 - 清理缓存的尺寸信息
        clearSizeCache: () => ipcRenderer.send('clear-size-cache'),
        // 监听窗口状态变化
        onMaximizedChanged: (callback) => {
            ipcRenderer.on('window:maximized', (event, isMaximized) => callback(isMaximized));
            return () => ipcRenderer.removeListener('window:maximized', callback);
        }
    }
});
