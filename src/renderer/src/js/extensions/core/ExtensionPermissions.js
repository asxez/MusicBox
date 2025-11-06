/**
 * ExtensionPermissions - 扩展权限管理系统
 * 控制扩展对 API 的访问权限
 */

import {Disposable} from "@extensions/core/Lifecycle";
import {Emitter} from "@extensions/core/Event";

/**
 * 权限定义
 */
export const Permissions = {
    // 播放器权限
    PLAYER_READ: 'player.read',
    PLAYER_CONTROL: 'player.control',
    PLAYER_QUEUE: 'player.queue',

    // 音乐库权限
    LIBRARY_READ: 'library.read',
    LIBRARY_WRITE: 'library.write',
    LIBRARY_DELETE: 'library.delete',

    // UI 权限
    UI_NOTIFICATION: 'ui.notification',
    UI_DIALOG: 'ui.dialog',
    UI_STATUSBAR: 'ui.statusbar',
    UI_WEBVIEW: 'ui.webview',

    // 存储权限
    STORAGE_READ: 'storage.read',
    STORAGE_WRITE: 'storage.write',

    // 网络权限
    NETWORK_REQUEST: 'network.request',
    NETWORK_WEBSOCKET: 'network.websocket',

    // 文件系统权限
    FILESYSTEM_READ: 'filesystem.read',
    FILESYSTEM_WRITE: 'filesystem.write',

    // 系统权限
    SYSTEM_INFO: 'system.info',
    SYSTEM_EXECUTE: 'system.execute',
    SYSTEM_CLIPBOARD: 'system.clipboard',

    // 设置权限
    SETTINGS_READ: 'settings.read',
    SETTINGS_WRITE: 'settings.write'
};

/**
 * 权限级别
 */
export const PermissionLevel = {
    GRANTED: 'granted',      // 已授予
    DENIED: 'denied',        // 已拒绝
    PROMPT: 'prompt'         // 需要询问
};

/**
 * 敏感权限 - 需要用户明确授权
 */
export const SensitivePermissions = new Set([
    Permissions.LIBRARY_DELETE,
    Permissions.FILESYSTEM_WRITE,
    Permissions.SYSTEM_EXECUTE,
    Permissions.NETWORK_REQUEST
]);

/**
 * 权限描述
 */
export const PermissionDescriptions = {
    [Permissions.PLAYER_READ]: '读取播放器状态',
    [Permissions.PLAYER_CONTROL]: '控制播放器（播放、暂停、跳转等）',
    [Permissions.PLAYER_QUEUE]: '管理播放队列',
    [Permissions.LIBRARY_READ]: '读取音乐库',
    [Permissions.LIBRARY_WRITE]: '修改音乐库（添加、编辑）',
    [Permissions.LIBRARY_DELETE]: '删除音乐库内容',
    [Permissions.UI_NOTIFICATION]: '显示通知',
    [Permissions.UI_DIALOG]: '显示对话框',
    [Permissions.UI_STATUSBAR]: '修改状态栏',
    [Permissions.UI_WEBVIEW]: '创建 Webview 面板',
    [Permissions.STORAGE_READ]: '读取扩展存储',
    [Permissions.STORAGE_WRITE]: '写入扩展存储',
    [Permissions.NETWORK_REQUEST]: '发起网络请求',
    [Permissions.NETWORK_WEBSOCKET]: '创建 WebSocket 连接',
    [Permissions.FILESYSTEM_READ]: '读取文件系统',
    [Permissions.FILESYSTEM_WRITE]: '写入文件系统',
    [Permissions.SYSTEM_INFO]: '获取系统信息',
    [Permissions.SYSTEM_EXECUTE]: '执行系统命令',
    [Permissions.SYSTEM_CLIPBOARD]: '访问剪贴板',
    [Permissions.SETTINGS_READ]: '读取设置',
    [Permissions.SETTINGS_WRITE]: '修改设置'
};

/**
 * 权限管理器
 */
export class PermissionManager extends Disposable {
    constructor() {
        super();
        this._permissions = new Map(); // extensionId -> Set<permission>
        this._permissionStates = new Map(); // extensionId -> Map<permission, state>
        this._onPermissionChanged = new Emitter();
        this._loadPermissions();
    }

    /**
     * 权限变化事件
     */
    get onPermissionChanged() {
        return this._onPermissionChanged.event;
    }

    /**
     * 从清单中提取权限
     */
    extractPermissions(manifest) {
        const permissions = new Set();

        // 从 permissions 字段提取
        if (manifest.permissions && Array.isArray(manifest.permissions)) {
            for (const permission of manifest.permissions) {
                permissions.add(permission);
            }
        }

        // 从 contributes 推断权限
        if (manifest.contributes) {
            // 如果贡献了命令，需要 UI 权限
            if (manifest.contributes.commands) {
                permissions.add(Permissions.UI_NOTIFICATION);
            }

            // 如果贡献了视图，需要 UI 权限
            if (manifest.contributes.views) {
                permissions.add(Permissions.UI_WEBVIEW);
            }

            // 如果贡献了配置，需要设置权限
            if (manifest.contributes.configuration) {
                permissions.add(Permissions.SETTINGS_READ);
                permissions.add(Permissions.SETTINGS_WRITE);
            }
        }

        return permissions;
    }

    /**
     * 注册扩展权限
     */
    registerExtensionPermissions(extensionId, permissions) {
        this._permissions.set(extensionId, new Set(permissions));

        // 获取或创建权限状态
        let states = this._permissionStates.get(extensionId);
        if (!states) {
            states = new Map();
            this._permissionStates.set(extensionId, states);
        }

        // 为新权限初始化状态（保留已有权限的状态）
        for (const permission of permissions) {
            // 如果权限状态已存在，保留它；否则设置默认状态
            if (!states.has(permission)) {
                // 敏感权限默认需要询问，其他权限默认授予
                const defaultState = SensitivePermissions.has(permission)
                    ? PermissionLevel.PROMPT
                    : PermissionLevel.GRANTED;
                states.set(permission, defaultState);
            }
        }

        this._savePermissions();
    }

    /**
     * 检查权限
     */
    hasPermission(extensionId, permission) {
        const states = this._permissionStates.get(extensionId);
        if (!states) {
            return false;
        }

        const state = states.get(permission);
        return state === PermissionLevel.GRANTED;
    }

    /**
     * 请求权限
     */
    async requestPermission(extensionId, permission) {
        const states = this._permissionStates.get(extensionId);
        if (!states) {
            throw new Error(`扩展 ${extensionId} 未注册`);
        }

        const currentState = states.get(permission);

        // 如果已经授予或拒绝，直接返回
        if (currentState === PermissionLevel.GRANTED) {
            return true;
        }
        if (currentState === PermissionLevel.DENIED) {
            return false;
        }

        // 需要询问用户
        const granted = await this._promptUser(extensionId, permission);

        // 更新状态
        states.set(permission, granted ? PermissionLevel.GRANTED : PermissionLevel.DENIED);
        this._savePermissions();

        this._onPermissionChanged.fire({
            extensionId,
            permission,
            granted
        });

        return granted;
    }

    /**
     * 授予权限
     */
    grantPermission(extensionId, permission) {
        const states = this._permissionStates.get(extensionId);
        if (!states) {
            throw new Error(`扩展 ${extensionId} 未注册`);
        }

        states.set(permission, PermissionLevel.GRANTED);
        this._savePermissions();

        this._onPermissionChanged.fire({
            extensionId,
            permission,
            granted: true
        });
    }

    /**
     * 撤销权限
     */
    revokePermission(extensionId, permission) {
        const states = this._permissionStates.get(extensionId);
        if (!states) {
            throw new Error(`扩展 ${extensionId} 未注册`);
        }

        states.set(permission, PermissionLevel.DENIED);
        this._savePermissions();

        this._onPermissionChanged.fire({
            extensionId,
            permission,
            granted: false
        });
    }

    /**
     * 获取扩展的所有权限
     */
    getExtensionPermissions(extensionId) {
        const permissions = this._permissions.get(extensionId);
        if (!permissions) {
            return [];
        }

        const states = this._permissionStates.get(extensionId);
        return Array.from(permissions).map(permission => ({
            permission,
            description: PermissionDescriptions[permission] || permission,
            state: states.get(permission) || PermissionLevel.PROMPT,
            sensitive: SensitivePermissions.has(permission)
        }));
    }

    /**
     * 重置扩展权限
     */
    resetExtensionPermissions(extensionId) {
        const permissions = this._permissions.get(extensionId);
        if (!permissions) {
            return;
        }

        const states = new Map();
        for (const permission of permissions) {
            const defaultState = SensitivePermissions.has(permission)
                ? PermissionLevel.PROMPT
                : PermissionLevel.GRANTED;
            states.set(permission, defaultState);
        }
        this._permissionStates.set(extensionId, states);
        this._savePermissions();
    }

    /**
     * 询问用户
     */
    async _promptUser(extensionId, permission) {
        // TODO: 实现用户授权对话框
        // 暂时默认授予
        console.warn(`⚠️ PermissionManager: 需要用户授权 ${extensionId} 的权限 ${permission}`);

        const description = PermissionDescriptions[permission] || permission;
        const message = `扩展 "${extensionId}" 请求权限：${description}\n\n是否允许？`;

        // 使用简单的 confirm 对话框（后续可以替换为自定义 UI）
        return confirm(message);
    }

    /**
     * 加载权限配置
     */
    _loadPermissions() {
        try {
            const stored = localStorage.getItem('extension-permissions');
            if (stored) {
                const data = JSON.parse(stored);

                // 恢复权限状态
                for (const [extensionId, states] of Object.entries(data)) {
                    const stateMap = new Map();
                    for (const [permission, state] of Object.entries(states)) {
                        stateMap.set(permission, state);
                    }
                    this._permissionStates.set(extensionId, stateMap);
                }
            }
        } catch (error) {
            console.error('❌ PermissionManager: 加载权限配置失败:', error);
        }
    }

    /**
     * 保存权限配置
     */
    _savePermissions() {
        try {
            const data = {};

            for (const [extensionId, states] of this._permissionStates) {
                data[extensionId] = {};
                for (const [permission, state] of states) {
                    data[extensionId][permission] = state;
                }
            }

            localStorage.setItem('extension-permissions', JSON.stringify(data));
        } catch (error) {
            console.error('❌ PermissionManager: 保存权限配置失败:', error);
        }
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();
        this._onPermissionChanged.dispose();
        this._permissions.clear();
        this._permissionStates.clear();
    }
}
