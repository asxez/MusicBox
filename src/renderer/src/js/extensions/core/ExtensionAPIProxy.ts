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
    'player.pause': Permissions.PLAYER_CONTROL,
    'player.stop': Permissions.PLAYER_CONTROL,
    'player.next': Permissions.PLAYER_CONTROL,
    'player.previous': Permissions.PLAYER_CONTROL,
    'player.seek': Permissions.PLAYER_CONTROL,
    'player.setVolume': Permissions.PLAYER_CONTROL,
    'player.getQueue': Permissions.PLAYER_QUEUE,
    'player.addToQueue': Permissions.PLAYER_QUEUE,
    'player.removeFromQueue': Permissions.PLAYER_QUEUE,
    'player.clearQueue': Permissions.PLAYER_QUEUE,

    // Library API
    'library.getTracks': Permissions.LIBRARY_READ,
    'library.getAlbums': Permissions.LIBRARY_READ,
    'library.getArtists': Permissions.LIBRARY_READ,
    'library.getPlaylists': Permissions.LIBRARY_READ,
    'library.addTrack': Permissions.LIBRARY_WRITE,
    'library.updateTrack': Permissions.LIBRARY_WRITE,
    'library.deleteTrack': Permissions.LIBRARY_DELETE,
    'library.createPlaylist': Permissions.LIBRARY_WRITE,
    'library.updatePlaylist': Permissions.LIBRARY_WRITE,
    'library.deletePlaylist': Permissions.LIBRARY_DELETE,

    // UI API
    'ui.showNotification': Permissions.UI_NOTIFICATION,
    'ui.showDialog': Permissions.UI_DIALOG,
    'ui.showErrorMessage': Permissions.UI_DIALOG,
    'ui.showWarningMessage': Permissions.UI_DIALOG,
    'ui.showInformationMessage': Permissions.UI_DIALOG,
    'ui.setStatusBarMessage': Permissions.UI_STATUSBAR,
    'ui.createWebviewPanel': Permissions.UI_WEBVIEW,

    // Storage API
    'storage.get': Permissions.STORAGE_READ,
    'storage.set': Permissions.STORAGE_WRITE,
    'storage.delete': Permissions.STORAGE_WRITE,
    'storage.clear': Permissions.STORAGE_WRITE,

    // Network API
    'network.fetch': Permissions.NETWORK_REQUEST,
    'network.request': Permissions.NETWORK_REQUEST,
    'network.createWebSocket': Permissions.NETWORK_WEBSOCKET,

    // Filesystem API
    'filesystem.readFile': Permissions.FILESYSTEM_READ,
    'filesystem.writeFile': Permissions.FILESYSTEM_WRITE,
    'filesystem.readDirectory': Permissions.FILESYSTEM_READ,
    'filesystem.exists': Permissions.FILESYSTEM_READ,

    // System API
    'system.getInfo': Permissions.SYSTEM_INFO,
    'system.getPlatform': Permissions.SYSTEM_INFO,
    'system.execute': Permissions.SYSTEM_EXECUTE,
    'system.readClipboard': Permissions.SYSTEM_CLIPBOARD,
    'system.writeClipboard': Permissions.SYSTEM_CLIPBOARD,

    // Settings API
    'settings.get': Permissions.SETTINGS_READ,
    'settings.set': Permissions.SETTINGS_WRITE,
    'settings.update': Permissions.SETTINGS_WRITE
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
