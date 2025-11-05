/**
 * ExtensionAPI - 扩展 API
 * 为扩展提供访问应用功能的标准接口
 */

import { showToast } from '@js/utils';
import {cacheManager} from "@js/cache-manager";
import {Disposable, toDisposable} from "@js/plugin-system/core/Lifecycle";
import {api} from "@js/api";
import {app} from "@js/app";

/**
 * 创建扩展 API
 * @param {Object} context 扩展上下文
 * @returns {Object} API 对象
 */
function createExtensionAPI(context) {
    const api = {
        // 播放器 API
        player: createPlayerAPI(),

        // 音乐库 API
        library: createLibraryAPI(),

        // UI API
        ui: createUIAPI(),

        // 存储 API
        storage: createStorageAPI(context),

        // 设置 API
        settings: createSettingsAPI(),

        // 导航 API
        navigation: createNavigationAPI(),

        // 网络 API
        network: createNetworkAPI(),

        // 系统 API
        system: createSystemAPI(),

        // 事件 API
        events: createEventsAPI(),

        // 命令 API
        commands: createCommandsAPI(),

        // 视图 API
        views: createViewsAPI()
    };

    return api;
}

/**
 * 播放器 API
 */
function createPlayerAPI() {
    return {
        /**
         * 播放歌曲
         * @param {Object} track 歌曲对象
         */
        async play(track) {
            if (api && typeof api.playTrack === 'function') {
                await api.playTrack(track);
            }
        },

        /**
         * 暂停播放
         */
        async pause() {
            if (api && typeof api.pause === 'function') {
                await api.pause();
            }
        },

        /**
         * 继续播放
         */
        async resume() {
            if (api && typeof api.resume === 'function') {
                await api.resume();
            }
        },

        /**
         * 停止播放
         */
        async stop() {
            if (api && typeof api.stop === 'function') {
                await api.stop();
            }
        },

        /**
         * 下一首
         */
        async next() {
            if (api && typeof api.next === 'function') {
                await api.next();
            }
        },

        /**
         * 上一首
         */
        async previous() {
            if (api && typeof api.previous === 'function') {
                await api.previous();
            }
        },

        /**
         * 设置音量
         * @param {Number} volume 音量 (0-1)
         */
        async setVolume(volume) {
            if (api && typeof api.setVolume === 'function') {
                await api.setVolume(volume);
            }
        },

        /**
         * 获取当前播放状态
         */
        getState() {
            if (api && typeof api.getPlaybackState === 'function') {
                return api.getPlaybackState();
            }
            return null;
        },

        /**
         * 获取当前歌曲
         */
        getCurrentTrack() {
            if (api && typeof api.getCurrentTrack === 'function') {
                return api.getCurrentTrack();
            }
            return null;
        },

        /**
         * 跳转到指定时间
         * @param {Number} time 时间（秒）
         */
        async seek(time) {
            if (api && typeof api.seek === 'function') {
                await api.seek(time);
            }
        }
    };
}

/**
 * 音乐库 API
 */
function createLibraryAPI() {
    return {
        /**
         * 获取所有歌曲
         */
        getAllTracks() {
            if (app && app.library) {
                return [...app.library];
            }
            return [];
        },

        /**
         * 搜索歌曲
         * @param {String} query 搜索关键词
         */
        searchTracks(query) {
            if (app && typeof app.searchLibrary === 'function') {
                return app.searchLibrary(query);
            }
            return [];
        },

        /**
         * 添加歌曲到库
         * @param {Object} track 歌曲对象
         */
        async addTrack(track) {
            if (app && typeof app.addTrackToLibrary === 'function') {
                await app.addTrackToLibrary(track);
            }
        },

        /**
         * 从库中移除歌曲
         * @param {String} trackId 歌曲ID
         */
        async removeTrack(trackId) {
            if (app && typeof app.removeTrackFromLibrary === 'function') {
                await app.removeTrackFromLibrary(trackId);
            }
        },

        /**
         * 获取播放列表
         */
        getPlaylists() {
            if (cacheManager && typeof cacheManager.getLocalCache === 'function') {
                return cacheManager.getLocalCache('playlists') || [];
            }
            return [];
        }
    };
}

/**
 * UI API
 */
function createUIAPI() {
    return {
        /**
         * 显示通知
         * @param {String} message 消息内容
         * @param {String} type 类型 (info, success, warning, error)
         */
        showNotification(message, type = 'info') {
            showToast(message, type);
        },

        /**
         * 显示对话框
         * @param {Object} options 对话框选项
         */
        async showDialog(options) {
            // 简单实现
            return window.confirm(options.message);
        },

        /**
         * 创建状态栏项
         * @param {String} id 唯一标识
         * @param {Object} options 选项
         */
        createStatusBarItem(id, options = {}) {
            // 待实现
            return {
                text: options.text || '',
                show() {
                },
                hide() {
                },
                dispose() {
                }
            };
        }
    };
}

/**
 * 存储 API
 */
function createStorageAPI(context) {
    return {
        /**
         * 获取全局状态
         * @param {String} key 键
         * @param {*} defaultValue 默认值
         */
        get(key, defaultValue) {
            return context.globalState.get(key, defaultValue);
        },

        /**
         * 设置全局状态
         * @param {String} key 键
         * @param {*} value 值
         */
        async update(key, value) {
            return context.globalState.update(key, value);
        },

        /**
         * 获取工作区状态
         * @param {String} key 键
         * @param {*} defaultValue 默认值
         */
        getWorkspace(key, defaultValue) {
            return context.workspaceState.get(key, defaultValue);
        },

        /**
         * 设置工作区状态
         * @param {String} key 键
         * @param {*} value 值
         */
        async updateWorkspace(key, value) {
            return context.workspaceState.update(key, value);
        }
    };
}

/**
 * 设置 API
 */
function createSettingsAPI() {
    return {
        /**
         * 获取设置
         * @param {String} key 设置键
         * @param {*} defaultValue 默认值
         */
        get(key, defaultValue) {
            if (window.settings && typeof window.settings.getSetting === 'function') {
                return window.settings.getSetting(key, defaultValue);
            }
            return defaultValue;
        },

        /**
         * 设置设置
         * @param {String} key 设置键
         * @param {*} value 值
         */
        async set(key, value) {
            if (window.settings && typeof window.settings.setSetting === 'function') {
                await window.settings.setSetting(key, value);
            }
        }
    };
}

/**
 * 导航 API
 */
function createNavigationAPI() {
    return {
        /**
         * 导航到视图
         * @param {String} viewId 视图ID
         */
        navigateTo(viewId) {
            if (app && app.components && app.components.navigation) {
                app.components.navigation.navigateTo(viewId);
            }
        }
    };
}

/**
 * 网络 API
 */
function createNetworkAPI() {
    return {
        /**
         * 发送 HTTP 请求
         * @param {String} url URL
         * @param {Object} options 选项
         */
        async fetch(url, options = {}) {
            return fetch(url, options);
        }
    };
}

/**
 * 系统 API
 */
function createSystemAPI() {
    return {
        /**
         * 获取应用版本
         */
        getVersion() {
            return window.electronAPI?.getAppVersion?.() || '1.0.0';
        },

        /**
         * 获取平台信息
         */
        getPlatform() {
            return window.electronAPI?.getPlatform?.() || 'unknown';
        }
    };
}

/**
 * 事件 API
 */
function createEventsAPI() {
    return {
        /**
         * 监听事件
         * @param {String} eventName 事件名
         * @param {Function} callback 回调函数
         */
        on(eventName, callback) {
            if (app) {
                app.on(eventName, callback);
                return toDisposable(() => {
                    app.off(eventName, callback);
                });
            }
            return Disposable.None;
        },

        /**
         * 触发事件
         * @param {String} eventName 事件名
         * @param {*} data 数据
         */
        emit(eventName, data) {
            if (app) {
                app.emit(eventName, data);
            }
        }
    };
}

/**
 * 命令 API
 */
function createCommandsAPI() {
    const commands = new Map();

    return {
        /**
         * 注册命令
         * @param {String} commandId 命令ID
         * @param {Function} callback 回调函数
         */
        registerCommand(commandId, callback) {
            if (commands.has(commandId)) {
                console.warn(`⚠️ 命令 ${commandId} 已注册`);
                return Disposable.None;
            }

            commands.set(commandId, callback);

            return toDisposable(() => {
                commands.delete(commandId);
            });
        },

        /**
         * 执行命令
         * @param {String} commandId 命令ID
         * @param  {...any} args 参数
         */
        async executeCommand(commandId, ...args) {
            const command = commands.get(commandId);
            if (command) {
                return await command(...args);
            }
            throw new Error(`命令 ${commandId} 未找到`);
        }
    };
}

/**
 * 视图 API
 */
function createViewsAPI() {
    return {
        /**
         * 注册视图
         * @param {String} viewId 视图ID
         * @param {Object} viewProvider 视图提供者
         */
        registerView(viewId, viewProvider) {
            // 待实现
            return Disposable.None;
        }
    };
}

export {createExtensionAPI};
