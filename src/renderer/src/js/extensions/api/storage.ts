/**
 * Storage API - 存储 API
 * 提供扩展数据持久化存储功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {ExtensionContext} from "@extensions/core";
import {StorageAPI} from "@extensions/api/types/storage";

/**
 * 创建存储 API
 * @param context - 扩展上下文
 * @returns 存储 API 实例
 */
export function createStorageAPI(context: ExtensionContext): StorageAPI {
    return {
        get<T = any>(key: string, defaultValue?: T): T {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapSync(() => {
                if (context && context.globalState) {
                    return context.globalState.get<T>(key, defaultValue);
                }
                return defaultValue as T;
            }, 'storage.get');
        },

        async update(key: string, value: any): Promise<void> {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.globalState) {
                    return await context.globalState.update(key, value);
                }
            }, 'storage.update');
        },

        async delete(key: string): Promise<void> {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.globalState) {
                    return await context.globalState.update(key, undefined);
                }
            }, 'storage.delete');
        },

        keys(): string[] {
            return ErrorUtils.wrapSync(() => {
                if (context && context.globalState && context.globalState.keys) {
                    return context.globalState.keys();
                }
                return [];
            }, 'storage.keys');
        },

        getWorkspace<T = any>(key: string, defaultValue?: T): T {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapSync(() => {
                if (context && context.workspaceState) {
                    return context.workspaceState.get<T>(key, defaultValue);
                }
                return defaultValue as T;
            }, 'storage.getWorkspace');
        },

        async updateWorkspace(key: string, value: any): Promise<void> {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.workspaceState) {
                    return await context.workspaceState.update(key, value);
                }
            }, 'storage.updateWorkspace');
        },

        async deleteWorkspace(key: string): Promise<void> {
            Validator.assertNonEmptyString(key, 'key');

            return ErrorUtils.wrapAsync(async () => {
                if (context && context.workspaceState) {
                    return await context.workspaceState.update(key, undefined);
                }
            }, 'storage.deleteWorkspace');
        },

        workspaceKeys(): string[] {
            return ErrorUtils.wrapSync(() => {
                if (context && context.workspaceState && context.workspaceState.keys) {
                    return context.workspaceState.keys();
                }
                return [];
            }, 'storage.workspaceKeys');
        }
    };
}
