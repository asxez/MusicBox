/**
 * 网络 API 类型定义
 */


/**
 * HTTP 方法
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * 请求头
 */
export type RequestHeaders = Record<string, string>;

/**
 * 请求选项
 */
export interface RequestOptions extends RequestInit {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    headers?: RequestHeaders;
}

/**
 * 网络响应
 */
export interface NetworkResponse<T = any> {
    success: boolean;
    data?: T;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    error?: string;
}
