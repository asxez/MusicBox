import {IDisposable} from "@extensions/core";

export interface SettingsChangeEvent {
    key: string;
    newValue: any;
    oldValue: any;
}

export interface SettingsAPI {
    /**
     * 获取设置
     */
    get<T = any>(key: string, defaultValue?: T): T;

    /**
     * 设置设置
     */
    set(key: string, value: any): Promise<void>;

    /**
     * 删除设置
     */
    delete(key: string): Promise<void>;

    /**
     * 检查设置是否存在
     */
    has(key: string): boolean;

    /**
     * 获取所有设置键
     */
    keys(): string[];

    /**
     * 监听设置变化
     */
    onDidChange(callback: (event: SettingsChangeEvent) => void): IDisposable;
}