/**
 * 参数验证工具
 * 提供统一的参数验证机制
 */

import {ValidationError} from "@api/core/errors";

/**
 * 验证工具类
 */
export class Validator {
    /**
     * 验证参数是否为指定类型
     */
    static assertType(value: any, type: string, paramName: string): void {
        const actualType = typeof value;
        if (actualType !== type) {
            throw new ValidationError(paramName, type, value);
        }
    }

    /**
     * 验证参数是否为字符串
     */
    static assertString(value: any, paramName: string): asserts value is string {
        this.assertType(value, 'string', paramName);
    }

    /**
     * 验证参数是否为非空字符串
     */
    static assertNonEmptyString(value: any, paramName: string): asserts value is string {
        this.assertString(value, paramName);
        if (value.trim().length === 0) {
            throw new ValidationError(paramName, 'non-empty string', value);
        }
    }

    /**
     * 验证参数是否为数字
     */
    static assertNumber(value: any, paramName: string): asserts value is number {
        this.assertType(value, 'number', paramName);
        if (isNaN(value)) {
            throw new ValidationError(paramName, 'valid number', value);
        }
    }

    /**
     * 验证参数是否为布尔值
     */
    static assertBoolean(value: any, paramName: string): asserts value is boolean {
        this.assertType(value, 'boolean', paramName);
    }

    /**
     * 验证参数是否为函数
     */
    static assertFunction(value: any, paramName: string): asserts value is Function {
        this.assertType(value, 'function', paramName);
    }

    /**
     * 验证参数是否为对象
     */
    static assertObject(value: any, paramName: string): asserts value is object {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new ValidationError(paramName, 'object', value);
        }
    }

    /**
     * 验证参数是否为数组
     */
    static assertArray(value: any, paramName: string): asserts value is any[] {
        if (!Array.isArray(value)) {
            throw new ValidationError(paramName, 'array', value);
        }
    }

    /**
     * 验证参数是否为非空数组
     */
    static assertNonEmptyArray(value: any, paramName: string): asserts value is any[] {
        this.assertArray(value, paramName);
        if (value.length === 0) {
            throw new ValidationError(paramName, 'non-empty array', value);
        }
    }

    /**
     * 验证参数是否不为 null 或 undefined
     */
    static assertDefined<T>(value: T | null | undefined, paramName: string): asserts value is T {
        if (value === null || value === undefined) {
            throw new ValidationError(paramName, 'defined value', value);
        }
    }

    /**
     * 验证数字是否在指定范围内
     */
    static assertRange(value: number, min: number, max: number, paramName: string): void {
        this.assertNumber(value, paramName);
        if (value < min || value > max) {
            throw new ValidationError(
                paramName,
                `number between ${min} and ${max}`,
                value
            );
        }
    }

    /**
     * 验证字符串是否匹配正则表达式
     */
    static assertPattern(value: string, pattern: RegExp, paramName: string): void {
        this.assertString(value, paramName);
        if (!pattern.test(value)) {
            throw new ValidationError(
                paramName,
                `string matching pattern ${pattern}`,
                value
            );
        }
    }

    /**
     * 验证值是否为枚举值之一
     */
    static assertEnum<T>(value: T, enumValues: readonly T[], paramName: string): void {
        if (!enumValues.includes(value)) {
            throw new ValidationError(
                paramName,
                `one of [${enumValues.join(', ')}]`,
                value
            );
        }
    }

    /**
     * 验证对象是否包含指定的属性
     */
    static assertObjectHasProps(obj: any, requiredProps: string[], paramName: string): void {
        this.assertObject(obj, paramName);
        for (const prop of requiredProps) {
            if (!(prop in obj)) {
                throw new ValidationError(
                    paramName,
                    `object with property "${prop}"`,
                    obj
                );
            }
        }
    }

    /**
     * 验证数组元素是否都为指定类型
     */
    static assertArrayOfType(arr: any[], elementType: string, paramName: string): void {
        this.assertArray(arr, paramName);
        for (let i = 0; i < arr.length; i++) {
            const element = arr[i];
            const actualType = typeof element;
            if (actualType !== elementType) {
                throw new ValidationError(
                    `${paramName}[${i}]`,
                    elementType,
                    element
                );
            }
        }
    }

    /**
     * 可选参数验证：如果参数存在，则验证其类型
     */
    static assertOptional<T>(
        value: T | null | undefined,
        validator: (value: T, paramName: string) => void,
        paramName: string
    ): void {
        if (value !== undefined && value !== null) {
            validator(value, paramName);
        }
    }

    /**
     * 验证文件路径
     */
    static assertFilePath(value: any, paramName: string): asserts value is string {
        this.assertNonEmptyString(value, paramName);
        // 基本的路径格式验证
        if (value.includes('\0')) {
            throw new ValidationError(paramName, 'valid file path', value);
        }
    }

    /**
     * 验证 URL
     */
    static assertURL(value: any, paramName: string): asserts value is string {
        this.assertString(value, paramName);
        try {
            new URL(value);
        } catch {
            throw new ValidationError(paramName, 'valid URL', value);
        }
    }
}

/**
 * 常用验证模式
 */
export const ValidationPatterns = {
    // URL 格式
    URL: /^https?:\/\/.+/,

    // 文件路径格式（简单验证）
    FILE_PATH: /^.+$/,

    // 音频文件扩展名
    AUDIO_FILE: /\.(flac|mp3|wav|ogg|m4a|aac|wma)$/i,

    // 歌词文件扩展名
    LYRICS_FILE: /\.(lrc|ttml)$/i,

    // 图片文件扩展名
    IMAGE_FILE: /\.(jpg|jpeg|png|gif|webp|bmp)$/i
} as const;

/**
 * 快捷验证函数
 */
export const validate = {
    /**
     * 验证音量值（0-1）
     */
    volume(volume: number, paramName = 'volume'): void {
        Validator.assertRange(volume, 0, 1, paramName);
    },

    /**
     * 验证时间值（秒，非负数）
     */
    time(time: number, paramName = 'time'): void {
        Validator.assertNumber(time, paramName);
        if (time < 0) {
            throw new ValidationError(paramName, 'non-negative number', time);
        }
    },

    /**
     * 验证播放模式
     */
    playMode(mode: string, paramName = 'playMode'): void {
        Validator.assertEnum(mode, ['sequence', 'shuffle', 'repeat-one', 'repeat-all'] as const, paramName);
    },

    /**
     * 验证音频文件路径
     */
    audioFilePath(path: string, paramName = 'filePath'): void {
        Validator.assertFilePath(path, paramName);
        if (!ValidationPatterns.AUDIO_FILE.test(path)) {
            throw new ValidationError(paramName, 'audio file path', path);
        }
    },

    /**
     * 验证歌词文件路径
     */
    lyricsFilePath(path: string, paramName = 'filePath'): void {
        Validator.assertFilePath(path, paramName);
        if (!ValidationPatterns.LYRICS_FILE.test(path)) {
            throw new ValidationError(paramName, 'lyrics file path', path);
        }
    },

    /**
     * 验证图片文件路径
     */
    imageFilePath(path: string, paramName = 'filePath'): void {
        Validator.assertFilePath(path, paramName);
        if (!ValidationPatterns.IMAGE_FILE.test(path)) {
            throw new ValidationError(paramName, 'image file path', path);
        }
    }
};
