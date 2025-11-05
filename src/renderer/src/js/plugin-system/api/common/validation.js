/**
 * 参数验证工具
 * 提供统一的参数验证机制
 */

import {ValidationError} from './errors.js';

/**
 * 验证工具类
 */
class Validator {
    /**
     * 验证参数是否为指定类型
     * @param {*} value - 要验证的值
     * @param {string} type - 期望的类型
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertType(value, type, paramName) {
        const actualType = typeof value;
        if (actualType !== type) {
            throw new ValidationError(paramName, type, value);
        }
    }

    /**
     * 验证参数是否为字符串
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertString(value, paramName) {
        this.assertType(value, 'string', paramName);
    }

    /**
     * 验证参数是否为非空字符串
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertNonEmptyString(value, paramName) {
        this.assertString(value, paramName);
        if (value.trim().length === 0) {
            throw new ValidationError(paramName, 'non-empty string', value);
        }
    }

    /**
     * 验证参数是否为数字
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertNumber(value, paramName) {
        this.assertType(value, 'number', paramName);
        if (isNaN(value)) {
            throw new ValidationError(paramName, 'valid number', value);
        }
    }

    /**
     * 验证参数是否为布尔值
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertBoolean(value, paramName) {
        this.assertType(value, 'boolean', paramName);
    }

    /**
     * 验证参数是否为函数
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertFunction(value, paramName) {
        this.assertType(value, 'function', paramName);
    }

    /**
     * 验证参数是否为对象
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertObject(value, paramName) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new ValidationError(paramName, 'object', value);
        }
    }

    /**
     * 验证参数是否为数组
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertArray(value, paramName) {
        if (!Array.isArray(value)) {
            throw new ValidationError(paramName, 'array', value);
        }
    }

    /**
     * 验证参数是否为非空数组
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertNonEmptyArray(value, paramName) {
        this.assertArray(value, paramName);
        if (value.length === 0) {
            throw new ValidationError(paramName, 'non-empty array', value);
        }
    }

    /**
     * 验证参数是否不为 null 或 undefined
     * @param {*} value - 要验证的值
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertDefined(value, paramName) {
        if (value === null || value === undefined) {
            throw new ValidationError(paramName, 'defined value', value);
        }
    }

    /**
     * 验证数字是否在指定范围内
     * @param {number} value - 要验证的值
     * @param {number} min - 最小值（包含）
     * @param {number} max - 最大值（包含）
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertRange(value, min, max, paramName) {
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
     * @param {string} value - 要验证的值
     * @param {RegExp} pattern - 正则表达式
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertPattern(value, pattern, paramName) {
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
     * @param {*} value - 要验证的值
     * @param {Array} enumValues - 枚举值数组
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertEnum(value, enumValues, paramName) {
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
     * @param {Object} obj - 要验证的对象
     * @param {string[]} requiredProps - 必需的属性名数组
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertObjectHasProps(obj, requiredProps, paramName) {
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
     * @param {Array} arr - 要验证的数组
     * @param {string} elementType - 元素类型
     * @param {string} paramName - 参数名称
     * @throws {ValidationError}
     */
    static assertArrayOfType(arr, elementType, paramName) {
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
     * @param {*} value - 要验证的值
     * @param {Function} validator - 验证函数
     * @param {string} paramName - 参数名称
     */
    static assertOptional(value, validator, paramName) {
        if (value !== undefined && value !== null) {
            validator(value, paramName);
        }
    }
}

/**
 * 常用验证模式
 */
const ValidationPatterns = {
    // 命令 ID 格式：extension.commandName
    COMMAND_ID: /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,

    // 视图 ID 格式：extension.viewName
    VIEW_ID: /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,

    // 扩展 ID 格式：publisher.extensionName
    EXTENSION_ID: /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,

    // 配置键格式：section.key
    CONFIG_KEY: /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/,

    // URL 格式
    URL: /^https?:\/\/.+/,

    // 文件路径格式（简单验证）
    FILE_PATH: /^.+$/
};

/**
 * 快捷验证函数
 */
const validate = {
    /**
     * 验证命令 ID
     * @param {string} commandId - 命令 ID
     * @param {string} paramName - 参数名称
     */
    commandId(commandId, paramName = 'commandId') {
        Validator.assertPattern(commandId, ValidationPatterns.COMMAND_ID, paramName);
    },

    /**
     * 验证视图 ID
     * @param {string} viewId - 视图 ID
     * @param {string} paramName - 参数名称
     */
    viewId(viewId, paramName = 'viewId') {
        Validator.assertPattern(viewId, ValidationPatterns.VIEW_ID, paramName);
    },

    /**
     * 验证扩展 ID
     * @param {string} extensionId - 扩展 ID
     * @param {string} paramName - 参数名称
     */
    extensionId(extensionId, paramName = 'extensionId') {
        Validator.assertPattern(extensionId, ValidationPatterns.EXTENSION_ID, paramName);
    },

    /**
     * 验证配置键
     * @param {string} configKey - 配置键
     * @param {string} paramName - 参数名称
     */
    configKey(configKey, paramName = 'configKey') {
        Validator.assertPattern(configKey, ValidationPatterns.CONFIG_KEY, paramName);
    },

    /**
     * 验证音量值（0-1）
     * @param {number} volume - 音量值
     * @param {string} paramName - 参数名称
     */
    volume(volume, paramName = 'volume') {
        Validator.assertRange(volume, 0, 1, paramName);
    },

    /**
     * 验证时间值（秒，非负数）
     * @param {number} time - 时间值
     * @param {string} paramName - 参数名称
     */
    time(time, paramName = 'time') {
        Validator.assertNumber(time, paramName);
        if (time < 0) {
            throw new ValidationError(paramName, 'non-negative number', time);
        }
    }
};

export {Validator, ValidationPatterns, validate};
