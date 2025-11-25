/**
 * API 错误定义
 * 提供统一的错误类型和错误处理机制
 */

/**
 * API 基础错误类
 */
export class APIError extends Error {
    code: string;
    timestamp: number;
    originalError?: Error;
    context?: Record<string, any>;

    constructor(message: string, code: string, context?: Record<string, any>) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.timestamp = Date.now();
        this.context = context;

        // 保持正确的原型链
        Object.setPrototypeOf(this, APIError.prototype);
    }
}

/**
 * 参数验证错误
 */
export class ValidationError extends APIError {
    paramName: string;
    expectedType: string;
    actualValue: any;

    constructor(paramName: string, expectedType: string, actualValue: any) {
        const message = `参数 "${paramName}" 验证失败: 期望 ${expectedType}, 实际收到 ${typeof actualValue}`;
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.paramName = paramName;
        this.expectedType = expectedType;
        this.actualValue = actualValue;

        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * 网络错误
 */
export class NetworkError extends APIError {
    url: string;
    statusCode?: number;
    retryCount?: number;

    constructor(message: string, url: string, statusCode?: number, retryCount?: number) {
        super(message, 'NETWORK_ERROR', { url, statusCode, retryCount });
        this.name = 'NetworkError';
        this.url = url;
        this.statusCode = statusCode;
        this.retryCount = retryCount;

        Object.setPrototypeOf(this, NetworkError.prototype);
    }
}

/**
 * IPC 通信错误
 */
export class IPCError extends APIError {
    channel: string;

    constructor(message: string, channel: string) {
        super(message, 'IPC_ERROR', { channel });
        this.name = 'IPCError';
        this.channel = channel;

        Object.setPrototypeOf(this, IPCError.prototype);
    }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends APIError {
    resourceType: string;
    resourceId: string;

    constructor(resourceType: string, resourceId: string) {
        super(`${resourceType} "${resourceId}" 未找到`, 'NOT_FOUND');
        this.name = 'NotFoundError';
        this.resourceType = resourceType;
        this.resourceId = resourceId;

        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * 功能不可用错误
 */
export class NotAvailableError extends APIError {
    feature: string;

    constructor(feature: string, reason = '功能未实现或不可用') {
        super(`${feature}: ${reason}`, 'NOT_AVAILABLE');
        this.name = 'NotAvailableError';
        this.feature = feature;

        Object.setPrototypeOf(this, NotAvailableError.prototype);
    }
}

/**
 * 操作超时错误
 */
export class TimeoutError extends APIError {
    operation: string;
    timeout: number;

    constructor(operation: string, timeout: number) {
        super(`操作 "${operation}" 超时 (${timeout}ms)`, 'TIMEOUT');
        this.name = 'TimeoutError';
        this.operation = operation;
        this.timeout = timeout;

        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends APIError {
    path: string;
    operation: string;

    constructor(message: string, path: string, operation: string) {
        super(message, 'FILE_SYSTEM_ERROR', { path, operation });
        this.name = 'FileSystemError';
        this.path = path;
        this.operation = operation;

        Object.setPrototypeOf(this, FileSystemError.prototype);
    }
}

/**
 * 音频引擎错误
 */
export class AudioEngineError extends APIError {
    engineType?: string;

    constructor(message: string, engineType?: string) {
        super(message, 'AUDIO_ENGINE_ERROR', { engineType });
        this.name = 'AudioEngineError';
        this.engineType = engineType;

        Object.setPrototypeOf(this, AudioEngineError.prototype);
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
            if (error instanceof APIError) {
                throw error;
            }
            // 包装未知错误
            const wrappedError = new APIError(
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
            if (error instanceof APIError) {
                throw error;
            }
            // 包装未知错误
            const wrappedError = new APIError(
                `${operationName} 失败: ${(error as Error).message}`,
                'UNKNOWN_ERROR'
            );
            wrappedError.originalError = error as Error;
            throw wrappedError;
        }
    },

    /**
     * 包装 IPC 调用
     */
    async wrapIPC<T>(
        fn: () => Promise<T>,
        channel: string,
        fallbackValue?: T
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            const ipcError = new IPCError(
                `IPC 调用失败: ${(error as Error).message}`,
                channel
            );
            ipcError.originalError = error as Error;

            if (fallbackValue !== undefined) {
                console.error(`❌ ${ipcError.message}，使用默认值`);
                return fallbackValue;
            }

            throw ipcError;
        }
    },

    /**
     * 检查是否为 API 错误
     */
    isAPIError(error: any): error is APIError {
        return error instanceof APIError;
    },

    /**
     * 格式化错误信息
     */
    formatError(error: Error): string {
        if (error instanceof APIError) {
            let msg = `[${error.code}] ${error.message}`;
            if (error.context && Object.keys(error.context).length > 0) {
                msg += ` | Context: ${JSON.stringify(error.context)}`;
            }
            return msg;
        }
        return error.message || String(error);
    },

    /**
     * 记录错误
     */
    logError(error: Error, context?: Record<string, any>): void {
        if (error instanceof APIError) {
            console.error(`❌ [${error.code}] ${error.message}`, {
                timestamp: error.timestamp,
                context: error.context,
                originalError: error.originalError,
                additionalContext: context
            });
        } else {
            console.error('❌ 未知错误:', error, context);
        }
    }
};
