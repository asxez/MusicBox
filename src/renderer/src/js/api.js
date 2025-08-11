class MusicBoxAPI extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentTrack = null;
        this.isPlaying = false;
        this.volume = 0.7;
        this.position = 0;
        this.duration = 0;
        this.playlist = [];
        this.currentIndex = -1;
        this.playMode = 'sequence'; // sequence, shuffle, repeat-one

        // 进度跟踪
        this.progressInterval = null;

        this.webAudioEngine = null;

        if (!window.electronAPI) {
            this.createMockAPI();
        }

        this.initializeWebAudio().then(() => {
            this.setupEventListeners();
        });
    }

    createMockAPI() {
        // Create a mock Electron API for browser testing
        window.electronAPI = {
            audio: {
                init: () => Promise.resolve(true),
                loadTrack: (filePath) => Promise.resolve(true),
                play: () => Promise.resolve(true),
                pause: () => Promise.resolve(true),
                stop: () => Promise.resolve(true),
                seek: (position) => Promise.resolve(true),
                setVolume: (volume) => Promise.resolve(),
                getVolume: () => Promise.resolve(0.7),
                getPosition: () => Promise.resolve(0),
                getDuration: () => Promise.resolve(180),
                getCurrentTrack: () => Promise.resolve({
                    filePath: 'mock-track.mp3',
                    title: 'Mock Track',
                    artist: 'Mock Artist',
                    album: 'Mock Album',
                    duration: 180
                }),
                setPlaylist: (tracks) => Promise.resolve(),
                nextTrack: () => Promise.resolve(true),
                previousTrack: () => Promise.resolve(true),
                onTrackChanged: () => {
                },
                onPlaybackStateChanged: () => {
                },
                onPositionChanged: () => {
                }
            },
            library: {
                scanDirectory: (path) => Promise.resolve(true),
                getTracks: (options) => Promise.resolve([]),
                getAlbums: () => Promise.resolve([]),
                getArtists: () => Promise.resolve([]),
                search: (query) => Promise.resolve([]),
                getTrackMetadata: (filePath) => Promise.resolve(null),
                onLibraryUpdated: () => {
                },
                onScanProgress: () => {
                }
            },
            openDirectory: () => Promise.resolve(null),
            openFiles: () => Promise.resolve([]),
            settings: {
                get: (key) => Promise.resolve(null),
                set: (key, value) => Promise.resolve(true)
            },
            getVersion: () => Promise.resolve('1.0.0-mock'),
            getPlatform: () => Promise.resolve('browser'),
            window: {
                minimize: () => Promise.resolve(null),
                maximize: () => Promise.resolve(null),
                isMaximized: () => Promise.resolve(false),
                close: () => Promise.resolve(null),
                getPosition: () => Promise.resolve([0, 0]),
                getSize: () => Promise.resolve([1440, 900]),
                sendPosition: (data) => Promise.resolve(null),
                clearSizeCache: () => Promise.resolve(null),
            }
        };


    }

    async initializeWebAudio() {
        try {
            if (window.WebAudioEngine) {
                this.webAudioEngine = new window.WebAudioEngine();
                const initialized = await this.webAudioEngine.initialize();
                if (initialized) {
                    this.webAudioEngine.setVolume(window.cacheManager.getLocalCache('volume'));

                    // 设置无间隙播放状态
                    const gaplessEnabled = window.cacheManager.getLocalCache('musicbox-settings')?.gaplessPlayback !== false;
                    this.webAudioEngine.setGaplessPlayback(gaplessEnabled);
                }
            }
        } catch (error) {
            console.error('Web Audio Engine 初始化错误:', error);
        }
    }

    setupEventListeners() {
        // Web Audio Engine events
        if (this.webAudioEngine) {
            console.log('🔄 API: 设置Web Audio Engine事件监听器');

            this.webAudioEngine.onTrackChanged = (track) => {
                console.log('🎵 API: Web Audio Engine 歌曲变化:', track);
                this.currentTrack = track;
                this.emit('trackChanged', track);
                // 同步到桌面歌词
                this.syncToDesktopLyrics('track', track);
            };

            this.webAudioEngine.onPlaybackStateChanged = (isPlaying) => {
                console.log('🎵 API: Web Audio Engine 播放状态变化:', isPlaying);
                this.isPlaying = isPlaying;
                this.emit('playbackStateChanged', isPlaying ? 'playing' : 'paused');
                // 同步到桌面歌词
                this.syncToDesktopLyrics('playbackState', {isPlaying, position: this.position});
            };

            this.webAudioEngine.onPositionChanged = (position) => {
                this.position = position;
                this.emit('positionChanged', position);
                // 同步到桌面歌词
                this.syncToDesktopLyrics('position', position);
            };

            this.webAudioEngine.onVolumeChanged = (volume) => {
                this.volume = volume;
                this.emit('volumeChanged', volume);
            };

            this.webAudioEngine.onDurationChanged = (filePath, duration) => {
                console.log('🎵 API: 音频时长更新:', filePath, duration.toFixed(2) + 's');
                this.updateTrackDuration(filePath, duration);
                this.emit('trackDurationUpdated', {filePath, duration});
            };
        } else {
            console.warn('⚠️ API: Web Audio Engine 不可用，无法设置事件监听器');
        }

        // Electron IPC events
        if (window.electronAPI.audio) {
            window.electronAPI.audio.onTrackChanged((event, track) => {
                if (!this.webAudioEngine) {
                    this.currentTrack = track;
                    this.emit('trackChanged', track);
                }
            });

            window.electronAPI.audio.onPlaybackStateChanged((event, state) => {
                if (!this.webAudioEngine) {
                    this.isPlaying = state === 'playing';
                    this.emit('playbackStateChanged', state);
                }
            });

            window.electronAPI.audio.onPositionChanged((event, position) => {
                if (!this.webAudioEngine) {
                    this.position = position;
                    this.emit('positionChanged', position);
                }
            });
        }

        // Library events
        if (window.electronAPI.library) {
            window.electronAPI.library.onLibraryUpdated((event, data) => {
                this.emit('libraryUpdated', data);
            });

            window.electronAPI.library.onScanProgress((event, progress) => {
                this.emit('scanProgress', progress);
            });
        }
    }

    // Audio Engine Methods
    async initializeAudio() {
        try {
            if (!window.electronAPI.audio) {
                throw new Error('Audio API not available');
            }

            const result = await window.electronAPI.audio.init();
            this.isInitialized = result;
            return result;
        } catch (error) {
            console.error('Failed to initialize audio engine:', error);
            return false;
        }
    }

    async loadTrack(filePath) {
        try {
            if (this.webAudioEngine) {
                const result = await this.webAudioEngine.loadTrack(filePath);
                if (result) {
                    this.currentTrack = this.webAudioEngine.getCurrentTrack();
                    this.duration = this.webAudioEngine.getDuration();
                    this.position = 0;

                    // 更新当前索引
                    this.currentIndex = this.webAudioEngine.currentIndex;

                    // 如果当前索引仍然是-1，尝试在播放列表中查找
                    if (this.currentIndex === -1 && this.playlist.length > 0) {
                        this.currentIndex = this.playlist.findIndex(track => {
                            const trackPath = track.filePath || track.path || track;
                            return trackPath === filePath;
                        });

                        // 如果找到了，同步到Web Audio Engine
                        if (this.currentIndex !== -1) {
                            this.webAudioEngine.currentIndex = this.currentIndex;
                        }
                    }

                    this.emit('trackLoaded', this.currentTrack);
                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('trackIndexChanged', this.currentIndex);

                    // 更新播放列表中的时长信息
                    this.updateTrackDuration(filePath, this.duration);
                    await window.electronAPI.audio.loadTrack(filePath);
                    return true;
                }
            }

            const result = await window.electronAPI.audio.loadTrack(filePath);
            if (result) {
                this.currentTrack = await window.electronAPI.audio.getCurrentTrack();
                this.duration = await window.electronAPI.audio.getDuration();
                this.position = 0;

                this.emit('trackLoaded', this.currentTrack);
                this.emit('trackChanged', this.currentTrack);
                this.emit('durationChanged', this.duration);
                this.emit('positionChanged', 0);
            }

            return result;
        } catch (error) {
            console.error('❌ 加载音频文件失败:', error);
            return false;
        }
    }

    async play() {
        try {
            if (this.webAudioEngine) {
                const result = await this.webAudioEngine.play();
                if (result) {
                    // 不在这里手动设置状态，让Web Audio Engine的事件回调来处理

                    // 同步到主进程
                    await window.electronAPI.audio.play();
                    return true;
                } else {
                    console.log('❌ API: Web Audio Engine 播放失败');
                }
            }

            const result = await window.electronAPI.audio.play();
            if (result) {
                this.isPlaying = true;
                this.emit('playbackStateChanged', 'playing');
            }
            return result;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    async pause() {
        try {
            if (this.webAudioEngine) {
                const result = this.webAudioEngine.pause();
                if (result) {
                    // 不在这里手动设置状态，让Web Audio Engine的事件回调来处理

                    // 同步到主进程
                    await window.electronAPI.audio.pause();
                    return true;
                } else {
                    console.log('❌ API: Web Audio Engine 暂停失败');
                }
            }

            const result = await window.electronAPI.audio.pause();
            if (result) {
                this.isPlaying = false;
                this.emit('playbackStateChanged', 'paused');
            }
            return result;
        } catch (error) {
            console.error('Failed to pause:', error);
            return false;
        }
    }

    async stop() {
        try {
            const result = await window.electronAPI.audio.stop();
            if (result) {
                this.isPlaying = false;
                this.position = 0;
                this.emit('playbackStateChanged', 'stopped');
                this.emit('positionChanged', 0);
            }
            return result;
        } catch (error) {
            console.error('Failed to stop:', error);
            return false;
        }
    }

    async seek(position) {
        try {
            if (this.webAudioEngine) {
                const result = await this.webAudioEngine.seek(position);
                if (result) {
                    this.position = position;
                    this.emit('positionChanged', position);

                    // 同步到主进程
                    await window.electronAPI.audio.seek(position);
                    return true;
                }
            }

            const result = await window.electronAPI.audio.seek(position);
            if (result) {
                this.position = position;
                this.emit('positionChanged', position);
            }
            return result;
        } catch (error) {
            console.error('Failed to seek:', error);
            return false;
        }
    }

    async setVolume(volume) {
        try {
            if (this.webAudioEngine) {
                const result = this.webAudioEngine.setVolume(volume);
                if (result) {
                    this.volume = volume;
                    this.emit('volumeChanged', volume);
                    // 同步到主进程
                    await window.electronAPI.audio.setVolume(volume);
                    return true;
                }
            }

            await window.electronAPI.audio.setVolume(volume);
            this.volume = volume;
            this.emit('volumeChanged', volume);
            return true;
        } catch (error) {
            console.error('Failed to set volume:', error);
            return false;
        }
    }

    async getVolume() {
        return this.volume;
    }

    getCurrentPosition() {
        try {
            this.position = this.webAudioEngine.getPosition();
            return this.position;
        } catch (error) {
            console.error('Failed to get position:', error);
            return this.position;
        }
    }

    getCurrentTrack() {
        try {
            this.currentTrack = this.webAudioEngine.getCurrentTrack();
            return this.currentTrack;
        } catch (error) {
            console.error('Failed to get track:', error);
            return this.currentTrack;
        }
    }

    async getDuration() {
        try {
            this.duration = this.webAudioEngine.getDuration();
            return this.duration;
        } catch (error) {
            console.error('Failed to get duration:', error);
            return this.duration;
        }
    }

    // Playlist Methods
    async setPlaylist(tracks, startIndex = -1) {
        try {
            console.log(`🔄 API: 设置播放列表，${tracks.length}首歌曲，起始索引: ${startIndex}`);
            if (this.webAudioEngine) {
                const result = this.webAudioEngine.setPlaylist(tracks, startIndex);
                if (result) {
                    this.playlist = tracks;
                    this.currentIndex = startIndex;

                    console.log(`✅ API: 播放列表设置成功，当前索引: ${this.currentIndex}`);
                    this.emit('playlistChanged', tracks);
                    this.emit('trackIndexChanged', this.currentIndex);

                    // 同步到主进程
                    await window.electronAPI.audio.setPlaylist(tracks);
                    return true;
                }
            }

            await window.electronAPI.audio.setPlaylist(tracks);
            this.playlist = tracks;
            this.currentIndex = startIndex;
            this.emit('playlistChanged', tracks);
            this.emit('trackIndexChanged', this.currentIndex);
            return true;
        } catch (error) {
            console.error('Failed to set playlist:', error);
            return false;
        }
    }

    async nextTrack() {
        try {
            if (this.playlist.length === 0) {
                console.log('⚠️ 播放列表为空');
                return false;
            }

            // 根据播放模式获取下一首的索引
            const nextIndex = this.getNextTrackIndex();
            if (nextIndex === -1) {
                console.log('⚠️ 无法获取下一首歌曲索引');
                return false;
            }

            const nextTrack = this.playlist[nextIndex];
            if (!nextTrack) {
                console.log('⚠️ 下一首歌曲不存在');
                return false;
            }

            if (this.webAudioEngine) {
                const result = await this.webAudioEngine.nextTrack();
                if (result) {
                    // 更新API状态
                    this.currentIndex = this.webAudioEngine.currentIndex;
                    this.currentTrack = this.webAudioEngine.getCurrentTrack();
                    this.duration = this.webAudioEngine.getDuration();
                    this.position = 0;
                    this.isPlaying = this.webAudioEngine.isPlaying;

                    this.emit('trackIndexChanged', this.currentIndex);
                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('playbackStateChanged', this.isPlaying ? 'playing' : 'paused');
                    return true;
                }
            }

            this.currentIndex = nextIndex;
            this.currentTrack = nextTrack;
            this.emit('trackIndexChanged', this.currentIndex);
            this.emit('trackChanged', this.currentTrack);
            return true;
        } catch (error) {
            console.error('Failed to go to next track:', error);
            return false;
        }
    }

    async previousTrack() {
        try {
            if (this.playlist.length === 0) {
                console.log('⚠️ 播放列表为空');
                return false;
            }

            // 根据播放模式获取上一首的索引
            const prevIndex = this.getPreviousTrackIndex();
            if (prevIndex === -1) {
                console.log('⚠️ 无法获取上一首歌曲索引');
                return false;
            }

            const prevTrack = this.playlist[prevIndex];
            if (!prevTrack) {
                console.log('⚠️ 上一首歌曲不存在');
                return false;
            }

            if (this.webAudioEngine) {
                const result = await this.webAudioEngine.previousTrack();
                if (result) {
                    // 更新API状态
                    this.currentIndex = this.webAudioEngine.currentIndex;
                    this.currentTrack = this.webAudioEngine.getCurrentTrack();
                    this.duration = this.webAudioEngine.getDuration();
                    this.position = 0;
                    this.isPlaying = this.webAudioEngine.isPlaying;

                    this.emit('trackIndexChanged', this.currentIndex);
                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('playbackStateChanged', this.isPlaying ? 'playing' : 'paused');
                    return true;
                }
            }

            this.currentIndex = prevIndex;
            this.currentTrack = prevTrack;
            this.emit('trackIndexChanged', this.currentIndex);
            this.emit('trackChanged', this.currentTrack);
            return true;
        } catch (error) {
            console.error('Failed to go to previous track:', error);
            return false;
        }
    }

    // 打开文件对话框
    async openFileDialog() {
        try {
            return await window.electronAPI.openFiles();
        } catch (error) {
            console.error('Failed to open file dialog:', error);
            return [];
        }
    }

    async openDirectoryDialog() {
        try {
            return await window.electronAPI.openDirectory();
        } catch (error) {
            console.error('Failed to open directory dialog:', error);
            return null;
        }
    }

    async scanDirectory(path) {
        try {
            this.emit('scanStarted', path);
            const result = await window.electronAPI.library.scanDirectory(path);
            if (result) {
                this.emit('scanCompleted', path);
                const tracks = await this.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('Failed to scan directory:', error);
            this.emit('scanError', error.message);
            return false;
        }
    }

    async scanNetworkDrive(driveId, relativePath = '/') {
        try {
            this.emit('scanStarted', `network://${driveId}`);
            const result = await window.electronAPI.library.scanNetworkDrive(driveId, relativePath);
            if (result) {
                this.emit('scanCompleted', `network://${driveId}`);
                // 刷新音乐库列表
                const tracks = await this.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('❌ 网络磁盘扫描失败:', error);
            this.emit('scanError', error.message);
            return false;
        }
    }

    // 网络请求工具方法
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        const defaultOptions = {
            timeout: 10000,
            headers: {
                'User-Agent': 'MusicBox/0.1.0'
            },
            ...options
        };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🌐 网络请求 (尝试 ${attempt}/${maxRetries}): ${url}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), defaultOptions.timeout);

                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                console.log(`✅ 网络请求成功: ${url}`);
                return response;

            } catch (error) {
                console.warn(`❌ 网络请求失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`);

                if (attempt === maxRetries) {
                    console.error(`🚫 网络请求最终失败: ${url}`);
                    throw error;
                }

                // 指数退避重试
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                console.log(`⏳ ${delay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async getTracks(options = {}) {
        try {
            return await window.electronAPI.library.getTracks(options);
        } catch (error) {
            console.error('Failed to get tracks:', error);
            return [];
        }
    }

    async getAlbums() {
        try {
            return await window.electronAPI.library.getAlbums();
        } catch (error) {
            console.error('Failed to get albums:', error);
            return [];
        }
    }

    async getArtists() {
        try {
            return await window.electronAPI.library.getArtists();
        } catch (error) {
            console.error('Failed to get artists:', error);
            return [];
        }
    }

    async searchLibrary(query) {
        try {
            return await window.electronAPI.library.search(query);
        } catch (error) {
            console.error('Failed to search library:', error);
            return [];
        }
    }

    async getTrackMetadata(filePath) {
        try {
            return await window.electronAPI.library.getTrackMetadata(filePath);
        } catch (error) {
            console.error('Failed to get track metadata:', error);
            return null;
        }
    }

    // 音乐库缓存方法
    async loadCachedTracks() {
        try {
            const tracks = await window.electronAPI.library.loadCachedTracks();

            if (tracks && tracks.length > 0) {
                this.emit('libraryLoaded', tracks);
                this.emit('libraryUpdated', tracks);
                return tracks;
            } else {
                return [];
            }
        } catch (error) {
            console.error('❌ 加载缓存音乐库失败:', error);
            this.emit('cacheError', error.message);
            return [];
        }
    }

    async validateCache() {
        try {
            this.emit('cacheValidationStarted');

            // 设置验证进度监听器
            const progressListener = window.electronAPI.library.onCacheValidationProgress((progress) => {
                this.emit('cacheValidationProgress', progress);
            });

            const result = await window.electronAPI.library.validateCache();

            // 移除进度监听器
            if (progressListener) {
                progressListener();
            }

            if (result) {
                console.log(`✅ 缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`);
                this.emit('cacheValidationCompleted', result);

                if (result.tracks) {
                    this.emit('libraryUpdated', result.tracks);
                }
                return result;
            } else {
                throw new Error('缓存验证失败');
            }
        } catch (error) {
            console.error('❌ 缓存验证失败:', error);
            this.emit('cacheValidationError', error.message);
            return null;
        }
    }

    async getCacheStatistics() {
        try {
            const stats = await window.electronAPI.library.getCacheStatistics();
            if (stats) {
                return stats;
            }
            return null;
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error);
            return null;
        }
    }

    async clearCache() {
        try {
            const success = await window.electronAPI.library.clearCache();
            if (success) {
                this.emit('cacheCleared');
                this.emit('libraryUpdated', []);
                return true;
            } else {
                throw new Error('清空缓存失败');
            }
        } catch (error) {
            console.error('❌ 清空缓存失败:', error);
            this.emit('cacheError', error.message);
            return false;
        }
    }

    // 检查是否有缓存的音乐库
    async hasCachedLibrary() {
        try {
            const stats = await this.getCacheStatistics();
            return stats && stats.totalTracks > 0;
        } catch (error) {
            console.error('❌ 检查缓存状态失败:', error);
            return false;
        }
    }

    // 歌单封面管理方法
    async updatePlaylistCover(playlistId, imagePath) {
        try {
            const result = await window.electronAPI.library.updatePlaylistCover(playlistId, imagePath);
            if (result.success) {
                this.emit('playlistCoverUpdated', {playlistId, imagePath});
                return {success: true};
            } else {
                throw new Error(result.error || '更新歌单封面失败');
            }
        } catch (error) {
            console.error('❌ 更新歌单封面失败:', error);
            return {success: false, error: error.message};
        }
    }

    async getPlaylistCover(playlistId) {
        try {
            const result = await window.electronAPI.library.getPlaylistCover(playlistId);
            if (result.success) {
                return {success: true, coverPath: result.coverPath};
            } else {
                throw new Error(result.error || '获取歌单封面失败');
            }
        } catch (error) {
            console.error('❌ 获取歌单封面失败:', error);
            return {success: false, error: error.message};
        }
    }

    async removePlaylistCover(playlistId) {
        try {
            const result = await window.electronAPI.library.removePlaylistCover(playlistId);
            if (result.success) {
                this.emit('playlistCoverRemoved', {playlistId});
                return {success: true};
            } else {
                throw new Error(result.error || '移除歌单封面失败');
            }
        } catch (error) {
            console.error('❌ 移除歌单封面失败:', error);
            return {success: false, error: error.message};
        }
    }

    async openDirectory() {
        try {
            // 使用原始的openDirectory方法，返回字符串路径（用于音乐目录扫描等）
            return await window.electronAPI.openDirectory(); // 直接返回字符串路径或null
        } catch (error) {
            console.error('Failed to open directory dialog:', error);
            return null;
        }
    }

    async openFiles() {
        try {
            return await window.electronAPI.openFiles();
        } catch (error) {
            console.error('Failed to open files dialog:', error);
            return [];
        }
    }

    // 选择音乐文件夹方法（用于设置页面）
    async selectMusicFolder() {
        try {
            const result = await window.electronAPI.selectFolder();
            if (result && result.filePaths && result.filePaths.length > 0 && !result.canceled) {
                return {path: result.filePaths[0], success: true};
            }
            return {success: false};
        } catch (error) {
            console.error('Failed to select music folder:', error);
            return {success: false, error: error.message};
        }
    }

    // 选择图片文件方法（用于歌单封面）
    async selectImageFile() {
        try {
            const imagePath = await window.electronAPI.openImageFile();
            if (imagePath) {
                return {path: imagePath, success: true};
            }
            return {success: false};
        } catch (error) {
            console.error('Failed to select image file:', error);
            return {success: false, error: error.message};
        }
    }

    async getSetting(key) {
        try {
            return window.cacheManager.getLocalCache(key);
        } catch (error) {
            console.error('Failed to get setting:', error);
            return null;
        }
    }

    async setSetting(key, value) {
        try {
            window.cacheManager.setLocalCache(key, value);
        } catch (error) {
            console.error('Failed to set setting:', error);
            return false;
        }
    }

    async getAppVersion() {
        try {
            return await window.electronAPI.getVersion();
        } catch (error) {
            console.error('Failed to get app version:', error);
            return 'Unknown';
        }
    }

    async getPlatform() {
        try {
            return await window.electronAPI.getPlatform();
        } catch (error) {
            console.error('Failed to get platform:', error);
            return 'unknown';
        }
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    setPlayMode(mode) {
        const validModes = ['sequence', 'shuffle', 'repeat-one'];
        if (validModes.includes(mode)) {
            this.playMode = mode;
            this.emit('playModeChanged', mode);
            return true;
        }
        return false;
    }

    getPlayMode() {
        return this.playMode;
    }

    togglePlayMode() {
        const modes = ['sequence', 'shuffle', 'repeat-one'];
        const currentIndex = modes.indexOf(this.playMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setPlayMode(modes[nextIndex]);
        return this.playMode;
    }

    getNextTrackIndex() {
        if (this.playlist.length === 0) return -1;

        switch (this.playMode) {
            case 'sequence':
                return (this.currentIndex + 1) % this.playlist.length;
            case 'shuffle':
                // 随机选择一个不同的索引
                if (this.playlist.length === 1) return 0;
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * this.playlist.length);
                } while (randomIndex === this.currentIndex);
                return randomIndex;
            case 'repeat-one':
                return this.currentIndex;
            default:
                return (this.currentIndex + 1) % this.playlist.length;
        }
    }

    getPreviousTrackIndex() {
        if (this.playlist.length === 0) return -1;

        switch (this.playMode) {
            case 'sequence':
                return this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
            case 'shuffle':
                // 随机选择一个不同的索引
                if (this.playlist.length === 1) return 0;
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * this.playlist.length);
                } while (randomIndex === this.currentIndex);
                return randomIndex;
            case 'repeat-one':
                return this.currentIndex;
            default:
                return this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        }
    }

    updateTrackDuration(filePath, duration) {
        // 更新当前播放列表中的时长信息
        if (this.playlist && this.playlist.length > 0) {
            const track = this.playlist.find(t => t.filePath === filePath);
            if (track) {
                track.duration = duration;
                this.emit('playlistChanged', this.playlist);
            }
        }

        // 触发全局时长更新事件，让应用层更新音乐库
        this.emit('libraryTrackDurationUpdated', {filePath, duration});
    }

    async getCover(title, artist, album, filePath = null, forceRefresh = false) {
        try {
            // 如果强制刷新，先清理缓存
            if (forceRefresh) {
                if (filePath && window.embeddedCoverManager) {
                    window.embeddedCoverManager.clearCacheForFile(filePath);
                }
                if (window.localCoverManager) {
                    window.localCoverManager.clearCacheForTrack(title, artist, album);
                }
            }

            // 优先级1: 检查内嵌封面
            if (filePath && window.embeddedCoverManager) {
                try {
                    const embeddedResult = await window.embeddedCoverManager.getEmbeddedCover(filePath);
                    if (embeddedResult.success && embeddedResult.url) {
                        // 验证URL有效性
                        const isValidUrl = window.urlValidator ?
                            await window.urlValidator.isValidUrl(embeddedResult.url) : true;

                        if (isValidUrl) {
                            return {
                                success: true,
                                imageUrl: embeddedResult.url,
                                type: 'embedded',
                                source: 'embedded-cover',
                                format: embeddedResult.format,
                                size: embeddedResult.size,
                                mimeType: embeddedResult.mimeType
                            };
                        } else {
                            console.warn('⚠️ API: 内嵌封面URL无效，跳过');
                        }
                    }
                } catch (embeddedError) {
                    console.warn('内嵌封面获取失败:', embeddedError.message);
                }
            }

            // 优先级2: 检查本地封面缓存
            if (window.localCoverManager && window.localCoverManager.getCoverDirectory()) {
                try {
                    const localCoverResult = await window.localCoverManager.checkLocalCover(title, artist, album);
                    if (localCoverResult.success) {
                        return {
                            success: true,
                            imageUrl: `file://${localCoverResult.filePath}`,
                            type: 'local-file',
                            source: 'local-cache',
                            filePath: localCoverResult.filePath
                        };
                    }
                } catch (localError) {
                    console.warn('本地封面缓存获取失败:', localError.message);
                }
            }

            // 优先级3: 从第三方API获取封面
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/cover?${params.toString()}`;
            const response = await this.fetchWithRetry(url);

            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                // 直接返回图片数据
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                result = {success: true, imageUrl, type: 'blob', source: 'api'};
                await this.saveCoverToLocalCache(title, artist, album, blob);
            } else if (response.redirected) {
                // 处理重定向
                result = {success: true, imageUrl: response.url, type: 'url', source: 'api'};
                await this.saveCoverToLocalCache(title, artist, album, response.url);
            } else {
                // 尝试解析为JSON或文本
                const text = await response.text();
                if (text.startsWith('http')) {
                    result = {success: true, imageUrl: text.trim(), type: 'url', source: 'api'};
                    await this.saveCoverToLocalCache(title, artist, album, text.trim());
                } else {
                    throw new Error('无效的封面响应格式');
                }
            }
            return result;
        } catch (error) {
            console.error(`封面获取失败: ${title} - ${error.message}`);
            return {success: false, error: error.message};
        }
    }

    // 保存封面到本地
    async saveCoverToLocalCache(title, artist, album, imageData) {
        try {
            if (!window.localCoverManager || !window.localCoverManager.getCoverDirectory()) {
                console.log('⚠️ 未设置封面缓存目录，跳过本地缓存保存');
                return;
            }

            // 确定图片格式
            let imageFormat = 'jpg';
            if (imageData instanceof Blob) {
                console.log(`🔍 API: Blob MIME类型 - ${imageData.type}`);
                if (imageData.type.includes('png')) imageFormat = 'png';
                else if (imageData.type.includes('webp')) imageFormat = 'webp';
                else if (imageData.type.includes('gif')) imageFormat = 'gif';
                else if (imageData.type.includes('jpeg') || imageData.type.includes('jpg')) imageFormat = 'jpg';
            } else if (typeof imageData === 'string') {
                if (imageData.includes('.png') || imageData.includes('png')) imageFormat = 'png';
                else if (imageData.includes('.webp') || imageData.includes('webp')) imageFormat = 'webp';
                else if (imageData.includes('.gif') || imageData.includes('gif')) imageFormat = 'gif';
            }

            const saveResult = await window.localCoverManager.saveCoverToCache(
                title, artist, album, imageData, imageFormat
            );
        } catch (error) {
            console.error('❌ 保存封面到本地缓存时发生错误:', error);
        }
    }

    async getLyrics(title, artist, album, filePath = null) {
        try {
            console.log(`🎵 获取歌词: ${title} - ${artist}${filePath ? ` (${filePath})` : ''}`);

            // 优先级1: 检查内嵌歌词（如果提供了文件路径）
            if (filePath && window.embeddedLyricsManager) {
                try {
                    const embeddedResult = await window.embeddedLyricsManager.getEmbeddedLyrics(filePath);
                    if (embeddedResult.success) {
                        return embeddedResult;
                    }
                } catch (embeddedError) {
                    console.warn(`⚠️ 内嵌歌词获取异常: ${title} - ${embeddedError.message}`);
                }
            }

            // 优先级2: 检查本地歌词文件
            if (window.localLyricsManager) {
                try {
                    const localResult = await window.localLyricsManager.getLyrics(title, artist, album);
                    if (localResult.success) {
                        return localResult;
                    }
                } catch (localError) {
                    console.warn(`⚠️ 本地歌词获取异常: ${title} - ${localError.message}`);
                }
            }

            // 优先级3: 检查localStorage缓存
            if (window.cacheManager) {
                const cached = window.cacheManager.getLyricsCache(title, artist, album);
                if (cached) {
                    return cached;
                }
            }

            // 优先级4: 通过网络接口获取
            console.log(`🌐 尝试网络获取歌词: ${title}`);
            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/lyrics?${params.toString()}`;
            const response = await this.fetchWithRetry(url);
            const lrcText = await response.text();
            if (!lrcText || lrcText.trim() === '') {
                console.error(`⚠️ 歌词内容为空`);
            }
            const result = {
                success: true,
                lrc: lrcText.trim(),
                source: 'network'
            };
            if (window.cacheManager) window.cacheManager.setLyricsCache(title, artist, album, result);
            return result;
        } catch (error) {
            console.error(`❌ 歌词获取失败: ${title} - ${error.message}`);
            return {
                success: false,
                error: error.message,
                source: 'error'
            };
        }
    }

    // LRC歌词解析方法
    parseLRC(lrcText) {
        try {
            const lines = lrcText.split('\n');
            const lyrics = [];
            const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})]/g;

            for (const line of lines) {
                const matches = [...line.matchAll(timeRegex)];
                if (matches.length > 0) {
                    const content = line.replace(timeRegex, '').trim();
                    if (content) {
                        for (const match of matches) {
                            const minutes = parseInt(match[1]);
                            const seconds = parseInt(match[2]);
                            const milliseconds = parseInt(match[3].padEnd(3, '0'));
                            const time = minutes * 60 + seconds + milliseconds / 1000;

                            lyrics.push({
                                time: time,
                                content: content
                            });
                        }
                    }
                }
            }
            // 按时间排序
            lyrics.sort((a, b) => a.time - b.time);
            console.log(`✅ LRC解析成功，共 ${lyrics.length} 行歌词`);
            return lyrics;
        } catch (error) {
            console.error('❌ LRC解析失败:', error);
            return [];
        }
    }

    // 获取均衡器实例
    getEqualizer() {
        if (this.webAudioEngine) {
            return this.webAudioEngine.getEqualizer();
        }
        return null;
    }

    // 启用/禁用均衡器
    setEqualizerEnabled(enabled) {
        if (this.webAudioEngine) {
            this.webAudioEngine.setEqualizerEnabled(enabled);
        }
    }

    // 设置无间隙播放状态
    setGaplessPlayback(enabled) {
        if (this.webAudioEngine) {
            this.webAudioEngine.setGaplessPlayback(enabled);
            console.log(`🎵 API: 无间隙播放${enabled ? '启用' : '禁用'}`);
        }
    }

    // 获取无间隙播放状态
    getGaplessPlayback() {
        if (this.webAudioEngine) {
            return this.webAudioEngine.getGaplessPlayback();
        }
        return false;
    }

    // 桌面歌词同步方法
    async syncToDesktopLyrics(type, data) {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            return;
        }

        try {
            switch (type) {
                case 'track':
                    await window.electronAPI.desktopLyrics.updateTrack(data);
                    // 如果歌曲变化，也需要更新歌词
                    if (data && data.lyrics) {
                        await window.electronAPI.desktopLyrics.updateLyrics(data.lyrics);
                    } else if (data && data.title && data.artist) {
                        // 尝试获取歌词
                        await this.loadLyricsForDesktop(data);
                    }
                    break;
                case 'playbackState':
                    await window.electronAPI.desktopLyrics.updatePlaybackState(data);
                    break;
                case 'position':
                    await window.electronAPI.desktopLyrics.updatePosition(data);
                    break;
                case 'lyrics':
                    await window.electronAPI.desktopLyrics.updateLyrics(data);
                    break;
            }
        } catch (error) {
            console.error('❌ 桌面歌词同步失败:', error);
        }
    }

    async loadLyricsForDesktop(track) {
        try {
            const lyricsResult = await this.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                const parsedLyrics = this.parseLRC(lyricsResult.lrc);
                await this.syncToDesktopLyrics('lyrics', parsedLyrics);
            }
        } catch (error) {
            console.error('❌ 为桌面歌词加载歌词失败:', error);
        }
    }

    // 桌面歌词控制方法
    async toggleDesktopLyrics() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            console.warn('桌面歌词API不可用');
            return {success: false, error: '桌面歌词API不可用'};
        }

        try {
            const result = await window.electronAPI.desktopLyrics.toggle();
            if (result.success && result.visible) {
                // 如果显示了桌面歌词，同步当前状态
                await this.syncCurrentStateToDesktopLyrics();
            }
            return result;
        } catch (error) {
            console.error('❌ 切换桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async syncCurrentStateToDesktopLyrics() {
        try {
            // 同步当前歌曲信息
            if (this.currentTrack) {
                await this.syncToDesktopLyrics('track', this.currentTrack);
            }

            // 同步播放状态
            await this.syncToDesktopLyrics('playbackState', {
                isPlaying: this.isPlaying,
                position: this.position
            });

            // 同步播放进度
            await this.syncToDesktopLyrics('position', this.position);
        } catch (error) {
            console.error('❌ 同步当前状态到桌面歌词失败:', error);
        }
    }

    async showDesktopLyrics() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            return {success: false, error: '桌面歌词API不可用'};
        }

        try {
            const result = await window.electronAPI.desktopLyrics.show();
            if (result.success) {
                await this.syncCurrentStateToDesktopLyrics();
            }
            return result;
        } catch (error) {
            console.error('❌ 显示桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async hideDesktopLyrics() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            return {success: false, error: '桌面歌词API不可用'};
        }

        try {
            return await window.electronAPI.desktopLyrics.hide();
        } catch (error) {
            console.error('❌ 隐藏桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async isDesktopLyricsVisible() {
        if (!window.electronAPI || !window.electronAPI.desktopLyrics) {
            return false;
        }

        try {
            return await window.electronAPI.desktopLyrics.isVisible();
        } catch (error) {
            console.error('❌ 检查桌面歌词状态失败:', error);
            return false;
        }
    }

    destroy() {
        this.stopProgressTracking();
        this.removeAllListeners();
    }
}

window.api = new MusicBoxAPI();
