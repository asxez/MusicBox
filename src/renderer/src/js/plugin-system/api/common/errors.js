/**
 * 扩展 API 错误定义
 * 提供统一的错误类型和错误处理机制
 */

/**
 * 扩展 API 基础错误类
 */
class ExtensionAPIError extends Error {
    /**
     * @param {string} message - 错误消息
     * @param {string} code - 错误代码
     */
    constructor(message, code) {
        super(message);
        this.name = 'ExtensionAPIError';
        this.code = code;
        this.timestamp = Date.now();
    }
}

/**
 * 参数验证错误
 */
class ValidationError extends ExtensionAPIError {
    /**
     * @param {string} paramName - 参数名称
     * @param {string} expectedType - 期望的类型
     * @param {*} actualValue - 实际值
     */
    constructor(paramName, expectedType, actualValue) {
        const message = `参数 "${paramName}" 验证失败: 期望 ${expectedType}, 实际收到 ${typeof actualValue}`;
        super(message, 'VALIDATION_ERROR');
        this.paramName = paramName;
        this.expectedType = expectedType;
        this.actualValue = actualValue;
    }
}

/**
 * 功能不可用错误
 */
class NotAvailableError extends ExtensionAPIError {
    /**
     * @param {string} feature - 功能名称
     * @param {string} reason - 不可用原因
     */
    constructor(feature, reason = '功能未实现或不可用') {
        super(`${feature}: ${reason}`, 'NOT_AVAILABLE');
        this.feature = feature;
    }
}

/**
 * 资源未找到错误
 */
class NotFoundError extends ExtensionAPIError {
    /**
     * @param {string} resourceType - 资源类型
     * @param {string} resourceId - 资源ID
     */
    constructor(resourceType, resourceId) {
        super(`${resourceType} "${resourceId}" 未找到`, 'NOT_FOUND');
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

/**
 * 权限错误
 */
class PermissionError extends ExtensionAPIError {
    /**
     * @param {string} action - 操作名称
     * @param {string} reason - 拒绝原因
     */
    constructor(action, reason = '权限不足') {
        super(`无法执行 "${action}": ${reason}`, 'PERMISSION_DENIED');
        this.action = action;
    }
}

/**
 * 操作超时错误
 */
class TimeoutError extends ExtensionAPIError {
    /**
     * @param {string} operation - 操作名称
     * @param {number} timeout - 超时时间（毫秒）
     */
    constructor(operation, timeout) {
        super(`操作 "${operation}" 超时 (${timeout}ms)`, 'TIMEOUT');
        this.operation = operation;
        this.timeout = timeout;
    }
}

/**
 * 冲突错误（例如：重复注册）
 */
class ConflictError extends ExtensionAPIError {
    /**
     * @param {string} resourceType - 资源类型
     * @param {string} resourceId - 资源ID
     */
    constructor(resourceType, resourceId) {
        super(`${resourceType} "${resourceId}" 已存在`, 'CONFLICT');
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

/**
 * 状态错误（例如：在错误的状态下执行操作）
 */
class StateError extends ExtensionAPIError {
    /**
     * @param {string} operation - 操作名称
     * @param {string} currentState - 当前状态
     * @param {string} expectedState - 期望状态
     */
    constructor(operation, currentState, expectedState) {
        super(
            `无法在状态 "${currentState}" 下执行 "${operation}", 期望状态: ${expectedState}`,
            'INVALID_STATE'
        );
        this.operation = operation;
        this.currentState = currentState;
        this.expectedState = expectedState;
    }
}

/**
 * 错误处理工具
 */
const ErrorUtils = {
    /**
     * 包装异步操作，统一错误处理
     * @param {Function} fn - 异步函数
     * @param {string} operationName - 操作名称
     * @returns {Promise<*>}
     */
    async wrapAsync(fn, operationName) {
        try {
            return await fn();
        } catch (error) {
            if (error instanceof ExtensionAPIError) {
                throw error;
            }
            // 包装未知错误
            const wrappedError = new ExtensionAPIError(
                `${operationName} 失败: ${error.message}`,
                'UNKNOWN_ERROR'
            );
            wrappedError.originalError = error;
            throw wrappedError;
        }
    },

    /**
     * 包装同步操作，统一错误处理
     * @param {Function} fn - 同步函数
     * @param {string} operationName - 操作名称
     * @returns {*}
     */
    wrapSync(fn, operationName) {
        try {
            return fn();
        } catch (error) {
            if (error instanceof ExtensionAPIError) {
                throw error;
            }
            // 包装未知错误
            const wrappedError = new ExtensionAPIError(
                `${operationName} 失败: ${error.message}`,
                'UNKNOWN_ERROR'
            );
            wrappedError.originalError = error;
            throw wrappedError;
        }
    },

    /**
     * 检查是否为扩展 API 错误
     * @param {*} error - 错误对象
     * @returns {boolean}
     */
    isExtensionAPIError(error) {
        return error instanceof ExtensionAPIError;
    },

    /**
     * 格式化错误信息
     * @param {Error} error - 错误对象
     * @returns {string}
     */
    formatError(error) {
        if (error instanceof ExtensionAPIError) {
            return `[${error.code}] ${error.message}`;
        }
        return error.message || String(error);
    }
};

export {
    ExtensionAPIError,
    ValidationError,
    NotAvailableError,
    NotFoundError,
    PermissionError,
    TimeoutError,
    ConflictError,
    StateError,
    ErrorUtils
};
