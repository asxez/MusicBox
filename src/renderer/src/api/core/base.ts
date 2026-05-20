/**
 * API 基础类
 * 所有 API 模块的基类，提供统一的功能和约定
 */

import {Logger} from "@api/core/logger";
import {ErrorUtils} from "@api/core/errors";

/**
 * API 基础配置
 */
export interface BaseAPIConfig {
    enableLogging?: boolean;
    enableErrorTracking?: boolean;
}

/**
 * API 基础类
 */
export abstract class BaseAPI {
    protected readonly name: string;
    protected config: BaseAPIConfig;

    constructor(name: string, config: BaseAPIConfig = {}) {
        this.name = name;
        this.config = {
            enableLogging: true,
            enableErrorTracking: true,
            ...config
        };
    }

    /**
     * 记录日志
     */
    protected log(message: string, ...args: any[]): void {
        if (this.config.enableLogging) {
            Logger.api(`[${this.name}] ${message}`, ...args);
        }
    }

    /**
     * 记录错误
     */
    protected logError(message: string, error?: Error, ...args: any[]): void {
        if (this.config.enableErrorTracking) {
            Logger.error(`[${this.name}] ${message}`, error, ...args);
            if (error) {
                ErrorUtils.logError(error, {api: this.name});
            }
        }
    }

    /**
     * 记录警告
     */
    protected logWarn(message: string, ...args: any[]): void {
        if (this.config.enableLogging) {
            Logger.warn(`[${this.name}] ${message}`, ...args);
        }
    }

    /**
     * 包装异步方法调用
     */
    protected async wrapAsync<T>(
        fn: () => Promise<T>,
        operationName: string,
        fallbackValue?: T
    ): Promise<T> {
        try {
            this.log(`开始: ${operationName}`);
            const result = await ErrorUtils.wrapAsync(fn, `${this.name}.${operationName}`);
            this.log(`完成: ${operationName}`);
            return result;
        } catch (error) {
            this.logError(`${operationName} 失败`, error as Error);

            if (fallbackValue !== undefined) {
                this.logWarn(`使用默认值: ${operationName}`);
                return fallbackValue;
            }

            throw error;
        }
    }

    /**
     * 包装同步方法调用
     */
    protected wrapSync<T>(
        fn: () => T,
        operationName: string,
        fallbackValue?: T
    ): T {
        try {
            this.log(`执行: ${operationName}`);
            const result = ErrorUtils.wrapSync(fn, `${this.name}.${operationName}`);
            this.log(`完成: ${operationName}`);
            return result;
        } catch (error) {
            this.logError(`${operationName} 失败`, error as Error);

            if (fallbackValue !== undefined) {
                this.logWarn(`使用默认值: ${operationName}`);
                return fallbackValue;
            }

            throw error;
        }
    }

    /**
     * 包装 IPC 调用
     */
    protected async wrapIPC<T>(
        fn: () => Promise<T>,
        channel: string,
        fallbackValue?: T
    ): Promise<T> {
        try {
            Logger.ipc(`调用: ${channel}`);
            const result = await ErrorUtils.wrapIPC(fn, channel, fallbackValue);
            Logger.ipc(`完成: ${channel}`);
            return result;
        } catch (error) {
            this.logError(`IPC 调用失败: ${channel}`, error as Error);
            throw error;
        }
    }

    /**
     * 获取 API 名称
     */
    getName(): string {
        return this.name;
    }

    /**
     * 获取 API 配置
     */
    getConfig(): Readonly<BaseAPIConfig> {
        return {...this.config};
    }

    /**
     * 更新 API 配置
     */
    updateConfig(config: Partial<BaseAPIConfig>): void {
        this.config = {...this.config, ...config};
    }
}

/**
 * 单例 API 基础类
 * 用于需要单例模式的 API
 */
export abstract class SingletonAPI extends BaseAPI {
    private static instances: Map<string, SingletonAPI> = new Map();

    protected constructor(name: string, config?: BaseAPIConfig) {
        super(name, config);
    }

    /**
     * 获取单例实例
     */
    protected static getInstance<T extends SingletonAPI>(
        this: new (name: string, config?: BaseAPIConfig) => T,
        name: string,
        config?: BaseAPIConfig
    ): T {
        const key = `${this.name}_${name}`;

        if (!SingletonAPI.instances.has(key)) {
            const instance = new this(name, config);
            SingletonAPI.instances.set(key, instance);
        }

        return SingletonAPI.instances.get(key) as T;
    }

    /**
     * 清除所有单例实例（主要用于测试）
     */
    static clearInstances(): void {
        SingletonAPI.instances.clear();
    }
}
