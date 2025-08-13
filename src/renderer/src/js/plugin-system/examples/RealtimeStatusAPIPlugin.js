/**
 * MusicBox 实时状态API插件
 */

class RealtimeStatusAPIPlugin extends PluginBase {
    constructor(context) {
        super(context);

        this.metadata = {
            id: 'realtime-status-api',
            name: '实时状态API',
            version: '1.0.0',
            description: '提供HTTP API接口获取MusicBox实时状态信息',
            author: 'MusicBox-ASXE',
            permissions: ['network', 'system', 'player'],
            category: 'api'
        };

        this.serverConfig = {
            port: 8899,
            host: 'localhost',
            cors: true,
            maxConnections: 50
        };

        this.serverId = null;
        this.isServerRunning = false;
        this.statusCache = null;
        this.cacheUpdateInterval = null;
        this.cacheUpdateFrequency = 500;
        this.eventCleanupFunctions = [];
        this.requestHandlerCleanup = null;

        if (!window._httpRequestHandlers) {
            window._httpRequestHandlers = new Map();
        }
    }

    async activate() {
        await super.activate();
        
        try {
            // 初始化状态缓存
            await this.initializeStatusCache();
            
            // 启动HTTP服务器
            await this.startHttpServer();
            
            // 设置状态监听器
            this.setupStatusListeners();
            
            // 启动缓存更新定时器
            this.startCacheUpdateTimer();
            
        } catch (error) {
            console.error('激活实时状态API插件失败:', error);
            throw error;
        }
    }

    async deactivate() {
        try {
            await this.stopHttpServer();
            this.stopCacheUpdateTimer();
            this.cleanupEventListeners();

            if (this.requestHandlerCleanup) {
                this.requestHandlerCleanup();
                this.requestHandlerCleanup = null;
            }

            if (window._httpRequestHandlers) {
                window._httpRequestHandlers.delete('status');
                window._httpRequestHandlers.delete('info');
                window._httpRequestHandlers.delete('root');

                if (window._httpRequestHandlers.size === 0) {
                    window._httpRequestHandlerSetup = false;
                }
            }

            this.statusCache = null;
            await super.deactivate();
        } catch (error) {
            console.error('停用实时状态API插件失败:', error);
        }
    }

    async startHttpServer() {
        try {
            const createResult = await this.context.electronAPI.httpServer.create(this.serverConfig);

            if (!createResult.success) {
                throw new Error(createResult.error);
            }

            this.serverId = createResult.serverId;
            await this.registerRequestHandlers();

            const startResult = await this.context.electronAPI.httpServer.start(this.serverId);

            if (!startResult.success) {
                throw new Error(startResult.error);
            }

            this.isServerRunning = true;

        } catch (error) {
            console.error('启动HTTP服务器失败:', error);
            throw error;
        }
    }

    async registerRequestHandlers() {
        try {
            // 注册处理器到全局映射
            window._httpRequestHandlers.set('status', this.handleStatusRequest.bind(this));
            window._httpRequestHandlers.set('info', this.handleInfoRequest.bind(this));
            window._httpRequestHandlers.set('root', this.handleRootRequest.bind(this));

            // 设置全局HTTP请求处理器
            if (!window._httpRequestHandlerSetup) {
                this.requestHandlerCleanup = this.context.electronAPI.httpServer.onHandleRequest(this.globalHttpRequestHandler.bind(this));
                window._httpRequestHandlerSetup = true;
            }

            // 注册端点处理器
            await this.context.electronAPI.httpServer.registerHandler(
                this.serverId, 'GET', '/api/status', 'status'
            );

            await this.context.electronAPI.httpServer.registerHandler(
                this.serverId, 'GET', '/api/info', 'info'
            );

            await this.context.electronAPI.httpServer.registerHandler(
                this.serverId, 'GET', '/', 'root'
            );

        } catch (error) {
            console.error('注册请求处理器失败:', error);
            throw error;
        }
    }

    async globalHttpRequestHandler(requestData) {
        try {
            const { method, url, headers, body, handlerId } = requestData;

            const handler = window._httpRequestHandlers.get(handlerId);
            if (!handler) {
                return this.createErrorResponse(404, 'Not Found', `未找到处理器: ${handlerId}`);
            }

            const parsedUrl = new URL(url, `http://localhost:${this.serverConfig.port}`);
            const response = await handler(parsedUrl, method, headers, body);

            return response;

        } catch (error) {
            console.error('全局处理器处理失败:', error);
            return this.createErrorResponse(500, 'Internal Server Error', error.message);
        }
    }

    async handleHttpRequest(requestData) {
        return await this.globalHttpRequestHandler(requestData);
    }

    async handleStatusRequest(parsedUrl, method, headers, body) {
        try {
            const status = await this.collectCurrentStatus();

            return {
                success: true,
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(status, null, 2)
            };

        } catch (error) {
            console.error('处理状态请求失败:', error);
            return this.createErrorResponse(500, 'Internal Server Error', '获取状态信息失败');
        }
    }

    /**
     * 处理信息请求
     */
    async handleInfoRequest(parsedUrl, method, headers, body) {
        const info = {
            plugin: {
                name: this.metadata.name,
                version: this.metadata.version,
                description: this.metadata.description,
                author: this.metadata.author
            },
            server: {
                running: this.isServerRunning,
                port: this.serverConfig.port,
                host: this.serverConfig.host,
                uptime: Date.now() - this.activationTime
            },
            endpoints: {
                status: '/api/status',
                info: '/api/info',
                root: '/'
            }
        };

        return {
            success: true,
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(info, null, 2)
        };
    }

    async handleRootRequest(parsedUrl, method, headers, body) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>MusicBox 实时状态API</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .method { color: #007acc; font-weight: bold; }
    </style>
</head>
<body>
    <h1>MusicBox 实时状态API</h1>
    <p>欢迎使用MusicBox实时状态API插件！</p>

    <h2>可用端点：</h2>
    <div class="endpoint">
        <span class="method">GET</span> /api/status - 获取完整的播放器状态信息
    </div>
    <div class="endpoint">
        <span class="method">GET</span> /api/info - 获取插件和服务器信息
    </div>

    <h2>使用示例：</h2>
    <pre>
curl http://localhost:${this.serverConfig.port}/api/status
fetch('http://localhost:${this.serverConfig.port}/api/status').then(r => r.json())
    </pre>
</body>
</html>`;

        return {
            success: true,
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            },
            body: html
        };
    }

    createErrorResponse(statusCode, error, message) {
        return {
            success: true,
            statusCode,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                error,
                message
            })
        };
    }

    async stopHttpServer() {
        try {
            if (this.serverId) {
                const result = await this.context.electronAPI.httpServer.destroy(this.serverId);
                if (result.success) {
                    this.isServerRunning = false;
                    this.serverId = null;
                } else {
                    console.error('停止HTTP服务器失败:', result.error);
                }
            }
        } catch (error) {
            console.error('停止HTTP服务器失败:', error);
        }
    }

    async initializeStatusCache() {
        this.statusCache = await this.collectCurrentStatus();
        this.activationTime = Date.now();
    }

    startCacheUpdateTimer() {
        this.cacheUpdateInterval = setInterval(async () => {
            try {
                this.statusCache = await this.collectCurrentStatus();
            } catch (error) {
                console.error('更新状态缓存失败:', error);
            }
        }, this.cacheUpdateFrequency);
    }

    stopCacheUpdateTimer() {
        if (this.cacheUpdateInterval) {
            clearInterval(this.cacheUpdateInterval);
            this.cacheUpdateInterval = null;
        }
    }

    setupStatusListeners() {
        const api = this.context.api;

        if (api) {
            // 监听播放状态变化
            const onPlaybackStateChanged = () => {
                this.updateStatusCache();
            };

            const onTrackChanged = () => {
                this.updateStatusCache();
            };

            const onPositionChanged = () => {
                this.updateStatusCache();
            };

            const onVolumeChanged = () => {
                this.updateStatusCache();
            };

            // 注册事件监听器
            api.on('playbackStateChanged', onPlaybackStateChanged);
            api.on('trackChanged', onTrackChanged);
            api.on('positionChanged', onPositionChanged);
            api.on('volumeChanged', onVolumeChanged);

            // 保存清理函数
            this.eventCleanupFunctions.push(
                () => api.off('playbackStateChanged', onPlaybackStateChanged),
                () => api.off('trackChanged', onTrackChanged),
                () => api.off('positionChanged', onPositionChanged),
                () => api.off('volumeChanged', onVolumeChanged)
            );
        }
    }

    cleanupEventListeners() {
        this.eventCleanupFunctions.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.error('清理事件监听器失败:', error);
            }
        });
        this.eventCleanupFunctions = [];
    }

    async updateStatusCache() {
        try {
            this.statusCache = await this.collectCurrentStatus();
        } catch (error) {
            console.error('更新状态缓存失败:', error);
        }
    }

    getCurrentStatus() {
        return this.statusCache || this.getEmptyStatus();
    }

    async collectCurrentStatus() {
        try {
            const api = this.context.api;
            const player = this.context.player;

            if (!api) {
                return this.getEmptyStatus();
            }

            // 获取当前播放音乐信息
            const currentTrack = api.getCurrentTrack() || {};

            // 获取播放状态
            const isPlaying = api.isPlaying || false;
            const position = api.getPosition() || 0;
            const duration = api.getDuration() || 0;
            const volume = api.getVolume() || 0;
            const playMode = api.getPlayMode() || 'sequence';

            // 获取播放列表
            const playlist = api.playlist || [];
            const currentIndex = api.currentIndex || -1;

            // 计算进度百分比
            const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

            // 格式化时间
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };

            // 构建完整状态对象
            const status = {
                // 基本信息
                timestamp: Date.now(),
                serverInfo: {
                    pluginVersion: this.metadata.version,
                    uptime: Date.now() - this.activationTime
                },

                // 当前播放音乐信息
                currentTrack: {
                    filePath: currentTrack.filePath || '',
                    title: currentTrack.title || '未知标题',
                    artist: currentTrack.artist || '未知艺术家',
                    album: currentTrack.album || '未知专辑',
                    duration: currentTrack.duration || duration || 0,
                    durationFormatted: formatTime(currentTrack.duration || duration || 0),
                    year: currentTrack.year || null,
                    genre: currentTrack.genre || null,
                    track: currentTrack.track || null,
                    disc: currentTrack.disc || null,
                    bitrate: currentTrack.bitrate || null,
                    sampleRate: currentTrack.sampleRate || null,
                    cover: currentTrack.cover || null,
                    embeddedLyrics: currentTrack.embeddedLyrics || null
                },

                // 播放状态
                playback: {
                    isPlaying: isPlaying,
                    state: isPlaying ? 'playing' : 'paused',
                    position: position,
                    positionFormatted: formatTime(position),
                    duration: duration,
                    durationFormatted: formatTime(duration),
                    progressPercent: Math.round(progressPercent * 100) / 100,
                    volume: Math.round(volume * 100) / 100,
                    volumePercent: Math.round(volume * 100),
                    playMode: playMode,
                    playModeDisplay: this.getPlayModeDisplay(playMode)
                },

                // 播放列表信息
                playlist: {
                    totalTracks: playlist.length,
                    currentIndex: currentIndex,
                    hasNext: currentIndex < playlist.length - 1,
                    hasPrevious: currentIndex > 0,
                    tracks: playlist.map((track, index) => ({
                        index: index,
                        isCurrent: index === currentIndex,
                        filePath: track.filePath || track.path || track,
                        title: track.title || '未知标题',
                        artist: track.artist || '未知艺术家',
                        album: track.album || '未知专辑',
                        duration: track.duration || 0,
                        durationFormatted: formatTime(track.duration || 0)
                    }))
                },

                // 音频格式信息
                audioFormat: {
                    bitrate: currentTrack.bitrate || null,
                    sampleRate: currentTrack.sampleRate || null,
                    channels: currentTrack.channels || null,
                    format: this.getAudioFormat(currentTrack.filePath || '')
                },

                // 应用状态
                application: {
                    isInitialized: api.isInitialized || false,
                    hasWebAudioEngine: !!api.webAudioEngine
                }
            };

            return status;

        } catch (error) {
            console.error('收集状态信息失败:', error);
            return this.getEmptyStatus();
        }
    }

    getPlayModeDisplay(mode) {
        const modeMap = {
            'sequence': '顺序播放',
            'shuffle': '随机播放',
            'repeat-one': '单曲循环',
            'repeat-all': '列表循环'
        };
        return modeMap[mode] || '未知模式';
    }

    getAudioFormat(filePath) {
        if (!filePath) return null;

        const ext = filePath.split('.').pop().toLowerCase();
        const formatMap = {
            'mp3': 'MP3',
            'flac': 'FLAC',
            'wav': 'WAV',
            'aac': 'AAC',
            'm4a': 'M4A',
            'ogg': 'OGG',
            'wma': 'WMA'
        };

        return formatMap[ext] || ext.toUpperCase();
    }
    getEmptyStatus() {
        return {
            timestamp: Date.now(),
            serverInfo: {
                pluginVersion: this.metadata.version,
                uptime: this.activationTime ? Date.now() - this.activationTime : 0
            },
            currentTrack: {
                filePath: '',
                title: '未选择音频文件',
                artist: '未知艺术家',
                album: '未知专辑',
                duration: 0,
                durationFormatted: '0:00',
                year: null,
                genre: null,
                track: null,
                disc: null,
                bitrate: null,
                sampleRate: null,
                cover: null,
                embeddedLyrics: null
            },
            playback: {
                isPlaying: false,
                state: 'stopped',
                position: 0,
                positionFormatted: '0:00',
                duration: 0,
                durationFormatted: '0:00',
                progressPercent: 0,
                volume: 0,
                volumePercent: 0,
                playMode: 'sequence',
                playModeDisplay: '顺序播放'
            },
            playlist: {
                totalTracks: 0,
                currentIndex: -1,
                hasNext: false,
                hasPrevious: false,
                tracks: []
            },
            audioFormat: {
                bitrate: null,
                sampleRate: null,
                channels: null,
                format: null
            },
            application: {
                version: '1.0.0',
                isInitialized: false,
                hasWebAudioEngine: false
            }
        };
    }

    getPluginConfig() {
        return {
            server: this.serverConfig,
            cache: {
                updateFrequency: this.cacheUpdateFrequency
            },
            metadata: this.metadata
        };
    }

    updateServerConfig(newConfig) {
        this.serverConfig = { ...this.serverConfig, ...newConfig };

        if (this.isServerRunning) {
            this.showNotification('配置已更新，需要重启插件以生效', 'info');
        }
    }

    getServerStatus() {
        return {
            running: this.isServerRunning,
            config: this.serverConfig,
            uptime: this.activationTime ? Date.now() - this.activationTime : 0,
            cacheUpdateFrequency: this.cacheUpdateFrequency,
            lastCacheUpdate: this.statusCache ? this.statusCache.timestamp : null
        };
    }
}

// 导出插件类
window.PluginClass = RealtimeStatusAPIPlugin;
