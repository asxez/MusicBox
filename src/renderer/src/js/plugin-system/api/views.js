/**
 * Views API - 视图 API
 * 提供自定义视图的注册和管理功能
 */

import {Validator, validate} from './common/validation.js';
import {ErrorUtils, ConflictError} from './common/errors.js';
import {toDisposable, Disposable} from '../core/Lifecycle.js';

/**
 * 全局视图注册表
 */
const globalViewRegistry = new Map();

/**
 * 全局视图容器注册表
 */
const globalViewContainerRegistry = new Map();

/**
 * 创建视图 API
 * @param {Object} context - 扩展上下文
 * @returns {ViewsAPI} 视图 API 实例
 */
export function createViewsAPI(context) {
    return {
        /**
         * 注册视图
         * @param {string} viewId - 视图 ID
         * @param {Object} viewProvider - 视图提供者
         * @returns {Disposable} 可释放对象
         */
        registerView(viewId, viewProvider) {
            validate.viewId(viewId);
            Validator.assertObject(viewProvider, 'viewProvider');

            return ErrorUtils.wrapSync(() => {
                if (globalViewRegistry.has(viewId)) {
                    throw new ConflictError('视图', viewId);
                }

                const viewInfo = {
                    id: viewId,
                    provider: viewProvider,
                    extensionId: context.extension?.id || 'unknown'
                };

                globalViewRegistry.set(viewId, viewInfo);
                console.log(`✅ 视图已注册: ${viewId}`);

                return toDisposable(() => {
                    globalViewRegistry.delete(viewId);
                    console.log(`🗑️ 视图已注销: ${viewId}`);
                });
            }, 'views.registerView');
        },

        /**
         * 注册视图容器
         * @param {string} containerId - 容器 ID
         * @param {Object} options - 容器选项
         * @returns {Disposable} 可释放对象
         */
        registerViewContainer(containerId, options) {
            Validator.assertNonEmptyString(containerId, 'containerId');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapSync(() => {
                if (globalViewContainerRegistry.has(containerId)) {
                    throw new ConflictError('视图容器', containerId);
                }

                const containerInfo = {
                    id: containerId,
                    title: options.title || containerId,
                    icon: options.icon || null,
                    views: [],
                    extensionId: context.extension?.id || 'unknown'
                };

                globalViewContainerRegistry.set(containerId, containerInfo);
                console.log(`✅ 视图容器已注册: ${containerId}`);

                return toDisposable(() => {
                    globalViewContainerRegistry.delete(containerId);
                    console.log(`🗑️ 视图容器已注销: ${containerId}`);
                });
            }, 'views.registerViewContainer');
        },

        /**
         * 创建树视图
         * @param {string} viewId - 视图 ID
         * @param {Object} options - 树视图选项
         * @returns {TreeView} 树视图对象
         */
        createTreeView(viewId, options) {
            validate.viewId(viewId);
            Validator.assertObject(options, 'options');
            Validator.assertObject(options.treeDataProvider, 'options.treeDataProvider');

            return ErrorUtils.wrapSync(() => {
                const treeView = new TreeView(viewId, options);

                // 注册视图
                this.registerView(viewId, {
                    type: 'tree',
                    treeView
                });

                return treeView;
            }, 'views.createTreeView');
        },

        /**
         * 注册 Webview 视图提供者
         * @param {string} viewId - 视图 ID
         * @param {Object} provider - Webview 视图提供者
         * @returns {Disposable} 可释放对象
         */
        registerWebviewViewProvider(viewId, provider) {
            validate.viewId(viewId);
            Validator.assertObject(provider, 'provider');
            Validator.assertFunction(provider.resolveWebviewView, 'provider.resolveWebviewView');

            return ErrorUtils.wrapSync(() => {
                return this.registerView(viewId, {
                    type: 'webview',
                    provider
                });
            }, 'views.registerWebviewViewProvider');
        },

        /**
         * 获取所有已注册的视图
         * @returns {Array<Object>} 视图列表
         */
        getViews() {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalViewRegistry.values()).map(view => ({
                    id: view.id,
                    extensionId: view.extensionId
                }));
            }, 'views.getViews');
        },

        /**
         * 获取所有已注册的视图容器
         * @returns {Array<Object>} 视图容器列表
         */
        getViewContainers() {
            return ErrorUtils.wrapSync(() => {
                return Array.from(globalViewContainerRegistry.values()).map(container => ({
                    id: container.id,
                    title: container.title,
                    icon: container.icon,
                    extensionId: container.extensionId
                }));
            }, 'views.getViewContainers');
        }
    };
}

/**
 * 树视图类
 */
class TreeView extends Disposable {
    constructor(viewId, options) {
        super();
        this.viewId = viewId;
        this.treeDataProvider = options.treeDataProvider;
        this.showCollapseAll = options.showCollapseAll || false;
        this.canSelectMany = options.canSelectMany || false;
        this.visible = false;
        this.selection = [];
    }

    /**
     * 显示视图
     */
    reveal(element, options) {
        // TODO: 实现实际的显示逻辑
        console.log(`[TreeView] 显示元素:`, element);
    }

    /**
     * 刷新视图
     */
    refresh(element) {
        // TODO: 实现实际的刷新逻辑
        console.log(`[TreeView] 刷新:`, element);
    }

    /**
     * 释放资源
     */
    dispose() {
        super.dispose();
    }
}

export {globalViewRegistry, globalViewContainerRegistry, TreeView};
