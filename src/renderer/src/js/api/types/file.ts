/**
 * 文件 API 类型定义
 */


import {FilePath, OptionResult} from "@api/types/common";

/**
 * 目录选择结果
 */
export interface DirectoryResult extends OptionResult<FilePath> {
    path?: FilePath;
}

/**
 * 图片文件选择结果
 */
export interface ImageFileResult extends OptionResult<FilePath> {
    path?: FilePath;
}
