// === utils.js ===

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * Format file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Debounce function to limit the rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function to limit the rate of function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get file extension from file path
 * @param {string} filePath - File path
 * @returns {string} File extension
 */
function getFileExtension(filePath) {
    return filePath.split('.').pop().toLowerCase();
}

/**
 * Get file name from file path
 * @param {string} filePath - File path
 * @returns {string} File name without extension
 */
function getFileName(filePath) {
    const name = filePath.split(/[\\/]/).pop();
    return name.substring(0, name.lastIndexOf('.')) || name;
}

/**
 * Check if a file is an audio file based on extension
 * @param {string} filePath - File path
 * @returns {boolean} True if audio file
 */
function isAudioFile(filePath) {
    const audioExtensions = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma'];
    const extension = getFileExtension(filePath);
    return audioExtensions.includes(extension);
}

/**
 * Sanitize string for use in HTML
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type of toast (success, error, info, warning)
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 1500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add toast styles if not already added
    if (!document.querySelector('#toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
            }
            .toast-success { background: #10b981; }
            .toast-error { background: #ef4444; }
            .toast-warning { background: #f59e0b; }
            .toast-info { background: #3b82f6; }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

/**
 * Event emitter for custom events
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;

        const index = this.events[event].indexOf(callback);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }

    emit(event, ...args) {
        if (!this.events[event]) return;

        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error('Error in event callback:', error);
            }
        });
    }
}

/**
 * Theme management
 */
const theme = {
    get current() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    },

    set(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('theme', themeName);
        this.emit('change', themeName);
    },

    toggle() {
        this.set(this.current === 'light' ? 'dark' : 'light');
    },

    init() {
        const savedTheme = localStorage.getItem('theme');
        this.set(savedTheme);
        console.log("☁️ 主题初始化：", savedTheme);
    },

    // Event emitter methods
    on: EventEmitter.prototype.on.bind(new EventEmitter()),
    off: EventEmitter.prototype.off.bind(new EventEmitter()),
    emit: EventEmitter.prototype.emit.bind(new EventEmitter())
};

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    theme.init();
});


// === api.js ===

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

        // Progress tracking
        this.progressInterval = null;

        // 初始化Web Audio Engine
        this.webAudioEngine = null;

        // Check if Electron API is available, create mock if not
        if (!window.electronAPI) {
            console.warn('Electron API not available - running in browser mode with mock API');
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
                onTrackChanged: () => {},
                onPlaybackStateChanged: () => {},
                onPositionChanged: () => {}
            },
            library: {
                scanDirectory: (path) => Promise.resolve(true),
                getTracks: (options) => Promise.resolve([]),
                getAlbums: () => Promise.resolve([]),
                getArtists: () => Promise.resolve([]),
                search: (query) => Promise.resolve([]),
                getTrackMetadata: (filePath) => Promise.resolve(null),
                onLibraryUpdated: () => {},
                onScanProgress: () => {}
            },
            openDirectory: () => Promise.resolve(null),
            openFiles: () => Promise.resolve([]),
            settings: {
                get: (key) => Promise.resolve(null),
                set: (key, value) => Promise.resolve(true)
            },
            getVersion: () => Promise.resolve('1.0.0-mock'),
            getPlatform: () => Promise.resolve('browser')
        };

        console.log('Mock Electron API created for browser testing');
    }

    async initializeWebAudio() {
        try {
            // 检查是否有Web Audio Engine
            if (window.WebAudioEngine) {
                this.webAudioEngine = new window.WebAudioEngine();

                // 设置事件回调（这里只是临时设置，真正的设置在setupEventListeners中）
                console.log('🎵 Web Audio Engine 可用，将在setupEventListeners中设置事件回调');

                // 初始化音频引擎
                const initialized = await this.webAudioEngine.initialize();
                if (initialized) {
                    console.log('🎵 Web Audio Engine 初始化成功');
                    this.webAudioEngine.setVolume(localStorage.getItem('volume'));
                } else {
                    console.warn('⚠️ Web Audio Engine 初始化失败');
                }
            } else {
                console.warn('⚠️ Web Audio Engine 不可用');
            }
        } catch (error) {
            console.error('❌ Web Audio Engine 初始化错误:', error);
        }
    }

    setupEventListeners() {
        // Web Audio Engine events
        if (this.webAudioEngine) {
            console.log('🔄 API: 设置Web Audio Engine事件监听器');

            this.webAudioEngine.onTrackChanged = (track) => {
                console.log('🎵 API: Web Audio Engine 曲目变化:', track);
                this.currentTrack = track;
                this.emit('trackChanged', track);
            };

            this.webAudioEngine.onPlaybackStateChanged = (isPlaying) => {
                console.log('🎵 API: Web Audio Engine 播放状态变化:', isPlaying);
                this.isPlaying = isPlaying;
                this.emit('playbackStateChanged', isPlaying ? 'playing' : 'paused');
            };

            this.webAudioEngine.onPositionChanged = (position) => {
                this.position = position;
                this.emit('positionChanged', position);
            };

            this.webAudioEngine.onVolumeChanged = (volume) => {
                this.volume = volume;
                this.emit('volumeChanged', volume);
            };

            this.webAudioEngine.onDurationChanged = (filePath, duration) => {
                console.log('🎵 API: 音频时长更新:', filePath, duration.toFixed(2) + 's');
                this.updateTrackDuration(filePath, duration);
                this.emit('trackDurationUpdated', { filePath, duration });
            };

            console.log('✅ API: Web Audio Engine 事件监听器设置完成');
        } else {
            console.warn('⚠️ API: Web Audio Engine 不可用，无法设置事件监听器');
        }

        // Electron IPC events (回退)
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
            console.log(`🔄 加载音频文件: ${filePath}`);
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
                            console.log(`🔄 设置播放列表索引: ${this.currentIndex}`);
                        }
                    }

                    console.log('✅ Web Audio Engine 加载成功:', this.currentTrack);
                    this.emit('trackLoaded', this.currentTrack);
                    this.emit('trackChanged', this.currentTrack);
                    this.emit('durationChanged', this.duration);
                    this.emit('positionChanged', 0);
                    this.emit('trackIndexChanged', this.currentIndex);

                    // 更新播放列表中的时长信息
                    this.updateTrackDuration(filePath, this.duration);

                    // 同步到主进程
                    await window.electronAPI.audio.loadTrack(filePath);
                    return true;
                }
            }

            const result = await window.electronAPI.audio.loadTrack(filePath);
            if (result) {
                this.currentTrack = await window.electronAPI.audio.getCurrentTrack();
                this.duration = await window.electronAPI.audio.getDuration();
                this.position = 0;

                console.log('✅ IPC 加载成功:', this.currentTrack);
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
            console.log('🔄 API: 请求播放');
            if (this.webAudioEngine) {
                const result = await this.webAudioEngine.play();
                if (result) {
                    console.log('✅ API: Web Audio Engine 播放成功');
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
            console.log('🔄 API: 请求暂停播放');
            if (this.webAudioEngine) {
                const result = this.webAudioEngine.pause();
                if (result) {
                    console.log('✅ API: Web Audio Engine 暂停成功');
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
    
    async getCurrentPosition() {
        try {
            this.position = await window.electronAPI.audio.getPosition();
            return this.position;
        } catch (error) {
            console.error('Failed to get position:', error);
            return this.position;
        }
    }
    
    async getDuration() {
        try {
            this.duration = await window.electronAPI.audio.getDuration();
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
            console.log('🔄 API: 请求播放下一首，当前播放模式:', this.playMode);

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

            console.log(`⏭️ 切换到下一首 (${this.playMode}模式): ${nextTrack.title || nextTrack.filePath}`);

            // 优先使用Web Audio Engine
            if (this.webAudioEngine) {
                // 手动设置索引和播放
                this.webAudioEngine.currentIndex = nextIndex;
                const filePath = nextTrack.filePath || nextTrack.path || nextTrack;
                const result = await this.webAudioEngine.loadTrack(filePath);
                if (result) {
                    const playResult = await this.webAudioEngine.play();
                    if (playResult) {
                        // 更新API状态
                        this.currentIndex = nextIndex;
                        this.currentTrack = this.webAudioEngine.getCurrentTrack();
                        this.duration = this.webAudioEngine.getDuration();
                        this.position = 0;
                        this.isPlaying = this.webAudioEngine.isPlaying;

                        console.log('✅ API: Web Audio Engine 切换成功:', this.currentTrack);

                        // 触发事件
                        this.emit('trackIndexChanged', this.currentIndex);
                        this.emit('trackChanged', this.currentTrack);
                        this.emit('durationChanged', this.duration);
                        this.emit('positionChanged', 0);
                        this.emit('playbackStateChanged', this.isPlaying ? 'playing' : 'paused');

                        return true;
                    }
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
            console.log('🔄 API: 请求播放上一首，当前播放模式:', this.playMode);

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
            console.log(`⏮️ 切换到上一首 (${this.playMode}模式): ${prevTrack.title || prevTrack.filePath}`);

            if (this.webAudioEngine) {
                // 手动设置索引和播放
                this.webAudioEngine.currentIndex = prevIndex;
                const filePath = prevTrack.filePath || prevTrack.path || prevTrack;
                const result = await this.webAudioEngine.loadTrack(filePath);
                if (result) {
                    const playResult = await this.webAudioEngine.play();
                    if (playResult) {
                        // 更新API状态
                        this.currentIndex = prevIndex;
                        this.currentTrack = this.webAudioEngine.getCurrentTrack();
                        this.duration = this.webAudioEngine.getDuration();
                        this.position = 0;
                        this.isPlaying = this.webAudioEngine.isPlaying;

                        console.log('✅ API: Web Audio Engine 切换成功:', this.currentTrack);

                        // 触发事件
                        this.emit('trackIndexChanged', this.currentIndex);
                        this.emit('trackChanged', this.currentTrack);
                        this.emit('durationChanged', this.duration);
                        this.emit('positionChanged', 0);
                        this.emit('playbackStateChanged', this.isPlaying ? 'playing' : 'paused');

                        return true;
                    }
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

    // File Dialog Methods
    async openFileDialog() {
        try {
            const files = await window.electronAPI.openFiles();
            console.log('Selected files:', files);
            return files;
        } catch (error) {
            console.error('Failed to open file dialog:', error);
            return [];
        }
    }

    async openDirectoryDialog() {
        try {
            const directory = await window.electronAPI.openDirectory();
            console.log('Selected directory:', directory);
            return directory;
        } catch (error) {
            console.error('Failed to open directory dialog:', error);
            return null;
        }
    }

    // Library Methods
    async scanDirectory(path) {
        try {
            console.log(`Scanning directory: ${path}`);
            this.emit('scanStarted', path);
            const result = await window.electronAPI.library.scanDirectory(path);
            if (result) {
                console.log('Directory scan completed successfully');
                this.emit('scanCompleted', path);
                // Refresh the track list
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
            console.log('📚 加载缓存的音乐库...');
            const tracks = await window.electronAPI.library.loadCachedTracks();

            if (tracks && tracks.length > 0) {
                console.log(`✅ 从缓存加载 ${tracks.length} 个音乐文件`);
                this.emit('libraryLoaded', tracks);
                this.emit('libraryUpdated', tracks);
                return tracks;
            } else {
                console.log('📚 缓存为空或不存在');
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
            console.log('🔍 验证音乐库缓存...');
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
                console.log('📊 缓存统计:', stats);
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
            console.log('🧹 清空音乐库缓存...');
            const success = await window.electronAPI.library.clearCache();

            if (success) {
                console.log('✅ 音乐库缓存已清空');
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
    
    // File Dialog Methods
    async openDirectory() {
        try {
            return await window.electronAPI.openDirectory();
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
    
    // Settings Methods
    async getSetting(key) {
        try {
            return await window.electronAPI.settings.get(key);
        } catch (error) {
            console.error('Failed to get setting:', error);
            return null;
        }
    }
    
    async setSetting(key, value) {
        try {
            return await window.electronAPI.settings.set(key, value);
        } catch (error) {
            console.error('Failed to set setting:', error);
            return false;
        }
    }
    
    // Utility Methods
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

    // Play Mode Methods
    setPlayMode(mode) {
        const validModes = ['sequence', 'shuffle', 'repeat-one'];
        if (validModes.includes(mode)) {
            this.playMode = mode;
            console.log('🔄 播放模式切换为:', mode);
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

    // Utility Methods
    updateTrackDuration(filePath, duration) {
        // 更新当前播放列表中的时长信息
        if (this.playlist && this.playlist.length > 0) {
            const track = this.playlist.find(t => t.filePath === filePath);
            if (track) {
                track.duration = duration;
                console.log(`✅ 更新播放列表歌曲时长: ${track.title} - ${duration.toFixed(2)}s`);

                // 触发播放列表更新事件
                this.emit('playlistChanged', this.playlist);
            }
        }

        // 触发全局时长更新事件，让应用层更新音乐库
        this.emit('libraryTrackDurationUpdated', { filePath, duration });
    }

    // 封面和歌词API方法
    async getCover(title, artist, album) {
        try {
            console.log(`🖼️ 获取封面: ${title} - ${artist}`);

            // 检查缓存
            if (window.cacheManager) {
                const cached = window.cacheManager.getCoverCache(title, artist, album);
                if (cached) {
                    console.log(`✅ 封面缓存命中: ${title}`);
                    return cached;
                }
            }

            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/cover?${params.toString()}`;
            const response = await this.fetchWithRetry(url);

            let result;

            // 检查响应类型
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                // 直接返回图片数据
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                console.log(`✅ 封面获取成功 (直接图片): ${title}`);
                result = { success: true, imageUrl, type: 'blob' };
            } else if (response.redirected) {
                // 处理重定向
                console.log(`✅ 封面获取成功 (重定向): ${title}`);
                result = { success: true, imageUrl: response.url, type: 'url' };
            } else {
                // 尝试解析为JSON或文本
                const text = await response.text();
                if (text.startsWith('http')) {
                    console.log(`✅ 封面获取成功 (URL响应): ${title}`);
                    result = { success: true, imageUrl: text.trim(), type: 'url' };
                } else {
                    throw new Error('无效的封面响应格式');
                }
            }

            // 缓存结果
            if (window.cacheManager && result.success) {
                window.cacheManager.setCoverCache(title, artist, album, result);
            }

            return result;
        } catch (error) {
            console.error(`❌ 封面获取失败: ${title} - ${error.message}`);
            const errorResult = { success: false, error: error.message };

            // 缓存失败结果（短时间）
            if (window.cacheManager) {
                window.cacheManager.setCoverCache(title, artist, album, errorResult);
            }

            return errorResult;
        }
    }

    async getLyrics(title, artist, album) {
        try {
            console.log(`🎵 获取歌词: ${title} - ${artist}`);

            // 检查缓存
            if (window.cacheManager) {
                const cached = window.cacheManager.getLyricsCache(title, artist, album);
                if (cached) {
                    console.log(`✅ 歌词缓存命中: ${title}`);
                    return cached;
                }
            }

            const params = new URLSearchParams();
            if (title) params.append('title', title);
            if (artist) params.append('artist', artist);
            if (album) params.append('album', album);

            const url = `https://api.lrc.cx/lyrics?${params.toString()}`;
            const response = await this.fetchWithRetry(url);

            const lrcText = await response.text();

            if (!lrcText || lrcText.trim() === '') {
                throw new Error('歌词内容为空');
            }

            console.log(`✅ 歌词获取成功: ${title}`);
            const result = { success: true, lrc: lrcText.trim() };

            // 缓存结果
            if (window.cacheManager) {
                window.cacheManager.setLyricsCache(title, artist, album, result);
            }

            return result;

        } catch (error) {
            console.error(`❌ 歌词获取失败: ${title} - ${error.message}`);
            const errorResult = { success: false, error: error.message };

            // 缓存失败结果（短时间）
            if (window.cacheManager) {
                window.cacheManager.setLyricsCache(title, artist, album, errorResult);
            }

            return errorResult;
        }
    }

    // LRC歌词解析方法
    parseLRC(lrcText) {
        try {
            const lines = lrcText.split('\n');
            const lyrics = [];
            const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

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

    // Cleanup method
    destroy() {
        this.stopProgressTracking();
        this.removeAllListeners();
    }
}

const api = new MusicBoxAPI();


// === components.js ===
class Component extends EventEmitter {
    constructor(element) {
        super();
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.isDestroyed = false;

        if (!this.element) {
            console.error('Component element not found');
            return;
        }

        this.init();
    }

    init() {
        // Override in subclasses
    }

    destroy() {
        this.isDestroyed = true;
        this.removeAllListeners();
    }

    removeAllListeners() {
        this.events = {};
    }
}

// Player Component
class Player extends Component {
    constructor() {
        super('#player');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.previousVolume = 0.7;
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;

        this.setupElements();
        this.setupEventListeners();
        this.setupAPIListeners();
        this.updateUI();
    }

    setupElements() {
        this.playPauseBtn = this.element.querySelector('#play-pause-btn');
        this.prevBtn = this.element.querySelector('#prev-btn');
        this.nextBtn = this.element.querySelector('#next-btn');
        this.playModeBtn = this.element.querySelector('#play-mode-btn');
        this.lyricsBtn = this.element.querySelector('#lyrics-btn');
        this.playlistBtn = this.element.querySelector('#playlist-btn');
        this.likeBtn = this.element.querySelector('#like-btn');

        this.trackCover = this.element.querySelector('#track-cover');
        this.trackTitle = this.element.querySelector('#track-title');
        this.trackArtist = this.element.querySelector('#track-artist');

        // Updated selectors for new structure
        this.progressBarContainer = this.element.querySelector('.progress-bar-container');
        this.progressTrack = this.element.querySelector('.progress-track');
        this.progressFill = this.element.querySelector('#progress-fill');
        this.progressHandle = this.element.querySelector('#progress-handle');
        this.progressTooltip = this.element.querySelector('#progress-tooltip');

        this.volumeBtn = this.element.querySelector('#volume-btn');
        this.volumeSlider = this.element.querySelector('.volume-slider');
        this.volumeFill = this.element.querySelector('#volume-fill');
        this.volumeHandle = this.element.querySelector('#volume-handle');

        this.playIcon = this.playPauseBtn.querySelector('.play-icon');
        this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

        // Play mode icons
        this.modeSequenceIcon = this.playModeBtn ? this.playModeBtn.querySelector('.mode-sequence') : null;
        this.modeShuffleIcon = this.playModeBtn ? this.playModeBtn.querySelector('.mode-shuffle') : null;
        this.modeRepeatOneIcon = this.playModeBtn ? this.playModeBtn.querySelector('.mode-repeat-one') : null;

        // Volume icons
        this.volumeHighIcon = this.volumeBtn.querySelector('.volume-high');
        this.volumeHalfIcon = this.volumeBtn.querySelector('.volume-half');
        this.volumeMuteIcon = this.volumeBtn.querySelector('.volume-mute');
    }

    setupEventListeners() {
        // Play/pause button
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Previous/next buttons
        this.prevBtn.addEventListener('click', () => {
            api.previousTrack();
        });

        this.nextBtn.addEventListener('click', () => {
            api.nextTrack();
        });

        // Progress bar - improved interaction
        this.progressBarContainer.addEventListener('mousedown', (e) => {
            this.isDraggingProgress = true;
            this.progressBarContainer.classList.add('dragging');
            this.updateProgress(e);
            e.preventDefault();
        });

        // Show tooltip on hover
        this.progressBarContainer.addEventListener('mousemove', (e) => {
            if (!this.isDraggingProgress) {
                this.updateProgressTooltip(e);
            }
        });

        this.progressBarContainer.addEventListener('mouseleave', () => {
            if (!this.isDraggingProgress) {
                this.progressTooltip.style.opacity = '0';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingProgress) {
                this.updateProgress(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingProgress) {
                this.isDraggingProgress = false;
                this.progressBarContainer.classList.remove('dragging');
                this.progressTooltip.style.opacity = '0';
                const progress = parseFloat(this.progressFill.style.width) / 100;
                api.seek(this.duration * progress);
            }
        });

        // Volume slider
        this.volumeSlider.addEventListener('mousedown', (e) => {
            this.isDraggingVolume = true;
            this.updateVolume(e);
        });

        this.volumeSlider.addEventListener('input', (e) => {
            this.updateVolume(e.target.value);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingVolume) {
                this.updateVolume(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
                const volume = parseFloat(this.volumeFill.style.width) / 100;
                api.setVolume(volume);
            }
        });

        this.volumeBtn.addEventListener('click', () => {
            this.toggleMute();
        });
        this.playModeBtn.addEventListener('click', () => {
            const newMode = api.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });
        this.lyricsBtn.addEventListener('click', () => {
            this.emit('toggleLyrics');
        });
        this.playlistBtn.addEventListener('click', () => {
            this.emit('togglePlaylist');
        });

        // API events
        api.on('trackChanged', (track) => {
            this.updateTrackInfo(track);
        });

        api.on('playbackStateChanged', (state) => {
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('positionChanged', (position) => {
            if (!this.isDraggingProgress) {
                this.currentTime = position;
                this.updateProgressDisplay();
            }
        });

        api.on('volumeChanged', (volume) => {
            this.volume = volume;
            this.updateVolumeDisplay();
        });

        api.on('trackIndexChanged', (index) => {
            this.emit('trackIndexChanged', index);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayPause().then(() => {
                    console.log('⏸️⏭️ 收到键盘更新状态')
                });
            }
        });
    }

    setupAPIListeners() {
        // 用于实时更新的增强型 API 事件监听
        api.on('trackLoaded', (track) => {
            console.log('Track loaded in player:', track);
            this.updateTrackInfo(track);
        });

        api.on('durationChanged', (duration) => {
            this.duration = duration;
            this.updateProgressDisplay();
        });

        api.on('positionChanged', (position) => {
            if (!this.isDraggingProgress) {
                this.currentTime = position;
                this.updateProgressDisplay();
            }
        });

        api.on('playbackStateChanged', (state) => {
            console.log('🎵 Player: 收到播放状态变化事件:', state);
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('volumeChanged', (volume) => {
            this.volume = volume;
            this.updateVolumeDisplay();
        });
    }

    updateProgress(e) {
        const rect = this.progressTrack.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.progressFill.style.width = `${progress * 100}%`;
        this.progressHandle.style.left = `${progress * 100}%`;

        // 更新进度条位置和内容
        const time = this.duration * progress;
        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    updateProgressTooltip(e) {
        const rect = this.progressTrack.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = this.duration * progress;

        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    updateVolume(e) {
        const rect = this.volumeSlider.getBoundingClientRect();
        const volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.volumeFill.style.width = `${volume * 100}%`;
        this.volumeHandle.style.left = `${volume * 100}%`;
    }

    async updateTrackInfo(track) {
        if (track) {
            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';
            this.duration = track.duration || 0;
            // 更新封面图片
            await this.updateCoverArt(track);
        }
    }

    async updateCoverArt(track) {
        // 首先设置默认封面
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');

        try {
            // 检查是否已有本地封面
            if (track.cover) {
                console.log('🖼️ Player: 使用本地封面');
                this.trackCover.src = track.cover;
                this.trackCover.classList.remove('loading');
                return;
            }

            // 尝试从API获取封面
            if (track.title && track.artist) {
                console.log('🖼️ Player: 从API获取封面');
                const coverResult = await api.getCover(track.title, track.artist, track.album);

                if (coverResult.success) {
                    this.trackCover.src = coverResult.imageUrl;
                    console.log('✅ Player: 封面更新成功');

                    // 缓存封面URL到track对象
                    track.coverUrl = coverResult.imageUrl;
                } else {
                    console.log('❌ Player: 封面获取失败，使用默认封面');
                }
            }
        } catch (error) {
            console.error('❌ Player: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    updatePlayButton() {
        console.log('🔄 Player: 更新播放按钮，当前状态:', this.isPlaying);

        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            console.log('✅ Player: 显示暂停图标');
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            console.log('✅ Player: 显示播放图标');
        }
    }

    updateProgressDisplay() {
        if (!this.isDraggingProgress) {
            const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
            this.progressFill.style.width = `${progress}%`;
            this.progressHandle.style.left = `${progress}%`;
        }
    }

    updateVolumeDisplay() {
        const volumePercent = this.volume * 100;
        this.volumeFill.style.width = `${volumePercent}%`;
        this.volumeHandle.style.left = `${volumePercent}%`;

        // Update volume icon based on volume level
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        // Hide all icons first
        if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';

        // Show appropriate icon based on volume level
        if (this.volume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.volume <= 0.5) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'block';
        }
    }

    updatePlayModeDisplay(mode) {
        // 检查是否有这个模式
        if (!this.modeSequenceIcon || !this.modeShuffleIcon || !this.modeRepeatOneIcon) {
            console.warn('🎵 Player: 播放模式图标元素不存在');
            return;
        }

        this.modeSequenceIcon.style.display = 'none';
        this.modeShuffleIcon.style.display = 'none';
        this.modeRepeatOneIcon.style.display = 'none';
        switch (mode) {
            case 'sequence':
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                this.modeShuffleIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                this.modeRepeatOneIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '单曲循环';
                break;
            default:
                // 默认显示顺序播放
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
        }
        console.log('🎵 Player: 播放模式显示更新为:', mode);
    }

    updateUI() {
        this.updatePlayButton();
        this.updateProgressDisplay();
        this.updateVolumeDisplay();
        this.updatePlayModeDisplay(api.getPlayMode());
    }

    async togglePlayPause() {
        console.log('🔄 Player: 切换播放状态，当前状态:', this.isPlaying);

        try {
            if (this.isPlaying) {
                console.log('🔄 Player: 请求暂停');
                const result = await api.pause();
                if (!result) {
                    console.error('❌ Player: 暂停失败');
                }
            } else {
                console.log('🔄 Player: 请求播放');
                const result = await api.play();
                if (!result) {
                    console.error('❌ Player: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Player: 切换播放状态失败:', error);
        }
    }

    toggleMute() {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            api.setVolume(0);
        } else {
            api.setVolume(this.previousVolume || 0.7);
        }
    }
}

// Search Component
class Search extends Component {
    constructor() {
        super('#search-input');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const debouncedSearch = debounce((query) => {
            this.performSearch(query);
        }, 200);

        this.element.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                debouncedSearch(query);
            } else if (query.length === 0) {
                this.clearSearch();
            }
        });

        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.element.value = '';
                this.clearSearch();
            }
        });
    }

    async performSearch(query) {
        try {
            const results = await api.searchLibrary(query);
            this.emit('searchResults', results);
        } catch (error) {
            console.error('Search failed:', error);
            showToast('搜索失败', 'error');
        }
    }

    clearSearch() {
        this.emit('searchCleared');
    }
}

// Navigation Component
class Navigation extends Component {
    constructor() {
        super('#navbar');
        this.currentView = 'library';
        this.sidebarCollapsed = false;
        this.setupElements();
        this.setupEventListeners();
        this.restoreSidebarState();
    }

    setupElements() {
        this.backBtn = this.element.querySelector('#back-btn');
        this.forwardBtn = this.element.querySelector('#forward-btn');
        this.settingsBtn = this.element.querySelector('#settings-btn');
        this.themeToggle = this.element.querySelector('#theme-toggle');
        this.lightIcon = this.themeToggle.querySelector('.light-icon');
        this.darkIcon = this.themeToggle.querySelector('.dark-icon');

        // 侧边栏相关元素
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        this.app = document.getElementById('app');
    }

    setupEventListeners() {
        this.themeToggle.addEventListener('click', () => {
            theme.toggle();
            this.updateThemeIcon();
        });

        this.settingsBtn.addEventListener('click', () => {
            this.emit('showSettings');
        });

        // Listen for theme changes
        theme.on('change', () => {
            this.updateThemeIcon();
        });

        // Initialize theme icon
        this.updateThemeIcon();

        // 侧边栏切换按钮
        this.sidebarToggleBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Sidebar navigation
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (view) {
                    this.navigateToView(view);
                }
            });
        });
    }

    updateThemeIcon() {
        const currentTheme = theme.current;
        if (currentTheme === 'dark') {
            this.lightIcon.style.display = 'none';
            this.darkIcon.style.display = 'block';
        } else {
            this.lightIcon.style.display = 'block';
            this.darkIcon.style.display = 'none';
        }
    }

    navigateToView(view) {
        // Update active link
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        this.currentView = view;
        this.emit('viewChanged', view);
    }

    // 切换侧边栏收缩状态
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;

        if (this.sidebarCollapsed) {
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        } else {
            this.sidebar.classList.remove('collapsed');
            this.app.classList.remove('sidebar-collapsed');
        }

        // 保存状态到本地存储
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);

        console.log('🎵 Navigation: 侧边栏状态切换', this.sidebarCollapsed ? '收缩' : '展开');
    }

    // 恢复侧边栏状态
    restoreSidebarState() {
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            this.sidebarCollapsed = true;
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        }
    }
}

// Track List Component
class TrackList extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.selectedTracks = new Set();
    }

    setTracks(tracks) {
        this.tracks = tracks;
        this.render();
    }

    render() {
        if (!this.element) return;

        this.element.innerHTML = '';

        if (this.tracks.length === 0) {
            this.element.innerHTML = '<div class="empty-state">啥也没有！</div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'track-list';

        this.tracks.forEach((track, index) => {
            const item = this.createTrackItem(track, index);
            list.appendChild(item);
        });

        this.element.appendChild(list);
    }

    createTrackItem(track, index) {
        const item = document.createElement('div');
        item.className = 'track-item';
        item.dataset.index = index;

        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info">
                <div class="track-title">${sanitizeHTML(track.title || 'Unknown Title')}</div>
                <div class="track-artist">${sanitizeHTML(track.artist || 'Unknown Artist')}</div>
            </div>
            <div class="track-album">${sanitizeHTML(track.album || 'Unknown Album')}</div>
            <div class="track-duration">${formatTime(track.duration || 0)}</div>
        `;

        item.addEventListener('dblclick', () => {
            this.playTrack(track, index);
        });

        item.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.toggleTrackSelection(index);
            } else {
                this.selectTrack(index);
            }
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.emit('trackRightClick', track, index, e.clientX, e.clientY);
        });

        return item;
    }

    async playTrack(track, index) {
        try {
            console.log(`🎵 双击播放: ${track.title || track.filePath}`);

            // 加载并播放音频文件
            const loadResult = await api.loadTrack(track.filePath);
            if (loadResult) {
                // 自动开始播放
                const playResult = await api.play();
                if (playResult) {
                    console.log('✅ 双击播放成功');
                } else {
                    console.log('❌ 双击播放失败');
                }
            } else {
                console.log('❌ 双击加载文件失败');
            }

            this.emit('trackPlayed', track, index);
        } catch (error) {
            console.error('❌ 双击播放错误:', error);
        }
    }

    selectTrack(index) {
        this.selectedTracks.clear();
        this.selectedTracks.add(index);
        this.updateSelection();
    }

    toggleTrackSelection(index) {
        if (this.selectedTracks.has(index)) {
            this.selectedTracks.delete(index);
        } else {
            this.selectedTracks.add(index);
        }
        this.updateSelection();
    }

    updateSelection() {
        const items = this.element.querySelectorAll('.track-item');
        items.forEach((item, index) => {
            if (this.selectedTracks.has(index)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
}

// Playlist component
class Playlist extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.tracks = [];
        this.currentTrackIndex = -1;

        this.setupElements();
        this.setupEventListeners();

        console.log('🎵 Playlist: 组件初始化完成');
    }

    setupElements() {
        this.panel = this.element;
        this.closeBtn = this.element.querySelector('#playlist-close');
        this.clearBtn = this.element.querySelector('#playlist-clear');
        this.countEl = this.element.querySelector('#playlist-count');
        this.tracksContainer = this.element.querySelector('#playlist-tracks');
    }

    setupEventListeners() {
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.panel.contains(e.target) && !e.target.closest('#playlist-btn')) {
                this.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show() {
        this.isVisible = true;
        this.panel.style.display = 'flex';
        this.panel.classList.add('show');

        // 自动滚动到当前播放的歌曲
        this.scrollToCurrentTrack();

        console.log('🎵 Playlist: 显示播放列表');
    }

    hide() {
        this.isVisible = false;
        this.panel.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                this.panel.style.display = 'none';
            }
        }, 300);
        console.log('🎵 Playlist: 隐藏播放列表');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    addTrack(track, shouldRender = true) {
        this.tracks.push(track);
        if (shouldRender) {
            this.render();
        }
        console.log('🎵 Playlist: 添加歌曲到播放列表:', track.title);
        return this.tracks.length - 1; // 返回新添加歌曲的索引
    }

    removeTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            const track = this.tracks[index];
            const wasCurrentTrack = index === this.currentTrackIndex;

            this.tracks.splice(index, 1);

            // Adjust current track index
            if (index < this.currentTrackIndex) {
                this.currentTrackIndex--;
            } else if (index === this.currentTrackIndex) {
                // 如果删除的是当前播放歌曲
                if (this.tracks.length > 0) {
                    // 如果还有歌曲，保持在相同位置
                    this.currentTrackIndex = Math.min(index, this.tracks.length - 1);
                } else {
                    // 如果没有歌曲了，设置为-1
                    this.currentTrackIndex = -1;
                }
            }

            this.render();
            this.emit('trackRemoved', {track, index, wasCurrentTrack});
            console.log('🎵 Playlist: 从播放列表移除歌曲:', track.title, '是否为当前播放:', wasCurrentTrack);
        }
    }

    clear() {
        this.tracks = [];
        this.currentTrackIndex = -1;
        this.render();
        this.emit('playlistCleared');
        console.log('🎵 Playlist: 清空播放列表');
    }

    setTracks(tracks, currentIndex = -1) {
        this.tracks = [...tracks];
        this.currentTrackIndex = currentIndex;
        this.render();
        console.log('🎵 Playlist: 设置播放列表:', tracks.length, '首歌曲');
    }

    setCurrentTrack(index) {
        this.currentTrackIndex = index;
        this.render();

        // 如果播放列表可见，滚动到当前歌曲
        if (this.isVisible) {
            this.scrollToCurrentTrack();
        }
    }

    scrollToCurrentTrack() {
        if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length) {
            setTimeout(() => {
                const currentTrackEl = this.tracksContainer.querySelector(`[data-index="${this.currentTrackIndex}"]`);
                if (currentTrackEl) {
                    currentTrackEl.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100); // 等待渲染完成
        }
    }

    render() {
        this.countEl.textContent = `${this.tracks.length} 首歌曲`;

        if (this.tracks.length === 0) {
            this.tracksContainer.innerHTML = `
                <div class="playlist-empty">
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A3,3 0 0,0 7,16A3,3 0 0,0 10,19A3,3 0 0,0 13,16V7H19V5H12V3Z"/>
                    </svg>
                    <p>播放列表为空</p>
                </div>
            `;
            return;
        }

        this.tracksContainer.innerHTML = this.tracks.map((track, index) => {
            const isCurrent = index === this.currentTrackIndex;
            const trackNumber = isCurrent ?
                `<svg class="icon playing-icon" viewBox="0 0 24 24">
                    <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                </svg>` :
                (index + 1);

            return `
                <div class="playlist-track ${isCurrent ? 'current playing' : ''}" data-index="${index}">
                    <div class="playlist-track-number">${trackNumber}</div>
                    <div class="playlist-track-info">
                        <div class="playlist-track-title">${track.title || 'Unknown Title'}</div>
                        <div class="playlist-track-artist">${track.artist || 'Unknown Artist'}</div>
                    </div>
                    <div class="playlist-track-duration">${formatTime(track.duration || 0)}</div>
                    <button class="playlist-track-remove" data-index="${index}">
                        <svg class="icon" viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Add event listeners to track elements
        this.tracksContainer.querySelectorAll('.playlist-track').forEach(trackEl => {
            trackEl.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-track-remove')) {
                    const index = parseInt(trackEl.dataset.index);
                    this.emit('trackSelected', {track: this.tracks[index], index});
                }
            });

            // Add double-click event for playing
            trackEl.addEventListener('dblclick', (e) => {
                if (!e.target.closest('.playlist-track-remove')) {
                    const index = parseInt(trackEl.dataset.index);
                    this.emit('trackPlayed', {track: this.tracks[index], index});
                }
            });
        });

        // Add event listeners to remove buttons
        this.tracksContainer.querySelectorAll('.playlist-track-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(removeBtn.dataset.index);
                this.removeTrack(index);
            });
        });
    }
}

// Context Menu component
class ContextMenu extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.currentIndex = -1;

        this.setupElements();
        this.setupEventListeners();

        console.log('🎵 ContextMenu: 组件初始化完成');
    }

    setupElements() {
        this.menu = this.element;
        this.playItem = this.element.querySelector('#context-play');
        this.addToPlaylistItem = this.element.querySelector('#context-add-to-playlist');
        this.deleteItem = this.element.querySelector('#context-delete');
    }

    setupEventListeners() {
        this.playItem.addEventListener('click', () => {
            this.emit('play', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addToPlaylistItem.addEventListener('click', () => {
            this.emit('addToPlaylist', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.deleteItem.addEventListener('click', () => {
            this.emit('delete', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show(x, y, track, index) {
        this.currentTrack = track;
        this.currentIndex = index;
        this.isVisible = true;

        // Position the menu
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.style.display = 'block';

        // Adjust position if menu goes off screen
        const rect = this.menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            this.menu.style.left = `${windowWidth - rect.width - 10}px`;
        }

        if (rect.bottom > windowHeight) {
            this.menu.style.top = `${windowHeight - rect.height - 10}px`;
        }

        console.log('🎵 ContextMenu: 显示右键菜单');
    }

    hide() {
        this.isVisible = false;
        this.menu.style.display = 'none';
        this.currentTrack = null;
        this.currentIndex = -1;
        console.log('🎵 ContextMenu: 隐藏右键菜单');
    }
}

// Settings component
class Settings extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.settings = this.loadSettings();

        this.setupElements();
        this.setupEventListeners();
        this.initializeSettings();

        console.log('🎵 Settings: 组件初始化完成');
    }

    setupElements() {
        this.page = this.element;

        // 关闭按钮
        this.closeBtn = this.element.querySelector('#settings-close-btn');

        // 设置控件元素
        this.languageSelect = this.element.querySelector('#language-select');
        this.defaultVolumeSlider = this.element.querySelector('#default-volume');
        this.volumeValue = this.element.querySelector('.volume-value');
        this.crossfadeToggle = this.element.querySelector('#crossfade-toggle');
        this.autoplayToggle = this.element.querySelector('#autoplay-toggle');
        this.rememberPositionToggle = this.element.querySelector('#remember-position-toggle');
        this.autoScanToggle = this.element.querySelector('#auto-scan-toggle');
        this.selectFolderBtn = this.element.querySelector('#select-folder-btn');
        this.rescanLibraryBtn = this.element.querySelector('#rescan-library-btn');
        this.checkUpdatesBtn = this.element.querySelector('#check-updates-btn');

        // 缓存管理元素
        this.viewCacheStatsBtn = this.element.querySelector('#view-cache-stats-btn');
        this.validateCacheBtn = this.element.querySelector('#validate-cache-btn');
        this.clearCacheBtn = this.element.querySelector('#clear-cache-btn');
        this.cacheStatsDescription = this.element.querySelector('#cache-stats-description');
    }

    setupEventListeners() {
        // 关闭按钮事件
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // 语言设置
        this.languageSelect.addEventListener('change', (e) => {
            this.updateSetting('language', e.target.value);
            this.emit('languageChanged', e.target.value);
        });

        // 默认音量设置
        this.defaultVolumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            this.volumeValue.textContent = `${volume}%`;
            this.updateSetting('defaultVolume', volume);
            this.emit('defaultVolumeChanged', volume);
        });

        // 各种开关设置
        this.crossfadeToggle.addEventListener('change', (e) => {
            this.updateSetting('crossfade', e.target.checked);
        });

        this.autoplayToggle.addEventListener('change', (e) => {
            this.updateSetting('autoplay', e.target.checked);
        });

        this.rememberPositionToggle.addEventListener('change', (e) => {
            this.updateSetting('rememberPosition', e.target.checked);
        });

        this.autoScanToggle.addEventListener('change', (e) => {
            this.updateSetting('autoScan', e.target.checked);
        });

        // 按钮事件
        this.selectFolderBtn.addEventListener('click', () => {
            this.emit('selectMusicFolder');
        });

        this.rescanLibraryBtn.addEventListener('click', () => {
            this.emit('rescanLibrary');
        });

        this.checkUpdatesBtn.addEventListener('click', () => {
            this.emit('checkUpdates');
        });

        // 缓存管理按钮事件
        this.viewCacheStatsBtn.addEventListener('click', () => {
            this.showCacheStatistics();
        });

        this.validateCacheBtn.addEventListener('click', () => {
            this.validateCache();
        });

        this.clearCacheBtn.addEventListener('click', () => {
            this.clearCache();
        });

        // 关闭设置页面 (ESC键)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show() {
        this.isVisible = true;
        this.page.style.display = 'block';

        // 隐藏其他页面元素
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';

        // 使用 requestAnimationFrame 确保动画正常播放
        requestAnimationFrame(() => {
            this.page.classList.add('show');
        });

        // 加载缓存统计信息
        this.showCacheStatistics();
        console.log('🎵 Settings: 显示设置页面');
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');
        this.page.classList.add('hiding');

        // 等待动画完成后隐藏页面
        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
                this.page.classList.remove('hiding');

                // 恢复其他页面元素
                document.getElementById('sidebar').style.display = 'block';
                document.getElementById('main-content').style.display = 'block';
            }
        }, 300);

        console.log('🎵 Settings: 隐藏设置页面');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // 初始化设置值
    initializeSettings() {
        this.languageSelect.value = this.settings.language || 'zh-CN';
        this.defaultVolumeSlider.value = this.settings.defaultVolume || 50;
        this.volumeValue.textContent = `${this.settings.defaultVolume || 50}%`;
        this.crossfadeToggle.checked = this.settings.crossfade || false;
        this.autoplayToggle.checked = this.settings.autoplay || false;
        this.rememberPositionToggle.checked = this.settings.rememberPosition || false;
        this.autoScanToggle.checked = this.settings.autoScan || false;
    }

    // 加载设置
    loadSettings() {
        const savedSettings = localStorage.getItem('musicbox-settings');
        return savedSettings ? JSON.parse(savedSettings) : {};
    }

    // 更新设置
    updateSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem('musicbox-settings', JSON.stringify(this.settings));
    }

    // 获取设置值
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    // 缓存管理方法
    async showCacheStatistics() {
        try {
            this.viewCacheStatsBtn.disabled = true;
            this.viewCacheStatsBtn.textContent = '获取中...';

            const stats = await api.getCacheStatistics();

            if (stats) {
                const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
                const cacheAgeDays = Math.floor(stats.cacheAge / (1000 * 60 * 60 * 24));

                this.cacheStatsDescription.textContent =
                    `缓存了 ${stats.totalTracks} 个音乐文件，总大小 ${totalSizeMB} MB，已扫描 ${stats.scannedDirectories} 个目录，缓存时间 ${cacheAgeDays} 天`;

                showToast(`缓存统计: ${stats.totalTracks} 个文件，${totalSizeMB} MB`, 'info');
            } else {
                showToast('获取缓存统计失败', 'error');
            }
        } catch (error) {
            console.error('获取缓存统计失败:', error);
            showToast('获取缓存统计失败', 'error');
        } finally {
            this.viewCacheStatsBtn.disabled = false;
            this.viewCacheStatsBtn.textContent = '查看统计';
        }
    }

    async validateCache() {
        try {
            this.validateCacheBtn.disabled = true;
            this.validateCacheBtn.textContent = '验证中...';
            showToast('开始验证缓存，请稍候...', 'info');
            const result = await api.validateCache();

            if (result) {
                const message = `缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`;
                showToast(message, 'success');
            } else {
                showToast('缓存验证失败', 'error');
            }
        } catch (error) {
            console.error('缓存验证失败:', error);
            showToast('缓存验证失败', 'error');
        } finally {
            this.validateCacheBtn.disabled = false;
            this.validateCacheBtn.textContent = '验证缓存';
        }
    }

    async clearCache() {
        if (!confirm('确定要清空所有缓存吗？这将删除所有已缓存的音乐文件信息，下次启动时需要重新扫描。')) {
            return;
        }

        try {
            this.clearCacheBtn.disabled = true;
            this.clearCacheBtn.textContent = '清空中...';

            const success = await api.clearCache();

            if (success) {
                showToast('缓存已清空', 'success');
                this.cacheStatsDescription.textContent = '缓存已清空';
            } else {
                showToast('清空缓存失败', 'error');
            }
        } catch (error) {
            console.error('清空缓存失败:', error);
            showToast('清空缓存失败', 'error');
        } finally {
            this.clearCacheBtn.disabled = false;
            this.clearCacheBtn.textContent = '清空缓存';
        }
    }
}

// Lyrics component
class Lyrics extends EventEmitter {
    constructor(element) {
        super();
        this.isPlaying = false;
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.isLoading = false;

        this.setupElements();
        this.setupEventListeners();
        this.setupAPIListeners();
        console.log('🎵 Lyrics: 组件初始化完成');
    }

    setupElements() {
        this.page = this.element;
        this.background = this.element.querySelector('.lyrics-background');
        this.closeBtn = this.element.querySelector('#lyrics-close');
        this.fullscreenBtn = this.element.querySelector('#lyrics-fullscreen');

        // 全屏按钮图标
        this.fullscreenIcon = this.fullscreenBtn.querySelector('.fullscreen-icon');
        this.fullscreenExitIcon = this.fullscreenBtn.querySelector('.fullscreen-exit-icon');

        // 封面和歌曲信息
        this.trackCover = this.element.querySelector('#lyrics-cover-image');
        this.trackTitle = this.element.querySelector('#lyrics-track-title');
        this.trackArtist = this.element.querySelector('#lyrics-track-artist');
        this.trackAlbum = this.element.querySelector('#lyrics-track-album');

        // 歌词显示
        this.lyricsDisplay = this.element.querySelector('#lyrics-display');

        // 播放控制
        this.playBtn = this.element.querySelector('#lyrics-play-btn');
        this.prevBtn = this.element.querySelector('#lyrics-prev-btn');
        this.nextBtn = this.element.querySelector('#lyrics-next-btn');
        this.playIcon = this.playBtn.querySelector('.play-icon');
        this.pauseIcon = this.playBtn.querySelector('.pause-icon');

        // 进度条
        this.progressBar = this.element.querySelector('#lyrics-progress-bar');
        this.progressFill = this.element.querySelector('#lyrics-progress-fill');
        this.progressHandle = this.element.querySelector('#lyrics-progress-handle');
        this.currentTimeEl = this.element.querySelector('#lyrics-current-time');
        this.durationEl = this.element.querySelector('#lyrics-duration');

        // 音量控制
        this.volumeBtn = this.element.querySelector('#lyrics-volume-btn');
        this.volumeSliderContainer = this.element.querySelector('.volume-slider-container');
        this.volumeSlider = this.element.querySelector('.volume-slider');
        this.volumeFill = this.element.querySelector('#lyrics-volume-fill');
        this.volumeHandle = this.element.querySelector('#lyrics-volume-handle');
        this.volumeIcon = this.volumeBtn.querySelector('.volume-icon');
        this.volumeMuteIcon = this.volumeBtn.querySelector('.volume-mute-icon');
        this.volumeHalfIcon = this.volumeBtn.querySelector('.volume-half-icon');

        // 播放模式控制
        this.playmodeBtn = this.element.querySelector('#lyrics-playmode-btn');
        this.modeSequenceIcon = this.playmodeBtn.querySelector('.lyrics-mode-sequence');
        this.modeShuffleIcon = this.playmodeBtn.querySelector('.lyrics-mode-shuffle');
        this.modeRepeatOneIcon = this.playmodeBtn.querySelector('.lyrics-mode-repeat-one');

        // 全屏状态
        this.isFullscreen = false;

        // 控制状态
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;
        this.currentVolume = 50;
        this.previousVolume = 50;
    }

    setupEventListeners() {
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        this.playBtn.addEventListener('click', async () => {
            await this.togglePlayPause();
        });

        this.prevBtn.addEventListener('click', async () => {
            await api.previousTrack();
        });

        this.nextBtn.addEventListener('click', async () => {
            await api.nextTrack();
        });

        // 音量控制事件
        this.volumeBtn.addEventListener('click', async () => {
            await this.toggleVolumeMute();
        });

        // 音量条点击和拖拽事件
        this.volumeSliderContainer.addEventListener('mousedown', (e) => {
            this.isDraggingVolume = true;
            this.updateVolumeFromEvent(e);
        });

        this.volumeSliderContainer.addEventListener('click', (e) => {
            if (!this.isDraggingVolume) {
                this.updateVolumeFromEvent(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingVolume) {
                this.updateVolumeFromEvent(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
            }
        });

        // 播放模式切换事件
        this.playmodeBtn.addEventListener('click', () => {
            const newMode = api.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });

        // 进度条交互事件
        this.progressBar.addEventListener('click', async (e) => {
            await this.seekToPosition(e);
        });

        this.progressBar.addEventListener('mousedown', (e) => {
            this.startProgressDrag(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingProgress) {
                this.updateProgressDrag(e);
            }
        });

        document.addEventListener('mouseup', async () => {
            if (this.isDraggingProgress) {
                await this.endProgressDrag();
            }
        });

        // 监听全屏状态变化
        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenState();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                if (this.isFullscreen) {
                    this.exitFullscreen();
                } else {
                    this.hide();
                }
            } else if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayPause().then(() => {
                    console.log('⏸️⏭️ 收到键盘更新状态')
                });
            } else if (e.key === 'F11' && this.isVisible) {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });

        const HIDE_DELAY = 2000;
        let mouseTimer = null;
        document.addEventListener('mousemove', () => {
            if (this.isVisible && this.isFullscreen) {
                document.body.classList.remove('hide-cursor');
                clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    document.body.classList.add('hide-cursor');
                }, HIDE_DELAY);
            }
        });

        api.on('playbackStateChanged', (state) => {
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('trackChanged', async (track) => {
            await this.updateTrackInfo(track);
        });

        // 监听时长变化事件，确保总时长正确显示
        api.on('durationChanged', (duration) => {
            if (this.durationEl && duration > 0) {
                this.durationEl.textContent = this.formatTime(duration);
                console.log('🎵 Lyrics: 时长更新:', this.formatTime(duration));
            }
        });
    }

    setupAPIListeners() {
        // 监听播放进度变化，用于歌词同步
        api.on('positionChanged', (position) => {
            this.updateLyricHighlight(position);
        });

        api.on('playbackStateChanged', (state) => {
            console.log('🎵 Player: 收到播放状态变化事件:', state);
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('trackLoaded', (track) => {
            console.log('Track loaded in lyrics:', track);
            this.updateTrackInfo(track);
        });
    }

    show(track) {
        this.currentTrack = track;
        this.isVisible = true;
        this.isPlaying = api.isPlaying;
        // 动画显示
        this.page.style.display = 'block';
        setTimeout(() => {
            this.page.classList.add('show');
        }, 10);

        // 初始化全屏状态
        this.updateFullscreenState();

        // 初始化控件状态
        this.initializeControls().then(() => {
        });

        // 确保歌词显示区域滚动到顶部
        setTimeout(() => {
            if (this.lyricsDisplay) {
                this.lyricsDisplay.scrollTop = 0;
            }
        }, 50);
        console.log('🎵 Lyrics: 显示歌词页面');
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');

        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
            }
        }, 300);

        console.log('🎵 Lyrics: 隐藏歌词页面');
    }

    toggle(track) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(track);
        }
    }

    async togglePlayPause() {
        console.log('🔄 Player: 切换播放状态，当前状态:', this.isPlaying);
        try {
            if (this.isPlaying) {
                console.log('🔄 Player: 请求暂停');
                const result = await api.pause();
                if (!result) {
                    console.error('❌ Player: 暂停失败');
                }
            } else {
                console.log('🔄 Player: 请求播放');
                const result = await api.play();
                if (!result) {
                    console.error('❌ Player: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Player: 切换播放状态失败:', error);
        }
    }

    updateProgress(currentTime, duration) {
        // 更新进度条填充和滑块位置
        if (this.progressFill && this.progressHandle && duration > 0) {
            const percentage = (currentTime / duration) * 100;
            this.progressFill.style.width = `${percentage}%`;
            this.progressHandle.style.left = `${percentage}%`;
        }
        // 更新时间显示
        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(currentTime);
        }
        if (this.durationEl) {
            this.durationEl.textContent = this.formatTime(duration);
        }
    }

    updatePlayButton() {
        console.log('🔄 Player: 更新播放按钮，当前状态:', this.isPlaying);
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            console.log('✅ Player: 显示暂停图标');
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            console.log('✅ Player: 显示播放图标');
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async updateTrackInfo(track) {
        if (track) {
            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';

            // 正确更新总时长显示
            if (this.durationEl && track.duration) {
                this.durationEl.textContent = this.formatTime(track.duration);
                console.log('🎵 Lyrics: 更新总时长显示:', this.formatTime(track.duration));
            }

            // 更新封面和歌词
            await this.loadLyrics(track);
            await this.updateCoverArt(track);
        }
    }

    async loadLyrics(track) {
        if (!track || !track.title || !track.artist) {
            this.showNoLyrics();
            return;
        }

        // 检查是否已有缓存的歌词
        if (track.lyrics) {
            console.log('🎵 Lyrics: 使用缓存歌词');
            this.lyrics = track.lyrics;
            this.renderLyrics();
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            console.log('🎵 Lyrics: 从API获取歌词');
            const lyricsResult = await api.getLyrics(track.title, track.artist, track.album);

            if (lyricsResult.success) {
                this.lyrics = api.parseLRC(lyricsResult.lrc);
                if (this.lyrics.length > 0) {
                    // 缓存歌词到track对象
                    track.lyrics = this.lyrics;
                    track.lrcText = lyricsResult.lrc;
                    this.renderLyrics();
                    console.log('✅ Lyrics: 歌词加载成功');
                } else {
                    this.showNoLyrics();
                    console.log('❌ Lyrics: 歌词解析失败');
                }
            } else {
                this.showNoLyrics();
                console.log('❌ Lyrics: 歌词获取失败');
            }
        } catch (error) {
            console.error('❌ Lyrics: 歌词加载失败:', error);
            this.showNoLyrics();
        } finally {
            this.isLoading = false;
        }
    }

    async updateCoverArt(track) {
        // 首先设置默认封面
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');
        try {
            // 检查是否已有本地封面
            if (track.cover) {
                console.log('🖼️ Player: 使用本地封面');
                this.trackCover.src = track.cover;
                this.trackCover.classList.remove('loading');
                this.background.style.backgroundImage = `url(${track.cover})`;
                return;
            }

            // 尝试从API获取封面
            if (track.title && track.artist) {
                console.log('🖼️ Player: 从API获取封面');
                const coverResult = await api.getCover(track.title, track.artist, track.album);
                if (coverResult.success) {
                    this.trackCover.src = coverResult.imageUrl;
                    console.log('✅ Player: 封面更新成功');
                    // 缓存封面URL到track对象
                    track.coverUrl = coverResult.imageUrl;
                } else {
                    console.log('❌ Player: 封面获取失败，使用默认封面');
                }
            }
            // Set background image if available
            if (track.coverUrl) {
                this.background.style.backgroundImage = `url(${track.coverUrl})`;
            } else {
                this.background.style.backgroundImage = 'none';
            }
        } catch (error) {
            console.error('❌ Player: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    showLoading() {
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <p class="lyrics-line loading">正在加载歌词...</p>
            </div>
        `;
    }

    showNoLyrics() {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                <p class="lyrics-line">暂无歌词</p>
                <p class="lyrics-line">请欣赏音乐</p>
                <div class="lyrics-line-spacer"></div>
            </div>
        `;
    }

    renderLyrics() {
        if (!this.lyrics || this.lyrics.length === 0) {
            this.showNoLyrics();
            return;
        }

        const lyricsHTML = this.lyrics.map((lyric, index) => {
            return `<p class="lyrics-line" data-time="${lyric.time}" data-index="${index}">${lyric.content}</p>`;
        }).join('');

        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                ${lyricsHTML}
                <div class="lyrics-line-spacer"></div>
            </div>
        `;

        // 重置滚动位置到顶部，确保从第一行歌词开始显示
        this.lyricsDisplay.scrollTop = 0;
        // 添加点击事件，允许用户跳转到指定时间
        this.lyricsDisplay.querySelectorAll('.lyrics-line').forEach(line => {
            line.addEventListener('click', async () => {
                const time = parseFloat(line.dataset.time);
                if (!isNaN(time)) {
                    await api.seek(time);
                }
            });
        });

        // 重置当前歌词索引
        this.currentLyricIndex = -1;
        console.log('🎵 Lyrics: 歌词渲染完成，滚动位置已重置');
    }

    updateLyricHighlight(currentTime) {
        if (!this.lyrics || this.lyrics.length === 0 || !this.isVisible) {
            return;
        }

        // 找到当前时间对应的歌词行
        let newIndex = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果索引发生变化，更新高亮
        if (newIndex !== this.currentLyricIndex) {
            // 移除之前的高亮
            if (this.currentLyricIndex >= 0) {
                const prevLine = this.lyricsDisplay.querySelector(`[data-index="${this.currentLyricIndex}"]`);
                if (prevLine) {
                    prevLine.classList.remove('highlight');
                }
            }

            // 添加新的高亮
            if (newIndex >= 0) {
                const currentLine = this.lyricsDisplay.querySelector(`[data-index="${newIndex}"]`);
                if (currentLine) {
                    currentLine.classList.add('highlight');

                    // 只有在歌曲开始播放后才进行自动滚动
                    // 避免在歌词刚加载时就滚动到中间位置
                    if (currentTime > 0 && this.currentLyricIndex >= 0) {
                        currentLine.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }
            }

            this.currentLyricIndex = newIndex;
        }
    }

    updateLyrics(lyrics) {
        // 兼容旧的接口，现在使用loadLyrics方法
        if (this.currentTrack) {
            this.currentTrack.lyrics = lyrics;
            this.lyrics = lyrics;
            this.renderLyrics();
        }
    }

    // 全屏功能方法
    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().then(() => {
                console.log('🎵 Lyrics: 进入全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 进入全屏失败:', err);
            });
        } else if (document.documentElement.webkitRequestFullscreen) {
            // Safari 支持
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            // IE/Edge 支持
            document.documentElement.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                console.log('🎵 Lyrics: 退出全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 退出全屏失败:', err);
            });
        } else if (document.webkitExitFullscreen) {
            // Safari 支持
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            // IE/Edge 支持
            document.msExitFullscreen();
        }
    }

    updateFullscreenState() {
        this.isFullscreen = !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement);

        // 更新按钮图标
        if (this.isFullscreen) {
            this.fullscreenIcon.style.display = 'none';
            this.fullscreenExitIcon.style.display = 'block';
        } else {
            this.fullscreenIcon.style.display = 'block';
            this.fullscreenExitIcon.style.display = 'none';
        }

        console.log('🎵 Lyrics: 全屏状态更新:', this.isFullscreen ? '全屏' : '窗口');
    }

    // 初始化控件状态
    async initializeControls() {
        const currentVolume = api.getVolume ? (await api.getVolume() * 100) : 50;
        await this.setVolume(currentVolume);

        const currentMode = api.getPlayMode ? api.getPlayMode() : 'repeat';
        this.updatePlayModeDisplay(currentMode);
        console.log('🎵 Lyrics: 控件状态初始化完成');
    }

    // 音量控制方法
    async setVolume(volume) {
        this.currentVolume = Math.max(0, Math.min(100, volume));

        // 更新音量条填充和滑块位置
        const percentage = this.currentVolume / 100;
        if (this.volumeFill) {
            this.volumeFill.style.width = `${this.currentVolume}%`;
        }
        if (this.volumeHandle) {
            this.volumeHandle.style.left = `${this.currentVolume}%`;
        }

        // 更新音量图标
        if (this.volumeIcon) this.volumeIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';
        if (this.currentVolume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.currentVolume <= 50) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeIcon) this.volumeIcon.style.display = 'block';
            this.volumeMuteIcon.style.display = 'none';
            this.volumeHalfIcon.style.display = 'none';
        }

        // 同步到主播放器
        await api.setVolume(this.currentVolume / 100);
        console.log('🎵 Lyrics: 音量设置为', this.currentVolume + '%');
    }

    // 从鼠标事件更新音量
    updateVolumeFromEvent(e) {
        if (!this.volumeSliderContainer) return;

        const rect = this.volumeSliderContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const volume = Math.round(percentage * 100);

        this.setVolume(volume);
    }

    async toggleVolumeMute() {
        if (this.currentVolume > 0) {
            this.previousVolume = this.currentVolume;
            await this.setVolume(0);
        } else {
            await this.setVolume(this.previousVolume || 50);
        }
    }

    updatePlayModeDisplay(mode) {
        if (!this.modeSequenceIcon || !this.modeShuffleIcon || !this.modeRepeatOneIcon) {
            console.warn('🎵 Player: 播放模式图标元素不存在');
            return;
        }
        this.modeSequenceIcon.style.display = 'none';
        this.modeShuffleIcon.style.display = 'none';
        this.modeRepeatOneIcon.style.display = 'none';
        switch (mode) {
            case 'sequence':
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                this.modeShuffleIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                this.modeRepeatOneIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '单曲循环';
                break;
            default:
                // 默认显示顺序播放
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
        }
        console.log('🎵 Player: 播放模式显示更新为:', mode);
    }

    // 进度条交互方法
    async seekToPosition(e) {
        if (!this.currentTrack || !await api.getDuration()) return;
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const seekTime = percentage * await api.getDuration();
        await api.seek(seekTime);
        console.log('🎵 Lyrics: 跳转到', this.formatTime(seekTime));
    }

    startProgressDrag(e) {
        this.isDraggingProgress = true;
        this.progressBar.classList.add('dragging');
        this.updateProgressDrag(e);
    }

    updateProgressDrag(e) {
        if (!this.isDraggingProgress || !this.currentTrack || !api.getDuration()) return;

        const rect = this.progressBar.getBoundingClientRect();
        const dragX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const percentage = dragX / rect.width;

        // 实时更新进度条显示
        this.progressFill.style.width = `${percentage * 100}%`;
        this.currentTimeEl.textContent = this.formatTime(percentage * api.getDuration());
    }

    async endProgressDrag() {
        if (!this.isDraggingProgress) return;

        this.isDraggingProgress = false;
        this.progressBar.classList.remove('dragging');

        // 执行实际的跳转
        const percentage = parseFloat(this.progressFill.style.width) / 100;
        const seekTime = percentage * await api.getDuration();
        await api.seek(seekTime);
    }
}


// === app.js ===

class MusicBoxApp extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentView = 'library';
        this.library = [];
        this.filteredLibrary = [];
        this.components = {};

        this.init();
    }

    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize API
            await this.initializeAPI();

            // Initialize components
            this.initializeComponents();

            // Setup event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadInitialData();

            // Hide loading screen and show app
            this.showApp();

            this.isInitialized = true;
            console.log('MusicBox initialized successfully');

        } catch (error) {
            console.error('Failed to initialize MusicBox:', error);
            this.showError('应用初始化失败');
        }
    }

    async initializeAPI() {
        const success = await api.initializeAudio();
        if (!success) {
            throw new Error('Failed to initialize audio engine');
        }

        // Load saved settings
        const savedVolume = await api.getSetting('volume');
        if (savedVolume !== null) {
            await api.setVolume(savedVolume);
        }
    }

    initializeComponents() {
        this.components.player = new Player();
        this.components.search = new Search();
        this.components.navigation = new Navigation();
        this.components.trackList = new TrackList('#content-area');
        this.components.playlist = new Playlist(document.getElementById('playlist-panel'));
        this.components.contextMenu = new ContextMenu(document.getElementById('context-menu'));
        this.components.settings = new Settings(document.getElementById('settings-page'));
        this.components.lyrics = new Lyrics(document.getElementById('lyrics-page'));

        // 设置组件事件监听
        this.components.search.on('searchResults', (results) => {
            this.handleSearchResults(results);
        });

        this.components.search.on('searchCleared', () => {
            this.handleSearchCleared();
        });

        this.components.navigation.on('viewChanged', (view) => {
            this.handleViewChange(view);
        });

        this.components.navigation.on('showSettings', () => {
            this.components.settings.toggle();
        });

        this.components.trackList.on('trackPlayed', (track, index) => {
            this.handleTrackPlayed(track, index);
        });

        this.components.trackList.on('trackRightClick', (track, index, x, y) => {
            this.components.contextMenu.show(x, y, track, index);
        });

        // Player events
        this.components.player.on('togglePlaylist', () => {
            this.components.playlist.toggle();
        });

        this.components.player.on('toggleLyrics', () => {
            this.components.lyrics.toggle(api.currentTrack);
        });

        this.components.player.on('trackIndexChanged', (index) => {
            this.handleTrackIndexChanged(index);
        });

        // Playlist events
        this.components.playlist.on('trackSelected', ({track, index}) => {
            this.handlePlaylistTrackSelected(track, index);
        });

        this.components.playlist.on('trackPlayed', ({track, index}) => {
            this.handlePlaylistTrackPlayed(track, index);
        });

        this.components.playlist.on('trackRemoved', ({track, index}) => {
            this.handlePlaylistTrackRemoved(track, index);
        });

        this.components.playlist.on('playlistCleared', () => {
            this.handlePlaylistCleared();
        });

        // Context menu events
        this.components.contextMenu.on('play', ({track, index}) => {
            this.handleTrackPlayed(track, index);
        });

        this.components.contextMenu.on('addToPlaylist', ({track, index}) => {
            this.addToPlaylist(track);
        });

        this.components.contextMenu.on('delete', ({track, index}) => {
            this.handleDeleteTrack(track, index);
        });

        // Settings events
        this.components.settings.on('selectMusicFolder', () => {
            this.handleSelectMusicFolder();
        });

        this.components.settings.on('rescanLibrary', () => {
            this.handleRescanLibrary();
        });

        this.components.settings.on('defaultVolumeChanged', (volume) => {
            this.handleDefaultVolumeChanged(volume);
        });

        // Lyrics events
        this.components.lyrics.on('togglePlay', () => {
            this.components.player.togglePlay();
        });

        this.components.lyrics.on('previousTrack', () => {
            this.components.player.previousTrack();
        });

        this.components.lyrics.on('nextTrack', () => {
            this.components.player.nextTrack();
        });
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });

        // 添加播放列表按钮
        const addPlaylistBtn = document.getElementById('add-playlist-btn');
        if (addPlaylistBtn) {
            addPlaylistBtn.addEventListener('click', () => {
                this.showCreatePlaylistDialog();
            });
        }

        // 文件加载功能
        this.setupFileLoading();

        // API events
        api.on('libraryUpdated', () => {
            this.refreshLibrary();
        });

        api.on('playlistChanged', (tracks) => {
            console.log('🎵 API播放列表改变:', tracks.length, '首歌曲');
            // 确保播放列表组件与API同步
            if (this.components.playlist && tracks.length > 0) {
                this.components.playlist.setTracks(tracks, api.currentIndex);
            }
        });

        api.on('libraryTrackDurationUpdated', ({filePath, duration}) => {
            console.log('🎵 更新音乐库歌曲时长:', filePath, duration.toFixed(2) + 's');
            this.updateLibraryTrackDuration(filePath, duration);
        });

        api.on('playModeChanged', (mode) => {
            console.log('🎵 播放模式改变:', mode);
            this.components.player.updatePlayModeDisplay(mode);
        });

        // Update lyrics page when track changes
        api.on('trackChanged', (track) => {
            if (this.components.lyrics.isVisible) {
                this.components.lyrics.show(track);
            }
        });

        // Update lyrics page progress
        api.on('positionChanged', (position) => {
            if (this.components.lyrics.isVisible) {
                this.components.lyrics.updateProgress(position, api.duration);
            }
        });

        // Update lyrics page play button
        api.on('playbackStateChanged', (state) => {
            if (this.components.lyrics.isVisible) {
                this.components.lyrics.updatePlayButton(state === 'playing');
            }
        });

        api.on('scanProgress', (progress) => {
            this.updateScanProgress(progress);
        });
    }

    async loadInitialData() {
        try {
            console.log('📚 开始加载初始数据...');

            // 首先尝试从缓存加载音乐库
            const hasCachedLibrary = await api.hasCachedLibrary();

            if (hasCachedLibrary) {
                console.log('📚 发现缓存的音乐库，优先加载...');
                this.showCacheLoadingStatus();

                // 从缓存加载音乐库
                this.library = await api.loadCachedTracks();

                if (this.library.length > 0) {
                    console.log(`✅ 从缓存加载 ${this.library.length} 个音乐文件`);
                    this.filteredLibrary = [...this.library];
                    this.updateTrackList();
                    this.hideCacheLoadingStatus();

                    // 在后台验证缓存
                    this.validateCacheInBackground();
                    return;
                }
            }

            // 如果没有缓存或缓存为空，检查内存中的音乐库
            this.library = await api.getTracks();
            if (this.library.length === 0) {
                this.showWelcomeScreen();
            } else {
                // 加载库视图
                this.filteredLibrary = [...this.library];
                this.updateTrackList();
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load music library');
        }
    }

    showCacheLoadingStatus() {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'block';
            statusElement.textContent = '正在从缓存加载音乐库...';
        }
    }

    hideCacheLoadingStatus() {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }

    async validateCacheInBackground() {
        try {
            console.log('🔍 在后台验证缓存...');

            // 设置验证进度监听器
            api.on('cacheValidationProgress', (progress) => {
                console.log(`🔍 缓存验证进度: ${progress.current}/${progress.total}`);
            });

            api.on('cacheValidationCompleted', (result) => {
                console.log('✅ 后台缓存验证完成:', result);

                // 如果有无效文件被清理，更新UI
                if (result.invalid > 0) {
                    this.showInfo(`已清理 ${result.invalid} 个无效的音乐文件`);

                    // 更新音乐库
                    if (result.tracks) {
                        this.library = result.tracks;
                        this.filteredLibrary = [...this.library];
                        this.updateTrackList();
                    }
                }
            });

            api.on('cacheValidationError', (error) => {
                console.warn('⚠️ 后台缓存验证失败:', error);
            });

            // 启动验证
            await api.validateCache();

        } catch (error) {
            console.warn('⚠️ 后台缓存验证失败:', error);
        }
    }

    showApp() {
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');

        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 300);
        }

        if (app) {
            app.style.display = 'grid';
            setTimeout(() => {
                app.style.opacity = '1';
            }, 100);
        }
    }

    showWelcomeScreen() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-content">
                    <h1>欢迎！</h1>
                    <p>添加喜欢的音乐吧！</p>
                    <div class="welcome-actions">
                        <button class="primary-button" id="scan-folder-btn">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                            </svg>
                            添加音乐目录
                        </button>
                        <button class="secondary-button" id="add-files-btn">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            添加音乐
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 为主页按钮添加事件监听
        document.getElementById('scan-folder-btn')?.addEventListener('click', () => {
            this.scanMusicFolder();
        });
        document.getElementById('add-files-btn')?.addEventListener('click', () => {
            this.addMusicFiles();
        });
    }

    async scanMusicFolder() {
        try {
            const folderPath = await api.openDirectory();
            if (folderPath) {
                this.showScanProgress();
                const success = await api.scanDirectory(folderPath);
                if (success) {
                    showToast('音乐目录扫描成功', 'success');
                    await this.refreshLibrary();
                } else {
                    showToast('音乐目录扫描失败', 'error');
                }
            }
        } catch (error) {
            console.error('扫描目录失败：', error);
            showToast('音乐目录扫描失败', 'error');
        }
    }

    async addMusicFiles() {
        try {
            const filePaths = await api.openFiles();
            if (filePaths.length > 0) {
                for (const filePath of filePaths) {
                    const metadata = await api.getTrackMetadata(filePath);
                    if (metadata) {
                        this.library.push(metadata);
                    }
                }
                this.filteredLibrary = [...this.library];
                this.updateTrackList();
                showToast(`添加 ${filePaths.length} 首音乐`, 'success');
            }
        } catch (error) {
            console.error('添加音乐失败', error);
            showToast('添加音乐失败', 'error');
        }
    }

    showScanProgress() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="scan-progress">
                <div class="scan-content">
                    <h2>扫描音乐库</h2>
                    <div class="progress-bar">
                        <div class="progress-fill" id="scan-progress-fill"></div>
                    </div>
                    <p id="scan-status">加载中...</p>
                </div>
            </div>
        `;
    }

    updateScanProgress(progress) {
        const progressFill = document.getElementById('scan-progress-fill');
        const statusText = document.getElementById('scan-status');

        if (progressFill && statusText) {
            const percent = progress.totalFiles > 0 ?
                (progress.processedFiles / progress.totalFiles) * 100 : 0;

            progressFill.style.width = `${percent}%`;
            statusText.textContent = progress.isComplete ?
                'Scan completed!' :
                `Processing: ${progress.currentFile}`;
        }
    }

    async refreshLibrary() {
        try {
            this.library = await api.getTracks();
            this.filteredLibrary = [...this.library];
            this.updateTrackList();
        } catch (error) {
            console.error('Failed to refresh library:', error);
        }
    }

    updateTrackList() {
        if (this.components.trackList) {
            this.components.trackList.setTracks(this.filteredLibrary);
        }
    }

    handleSearchResults(results) {
        this.filteredLibrary = results;
        this.updateTrackList();
    }

    handleSearchCleared() {
        this.filteredLibrary = [...this.library];
        this.updateTrackList();
    }

    handleViewChange(view) {
        this.currentView = view;
        // todo 在此处实现视图切换逻辑
        console.log('View changed to:', view);
    }

    handleTrackPlayed(track, index) {
        console.log('🎵 从音乐库播放歌曲:', track.title);

        if (this.components.playlist) {
            // 如果播放列表为空，将整个音乐库添加到播放列表
            if (this.components.playlist.tracks.length === 0) {
                console.log('🎵 播放列表为空，添加整个音乐库');
                this.components.playlist.setTracks(this.filteredLibrary, index);
                this.playTrackFromPlaylist(track, index);
            } else {
                // 播放列表不为空，检查歌曲是否已在播放列表中
                const existingIndex = this.components.playlist.tracks.findIndex(t =>
                    t.filePath === track.filePath
                );

                if (existingIndex === -1) {
                    // 歌曲不在播放列表中，添加到末尾并播放
                    const newIndex = this.components.playlist.addTrack(track);
                    this.playTrackFromPlaylist(track, newIndex);
                } else {
                    // 歌曲已在播放列表中，直接播放
                    this.playTrackFromPlaylist(track, existingIndex);
                }
            }
        } else {
            // 如果播放列表组件不存在，使用传统播放方式
            console.warn('播放列表组件不存在，使用传统播放方式');
            api.setPlaylist([track], 0);
        }
    }

    handleKeyboardShortcut(e) {
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                // 控制台组件处理
                break;
            case 'ArrowRight':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    api.nextTrack();
                }
                break;
            case 'ArrowLeft':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    api.previousTrack();
                }
                break;
            case 'KeyF':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    document.getElementById('search-input')?.focus();
                }
                break;
        }
    }

    showCreatePlaylistDialog() {
        // todo 实现播放列表创建对话框
        const name = prompt('Enter playlist name:');
        if (name) {
            console.log('Creating playlist:', name);
        }
    }

    cleanup() {
        if (this.components.player) {
            api.setSetting('volume', this.components.player.volume);
        }
        Object.values(this.components).forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
    }

    // File Loading Methods
    setupFileLoading() {
        // Add drag and drop support
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });

        // Add keyboard shortcuts for file operations
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'o':
                        e.preventDefault();
                        this.openFileDialog();
                        break;
                    case 'O':
                        e.preventDefault();
                        this.openDirectoryDialog();
                        break;
                }
            }
        });

        // Add menu items for file operations (if running in Electron)
        if (window.electronAPI) {
            this.addFileMenuItems();
        }
    }

    async handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        const audioFiles = files.filter(file =>
            file.type.startsWith('audio/') ||
            /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)
        );

        if (audioFiles.length > 0) {
            console.log(`Dropped ${audioFiles.length} audio files`);

            if (audioFiles.length === 1) {
                // Single file - load and play
                await this.loadAndPlayFile(audioFiles[0].path);
            } else {
                // Multiple files - add to playlist
                await this.addFilesToPlaylist(audioFiles);
            }
        }
    }

    async openFileDialog() {
        try {
            const files = await api.openFileDialog();
            if (files && files.length > 0) {
                console.log(`Selected ${files.length} files`);

                if (files.length === 1) {
                    await this.loadAndPlayFile(files[0]);
                } else {
                    await this.addFilesToPlaylist(files);
                }
            }
        } catch (error) {
            console.error('Failed to open file dialog:', error);
            this.showError('Failed to open file dialog');
        }
    }

    async openDirectoryDialog() {
        try {
            const directory = await api.openDirectoryDialog();
            if (directory) {
                console.log(`Selected directory: ${directory}`);
                await this.scanDirectory(directory);
            }
        } catch (error) {
            console.error('Failed to open directory dialog:', error);
            this.showError('Failed to open directory dialog');
        }
    }

    async loadAndPlayFile(filePath) {
        try {
            console.log(`Loading and playing file: ${filePath}`);
            const success = await api.loadTrack(filePath);
            if (success) {
                await api.play();
                this.showSuccess(`Now playing: ${filePath.split(/[/\\]/).pop()}`);
            } else {
                this.showError(`Failed to load file: ${filePath}`);
            }
        } catch (error) {
            console.error('Failed to load and play file:', error);
            this.showError('Failed to load audio file');
        }
    }

    async addFilesToPlaylist(files) {
        try {
            console.log(`Adding ${files.length} files to playlist`);
            // For now, just load the first file
            if (files.length > 0) {
                await this.loadAndPlayFile(files[0].path || files[0]);
            }
            this.showSuccess(`Added ${files.length} files to playlist`);
        } catch (error) {
            console.error('Failed to add files to playlist:', error);
            this.showError('Failed to add files to playlist');
        }
    }

    async scanDirectory(directoryPath) {
        try {
            console.log(`Scanning directory: ${directoryPath}`);
            this.showInfo('扫描音乐文件...');

            const success = await api.scanDirectory(directoryPath);
            if (success) {
                this.showSuccess('音乐目录扫描完成');
                await this.refreshLibrary();
            } else {
                this.showError('扫描失败');
            }
        } catch (error) {
            console.error('扫描失败：', error);
            this.showError('扫描失败');
        }
    }

    addFileMenuItems() {
        // This would add menu items to the Electron menu
        // For now, we'll just add some UI hints
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.placeholder = '搜索... (Ctrl+O 添加音乐, Ctrl+Shift+O 添加音乐目录)';
        }
    }

    showSuccess(message) {
        console.log(`✅ ${message}`);
        // TODO: Add toast notification system
        showToast(message, 'success');
    }

    showError(message) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div class="error-message">
                    <h2>错误</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()">重试</button>
                </div>
            `;
        }
        showToast(message, 'error');
    }

    showInfo(message) {
        console.log(`ℹ️ ${message}`);
        showToast(message, 'info');
    }

    // Playlist event handlers
    handlePlaylistTrackSelected(track, index) {
        console.log('🎵 播放列表选择歌曲:', track.title);
        // Just select, don't play automatically
    }

    handlePlaylistTrackPlayed(track, index) {
        console.log('🎵 播放列表双击播放歌曲:', track.title, '索引:', index);

        // 直接播放播放列表中的指定歌曲
        this.playTrackFromPlaylist(track, index);
    }

    handlePlaylistTrackRemoved(track, index) {
        console.log('🎵 从播放列表移除歌曲:', track.title, '索引:', index);

        // 同步更新API播放列表
        if (this.components.playlist && this.components.playlist.tracks.length >= 0) {
            console.log('🔄 同步删除操作到API，剩余歌曲:', this.components.playlist.tracks.length);

            // 获取当前播放索引
            const currentIndex = this.components.playlist.currentTrackIndex;

            // 更新API播放列表
            api.setPlaylist(this.components.playlist.tracks, currentIndex);

            // 如果删除的是当前播放的歌曲，需要特殊处理
            if (index === api.currentIndex) {
                console.log('⚠️ 删除的是当前播放歌曲，停止播放');
                api.pause();
            }
        }
    }

    handlePlaylistCleared() {
        console.log('🎵 播放列表已清空');

        // 同步清空API播放列表
        api.setPlaylist([], -1);
        api.pause();
        console.log('🔄 API播放列表已清空');
    }

    // Play track from playlist
    async playTrackFromPlaylist(track, index) {
        try {
            console.log('🎵 从播放列表播放歌曲:', track.title, '索引:', index);

            // 确保API的播放列表与组件播放列表同步
            if (this.components.playlist && this.components.playlist.tracks.length > 0) {
                console.log('🔄 同步播放列表到API:', this.components.playlist.tracks.length, '首歌曲');

                // 先设置API的播放列表为组件的播放列表
                const setPlaylistResult = await api.setPlaylist(this.components.playlist.tracks, index);

                if (setPlaylistResult) {
                    // 更新播放列表组件的当前歌曲
                    this.components.playlist.setCurrentTrack(index);

                    // 加载并播放指定的歌曲
                    const loadResult = await api.loadTrack(track.filePath);
                    if (loadResult) {
                        // 开始播放
                        const playResult = await api.play();
                        if (playResult) {
                            console.log('✅ 播放列表播放成功');
                        } else {
                            console.log('❌ 播放列表播放失败');
                        }
                    } else {
                        console.log('❌ 播放列表加载文件失败');
                    }
                } else {
                    console.log('❌ 设置播放列表失败');
                }
            } else {
                console.warn('播放列表为空或不存在');
            }
        } catch (error) {
            console.error('❌ 播放列表播放错误:', error);
        }
    }

    // Handle track index change (for prev/next buttons)
    handleTrackIndexChanged(index) {
        console.log('🎵 播放索引改变:', index);
        console.log('🎵 当前播放列表长度:', this.components.playlist?.tracks?.length || 0);
        console.log('🎵 API播放列表长度:', api.playlist?.length || 0);

        // 更新播放列表组件的当前歌曲
        if (this.components.playlist) {
            if (index >= 0 && index < this.components.playlist.tracks.length) {
                this.components.playlist.setCurrentTrack(index);
                console.log('✅ 播放列表组件已更新到索引:', index);
            } else {
                console.warn('⚠️ 索引超出播放列表范围:', index, '/', this.components.playlist.tracks.length);
            }
        }
    }

    updateLibraryTrackDuration(filePath, duration) {
        // 更新音乐库中的时长
        const libraryTrack = this.library.find(track => track.filePath === filePath);
        if (libraryTrack) {
            libraryTrack.duration = duration;
            console.log('✅ 更新音乐库歌曲时长:', libraryTrack.title, duration.toFixed(2) + 's');
        }

        // 更新过滤后的音乐库
        const filteredTrack = this.filteredLibrary.find(track => track.filePath === filePath);
        if (filteredTrack) {
            filteredTrack.duration = duration;
        }

        // 更新播放列表组件中的时长（如果存在）
        if (this.components.playlist) {
            const playlistTrack = this.components.playlist.tracks.find(track => track.filePath === filePath);
            if (playlistTrack) {
                playlistTrack.duration = duration;
                this.components.playlist.render(); // 重新渲染播放列表
            }
        }

        // 更新音乐列表显示
        this.updateTrackList();
    }

    // Context menu event handlers
    handleDeleteTrack(track, index) {
        if (confirm(`确定要删除歌曲 "${track.title}" 吗？`)) {
            console.log('🗑️ 删除歌曲:', track.title);
            // TODO: 实现删除歌曲的逻辑
            this.showInfo('删除功能将在后续版本中实现');
        }
    }

    // Settings event handlers
    async handleSelectMusicFolder() {
        try {
            const result = await api.selectMusicFolder();
            if (result && result.path) {
                this.components.settings.updateMusicFolderPath(result.path);
                console.log('📁 选择音乐文件夹:', result.path);
            }
        } catch (error) {
            console.error('❌ 选择音乐文件夹失败:', error);
        }
    }

    async handleRescanLibrary() {
        try {
            console.log('🔄 重新扫描音乐库');
            await api.scanLibrary();
            this.showInfo('开始重新扫描音乐库');
        } catch (error) {
            console.error('❌ 重新扫描失败:', error);
        }
    }

    handleDefaultVolumeChanged(volume) {
        console.log('🔊 默认音量改变:', volume);
        // TODO: 保存默认音量设置
    }

    // Add track to playlist
    addToPlaylist(track) {
        if (this.components.playlist) {
            this.components.playlist.addTrack(track);
            console.log('🎵 添加歌曲到播放列表:', track.title);
            this.showInfo(`已添加 "${track.title}" 到播放列表`);
        }
    }
}

const app = new MusicBoxApp();


// === md5.js ===
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */
/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_md5(s){ return binl2hex(core_md5(str2binl(s), s.length * chrsz));}
function b64_md5(s){ return binl2b64(core_md5(str2binl(s), s.length * chrsz));}
function str_md5(s){ return binl2str(core_md5(str2binl(s), s.length * chrsz));}
function hex_hmac_md5(key, data) { return binl2hex(core_hmac_md5(key, data)); }
function b64_hmac_md5(key, data) { return binl2b64(core_hmac_md5(key, data)); }
function str_hmac_md5(key, data) { return binl2str(core_hmac_md5(key, data)); }
/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
    return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;
    for(var i = 0; i < x.length; i += 16)
    {
        var olda = a;
        var oldb = b;
        var oldc = c;
        var oldd = d;
        a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
        d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
        c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
        b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
        a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
        d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
        c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
        b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
        a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
        d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
        c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
        b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
        a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
        d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
        c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
        b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);
        a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
        d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
        c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
        b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
        a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
        d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
        c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
        b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
        a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
        d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
        c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
        b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
        a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
        d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
        c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
        b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);
        a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
        d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
        c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
        b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
        a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
        d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
        c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
        b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
        a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
        d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
        c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
        b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
        a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
        d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
        c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
        b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);
        a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
        d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
        c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
        b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
        a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
        d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
        c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
        b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
        a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
        d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
        c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
        b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
        a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
        d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
        c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
        b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);
        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
    }
    return Array(a, b, c, d);
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
    return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
    return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
    return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
    return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
    return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}
/*
 * Calculate the HMAC-MD5, of a key and some data
 */
function core_hmac_md5(key, data)
{
    var bkey = str2binl(key);
    if(bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);
    var ipad = Array(16), opad = Array(16);
    for(var i = 0; i < 16; i++)
    {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }
    var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
    return core_md5(opad.concat(hash), 512 + 128);
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
    return (num << cnt) | (num >>> (32 - cnt));
}
/*
 * Convert a string to an array of little-endian words
 * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
 */
function str2binl(str)
{
    var bin = Array();
    var mask = (1 << chrsz) - 1;
    for(var i = 0; i < str.length * chrsz; i += chrsz)
        bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);
    return bin;
}
/*
 * Convert an array of little-endian words to a string
 */
function binl2str(bin)
{
    var str = "";
    var mask = (1 << chrsz) - 1;
    for(var i = 0; i < bin.length * 32; i += chrsz)
        str += String.fromCharCode((bin[i>>5] >>> (i % 32)) & mask);
    return str;
}
/*
 * Convert an array of little-endian words to a hex string.
 */
function binl2hex(binarray)
{
    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i++)
    {
        str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
            hex_tab.charAt((binarray[i>>2] >> ((i%4)*8  )) & 0xF);
    }
    return str;
}
/*
 * Convert an array of little-endian words to a base-64 string
 */
function binl2b64(binarray)
{
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i += 3)
    {
        var triplet = (((binarray[i   >> 2] >> 8 * ( i   %4)) & 0xFF) << 16)
            | (((binarray[i+1 >> 2] >> 8 * ((i+1)%4)) & 0xFF) << 8 )
            |  ((binarray[i+2 >> 2] >> 8 * ((i+2)%4)) & 0xFF);
        for(var j = 0; j < 4; j++)
        {
            if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
            else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
        }
    }
    return str;
}


