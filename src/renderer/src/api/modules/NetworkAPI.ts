/**
 * 网络 API
 * 提供网络请求功能，支持重试机制
 */

import {networkRequestClient, NetworkRequestError} from '@/shared/network';
import {BaseAPI, NetworkError, Validator} from "@api/core";
import {HTTPMethod, NetworkResponse, RequestOptions} from "@api/types";

/**
 * 网络 API 类
 */
export class NetworkAPI extends BaseAPI {
    private readonly defaultTimeout: number = 10000;
    private readonly defaultMaxRetries: number = 3;

    constructor() {
        super('NetworkAPI');
    }

    /**
     * 带重试机制的 fetch 请求
     * @param url - 请求 URL
     * @param options - 请求选项
     * @param maxRetries - 最大重试次数
     * @returns fetch 响应
     */
    async fetchWithRetry(
        url: string,
        options: RequestOptions = {},
        maxRetries: number = this.defaultMaxRetries
    ): Promise<Response> {
        Validator.assertURL(url, 'url');
        Validator.assertNumber(maxRetries, 'maxRetries');

        const defaultOptions: RequestOptions = {
            timeout: this.defaultTimeout,
            headers: {
                'User-Agent': 'MusicBox',
                ...options.headers
            },
            ...options
        };

        return await networkRequestClient.fetchWithRetry(url, defaultOptions, maxRetries);
    }

    /**
     * GET 请求
     * @param url - 请求 URL
     * @param options - 请求选项
     * @returns 响应数据
     */
    async get<T = any>(url: string, options?: RequestOptions): Promise<NetworkResponse<T>> {
        return this.request<T>(url, 'GET', options);
    }

    /**
     * POST 请求
     * @param url - 请求 URL
     * @param data - 请求数据
     * @param options - 请求选项
     * @returns 响应数据
     */
    async post<T = any>(
        url: string,
        data?: any,
        options?: RequestOptions
    ): Promise<NetworkResponse<T>> {
        return this.request<T>(url, 'POST', {
            ...options,
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers
            }
        });
    }

    /**
     * PUT 请求
     * @param url - 请求 URL
     * @param data - 请求数据
     * @param options - 请求选项
     * @returns 响应数据
     */
    async put<T = any>(
        url: string,
        data?: any,
        options?: RequestOptions
    ): Promise<NetworkResponse<T>> {
        return this.request<T>(url, 'PUT', {
            ...options,
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers
            }
        });
    }

    /**
     * DELETE 请求
     * @param url - 请求 URL
     * @param options - 请求选项
     * @returns 响应数据
     */
    async delete<T = any>(url: string, options?: RequestOptions): Promise<NetworkResponse<T>> {
        return this.request<T>(url, 'DELETE', options);
    }

    /**
     * 通用请求方法
     * @param url - 请求 URL
     * @param method - HTTP 方法
     * @param options - 请求选项
     * @returns 响应数据
     */
    private async request<T = any>(
        url: string,
        method: HTTPMethod,
        options?: RequestOptions
    ): Promise<NetworkResponse<T>> {
        try {
            const response = await this.fetchWithRetry(url, {
                ...options,
                method
            }, options?.maxRetries);

            const data = await this.parseResponse<T>(response);

            return {
                success: true,
                data,
                status: response.status,
                statusText: response.statusText,
                headers: this.parseHeaders(response.headers)
            };
        } catch (error) {
            this.logError(`${method} 请求失败`, error as Error);

            return {
                success: false,
                error: (error as Error).message,
                status: this.getNetworkStatus(error)
            };
        }
    }

    private getNetworkStatus(error: unknown): number | undefined {
        if (error instanceof NetworkError || error instanceof NetworkRequestError) {
            return error.statusCode;
        }

        return undefined;
    }

    /**
     * 解析响应数据
     * @param response - fetch 响应
     * @returns 解析后的数据
     */
    private async parseResponse<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
            return await response.json();
        } else if (contentType?.includes('text/')) {
            return await response.text() as any;
        } else {
            return await response.blob() as any;
        }
    }

    /**
     * 解析响应头
     * @param headers - Headers 对象
     * @returns 响应头对象
     */
    private parseHeaders(headers: Headers): Record<string, string> {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    /**
     * 下载文件
     * @param url - 文件 URL
     * @param options - 请求选项
     * @returns 文件 Blob
     */
    async downloadFile(url: string, options?: RequestOptions): Promise<Blob> {
        Validator.assertURL(url, 'url');

        try {
            const response = await this.fetchWithRetry(url, options);
            return await response.blob();
        } catch (error) {
            this.logError('下载文件失败', error as Error);
            throw error;
        }
    }

    /**
     * 获取 JSON 数据
     * @param url - 请求 URL
     * @param options - 请求选项
     * @returns JSON 数据
     */
    async getJSON<T = any>(url: string, options?: RequestOptions): Promise<T> {
        Validator.assertURL(url, 'url');

        try {
            const response = await this.fetchWithRetry(url, options);
            return await response.json();
        } catch (error) {
            this.logError('获取 JSON 失败', error as Error);
            throw error;
        }
    }

    /**
     * 获取文本数据
     * @param url - 请求 URL
     * @param options - 请求选项
     * @returns 文本数据
     */
    async getText(url: string, options?: RequestOptions): Promise<string> {
        Validator.assertURL(url, 'url');

        try {
            const response = await this.fetchWithRetry(url, options);
            return await response.text();
        } catch (error) {
            this.logError('获取文本失败', error as Error);
            throw error;
        }
    }

    /**
     * 检查 URL 是否可访问
     * @param url - 请求 URL
     * @returns 是否可访问
     */
    async isAccessible(url: string): Promise<boolean> {
        try {
            const response = await this.fetchWithRetry(url, {method: 'HEAD'}, 1);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * 设置默认超时时间
     * @param timeout - 超时时间（毫秒）
     */
    setDefaultTimeout(timeout: number): void {
        Validator.assertNumber(timeout, 'timeout');
        (this as any).defaultTimeout = timeout;
    }

    /**
     * 设置默认最大重试次数
     * @param maxRetries - 最大重试次数
     */
    setDefaultMaxRetries(maxRetries: number): void {
        Validator.assertNumber(maxRetries, 'maxRetries');
        (this as any).defaultMaxRetries = maxRetries;
    }
}

export const networkAPI = new NetworkAPI();
