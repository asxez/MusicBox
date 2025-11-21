import {KeybindingScope, KeybindingWhen} from "@extensions/api";
import {IDisposable} from "@extensions/core";

export type KeybindingScopeType = typeof KeybindingScope[keyof typeof KeybindingScope];
export type KeybindingWhenType = typeof KeybindingWhen[keyof typeof KeybindingWhen];

/**
 * 快捷键注册选项
 */
export interface KeybindingOptions {
    /** 关联的命令ID */
    commandId?: string;
    /** 上下文条件 */
    when?: KeybindingWhenType;
    /** 描述 */
    description?: string;
    /** 快捷键ID（用于全局快捷键） */
    id?: string;
    /** 名称（用于全局快捷键） */
    name?: string;
}

/**
 * 快捷键信息
 */
export interface KeybindingInfo {
    /** 快捷键组合 */
    keybinding: string;
    /** 回调函数 */
    callback: () => void | Promise<void>;
    /** 作用域 */
    scope: KeybindingScopeType;
    /** 关联的命令ID */
    commandId: string | null;
    /** 描述 */
    description: string;
    /** 上下文条件 */
    when: KeybindingWhenType;
    /** 扩展ID */
    extensionId: string;
    /** 全局事件处理器 */
    globalEventHandler?: (event: CustomEvent) => void;
}

/**
 * 快捷键信息（返回给用户）
 */
export interface PublicKeybindingInfo {
    /** 快捷键组合 */
    keybinding: string;
    /** 作用域 */
    scope: KeybindingScopeType;
    /** 关联的命令ID */
    commandId: string | null;
    /** 描述 */
    description: string;
    /** 上下文条件（仅局部快捷键有） */
    when?: KeybindingWhenType;
    /** 扩展ID */
    extensionId: string;
}

/**
 * 全局快捷键配置
 */
export interface GlobalShortcutConfig {
    id: string;
    name: string;
    description: string;
    key: string;
    enabled: boolean;
}

/**
 * 快捷键 API
 */
export interface KeybindingsAPI {
    /**
     * 注册局部快捷键
     * @param keybinding - 快捷键组合（如 'Ctrl+Shift+P'）
     * @param callback - 回调函数
     * @param options - 选项
     * @returns 可释放对象
     */
    registerKeybinding(
        keybinding: string,
        callback: () => void | Promise<void>,
        options?: KeybindingOptions
    ): Promise<IDisposable>;

    /**
     * 注册全局快捷键
     * @param keybinding - 快捷键组合（如 'Alt+Ctrl+P'）
     * @param callback - 回调函数
     * @param options - 选项
     * @returns 可释放对象
     */
    registerGlobalKeybinding(
        keybinding: string,
        callback: () => void | Promise<void>,
        options?: KeybindingOptions
    ): Promise<IDisposable>;

    /**
     * 注销快捷键
     * @param keybinding - 快捷键组合
     * @param scope - 作用域
     */
    unregisterKeybinding(keybinding: string, scope?: KeybindingScopeType): Promise<void>;

    /**
     * 获取所有已注册的快捷键
     * @param scope - 作用域过滤（可选）
     * @returns 快捷键列表
     */
    getKeybindings(scope?: KeybindingScopeType): PublicKeybindingInfo[];

    /**
     * 检查快捷键是否已注册
     * @param keybinding - 快捷键组合
     * @param scope - 作用域
     * @returns 是否已注册
     */
    hasKeybinding(keybinding: string, scope?: KeybindingScopeType): boolean;

    /**
     * 获取快捷键信息
     * @param keybinding - 快捷键组合
     * @param scope - 作用域
     * @returns 快捷键信息
     */
    getKeybindingInfo(keybinding: string, scope?: KeybindingScopeType): PublicKeybindingInfo | null;

    /**
     * 模拟触发快捷键
     * @param keybinding - 快捷键组合
     * @param scope - 作用域
     * @returns 执行结果
     */
    triggerKeybinding(keybinding: string, scope?: KeybindingScopeType): Promise<any>;
}
