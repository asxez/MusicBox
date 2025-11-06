/**
 * Settings API - 设置 API
 * 提供应用设置的读取和修改功能
 */

import {validate, Validator} from './common/validation.js';
import {ErrorUtils, NotAvailableError} from './common/errors.js';
import {toDisposable} from '../core/Lifecycle.js';

/**
 * 创建设置 API
 * @param {Object} context - 扩展上下文
 * @returns {SettingsAPI} 设置 API 实例
 */
export function createSettingsAPI(context) {
    return {
        /**
         * 获取设置
         * @param {string} key - 设置键
         * @param {*} [defaultValue] - 默认值
         * @returns {*} 设置值
         */
        get(key, defaultValue) {
            validate.configKey(key);

            return ErrorUtils.wrapSync(() => {
                if (window.settings && typeof window.settings.getSetting === 'function') {
                    return window.settings.getSetting(key, defaultValue);
                }
                // 尝试从 localStorage 读取
                try {
                    const stored = localStorage.getItem(`setting_${key}`);
                    if (stored !== null) {
                        return JSON.parse(stored);
                    }
                } catch (error) {
                    console.warn(`读取设置 ${key} 失败:`, error);
                }
                return defaultValue;
            }, 'settings.get');
        },

        /**
         * 设置设置
         * @param {string} key - 设置键
         * @param {*} value - 值
         * @returns {Promise<void>}
         */
        async set(key, value) {
            validate.configKey(key);

            return ErrorUtils.wrapAsync(async () => {
                if (window.settings && typeof window.settings.setSetting === 'function') {
                    await window.settings.setSetting(key, value);
                } else {
                    // 尝试写入 localStorage
                    try {
                        localStorage.setItem(`setting_${key}`, JSON.stringify(value));
                    } catch (error) {
                        throw new NotAvailableError('settings.set', `无法保存设置: ${error.message}`);
                    }
                }
            }, 'settings.set');
        },

        /**
         * 删除设置
         * @param {string} key - 设置键
         * @returns {Promise<void>}
         */
        async delete(key) {
            validate.configKey(key);

            return ErrorUtils.wrapAsync(async () => {
                if (window.settings && typeof window.settings.deleteSetting === 'function') {
                    await window.settings.deleteSetting(key);
                } else {
                    // 尝试从 localStorage 删除
                    try {
                        localStorage.removeItem(`setting_${key}`);
                    } catch (error) {
                        throw new NotAvailableError('settings.delete', `无法删除设置: ${error.message}`);
                    }
                }
            }, 'settings.delete');
        },

        /**
         * 检查设置是否存在
         * @param {string} key - 设置键
         * @returns {boolean} 是否存在
         */
        has(key) {
            validate.configKey(key);

            return ErrorUtils.wrapSync(() => {
                if (window.settings && typeof window.settings.hasSetting === 'function') {
                    return window.settings.hasSetting(key);
                }
                // 尝试从 localStorage 检查
                try {
                    return localStorage.getItem(`setting_${key}`) !== null;
                } catch (error) {
                    return false;
                }
            }, 'settings.has');
        },

        /**
         * 获取所有设置键
         * @returns {Array<string>} 设置键列表
         */
        keys() {
            return ErrorUtils.wrapSync(() => {
                if (window.settings && typeof window.settings.getAllKeys === 'function') {
                    return window.settings.getAllKeys();
                }
                // 尝试从 localStorage 获取
                try {
                    const keys = [];
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

        /**
         * 监听设置变化
         * @param {Function} callback - 回调函数，接收 {key, newValue, oldValue} 事件对象
         * @returns {Disposable} 可释放对象
         */
        onDidChange(callback) {
            Validator.assertFunction(callback, 'callback');

            return ErrorUtils.wrapSync(() => {
                if (window.settings && typeof window.settings.onSettingChanged === 'function') {
                    // 如果系统提供了配置变化监听，使用系统的
                    return window.settings.onSettingChanged(callback);
                }

                // 使用 storage 事件监听 localStorage 变化
                const handler = (event) => {
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
