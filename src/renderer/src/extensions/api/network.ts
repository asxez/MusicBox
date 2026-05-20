/**
 * Network API - 网络 API
 * 提供 HTTP 请求等网络功能
 */

import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils} from '@extensions/api/common/errors';
import {ExtensionContext} from "@extensions/core";
import {NetworkAPI, RequestOptions} from "@extensions/api/types/network";

/**
 * 创建网络 API
 */
export function createNetworkAPI(_context: ExtensionContext): NetworkAPI {
    return {
        async fetch(url: string, options: RequestOptions = {}): Promise<Response> {
            Validator.assertNonEmptyString(url, 'url');
            Validator.assertObject(options, 'options');

            return ErrorUtils.wrapAsync(async () => {
                return await fetch(url, options);
            }, 'network.fetch');
        },

        async get(url: string, options: RequestOptions = {}): Promise<string> {
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

        async post(url: string, data: any, options: RequestOptions = {}): Promise<any> {
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

        async put(url: string, data: any, options: RequestOptions = {}): Promise<any> {
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

        async delete(url: string, options: RequestOptions = {}): Promise<any> {
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

        async downloadFile(url: string, options: RequestOptions = {}): Promise<Blob> {
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
