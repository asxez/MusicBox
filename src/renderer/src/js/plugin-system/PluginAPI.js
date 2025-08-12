/**
 * 插件API接口定义
 * 为插件提供标准化的API接口访问应用功能
 */

class PluginAPI {
    constructor(pluginManager = null) {
        this.pluginManager = pluginManager;
        this.registeredAPIs = new Map();

        // 插件事件监听器管理
        this.pluginEventListeners = new Map(); // pluginId -> { eventName -> [callbacks] }

        // 延迟初始化核心API，避免循环依赖
        this.coreAPIsInitialized = false;
    }

    // 设置插件管理器引用
    setPluginManager(pluginManager) {
        this.pluginManager = pluginManager;
        if (!this.coreAPIsInitialized) {
            this.initializeCoreAPIs();
        }
    }

    // 初始化核心API
    initializeCoreAPIs() {
        if (this.coreAPIsInitialized) {
            return;
        }

        this.coreAPIsInitialized = true;
        // 音乐播放API - 使用工厂函数为每个插件创建独立的API实例
        this.registerAPI('player', this.createPlayerAPIFactory());

        // 音乐库API
        this.registerAPI('library', {
            getTracks: (options) => window.api.getTracks(options),
            getAlbums: () => window.api.getAlbums(),
            getArtists: () => window.api.getArtists(),
            search: (query) => window.api.search(query),
            scanDirectory: (path) => window.api.scanDirectory(path),
            getTrackMetadata: (filePath) => window.api.getTrackMetadata(filePath),
            onLibraryUpdated: (callback) => window.api.onLibraryUpdated(callback),
            onScanProgress: (callback) => window.api.onScanProgress(callback)
        });

        // UI组件API
        this.registerAPI('ui', {
            showNotification: (message, type, duration) => {
                this.pluginManager.showNotification(message, type, duration);
            },
            createElement: (tag, attributes, children) => {
                return this.pluginManager.createElement(tag, attributes, children);
            },
            addCSS: (pluginId, css) => {
                this.pluginManager.addCSS(pluginId, css);
            },
            removeCSS: (pluginId) => {
                this.pluginManager.removeCSS(pluginId);
            },
            getComponent: (name) => {
                return window.app?.components?.[name];
            },
            showDialog: (config) => {
                // TODO: 实现通用对话框显示
                console.log('显示对话框:', config);
            }
        });

        // 设置API
        this.registerAPI('settings', {
            get: (key, defaultValue) => {
                const settings = window.app?.components?.settings;
                return settings?.getSetting(key, defaultValue);
            },
            set: (key, value) => {
                const settings = window.app?.components?.settings;
                settings?.updateSetting(key, value);
            },
            addSection: (pluginId, config) => {
                const settings = window.app?.components?.settings;
                if (settings && typeof settings.addPluginSection === 'function') {
                    return settings.addPluginSection(pluginId, config);
                }
                return null;
            },
            removeSection: (pluginId, sectionId) => {
                const settings = window.app?.components?.settings;
                if (settings && typeof settings.removePluginSection === 'function') {
                    settings.removePluginSection(pluginId, sectionId);
                }
            }
        });

        // 导航API
        this.registerAPI('navigation', {
            addItem: (pluginId, config) => {
                const navigation = window.app?.components?.navigation;
                if (navigation && typeof navigation.addPluginItem === 'function') {
                    return navigation.addPluginItem(pluginId, config);
                }
                return null;
            },
            removeItem: (pluginId, itemId) => {
                const navigation = window.app?.components?.navigation;
                if (navigation && typeof navigation.removePluginItem === 'function') {
                    navigation.removePluginItem(pluginId, itemId);
                }
            },
            getCurrentView: () => {
                return window.app?.currentView;
            },
            navigateTo: (view) => {
                if (window.app && typeof window.app.handleViewChange === 'function') {
                    window.app.handleViewChange(view);
                }
            }
        });

        // 右键菜单API
        this.registerAPI('contextMenu', {
            addItem: (pluginId, config) => {
                const contextMenu = window.app?.components?.contextMenu;
                if (contextMenu && typeof contextMenu.addPluginItem === 'function') {
                    return contextMenu.addPluginItem(pluginId, config);
                }
                return null;
            },
            removeItem: (pluginId, itemId) => {
                const contextMenu = window.app?.components?.contextMenu;
                if (contextMenu && typeof contextMenu.removePluginItem === 'function') {
                    contextMenu.removePluginItem(pluginId, itemId);
                }
            }
        });

        // 存储API
        this.registerAPI('storage', {
            get: (key) => window.cacheManager.getLocalCache(key),
            set: (key, value) => window.cacheManager.setLocalCache(key, value),
            remove: (key) => window.cacheManager.removeLocalCache(key),
            clear: () => window.cacheManager.clearAllCache()
        });

        // 系统API
        this.registerAPI('system', {
            fs: window.electronAPI.fs,
            path: window.electronAPI.path,
            os: window.electronAPI.os,
            openDirectory: () => window.api.openDirectory(),
            openFiles: () => window.api.openFiles(),
            showItemInFolder: (path) => window.electronAPI.showItemInFolder?.(path)
        });

        // 事件API
        this.registerAPI('events', {
            emit: (event, data) => {
                if (window.app && typeof window.app.emit === 'function') {
                    window.app.emit(event, data);
                }
            },
            on: (event, callback) => {
                if (window.app && typeof window.app.on === 'function') {
                    window.app.on(event, callback);
                }
            },
            off: (event, callback) => {
                if (window.app && typeof window.app.off === 'function') {
                    window.app.off(event, callback);
                }
            }
        });
    }

    // 注册API
    registerAPI(namespace, api) {
        this.registeredAPIs.set(namespace, api);
        console.log(`🔌 PluginAPI: 注册API命名空间 ${namespace}`);
    }

    // 获取API
    getAPI(namespace) {
        return this.registeredAPIs.get(namespace);
    }

    // 获取所有API
    getAllAPIs() {
        const apis = {};
        for (const [namespace, api] of this.registeredAPIs) {
            apis[namespace] = api;
        }
        return apis;
    }

    // 创建插件上下文
    createPluginContext(pluginId) {
        // 为插件创建专用的API实例
        const pluginSpecificAPIs = this.createPluginSpecificAPIs(pluginId);

        // 创建动态上下文对象，使用getter确保总是获取最新的应用状态
        const context = {
            // 插件信息
            pluginId: pluginId,

            // 插件专用API实例
            ...pluginSpecificAPIs,

            get app() {
                return window.app;
            },

            get api() {
                return window.api;
            },

            // 全局
            document: document,
            window: window,
            electronAPI: window.electronAPI,

            // 组件
            Component: window.Component,
            EventEmitter: window.EventEmitter,

            // 插件基类
            PluginBase: window.PluginBase,

            // 工具函数
            utils: {
                createElement: this.pluginManager.createElement.bind(this.pluginManager),
                addCSS: (css) => this.pluginManager.addCSS(pluginId, css),
                removeCSS: () => this.pluginManager.removeCSS(pluginId),
                showNotification: this.pluginManager.showNotification.bind(this.pluginManager),
                registerCommand: (commandId, handler) => this.pluginManager.registerCommand(pluginId, commandId, handler),
                unregisterCommand: (commandId) => this.pluginManager.unregisterCommand(pluginId, commandId)
            },

            // 插件间通信
            messaging: {
                emit: (event, data) => this.pluginManager.emit(`plugin:${pluginId}:${event}`, data),
                on: (event, callback) => this.pluginManager.on(`plugin:${pluginId}:${event}`, callback),
                off: (event, callback) => this.pluginManager.off(`plugin:${pluginId}:${event}`, callback),
                broadcast: (event, data) => this.pluginManager.emit(`plugin:broadcast:${event}`, data),
                onBroadcast: (event, callback) => this.pluginManager.on(`plugin:broadcast:${event}`, callback)
            }
        };

        console.log(`🔌 PluginAPI: 为插件 ${pluginId} 创建专用上下文`);
        console.log(`🔌 PluginAPI: 当前应用状态:`, {
            appExists: !!window.app,
            appInitialized: window.app?.isInitialized,
            componentsCount: Object.keys(window.app?.components || {}).length,
            availableComponents: Object.keys(window.app?.components || {})
        });

        return context;
    }

    // 为插件创建专用的API实例
    createPluginSpecificAPIs(pluginId) {
        const pluginAPIs = {};

        // 遍历所有注册的API
        for (const [namespace, apiFactory] of this.registeredAPIs) {
            if (typeof apiFactory === 'function') {
                // 如果是工厂函数，为插件创建专用实例
                try {
                    pluginAPIs[namespace] = apiFactory(pluginId);
                    console.log(`✅ PluginAPI: 为插件 ${pluginId} 创建 ${namespace} API实例`);
                } catch (error) {
                    console.error(`❌ PluginAPI: 为插件 ${pluginId} 创建 ${namespace} API实例失败:`, error);
                    pluginAPIs[namespace] = null;
                }
            } else {
                // 如果是静态API，直接使用
                pluginAPIs[namespace] = apiFactory;
            }
        }

        return pluginAPIs;
    }

    // 扩展API
    extendAPI(namespace, extension) {
        const existingAPI = this.registeredAPIs.get(namespace) || {};
        const extendedAPI = { ...existingAPI, ...extension };
        this.registerAPI(namespace, extendedAPI);
    }

    // 移除API
    removeAPI(namespace) {
        this.registeredAPIs.delete(namespace);
    }

    // 创建Player API工厂函数
    createPlayerAPIFactory() {
        return (pluginId) => {
            return {
                // 播放控制方法
                play: () => window.api.play(),
                pause: () => window.api.pause(),
                stop: () => window.api.stop(),
                next: () => window.api.nextTrack(),
                previous: () => window.api.previousTrack(),
                setVolume: (volume) => window.api.setVolume(volume),
                getVolume: () => window.api.getVolume(),
                getCurrentTrack: () => window.api.getCurrentTrack(),
                getPlaylist: () => window.api.playlist,
                setPlaylist: (tracks, index) => window.api.setPlaylist(tracks, index),
                seek: (position) => window.api.seek(position),
                getPosition: () => window.api.getPosition(),
                getDuration: () => window.api.getDuration(),
                isPlaying: () => window.api.isPlaying,

                // 事件监听器方法 - 为每个插件实例管理独立的监听器
                onTrackChanged: (callback) => {
                    return this.addPluginEventListener(pluginId, 'trackChanged', callback);
                },
                onPlaybackStateChanged: (callback) => {
                    return this.addPluginEventListener(pluginId, 'playbackStateChanged', callback);
                },
                onPositionChanged: (callback) => {
                    return this.addPluginEventListener(pluginId, 'positionChanged', callback);
                },
                onTrackLoaded: (callback) => {
                    return this.addPluginEventListener(pluginId, 'trackLoaded', callback);
                },
                onDurationChanged: (callback) => {
                    return this.addPluginEventListener(pluginId, 'durationChanged', callback);
                },
                onVolumeChanged: (callback) => {
                    return this.addPluginEventListener(pluginId, 'volumeChanged', callback);
                },

                // 事件移除方法
                offTrackChanged: (callback) => {
                    return this.removePluginEventListener(pluginId, 'trackChanged', callback);
                },
                offPlaybackStateChanged: (callback) => {
                    return this.removePluginEventListener(pluginId, 'playbackStateChanged', callback);
                },
                offPositionChanged: (callback) => {
                    return this.removePluginEventListener(pluginId, 'positionChanged', callback);
                },
                offTrackLoaded: (callback) => {
                    return this.removePluginEventListener(pluginId, 'trackLoaded', callback);
                },
                offDurationChanged: (callback) => {
                    return this.removePluginEventListener(pluginId, 'durationChanged', callback);
                },
                offVolumeChanged: (callback) => {
                    return this.removePluginEventListener(pluginId, 'volumeChanged', callback);
                },

                // 移除插件的所有事件监听器
                removeAllListeners: () => {
                    return this.removeAllPluginEventListeners(pluginId);
                }
            };
        };
    }

    // 为插件添加事件监听器
    addPluginEventListener(pluginId, eventName, callback) {
        try {
            if (!window.api || typeof window.api.on !== 'function') {
                console.warn(`🔌 PluginAPI: window.api.on不可用，无法注册${eventName}监听器`);
                return false;
            }

            // 初始化插件的事件监听器映射
            if (!this.pluginEventListeners.has(pluginId)) {
                this.pluginEventListeners.set(pluginId, new Map());
            }

            const pluginListeners = this.pluginEventListeners.get(pluginId);

            // 初始化事件的回调数组
            if (!pluginListeners.has(eventName)) {
                pluginListeners.set(eventName, []);
            }

            const eventCallbacks = pluginListeners.get(eventName);

            // 检查回调是否已经注册
            if (eventCallbacks.includes(callback)) {
                console.warn(`🔌 PluginAPI: 插件 ${pluginId} 的 ${eventName} 监听器已存在`);
                return false;
            }

            // 注册到window.api
            window.api.on(eventName, callback);

            // 记录到插件监听器映射
            eventCallbacks.push(callback);

            console.log(`✅ PluginAPI: 为插件 ${pluginId} 注册 ${eventName} 监听器`);
            return true;

        } catch (error) {
            console.error(`❌ PluginAPI: 为插件 ${pluginId} 注册 ${eventName} 监听器失败:`, error);
            return false;
        }
    }

    // 移除插件的事件监听器
    removePluginEventListener(pluginId, eventName, callback) {
        try {
            if (!window.api || typeof window.api.off !== 'function') {
                console.warn(`🔌 PluginAPI: window.api.off不可用，无法移除${eventName}监听器`);
                return false;
            }

            const pluginListeners = this.pluginEventListeners.get(pluginId);
            if (!pluginListeners) {
                return false;
            }

            const eventCallbacks = pluginListeners.get(eventName);
            if (!eventCallbacks) {
                return false;
            }

            const index = eventCallbacks.indexOf(callback);
            if (index === -1) {
                return false;
            }

            // 从window.api移除
            window.api.off(eventName, callback);

            // 从插件监听器映射中移除
            eventCallbacks.splice(index, 1);

            // 如果该事件没有更多监听器，清理映射
            if (eventCallbacks.length === 0) {
                pluginListeners.delete(eventName);
            }

            console.log(`✅ PluginAPI: 为插件 ${pluginId} 移除 ${eventName} 监听器`);
            return true;

        } catch (error) {
            console.error(`❌ PluginAPI: 为插件 ${pluginId} 移除 ${eventName} 监听器失败:`, error);
            return false;
        }
    }

    // 移除插件的所有事件监听器
    removeAllPluginEventListeners(pluginId) {
        try {
            const pluginListeners = this.pluginEventListeners.get(pluginId);
            if (!pluginListeners) {
                return true;
            }

            let removedCount = 0;

            // 遍历所有事件类型
            for (const [eventName, callbacks] of pluginListeners.entries()) {
                // 移除所有回调
                for (const callback of callbacks) {
                    if (window.api && typeof window.api.off === 'function') {
                        window.api.off(eventName, callback);
                        removedCount++;
                    }
                }
            }

            // 清理插件的监听器映射
            this.pluginEventListeners.delete(pluginId);

            console.log(`✅ PluginAPI: 为插件 ${pluginId} 移除了 ${removedCount} 个事件监听器`);
            return true;

        } catch (error) {
            console.error(`❌ PluginAPI: 为插件 ${pluginId} 移除所有事件监听器失败:`, error);
            return false;
        }
    }

    // 获取插件的事件监听器统计
    getPluginEventListenerStats(pluginId) {
        const pluginListeners = this.pluginEventListeners.get(pluginId);
        if (!pluginListeners) {
            return { totalEvents: 0, events: {} };
        }

        const stats = { totalEvents: 0, events: {} };

        for (const [eventName, callbacks] of pluginListeners.entries()) {
            stats.events[eventName] = callbacks.length;
            stats.totalEvents += callbacks.length;
        }

        return stats;
    }
}

window.PluginAPI = PluginAPI;
