/**
 * 日志工具
 * 提供统一的日志记录机制，支持带 emoji 的分类日志
 */

/**
 * 日志级别
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

/**
 * 日志配置
 */
interface LoggerConfig {
    level: LogLevel;
    enableTimestamp: boolean;
    enableStackTrace: boolean;
}

/**
 * 日志器类
 */
export class Logger {
    private static config: LoggerConfig = {
        level: LogLevel.INFO,
        enableTimestamp: false,
        enableStackTrace: false
    };

    /**
     * 配置日志器
     */
    static configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前时间戳
     */
    private static getTimestamp(): string {
        const now = new Date();
        return now.toISOString();
    }

    /**
     * 格式化日志消息
     */
    private static formatMessage(emoji: string, category: string, message: string): string {
        let formatted = `${emoji} ${category}: ${message}`;
        if (this.config.enableTimestamp) {
            formatted = `[${this.getTimestamp()}] ${formatted}`;
        }
        return formatted;
    }

    /**
     * 通用日志方法
     */
    private static log(
        level: LogLevel,
        emoji: string,
        category: string,
        message: string,
        ...args: any[]
    ): void {
        if (level < this.config.level) {
            return;
        }

        const formatted = this.formatMessage(emoji, category, message);

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(formatted, ...args);
                break;
            case LogLevel.INFO:
                console.log(formatted, ...args);
                break;
            case LogLevel.WARN:
                console.warn(formatted, ...args);
                break;
            case LogLevel.ERROR:
                console.error(formatted, ...args);
                if (this.config.enableStackTrace) {
                    console.trace();
                }
                break;
        }
    }

    // ===== 通用日志方法 =====

    static debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, '🔍', 'DEBUG', message, ...args);
    }

    static info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, 'ℹ️', 'INFO', message, ...args);
    }

    static warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, '⚠️', 'WARN', message, ...args);
    }

    static error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, '❌', 'ERROR', message, ...args);
    }

    // ===== 特定分类的日志方法 =====

    /**
     * API 日志
     */
    static api(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '🔌', 'API', message, ...args);
    }

    /**
     * 音频引擎日志
     */
    static audio(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '🎵', 'Audio', message, ...args);
    }

    /**
     * 音频引擎错误日志
     */
    static audioError(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, '❌', 'Audio', message, ...args);
    }

    /**
     * 音频引擎成功日志
     */
    static audioSuccess(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '✅', 'Audio', message, ...args);
    }

    /**
     * 网络请求日志
     */
    static network(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '🌐', 'Network', message, ...args);
    }

    /**
     * 网络错误日志
     */
    static networkError(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, '🚫', 'Network', message, ...args);
    }

    /**
     * 文件系统日志
     */
    static file(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '📁', 'File', message, ...args);
    }

    /**
     * 歌词日志
     */
    static lyrics(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '📝', 'Lyrics', message, ...args);
    }

    /**
     * 封面日志
     */
    static cover(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '🖼️', 'Cover', message, ...args);
    }

    /**
     * 音乐库日志
     */
    static library(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '📚', 'Library', message, ...args);
    }

    /**
     * 缓存日志
     */
    static cache(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '💾', 'Cache', message, ...args);
    }

    /**
     * IPC 通信日志
     */
    static ipc(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, '🔄', 'IPC', message, ...args);
    }

    /**
     * 性能日志
     */
    static performance(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '⚡', 'Performance', message, ...args);
    }

    /**
     * 初始化日志
     */
    static init(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '🚀', 'Init', message, ...args);
    }

    /**
     * 成功日志
     */
    static success(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '✅', 'Success', message, ...args);
    }

    /**
     * 加载日志
     */
    static loading(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '⏳', 'Loading', message, ...args);
    }

    /**
     * 回退日志
     */
    static fallback(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, '🔄', 'Fallback', message, ...args);
    }

    /**
     * 跳过日志
     */
    static skip(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, '⏭️', 'Skip', message, ...args);
    }
}

/**
 * 性能计时器
 */
export class PerformanceTimer {
    private startTime: number;
    private label: string;

    constructor(label: string) {
        this.label = label;
        this.startTime = performance.now();
        Logger.performance(`开始: ${label}`);
    }

    /**
     * 结束计时并记录
     */
    end(): number {
        const duration = performance.now() - this.startTime;
        Logger.performance(`完成: ${this.label} (耗时 ${duration.toFixed(2)}ms)`);
        return duration;
    }

    /**
     * 记录检查点
     */
    checkpoint(checkpointLabel: string): number {
        const duration = performance.now() - this.startTime;
        Logger.performance(`检查点 [${this.label}]: ${checkpointLabel} (${duration.toFixed(2)}ms)`);
        return duration;
    }
}

/**
 * 便捷的性能测量装饰器
 */
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        const timer = new PerformanceTimer(`${target.constructor.name}.${propertyKey}`);
        try {
            const result = await originalMethod.apply(this, args);
            timer.end();
            return result;
        } catch (error) {
            timer.end();
            throw error;
        }
    };

    return descriptor;
}

/**
 * 便捷的错误捕获装饰器
 */
export function catchErrors(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            Logger.error(`${target.constructor.name}.${propertyKey} 执行失败:`, error);
            throw error;
        }
    };

    return descriptor;
}
