/**
 * Storage API - 存储 API
 * 提供扩展数据持久化存储功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils} from './common/errors.js';

/**
 * 创建存储 API
 * @param {Object} context - 扩展上下文
 * @returns {StorageAPI} 存储 API 实例
 */
export function createStorageAPI(context) {
    return {
        /**
         * 获取全局状态
         * @param {string} key - 键
         * @param {*} [defaultValue] - 默认值
         * @returns {*} 存储的值
         */
        get(key, defaultValue) {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapSync(() => {
                if (context && context.globalState) {
                    return context.globalState.get(key, defaultValue);
                }
                return defaultValue;
            }, 'storage.get');
        },

        /**
         * 设置全局状态
         * @param {string} key - 键
         * @param {*} value - 值
         * @returns {Promise<void>}
         */
        async update(key, value) {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.globalState) {
                    return await context.globalState.update(key, value);
                }
            }, 'storage.update');
        },

        /**
         * 删除全局状态
         * @param {string} key - 键
         * @returns {Promise<void>}
         */
        async delete(key) {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.globalState) {
                    return await context.globalState.update(key, undefined);
                }
            }, 'storage.delete');
        },

        /**
         * 获取所有全局状态的键
         * @returns {Array<string>} 键列表
         */
        keys() {
            return ErrorUtils.wrapSync(() => {
                if (context && context.globalState && context.globalState.keys) {
                    return context.globalState.keys();
                }
                return [];
            }, 'storage.keys');
        },

        /**
         * 获取工作区状态
         * @param {string} key - 键
         * @param {*} [defaultValue] - 默认值
         * @returns {*} 存储的值
         */
        getWorkspace(key, defaultValue) {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapSync(() => {
                if (context && context.workspaceState) {
                    return context.workspaceState.get(key, defaultValue);
                }
                return defaultValue;
            }, 'storage.getWorkspace');
        },

        /**
         * 设置工作区状态
         * @param {string} key - 键
         * @param {*} value - 值
         * @returns {Promise<void>}
         */
        async updateWorkspace(key, value) {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.workspaceState) {
                    return await context.workspaceState.update(key, value);
                }
            }, 'storage.updateWorkspace');
        },

        /**
         * 删除工作区状态
         * @param {string} key - 键
         * @returns {Promise<void>}
         */
        async deleteWorkspace(key) {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.workspaceState) {
                    return await context.workspaceState.update(key, undefined);
                }
            }, 'storage.deleteWorkspace');
        },

        /**
         * 获取所有工作区状态的键
         * @returns {Array<string>} 键列表
         */
        workspaceKeys() {
            return ErrorUtils.wrapSync(() => {
                if (context && context.workspaceState && context.workspaceState.keys) {
                    return context.workspaceState.keys();
                }
                return [];
            }, 'storage.workspaceKeys');
        }
    };
}
