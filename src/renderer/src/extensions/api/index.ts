/**
 * Extension API - 扩展 API 入口
 * 为扩展提供访问应用功能的标准接口
 */

// 导入核心类型
import {ExtensionContext} from '@extensions/core';
import {PermissionManager} from '@extensions/core/ExtensionPermissions';

// 导入各个 API 模块
import {createPlayerAPI, PlaybackState, PlayMode} from './player';
import {createLibraryAPI} from './library';
import {createUIAPI, NotificationType} from './ui';
import {createStorageAPI} from './storage';
import {createNavigationAPI} from './navigation';
import {createNetworkAPI} from './network';
import {createSystemAPI} from './system';
import {createEventsAPI} from './events';
import {createCommandsAPI} from './commands';
import {
    createDiagnostic,
    createDiagnosticsAPI,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity
} from './diagnostics';
import {CancellationToken, createTasksAPI, Task, TaskState} from './tasks';
import {createKeybindingsAPI, KeybindingScope, KeybindingWhen} from './keybindings';
import {APICallLogger, createExtensionAPIProxy, createLoggingAPIProxy} from '@extensions/core/ExtensionAPIProxy';
import {createWindowAPI} from './window';
import {createSettingsAPI} from './settings';

// API 类型接口
import type {PlayerAPI} from './types/player';
import type {LibraryAPI} from './types/library';
import type {UIAPI} from './types/ui';
import type {StorageAPI} from './types/storage';
import type {NavigationAPI} from './types/navigation';
import type {NetworkAPI} from './types/network';
import type {SystemAPI} from './types/system';
import type {EventsAPI} from './types/events';
import type {CommandsAPI} from './types/commands';
import type {DiagnosticsAPI} from './types/diagnostics';
import type {TasksAPI} from './types/tasks';
import type {WindowAPI} from './types/window';
import type {KeybindingsAPI} from './types/keybindings';
import type {SettingsAPI} from './types/settings';

/**
 * 扩展 API 对象接口
 */
export interface ExtensionAPI {
    player: PlayerAPI;
    library: LibraryAPI;
    ui: UIAPI;
    storage: StorageAPI;
    settings: SettingsAPI;
    navigation: NavigationAPI;
    network: NetworkAPI;
    system: SystemAPI;
    events: EventsAPI;
    commands: CommandsAPI;
    diagnostics: DiagnosticsAPI;
    tasks: TasksAPI;
    window: WindowAPI;
    keybindings: KeybindingsAPI;
}

/**
 * Memento 接口 - 用于存储和检索状态
 */
export interface Memento {
    /**
     * 获取存储的值
     * @param key - 键
     * @param defaultValue - 默认值
     */
    get<T>(key: string, defaultValue?: T): T | undefined;

    /**
     * 更新存储的值
     * @param key - 键
     * @param value - 值（undefined 表示删除）
     */
    update(key: string, value: any): Promise<void>;

    /**
     * 获取所有键
     */
    keys(): string[];
}

/**
 * 创建扩展 API 的选项
 */
export interface CreateExtensionAPIOptions {
    /** 权限管理器 */
    permissionManager?: PermissionManager | null;
    /** 是否启用权限代理（默认 true） */
    enableProxy?: boolean;
    /** 是否启用日志记录（默认 false） */
    enableLogging?: boolean;
}

// 全局 API 调用日志记录器
const apiCallLogger = new APICallLogger();

/**
 * 创建扩展 API
 * @param context - 扩展上下文
 * @param options - 选项
 * @returns API 对象
 */
function createExtensionAPI(context: ExtensionContext, options: CreateExtensionAPIOptions = {}): ExtensionAPI {
    const {
        permissionManager = null,
        enableProxy = true,
        enableLogging = false
    } = options;

    // 创建原始 API 对象
    const rawAPI: ExtensionAPI = {
        // 播放器 API
        player: createPlayerAPI(context),

        // 音乐库 API
        library: createLibraryAPI(context),

        // UI API
        ui: createUIAPI(context),

        // 存储 API
        storage: createStorageAPI(context),

        // 配置 API
        settings: createSettingsAPI(context),

        // 导航 API
        navigation: createNavigationAPI(context),

        // 网络 API
        network: createNetworkAPI(context),

        // 系统 API
        system: createSystemAPI(context),

        // 事件 API
        events: createEventsAPI(context),

        // 命令 API
        commands: createCommandsAPI(context),

        // 诊断 API
        diagnostics: createDiagnosticsAPI(context),

        // 任务 API
        tasks: createTasksAPI(context),

        // 窗口 API
        window: createWindowAPI(context),

        // 快捷键 API
        keybindings: createKeybindingsAPI(context),
    };

    // 如果启用了权限代理且提供了权限管理器，则创建代理
    if (enableProxy && permissionManager) {
        const extensionId = context.extension.id;

        if (enableLogging) {
            // 创建带日志记录的代理
            console.log(`🔐 创建带权限和日志的 API 代理: ${extensionId}`);
            return createLoggingAPIProxy(rawAPI, extensionId, permissionManager, apiCallLogger);
        } else {
            // 创建普通权限代理
            console.log(`🔐 创建带权限的 API 代理: ${extensionId}`);
            return createExtensionAPIProxy(rawAPI, extensionId, permissionManager);
        }
    }

    // 返回原始 API
    return rawAPI;
}

// 导出主要函数
export {createExtensionAPI, apiCallLogger};

// 导出枚举和常量
export {
    // Player
    PlayMode,
    PlaybackState,

    // UI
    NotificationType,

    // Diagnostics
    DiagnosticSeverity,
    createDiagnostic,
    DiagnosticCollection,
    Diagnostic,

    // Tasks
    TaskState,
    Task,
    CancellationToken,

    // Keybindings
    KeybindingScope,
    KeybindingWhen,
};

// 导出错误类
export {
    ExtensionAPIError,
    ValidationError,
    NotAvailableError,
    NotFoundError,
    PermissionError,
    TimeoutError,
    ConflictError,
    StateError
} from './common/errors';

// 导出验证工具
export {Validator, ValidationPatterns, validate} from './common/validation';

// 导出类型
export type {ExtensionContext};
export type {PlayerAPI} from './types/player';
export type {LibraryAPI} from './types/library';
export type {UIAPI} from './types/ui';
export type {StorageAPI} from './types/storage';
export type {NavigationAPI} from './types/navigation';
export type {NetworkAPI} from './types/network';
export type {SystemAPI} from './types/system';
export type {EventsAPI} from './types/events';
export type {CommandsAPI} from './types/commands';
export type {DiagnosticsAPI} from './types/diagnostics';
export type {TasksAPI} from './types/tasks';
export type {WindowAPI} from './types/window';
export type {KeybindingsAPI} from './types/keybindings';
export type {SettingsAPI} from './types/settings';
