/**
 * Window API - 窗口 API
 * 提供窗口控制相关功能
 */

import {ErrorUtils} from '@extensions/api/common/errors.js';
import {Validator} from "@extensions/api/common/validation";

/**
 * 创建窗口 API
 * @param {Object} context - 扩展上下文
 * @returns {WindowAPI} 窗口 API 实例
 */
export function createWindowAPI(context) {
    return {
        /**
         * 窗口最大化
         * @returns {Promise<void>}
         */
        async maximize() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.maximize();
            }, 'window.maximize');
        },

        /**
         * 窗口最小化
         * @returns {Promise<void>}
         */
        async minimize() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.minimize();
            }, 'window.minimize');
        },

        /**
         * 关闭窗口
         * @returns {Promise<void>}
         */
        async close() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.close();
            }, 'window.close');
        },

        /**
         * 窗口是否最大化
         * @returns {Promise<boolean>}
         */
        async isMaximized() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.isMaximized();
            }, 'window.isMaximized');
        },

        /**
         * 获取窗口位置
         * @returns {Promise<Array<number, number>>}
         */
        async getPosition() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.getPosition();
            }, 'window.getPosition');
        },

        /**
         * 获取窗口大小
         * @returns {Promise<Array<number, number>>}
         */
        async getSize() {
            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.getSize();
            }, 'window.getSize');
        },

        /**
         * 设置窗口大小
         * @param width {number}
         * @param height {number}
         * @returns {Promise<Object>}
         */
        async setSize(width, height) {
            Validator.assertType(width, 'number', 'width');
            Validator.assertType(height, 'number', 'height');

            return ErrorUtils.wrapAsync(async () => {
                return await window.electronAPI.window.setSize(width, height);
            }, 'window.setSize');
        },

        /**
         * 监听窗口最大化
         * @param callback {Function}
         * @returns {Promise<void>}
         */
        async onMaximizedChanged(callback) {
            return ErrorUtils.wrapAsync(async () => {
                await window.electronAPI.window.onMaximizedChanged((isMaximized) => {
                    callback(isMaximized);
                });
            }, 'window.onMaximizedChanged');
        },
    };
}
