/**
 * System API - 系统 API
 * 提供系统信息和环境变量访问功能
 */

import {ErrorUtils} from './common/errors.js';

/**
 * 创建系统 API
 * @param {Object} context - 扩展上下文
 * @returns {SystemAPI} 系统 API 实例
 */
export function createSystemAPI(context) {
    return {
        /**
         * 获取应用版本
         * @returns {Promise<string>} 应用版本
         */
        async getVersion() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.getVersion();
            }, 'system.getVersion');
        },

        /**
         * 获取平台信息
         * @returns {Promise<string>} 平台 (win32, darwin, linux)
         */
        async getPlatform() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.getPlatform();
            }, 'system.getPlatform');
        },

        /**
         * 获取操作系统类型
         * @returns {Promise<string>} 操作系统类型 (windows, macos, linux, unknown)
         */
        async getOS() {
            return ErrorUtils.wrapAsync(async () => {
                const platform = await this.getPlatform();
                const platformLower = platform.toLowerCase();
                if (platformLower.includes('win')) return 'windows';
                if (platformLower.includes('mac') || platformLower.includes('darwin')) return 'macos';
                if (platformLower.includes('linux')) return 'linux';
                return 'unknown';
            }, 'system.getOS');
        },

        /**
         * 获取应用路径
         * @returns {Promise<string>} 应用路径
         */
        async getAppPath() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.getAppPath();
            }, 'system.getAppPath');
        },

        /**
         * 获取用户数据路径
         * @returns {Promise<string>} 用户数据路径
         */
        async getUserDataPath() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.getUserDataPath();
            }, 'system.getUserDataPath');
        },

        /**
         * 获取临时目录路径
         * @returns {Promise<string>} 临时目录路径
         */
        async getTempPath() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.getTempPath();
            }, 'system.getTempPath');
        },

        /**
         * 获取系统语言
         * @returns {string} 语言代码 (如: zh-CN, en-US)
         */
        getLanguage() {
            return ErrorUtils.wrapSync(() => {
                return navigator.language || 'en-US';
            }, 'system.getLanguage');
        },

        /**
         * 检查是否在开发模式
         * @returns {boolean} 是否在开发模式
         */
        isDevelopment() {
            return ErrorUtils.wrapSync(() => {
                return process?.env?.NODE_ENV === 'development' || false;
            }, 'system.isDevelopment');
        },

        /**
         * 获取环境变量
         * @param {string} key - 环境变量名
         * @returns {string|undefined} 环境变量值
         */
        getEnv(key) {
            return ErrorUtils.wrapSync(() => {
                return process?.env?.[key];
            }, 'system.getEnv');
        },

        /**
         * 打开外部链接
         * @param {string} url - URL
         * @returns {Promise<void>}
         */
        async openExternal(url) {
            return ErrorUtils.wrapAsync(async () => {
                if (window.electronAPI.openExternal) {
                    await window.electronAPI.openExternal(url);
                } else {
                    window.open(url, '_blank');
                }
            }, 'system.openExternal');
        },

        /**
         * 显示文件在文件管理器中
         * @param {string} filePath - 文件路径
         * @returns {Promise<void>}
         */
        async showItemInFolder(filePath) {
            return ErrorUtils.wrapAsync(async () => {
                await window.electronAPI.openPath(filePath);
            }, 'system.showItemInFolder');
        },

        /**
         * 获取剪贴板文本
         * @returns {Promise<string>} 剪贴板文本
         */
        async getClipboardText() {
            return ErrorUtils.wrapAsync(async () => {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    return await navigator.clipboard.readText();
                }
                return '';
            }, 'system.getClipboardText');
        },

        /**
         * 设置剪贴板文本
         * @param {string} text - 文本内容
         * @returns {Promise<void>}
         */
        async setClipboardText(text) {
            return ErrorUtils.wrapAsync(async () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                }
            }, 'system.setClipboardText');
        }
    };
}
