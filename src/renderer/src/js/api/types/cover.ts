/**
 * 封面 API 类型定义
 */

import {Base64String, Result} from "@api/types/common";

/**
 * 图片格式
 */
export type ImageFormat = 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp';

/**
 * 封面数据
 */
export interface CoverData {
    imageUrl?: string;
    imageData?: Base64String;
    mimeType?: string;
    format?: ImageFormat;
    size?: number;
    width?: number;
    height?: number;
}

/**
 * 封面结果
 */
export interface CoverResult extends Result<CoverData> {
    imageUrl?: string;
    imageData?: Base64String | Blob;
    type?: CoverSource;
    source?: string;
    format?: ImageFormat;
    size?: number;
    mimeType?: string;
    filePath?: string;
}

/**
 * 封面来源
 */
export type CoverSource = 'embedded' | 'local' | 'network' | 'placeholder' | 'blob' | 'url' | 'local-file';
