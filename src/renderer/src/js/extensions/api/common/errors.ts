/**
 * 扩展 API 错误定义
 * 提供统一的错误类型和错误处理机制
 */

/**
 * 扩展 API 基础错误类
 */
export class ExtensionAPIError extends Error {
    code: string;
    timestamp: number;
    originalError?: Error;

    constructor(message: string, code: string) {
        super(message);
        this.name = 'ExtensionAPIError';
        this.code = code;
        this.timestamp = Date.now();
    }
}

/**
 * 参数验证错误
 */
export class ValidationError extends ExtensionAPIError {
    paramName: string;
    expectedType: string;
    actualValue: any;

    constructor(paramName: string, expectedType: string, actualValue: any) {
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
export class NotAvailableError extends ExtensionAPIError {
    feature: string;

    constructor(feature: string, reason = '功能未实现或不可用') {
        super(`${feature}: ${reason}`, 'NOT_AVAILABLE');
        this.feature = feature;
    }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends ExtensionAPIError {
    resourceType: string;
    resourceId: string;

    constructor(resourceType: string, resourceId: string) {
        super(`${resourceType} "${resourceId}" 未找到`, 'NOT_FOUND');
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

/**
 * 权限错误
 */
export class PermissionError extends ExtensionAPIError {
    action: string;

    constructor(action: string, reason = '权限不足') {
        super(`无法执行 "${action}": ${reason}`, 'PERMISSION_DENIED');
        this.action = action;
    }
}

/**
 * 操作超时错误
 */
export class TimeoutError extends ExtensionAPIError {
    operation: string;
    timeout: number;

    constructor(operation: string, timeout: number) {
        super(`操作 "${operation}" 超时 (${timeout}ms)`, 'TIMEOUT');
        this.operation = operation;
        this.timeout = timeout;
    }
}

/**
 * 冲突错误（例如：重复注册）
 */
export class ConflictError extends ExtensionAPIError {
    resourceType: string;
    resourceId: string;

    constructor(resourceType: string, resourceId: string) {
        super(`${resourceType} "${resourceId}" 已存在`, 'CONFLICT');
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}

/**
 * 状态错误（例如：在错误的状态下执行操作）
 */
export class StateError extends ExtensionAPIError {
    operation: string;
    currentState: string;
    expectedState: string;

    constructor(operation: string, currentState: string, expectedState: string) {
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
export const ErrorUtils = {
    /**
     * 包装异步操作，统一错误处理
     */
    async wrapAsync<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (error instanceof ExtensionAPIError) {
                throw error;
            }
            // 包装未知错误
            const wrappedError = new ExtensionAPIError(
                `${operationName} 失败: ${(error as Error).message}`,
                'UNKNOWN_ERROR'
            );
            wrappedError.originalError = error as Error;
            throw wrappedError;
        }
    },

    /**
     * 包装同步操作，统一错误处理
     */
    wrapSync<T>(fn: () => T, operationName: string): T {
        try {
            return fn();
        } catch (error) {
            if (error instanceof ExtensionAPIError) {
                throw error;
            }
            // 包装未知错误
            const wrappedError = new ExtensionAPIError(
                `${operationName} 失败: ${(error as Error).message}`,
                'UNKNOWN_ERROR'
            );
            wrappedError.originalError = error as Error;
            throw wrappedError;
        }
    },

    /**
     * 检查是否为扩展 API 错误
     */
    isExtensionAPIError(error: any): error is ExtensionAPIError {
        return error instanceof ExtensionAPIError;
    },

    /**
     * 格式化错误信息
     */
    formatError(error: Error): string {
        if (error instanceof ExtensionAPIError) {
            return `[${error.code}] ${error.message}`;
        }
        return error.message || String(error);
    }
};
