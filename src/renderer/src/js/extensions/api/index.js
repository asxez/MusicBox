/**
 * Extension API - 扩展 API 入口
 * 为扩展提供访问应用功能的标准接口
 */

// 导入各个 API 模块
import {createPlayerAPI, PlaybackState, PlayMode} from './player.js';
import {createLibraryAPI} from './library.js';
import {createUIAPI, NotificationType, StatusBarAlignment, StatusBarItem, WebviewPanel} from './ui.js';
import {createStorageAPI} from './storage.js';
import {createNavigationAPI} from './navigation.js';
import {createNetworkAPI} from './network.js';
import {createSystemAPI} from './system.js';
import {createEventsAPI} from './events.js';
import {createCommandsAPI} from './commands.js';
import {createViewsAPI, TreeView} from './views.js';
import {
    createDiagnostic,
    createDiagnosticsAPI,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity
} from './diagnostics.js';
import {CancellationToken, createTasksAPI, Task, TaskState} from './tasks.js';
import {APICallLogger, createExtensionAPIProxy, createLoggingAPIProxy} from '@extensions/core/ExtensionAPIProxy.js';
import {createWindowAPI} from "@extensions/api/window";
import {createSettingsAPI} from "@extensions/api/settings";

// 全局 API 调用日志记录器
const apiCallLogger = new APICallLogger();

/**
 * 创建扩展 API
 * @param {Object} context - 扩展上下文
 * @param {Object} options - 选项
 * @param {PermissionManager} options.permissionManager - 权限管理器
 * @param {boolean} options.enableProxy - 是否启用权限代理（默认 true）
 * @param {boolean} options.enableLogging - 是否启用日志记录（默认 false）
 * @returns {Object} API 对象
 */
function createExtensionAPI(context, options = {}) {
    // 验证上下文
    if (!context) {
        console.warn('⚠️ 扩展上下文未提供，某些 API 功能可能不可用');
        context = {
            extension: {id: 'unknown'},
            globalState: createMockMemento(),
            workspaceState: createMockMemento()
        };
    }

    const {
        permissionManager = null,
        enableProxy = true,
        enableLogging = false
    } = options;

    // 创建原始 API 对象
    const rawAPI = {
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

        // 视图 API
        views: createViewsAPI(context),

        // 诊断 API
        diagnostics: createDiagnosticsAPI(context),

        // 任务 API
        tasks: createTasksAPI(context),

        // 窗口 API
        window: createWindowAPI(context),
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

/**
 * 创建模拟的 Memento 对象（用于测试）
 * @returns {Object} Memento 对象
 */
function createMockMemento() {
    const storage = new Map();

    return {
        get(key, defaultValue) {
            return storage.has(key) ? storage.get(key) : defaultValue;
        },

        async update(key, value) {
            if (value === undefined) {
                storage.delete(key);
            } else {
                storage.set(key, value);
            }
        },

        keys() {
            return Array.from(storage.keys());
        }
    };
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
    StatusBarAlignment,
    StatusBarItem,
    WebviewPanel,

    // Diagnostics
    DiagnosticSeverity,
    createDiagnostic,
    DiagnosticCollection,
    Diagnostic,

    // Tasks
    TaskState,
    Task,
    CancellationToken,

    // Views
    TreeView
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
} from './common/errors.js';

// 导出验证工具
export {Validator, ValidationPatterns, validate} from './common/validation.js';
