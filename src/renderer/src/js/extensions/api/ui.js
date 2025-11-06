/**
 * UI API - 用户界面 API
 * 提供通知、对话框、状态栏、进度提示等 UI 交互功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils} from './common/errors.js';
import {Disposable} from '../core/Lifecycle.js';
import {showToast} from '@utils';

/**
 * 通知类型枚举
 */
export const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * 状态栏项对齐方式
 */
export const StatusBarAlignment = {
    LEFT: 'left',
    RIGHT: 'right'
};

/**
 * 创建 UI API
 * @param {Object} context - 扩展上下文
 * @returns {UIAPI} UI API 实例
 */
export function createUIAPI(context) {
    return {
        /**
         * 显示通知
         * @param {string} message - 消息内容
         * @param {string} [type='info'] - 类型 (info, success, warning, error)
         * @returns {void}
         */
        showNotification(message, type = NotificationType.INFO) {
            Validator.assertNonEmptyString(message, 'message');
            Validator.assertEnum(type, Object.values(NotificationType), 'type');

            return ErrorUtils.wrapSync(() => {
                showToast(message, type);
            }, 'ui.showNotification');
        },

        /**
         * 显示信息通知
         * @param {string} message - 消息内容
         * @returns {void}
         */
        showInformationMessage(message) {
            return this.showNotification(message, NotificationType.INFO);
        },

        /**
         * 显示成功通知
         * @param {string} message - 消息内容
         * @returns {void}
         */
        showSuccessMessage(message) {
            return this.showNotification(message, NotificationType.SUCCESS);
        },

        /**
         * 显示警告通知
         * @param {string} message - 消息内容
         * @returns {void}
         */
        showWarningMessage(message) {
            return this.showNotification(message, NotificationType.WARNING);
        },

        /**
         * 显示错误通知
         * @param {string} message - 消息内容
         * @returns {void}
         */
        showErrorMessage(message) {
            return this.showNotification(message, NotificationType.ERROR);
        },

        /**
         * 显示确认对话框
         * @param {string} message - 消息内容
         * @param {Object} [options={}] - 对话框选项
         * @returns {Promise<boolean>} 用户是否确认
         */
        async showConfirmDialog(message, options = {}) {
            Validator.assertNonEmptyString(message, 'message');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const title = options.title || '确认';
                const confirmText = options.confirmText || '确定';
                const cancelText = options.cancelText || '取消';

                // 简单实现，使用浏览器原生对话框
                // TODO: 实现自定义对话框组件
                return window.confirm(`${title}\n\n${message}`);
            }, 'ui.showConfirmDialog');
        },

        /**
         * 显示输入框
         * @param {Object} options - 输入框选项
         * @returns {Promise<string|null>} 用户输入的内容，取消则返回 null
         */
        async showInputBox(options = {}) {
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const prompt = options.prompt || '请输入';
                const defaultValue = options.value || '';
                const placeholder = options.placeholder || '';

                // 简单实现，使用浏览器原生输入框
                // TODO: 实现自定义输入框组件
                const result = window.prompt(prompt, defaultValue);
                return result;
            }, 'ui.showInputBox');
        },

        /**
         * 显示快速选择列表
         * @param {Array<string|Object>} items - 选项列表
         * @param {Object} [options={}] - 选择器选项
         * @returns {Promise<string|Object|null>} 用户选择的项，取消则返回 null
         */
        async showQuickPick(items, options = {}) {
            Validator.assertNonEmptyArray(items, 'items');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const placeholder = options.placeholder || '请选择';

                // 简单实现
                // TODO: 实现自定义快速选择组件
                const itemLabels = items.map(item =>
                    typeof item === 'string' ? item : (item.label || String(item))
                );

                const selectedLabel = window.prompt(
                    `${placeholder}\n可选项: ${itemLabels.join(', ')}`
                );

                if (selectedLabel === null) {
                    return null;
                }

                const index = itemLabels.indexOf(selectedLabel);
                return index !== -1 ? items[index] : null;
            }, 'ui.showQuickPick');
        },

        /**
         * 创建状态栏项
         * @param {string} id - 唯一标识
         * @param {Object} [options={}] - 选项
         * @returns {StatusBarItem} 状态栏项对象
         */
        createStatusBarItem(id, options = {}) {
            Validator.assertNonEmptyString(id, 'id');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                const alignment = options.alignment || StatusBarAlignment.LEFT;
                const priority = options.priority || 0;

                return new StatusBarItem(id, {
                    text: options.text || '',
                    tooltip: options.tooltip || '',
                    alignment,
                    priority
                });
            }, 'ui.createStatusBarItem');
        },

        /**
         * 显示进度提示
         * @param {Object} options - 进度选项
         * @param {Function} task - 任务函数
         * @returns {Promise<*>} 任务结果
         */
        async withProgress(options, task) {
            Validator.assertObject(options, 'options');
            Validator.assertFunction(task, 'task');

            return ErrorUtils.wrapAsync(async () => {
                const title = options.title || '处理中...';
                const cancellable = options.cancellable || false;

                // 简单实现
                // TODO: 实现自定义进度提示组件
                console.log(`[Progress] ${title}`);

                const progress = {
                    report(value) {
                        if (typeof value === 'object' && value.message) {
                            console.log(`[Progress] ${value.message}`);
                        }
                    }
                };

                try {
                    const result = await task(progress);
                    console.log(`[Progress] 完成`);
                    return result;
                } catch (error) {
                    console.error(`[Progress] 失败:`, error);
                    throw error;
                }
            }, 'ui.withProgress');
        },

        /**
         * 创建 Webview 面板
         * @param {string} viewId - 视图 ID
         * @param {string} title - 面板标题
         * @param {Object} [options={}] - 面板选项
         * @returns {WebviewPanel} Webview 面板对象
         */
        createWebviewPanel(viewId, title, options = {}) {
            Validator.assertNonEmptyString(viewId, 'viewId');
            Validator.assertNonEmptyString(title, 'title');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                // TODO: 实现 Webview 面板
                return new WebviewPanel(viewId, title, options);
            }, 'ui.createWebviewPanel');
        }
    };
}

/**
 * 状态栏项类
 */
class StatusBarItem extends Disposable {
    constructor(id, options) {
        super();
        this.id = id;
        this.text = options.text || '';
        this.tooltip = options.tooltip || '';
        this.alignment = options.alignment || StatusBarAlignment.LEFT;
        this.priority = options.priority || 0;
        this.visible = false;
        this.element = null;
    }

    /**
     * 显示状态栏项
     */
    show() {
        if (!this.visible) {
            this.visible = true;
            this._render();
        }
    }

    /**
     * 隐藏状态栏项
     */
    hide() {
        if (this.visible) {
            this.visible = false;
            this._remove();
        }
    }

    /**
     * 设置文本
     * @param {string} text - 文本内容
     */
    setText(text) {
        this.text = text;
        if (this.visible) {
            this._render();
        }
    }

    /**
     * 设置提示
     * @param {string} tooltip - 提示内容
     */
    setTooltip(tooltip) {
        this.tooltip = tooltip;
        if (this.visible && this.element) {
            this.element.title = tooltip;
        }
    }

    /**
     * 渲染状态栏项
     * @private
     */
    _render() {
        // TODO: 实现实际的渲染逻辑
        console.log(`[StatusBarItem] ${this.id}: ${this.text}`);
    }

    /**
     * 移除状态栏项
     * @private
     */
    _remove() {
        // TODO: 实现实际的移除逻辑
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    /**
     * 释放资源
     */
    dispose() {
        this.hide();
        super.dispose();
    }
}

/**
 * Webview 面板类
 */
class WebviewPanel extends Disposable {
    constructor(viewId, title, options) {
        super();
        this.viewId = viewId;
        this.title = title;
        this.options = options;
        this.visible = false;
        this.webview = null;
    }

    /**
     * 显示面板
     */
    reveal() {
        this.visible = true;
        // TODO: 实现实际的显示逻辑
        console.log(`[WebviewPanel] 显示: ${this.viewId}`);
    }

    /**
     * 隐藏面板
     */
    hide() {
        this.visible = false;
        // TODO: 实现实际的隐藏逻辑
        console.log(`[WebviewPanel] 隐藏: ${this.viewId}`);
    }

    /**
     * 释放资源
     */
    dispose() {
        this.hide();
        super.dispose();
    }
}

export {StatusBarItem, WebviewPanel};
