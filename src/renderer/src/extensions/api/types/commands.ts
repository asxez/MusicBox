import {IDisposable} from "@extensions/core";

/**
 * 命令选项接口
 */
export interface CommandOptions {
    /** 命令标题 */
    title?: string;
    /** 命令分类 */
    category?: string;
    /** 是否启用命令 */
    enabled?: boolean;
}

/**
 * 命令信息接口
 */
export interface CommandInfo {
    /** 命令 ID */
    id: string;
    /** 命令回调函数 */
    callback: (...args: any[]) => any;
    /** 命令标题 */
    title: string;
    /** 命令分类 */
    category: string;
    /** 是否启用 */
    enabled: boolean;
    /** 扩展 ID */
    extensionId: string;
}

/**
 * 公开的命令信息接口
 */
export interface PublicCommandInfo {
    /** 命令 ID */
    id: string;
    /** 命令标题 */
    title: string;
    /** 命令分类 */
    category: string;
    /** 是否启用 */
    enabled: boolean;
    /** 扩展 ID */
    extensionId: string;
}


/**
 * 命令 API 接口
 */
export interface CommandsAPI {
    /**
     * 注册命令
     * @param commandId - 命令 ID
     * @param callback - 回调函数
     * @param options - 命令选项
     * @returns 可释放对象
     */
    registerCommand(
        commandId: string,
        callback: (...args: any[]) => any,
        options?: CommandOptions
    ): IDisposable;

    /**
     * 执行命令
     * @param commandId - 命令 ID
     * @param args - 参数
     * @returns 命令执行结果
     */
    executeCommand(commandId: string, ...args: any[]): Promise<any>;

    /**
     * 获取所有已注册的命令
     * @returns 命令列表
     */
    getCommands(): PublicCommandInfo[];

    /**
     * 检查命令是否存在
     * @param commandId - 命令 ID
     * @returns 是否存在
     */
    hasCommand(commandId: string): boolean;

    /**
     * 启用命令
     * @param commandId - 命令 ID
     */
    enableCommand(commandId: string): void;

    /**
     * 禁用命令
     * @param commandId - 命令 ID
     */
    disableCommand(commandId: string): void;

    /**
     * 获取命令信息
     * @param commandId - 命令 ID
     * @returns 命令信息
     */
    getCommandInfo(commandId: string): PublicCommandInfo | null;
}
