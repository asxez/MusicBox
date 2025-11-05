/**
 * Extension API - 扩展 API 入口
 * 为扩展提供访问应用功能的标准接口
 */

// 导入各个 API 模块
import {createPlayerAPI, PlayMode, PlaybackState} from './player.js';
import {createLibraryAPI} from './library.js';
import {createUIAPI, NotificationType, StatusBarAlignment, StatusBarItem, WebviewPanel} from './ui.js';
import {createStorageAPI} from './storage.js';
import {createSettingsAPI} from './settings.js';
import {createNavigationAPI} from './navigation.js';
import {createNetworkAPI} from './network.js';
import {createSystemAPI} from './system.js';
import {createEventsAPI} from './events.js';
import {createCommandsAPI} from './commands.js';
import {createViewsAPI, TreeView} from './views.js';
import {
    createDiagnosticsAPI,
    DiagnosticSeverity,
    createDiagnostic,
    DiagnosticCollection,
    Diagnostic
} from './diagnostics.js';
import {createTasksAPI, TaskState, Task, CancellationToken} from './tasks.js';

/**
 * 创建扩展 API
 * @param {Object} context - 扩展上下文
 * @returns {Object} API 对象
 */
function createExtensionAPI(context) {
    // 验证上下文
    if (!context) {
        console.warn('⚠️ 扩展上下文未提供，某些 API 功能可能不可用');
        context = {
            extension: {id: 'unknown'},
            globalState: createMockMemento(),
            workspaceState: createMockMemento()
        };
    }

    // 创建 API 对象
    const api = {
        // 播放器 API
        player: createPlayerAPI(context),

        // 音乐库 API
        library: createLibraryAPI(context),

        // UI API
        ui: createUIAPI(context),

        // 存储 API
        storage: createStorageAPI(context),

        // 设置 API
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
        tasks: createTasksAPI(context)
    };

    return api;
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
export {createExtensionAPI};

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
