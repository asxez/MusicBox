/**
 * Network API - 网络 API
 * 提供 HTTP 请求等网络功能
 */

import {Validator} from './common/validation.js';
import {ErrorUtils} from './common/errors.js';

/**
 * 创建网络 API
 * @param {Object} context - 扩展上下文
 * @returns {NetworkAPI} 网络 API 实例
 */
export function createNetworkAPI(context) {
    return {
        /**
         * 发送 HTTP 请求
         * @param {string} url - URL
         * @param {Object} [options={}] - 请求选项
         * @returns {Promise<Response>} 响应对象
         */
        async fetch(url, options = {}) {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                return await fetch(url, options);
            }, 'network.fetch');
        },

        /**
         * 发送 GET 请求
         * @param {string} url - URL
         * @param {Object} [options={}] - 请求选项
         * @returns {Promise<string>} 响应数据
         */
        async get(url, options = {}) {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const response = await fetch(url, {
                    ...options,
                    method: 'GET'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.text();
            }, 'network.get');
        },

        /**
         * 发送 POST 请求
         * @param {string} url - URL
         * @param {*} data - 请求数据
         * @param {Object} [options={}] - 请求选项
         * @returns {Promise<any>} 响应数据
         */
        async post(url, data, options = {}) {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const response = await fetch(url, {
                    ...options,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            }, 'network.post');
        },

        /**
         * 发送 PUT 请求
         * @param {string} url - URL
         * @param {*} data - 请求数据
         * @param {Object} [options={}] - 请求选项
         * @returns {Promise<any>} 响应数据
         */
        async put(url, data, options = {}) {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const response = await fetch(url, {
                    ...options,
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            }, 'network.put');
        },

        /**
         * 发送 DELETE 请求
         * @param {string} url - URL
         * @param {Object} [options={}] - 请求选项
         * @returns {Promise<any>} 响应数据
         */
        async delete(url, options = {}) {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const response = await fetch(url, {
                    ...options,
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            }, 'network.delete');
        },

        /**
         * 下载文件
         * @param {string} url - URL
         * @param {Object} [options={}] - 下载选项
         * @returns {Promise<Blob>} 文件 Blob
         */
        async downloadFile(url, options = {}) {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                const response = await fetch(url, options);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.blob();
            }, 'network.downloadFile');
        }
    };
}
