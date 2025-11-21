/**
 * Settings API - 设置 API
 * 提供应用设置的读取和修改功能
 */

import {validate, Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotAvailableError} from '@extensions/api/common/errors';
import {IDisposable, toDisposable} from '@extensions/core/Lifecycle';
import {ExtensionContext} from "@extensions/core";
import {SettingsAPI, SettingsChangeEvent} from "@extensions/api/types/settings";

/**
 * 创建设置 API
 */
export function createSettingsAPI(_context: ExtensionContext): SettingsAPI {
    return {
        get<T = any>(key: string, defaultValue?: T): T {
            validate.configKey(key);

            return ErrorUtils.wrapSync(() => {
                try {
                    const stored = localStorage.getItem(`setting_${key}`);
                    if (stored !== null) {
                        return JSON.parse(stored);
                    }
                } catch (error) {
                    console.warn(`读取设置 ${key} 失败:`, error);
                }
                return defaultValue as T;
            }, 'settings.get');
        },

        async set(key: string, value: any): Promise<void> {
            validate.configKey(key);

            return ErrorUtils.wrapAsync(async () => {
                try {
                    localStorage.setItem(`setting_${key}`, JSON.stringify(value));
                } catch (error) {
                    throw new NotAvailableError('settings.set', `无法保存设置: ${(error as Error).message}`);
                }
            }, 'settings.set');
        },

        async delete(key: string): Promise<void> {
            validate.configKey(key);

            return ErrorUtils.wrapAsync(async () => {
                try {
                    localStorage.removeItem(`setting_${key}`);
                } catch (error) {
                    throw new NotAvailableError('settings.delete', `无法删除设置: ${(error as Error).message}`);
                }
            }, 'settings.delete');
        },

        has(key: string): boolean {
            validate.configKey(key);

            return ErrorUtils.wrapSync(() => {
                try {
                    return localStorage.getItem(`setting_${key}`) !== null;
                } catch (error) {
                    return false;
                }
            }, 'settings.has');
        },

        keys(): string[] {
            return ErrorUtils.wrapSync(() => {
                try {
                    const keys: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('setting_')) {
                            keys.push(key.substring(8)); // 移除 'setting_' 前缀
                        }
                    }
                    return keys;
                } catch (error) {
                    return [];
                }
            }, 'settings.keys');
        },

        onDidChange(callback: (event: SettingsChangeEvent) => void): IDisposable {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                // 使用 storage 事件监听 localStorage 变化
                const handler = (event: StorageEvent) => {
                    // 只处理设置相关的变化
                    if (event.key && event.key.startsWith('setting_')) {
                        try {
                            const key = event.key.substring(8); // 移除 'setting_' 前缀
                            const newValue = event.newValue ? JSON.parse(event.newValue) : undefined;
                            const oldValue = event.oldValue ? JSON.parse(event.oldValue) : undefined;
                            callback({key, newValue, oldValue});
                        } catch (error) {
                            console.warn(`解析设置变化失败:`, error);
                        }
                    }
                };

                window.addEventListener('storage', handler);

                return toDisposable(() => {
                    window.removeEventListener('storage', handler);
                });
            }, 'settings.onDidChange');
        }
    };
}
