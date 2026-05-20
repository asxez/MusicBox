/**
 * ExtensionAPIProxy - 扩展 API 代理
 * 为扩展 API 添加权限检查和访问控制
 */

import {Permissions, PermissionManager} from '@extensions/core/ExtensionPermissions';

/**
 * API 权限映射 - 定义每个 API 需要的权限
 */
const API_PERMISSION_MAP: Record<string, string> = {
    // Player API
    'player.getState': Permissions.PLAYER_READ,
    'player.getCurrentTrack': Permissions.PLAYER_READ,
    'player.getVolume': Permissions.PLAYER_READ,
    'player.play': Permissions.PLAYER_CONTROL,
    'player.playTrack': Permissions.PLAYER_CONTROL,
    'player.pause': Permissions.PLAYER_CONTROL,
    'player.stop': Permissions.PLAYER_CONTROL,
    'player.next': Permissions.PLAYER_CONTROL,
    'player.nextTrack': Permissions.PLAYER_CONTROL,
    'player.previous': Permissions.PLAYER_CONTROL,
    'player.previousTrack': Permissions.PLAYER_CONTROL,
    'player.seek': Permissions.PLAYER_CONTROL,
    'player.setVolume': Permissions.PLAYER_CONTROL,
    'player.getQueue': Permissions.PLAYER_QUEUE,
    'player.getPlaylist': Permissions.PLAYER_QUEUE,
    'player.setPlaylist': Permissions.PLAYER_QUEUE,
    'player.addToQueue': Permissions.PLAYER_QUEUE,
    'player.removeFromQueue': Permissions.PLAYER_QUEUE,
    'player.clearQueue': Permissions.PLAYER_QUEUE,
    'player.getPosition': Permissions.PLAYER_READ,
    'player.getDuration': Permissions.PLAYER_READ,
    'player.getPlayMode': Permissions.PLAYER_READ,
    'player.setPlayMode': Permissions.PLAYER_CONTROL,
    'player.onTrackChanged': Permissions.PLAYER_READ,
    'player.onPlaybackStateChanged': Permissions.PLAYER_READ,

    // Library API
    'library.getTracks': Permissions.LIBRARY_READ,
    'library.getAllTracks': Permissions.LIBRARY_READ,
    'library.getTrackById': Permissions.LIBRARY_READ,
    'library.searchTracks': Permissions.LIBRARY_READ,
    'library.getAlbums': Permissions.LIBRARY_READ,
    'library.getAlbumByName': Permissions.LIBRARY_READ,
    'library.getArtists': Permissions.LIBRARY_READ,
    'library.getArtistByName': Permissions.LIBRARY_READ,
    'library.getPlaylists': Permissions.LIBRARY_READ,
    'library.getPlaylistById': Permissions.LIBRARY_READ,
    'library.addTrack': Permissions.LIBRARY_WRITE,
    'library.updateTrack': Permissions.LIBRARY_WRITE,
    'library.deleteTrack': Permissions.LIBRARY_DELETE,
    'library.removeTrack': Permissions.LIBRARY_DELETE,
    'library.createPlaylist': Permissions.LIBRARY_WRITE,
    'library.updatePlaylist': Permissions.LIBRARY_WRITE,
    'library.deletePlaylist': Permissions.LIBRARY_DELETE,

    // UI API
    'ui.showNotification': Permissions.UI_NOTIFICATION,
    'ui.showDialog': Permissions.UI_DIALOG,
    'ui.showErrorMessage': Permissions.UI_DIALOG,
    'ui.showWarningMessage': Permissions.UI_DIALOG,
    'ui.showInformationMessage': Permissions.UI_DIALOG,
    'ui.showSuccessMessage': Permissions.UI_NOTIFICATION,
    'ui.showConfirmDialog': Permissions.UI_DIALOG,
    'ui.showInputBox': Permissions.UI_DIALOG,
    'ui.getCurrentTheme': Permissions.UI_NOTIFICATION,
    'ui.setTheme': Permissions.UI_NOTIFICATION,
    'ui.toggleTheme': Permissions.UI_NOTIFICATION,
    'ui.onThemeChanged': Permissions.UI_NOTIFICATION,
    'ui.setCSSVariable': Permissions.UI_NOTIFICATION,
    'ui.getCSSVariable': Permissions.UI_NOTIFICATION,
    'ui.setStatusBarMessage': Permissions.UI_STATUSBAR,
    'ui.createWebviewPanel': Permissions.UI_WEBVIEW,
    'ui.registerSettingsSection': Permissions.UI_WEBVIEW,
    'ui.registerSettingsPage': Permissions.UI_WEBVIEW,
    'ui.registerSettingsPageSchema': Permissions.UI_WEBVIEW,
    'ui.registerFloatingPanel': Permissions.UI_WEBVIEW,
    'ui.createToggleSetting': Permissions.UI_WEBVIEW,
    'ui.createSelectSetting': Permissions.UI_WEBVIEW,
    'ui.createInputSetting': Permissions.UI_WEBVIEW,
    'ui.createColorPickerSetting': Permissions.UI_WEBVIEW,
    'ui.createButtonSetting': Permissions.UI_WEBVIEW,

    // Storage API
    'storage.get': Permissions.STORAGE_READ,
    'storage.getWorkspace': Permissions.STORAGE_READ,
    'storage.keys': Permissions.STORAGE_READ,
    'storage.workspaceKeys': Permissions.STORAGE_READ,
    'storage.set': Permissions.STORAGE_WRITE,
    'storage.update': Permissions.STORAGE_WRITE,
    'storage.updateWorkspace': Permissions.STORAGE_WRITE,
    'storage.delete': Permissions.STORAGE_WRITE,
    'storage.deleteWorkspace': Permissions.STORAGE_WRITE,
    'storage.clear': Permissions.STORAGE_WRITE,

    // Network API
    'network.fetch': Permissions.NETWORK_REQUEST,
    'network.get': Permissions.NETWORK_REQUEST,
    'network.post': Permissions.NETWORK_REQUEST,
    'network.put': Permissions.NETWORK_REQUEST,
    'network.delete': Permissions.NETWORK_REQUEST,
    'network.downloadFile': Permissions.NETWORK_REQUEST,
    'network.request': Permissions.NETWORK_REQUEST,
    'network.createWebSocket': Permissions.NETWORK_WEBSOCKET,

    // Filesystem API
    'filesystem.readFile': Permissions.FILESYSTEM_READ,
    'filesystem.writeFile': Permissions.FILESYSTEM_WRITE,
    'filesystem.readDirectory': Permissions.FILESYSTEM_READ,
    'filesystem.exists': Permissions.FILESYSTEM_READ,

    // System API
    'system.getInfo': Permissions.SYSTEM_INFO,
    'system.getVersion': Permissions.SYSTEM_INFO,
    'system.getPlatform': Permissions.SYSTEM_INFO,
    'system.getOS': Permissions.SYSTEM_INFO,
    'system.getAppPath': Permissions.SYSTEM_INFO,
    'system.getUserDataPath': Permissions.SYSTEM_INFO,
    'system.getTempPath': Permissions.SYSTEM_INFO,
    'system.getLanguage': Permissions.SYSTEM_INFO,
    'system.getEnv': Permissions.SYSTEM_INFO,
    'system.showItemInFolder': Permissions.FILESYSTEM_READ,
    'system.execute': Permissions.SYSTEM_EXECUTE,
    'system.readClipboard': Permissions.SYSTEM_CLIPBOARD,
    'system.getClipboardText': Permissions.SYSTEM_CLIPBOARD,
    'system.writeClipboard': Permissions.SYSTEM_CLIPBOARD,
    'system.setClipboardText': Permissions.SYSTEM_CLIPBOARD,

    // Settings API
    'settings.get': Permissions.SETTINGS_READ,
    'settings.has': Permissions.SETTINGS_READ,
    'settings.keys': Permissions.SETTINGS_READ,
    'settings.onDidChange': Permissions.SETTINGS_READ,
    'settings.set': Permissions.SETTINGS_WRITE,
    'settings.update': Permissions.SETTINGS_WRITE,
    'settings.delete': Permissions.SETTINGS_WRITE,

    // Window API
    'window.maximize': Permissions.UI_NOTIFICATION,
    'window.minimize': Permissions.UI_NOTIFICATION,
    'window.close': Permissions.UI_NOTIFICATION,
    'window.isMaximized': Permissions.UI_NOTIFICATION,
    'window.getPosition': Permissions.UI_NOTIFICATION,
    'window.getSize': Permissions.UI_NOTIFICATION,
    'window.setSize': Permissions.UI_NOTIFICATION,
    'window.onMaximizedChanged': Permissions.UI_NOTIFICATION,

    // Keybindings API
    'keybindings.registerKeybinding': Permissions.UI_NOTIFICATION,
    'keybindings.registerGlobalKeybinding': Permissions.UI_NOTIFICATION,
    'keybindings.unregisterKeybinding': Permissions.UI_NOTIFICATION,
    'keybindings.getKeybindings': Permissions.UI_NOTIFICATION,
    'keybindings.hasKeybinding': Permissions.UI_NOTIFICATION,
    'keybindings.getKeybindingInfo': Permissions.UI_NOTIFICATION,
    'keybindings.triggerKeybinding': Permissions.UI_NOTIFICATION,

    // Commands API
    'commands.registerCommand': Permissions.UI_NOTIFICATION,
    'commands.executeCommand': Permissions.UI_NOTIFICATION,
    'commands.getCommands': Permissions.UI_NOTIFICATION,
    'commands.hasCommand': Permissions.UI_NOTIFICATION,
    'commands.enableCommand': Permissions.UI_NOTIFICATION,
    'commands.disableCommand': Permissions.UI_NOTIFICATION,
    'commands.getCommandInfo': Permissions.UI_NOTIFICATION,

    // Events API
    'events.on': Permissions.UI_NOTIFICATION,
    'events.once': Permissions.UI_NOTIFICATION,
    'events.emit': Permissions.UI_NOTIFICATION,
    'events.off': Permissions.UI_NOTIFICATION,
    'events.removeAllListeners': Permissions.UI_NOTIFICATION,

    // Navigation API
    'navigation.navigateToView': Permissions.UI_NOTIFICATION,
    'navigation.goBack': Permissions.UI_NOTIFICATION,
    'navigation.goForward': Permissions.UI_NOTIFICATION,
    'navigation.getCurrentView': Permissions.UI_NOTIFICATION
};

/**
 * 创建 API 代理
 * @param api - 原始 API 对象
 * @param extensionId - 扩展 ID
 * @param permissionManager - 权限管理器
 * @param namespace - API 命名空间（如 'player', 'library'）
 * @returns 代理后的 API 对象
 */
export function createAPIProxy<T extends object>(
    api: T,
    extensionId: string,
    permissionManager: PermissionManager,
    namespace = ''
): T {
    if (!api || typeof api !== 'object') {
        return api;
    }

    return new Proxy(api, {
        get(target: T, prop: string | symbol) {
            if (typeof prop === 'symbol') {
                return (target as any)[prop];
            }

            const value = (target as any)[prop];

            // 如果是函数,添加权限检查
            if (typeof value === 'function') {
                return function (this: any, ...args: any[]) {
                    // 构建完整的 API 路径
                    const apiPath = namespace ? `${namespace}.${prop}` : prop;

                    // 检查是否需要权限
                    const requiredPermission = API_PERMISSION_MAP[apiPath];

                    if (requiredPermission) {
                        // 检查权限
                        if (!permissionManager.hasPermission(extensionId, requiredPermission)) {
                            // 尝试请求权限
                            return permissionManager.requestPermission(extensionId, requiredPermission)
                                .then(granted => {
                                    if (!granted) {
                                        throw new Error(
                                            `扩展 ${extensionId} 没有权限调用 ${apiPath},需要权限: ${requiredPermission}`
                                        );
                                    }
                                    // 权限已授予,执行原始函数
                                    return value.apply(target, args);
                                });
                        }
                    }

                    // 执行原始函数
                    return value.apply(target, args);
                };
            }

            // 如果是对象,递归创建代理
            if (value && typeof value === 'object') {
                const childNamespace = namespace ? `${namespace}.${prop}` : prop;
                return createAPIProxy(value, extensionId, permissionManager, childNamespace);
            }

            // 其他类型直接返回
            return value;
        }
    }) as T;
}

/**
 * 创建完整的扩展 API 代理
 * @param fullAPI - 完整的 API 对象
 * @param extensionId - 扩展 ID
 * @param permissionManager - 权限管理器
 * @returns 代理后的 API 对象
 */
export function createExtensionAPIProxy<T extends Record<string, any>>(
    fullAPI: T,
    extensionId: string,
    permissionManager: PermissionManager
): T {
    const proxiedAPI: any = {};

    // 为每个命名空间创建代理
    for (const [namespace, api] of Object.entries(fullAPI)) {
        proxiedAPI[namespace] = createAPIProxy(api, extensionId, permissionManager, namespace);
    }

    return proxiedAPI as T;
}

interface APILogEntry {
    timestamp: number;
    apiPath: string;
    args: any[];
    success: boolean;
    error: string | null;
}

interface APIStats {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    apiUsage: Record<string, number>;
}

/**
 * API 调用日志记录器
 */
export class APICallLogger {
    private _logs = new Map<string, APILogEntry[]>();
    private _maxLogsPerExtension = 1000;

    /**
     * 记录 API 调用
     */
    log(extensionId: string, apiPath: string, args: any[], _result: any, error: Error | null = null): void {
        if (!this._logs.has(extensionId)) {
            this._logs.set(extensionId, []);
        }

        const logs = this._logs.get(extensionId)!;
        logs.push({
            timestamp: Date.now(),
            apiPath,
            args: this._sanitizeArgs(args),
            success: !error,
            error: error ? error.message : null
        });

        // 限制日志数量
        if (logs.length > this._maxLogsPerExtension) {
            logs.shift();
        }
    }

    /**
     * 获取扩展的 API 调用日志
     */
    getLogs(extensionId: string, limit = 100): APILogEntry[] {
        const logs = this._logs.get(extensionId) || [];
        return logs.slice(-limit);
    }

    /**
     * 清除扩展的日志
     */
    clearLogs(extensionId: string): void {
        this._logs.delete(extensionId);
    }

    /**
     * 清理参数（避免记录敏感信息）
     */
    private _sanitizeArgs(args: any[]): any[] {
        if (!args || args.length === 0) {
            return [];
        }

        return args.map(arg => {
            if (typeof arg === 'function') {
                return '[Function]';
            }
            if (arg && typeof arg === 'object') {
                // 避免循环引用
                try {
                    return JSON.parse(JSON.stringify(arg));
                } catch {
                    return '[Object]';
                }
            }
            return arg;
        });
    }

    /**
     * 获取 API 调用统计
     */
    getStats(extensionId: string): APIStats {
        const logs = this._logs.get(extensionId) || [];

        const stats: APIStats = {
            totalCalls: logs.length,
            successCalls: 0,
            failedCalls: 0,
            apiUsage: {}
        };

        for (const log of logs) {
            if (log.success) {
                stats.successCalls++;
            } else {
                stats.failedCalls++;
            }

            if (!stats.apiUsage[log.apiPath]) {
                stats.apiUsage[log.apiPath] = 0;
            }
            stats.apiUsage[log.apiPath]++;
        }

        return stats;
    }
}

/**
 * 创建带日志记录的 API 代理
 */
export function createLoggingAPIProxy<T extends object>(
    api: T,
    extensionId: string,
    permissionManager: PermissionManager,
    logger: APICallLogger,
    namespace = ''
): T {
    if (!api || typeof api !== 'object') {
        return api;
    }

    return new Proxy(api, {
        get(target: T, prop: string | symbol) {
            if (typeof prop === 'symbol') {
                return (target as any)[prop];
            }

            const value = (target as any)[prop];

            // 如果是函数,添加权限检查和日志记录
            if (typeof value === 'function') {
                return async function (this: any, ...args: any[]) {
                    const apiPath = namespace ? `${namespace}.${prop}` : prop;
                    const requiredPermission = API_PERMISSION_MAP[apiPath];

                    try {
                        // 权限检查
                        if (requiredPermission) {
                            if (!permissionManager.hasPermission(extensionId, requiredPermission)) {
                                const granted = await permissionManager.requestPermission(
                                    extensionId,
                                    requiredPermission
                                );
                                if (!granted) {
                                    throw new Error(
                                        `扩展 ${extensionId} 没有权限调用 ${apiPath},需要权限: ${requiredPermission}`
                                    );
                                }
                            }
                        }

                        // 执行原始函数
                        const result = await value.apply(target, args);

                        // 记录成功调用
                        logger.log(extensionId, apiPath, args, result);

                        return result;
                    } catch (error) {
                        // 记录失败调用
                        logger.log(extensionId, apiPath, args, null, error as Error);
                        throw error;
                    }
                };
            }

            // 如果是对象,递归创建代理
            if (value && typeof value === 'object') {
                const childNamespace = namespace ? `${namespace}.${prop}` : prop;
                return createLoggingAPIProxy(value, extensionId, permissionManager, logger, childNamespace);
            }

            return value;
        }
    }) as T;
}
