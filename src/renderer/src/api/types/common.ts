/**
 * 通用类型定义
 */

/**
 * 通用结果类型
 */
export interface Result<T = void> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * 事件取消订阅函数
 */
export type Unsubscribe = () => void;

/**
 * 选项结果
 */
export interface OptionResult<T = void> {
    success: boolean;
    canceled?: boolean;
    data?: T;
    error?: string;
}

/**
 * 分页参数
 */
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    offset?: number;
    limit?: number;
}

/**
 * 排序参数
 */
export interface SortParams {
    field: string;
    order: 'asc' | 'desc';
}

/**
 * 筛选参数
 */
export interface FilterParams {
    [key: string]: any;
}

/**
 * 查询选项
 */
export interface QueryOptions {
    pagination?: PaginationParams;
    sort?: SortParams;
    filter?: FilterParams;
}

/**
 * 歌词格式
 */
export type LyricsFormat = 'lrc' | 'ttml';

/**
 * 时间戳（毫秒）
 */
export type Timestamp = number;

/**
 * 文件路径
 */
export type FilePath = string;

/**
 * URL 字符串
 */
export type URL = string;

/**
 * Base64 编码的字符串
 */
export type Base64String = string;
