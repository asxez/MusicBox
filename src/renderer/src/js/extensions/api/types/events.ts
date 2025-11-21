import {IDisposable} from "@extensions/core";

/**
 * 事件监听器回调函数类型
 */
export type EventCallback = (...args: any[]) => void;


export interface EventsAPI {
    /**
     * 监听事件
     * @param eventName - 事件名
     * @param callback - 回调函数
     * @returns 可释放对象
     */
    on(eventName: string, callback: EventCallback): IDisposable;

    /**
     * 监听一次性事件
     * @param eventName - 事件名
     * @param callback - 回调函数
     * @returns 可释放对象
     */
    once(eventName: string, callback: EventCallback): IDisposable;

    /**
     * 触发事件
     * @param eventName - 事件名
     * @param data - 数据
     * @returns undefined
     */
    emit(eventName: string, data?: any): void;

    /**
     * 移除事件监听器
     * @param eventName - 事件名
     * @param callback - 回调函数
     * @returns undefined
     */
    off(eventName: string, callback: EventCallback): void;

    /**
     * 移除所有事件监听器
     * @param eventName - 事件名，如果不提供则移除所有事件的监听器
     * @returns undefined
     */
    removeAllListeners(eventName?: string): void;
}
