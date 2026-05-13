import {EventEmitter} from '@utils/index.js';
import {appEventController} from "@js/features/events";
import type {KnownEventName} from "@js/features/events";

type ManagedEventTarget = EventTarget & {
    addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean): void;
};

interface ManagedDOMListener {
    element: ManagedEventTarget;
    event: string;
    handler: EventListenerOrEventListenerObject;
    options?: AddEventListenerOptions | boolean;
}

interface ManagedAPIListener {
    event: KnownEventName;
    handler: (...args: any[]) => void;
}

class Component extends EventEmitter {
    public element: Element | null;
    protected isDestroyed: boolean;
    protected eventListeners: ManagedDOMListener[];
    protected apiEventListeners: ManagedAPIListener[];

    constructor(element: string | Element | null = null, has = true) {
        super();
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.isDestroyed = false;

        // 资源管理
        this.eventListeners = [];
        this.apiEventListeners = [];

        if (has && !this.element) {
            console.error('❌ Component element not found');
        }
    }

    show(..._args: any[]): any {}
    hide(..._args: any[]): any {}

    // 添加事件监听器
    addEventListenerManaged(
        element: ManagedEventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: AddEventListenerOptions | boolean
    ): () => void {
        element.addEventListener(event, handler, options);
        this.eventListeners.push({element, event, handler, options});
        return () => this.removeEventListenerManaged(element, event, handler);
    }

    // 移除特定事件监听器
    removeEventListenerManaged(
        element: ManagedEventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject
    ): void {
        element.removeEventListener(event, handler);
        this.eventListeners = this.eventListeners.filter(
            (listener) => !(listener.element === element && listener.event === event && listener.handler === handler)
        );
    }

    // 添加API事件监听器
    addAPIEventListenerManaged(event: KnownEventName, handler: (...args: any[]) => void): () => void {
        appEventController.on(event, handler as any);
        this.apiEventListeners.push({event, handler});
        return () => this.removeAPIEventListenerManaged(event, handler);
    }

    // 移除特定API事件监听器
    removeAPIEventListenerManaged(event: KnownEventName, handler: (...args: any[]) => void): void {
        appEventController.off(event, handler as any);
        this.apiEventListeners = this.apiEventListeners.filter(
            (listener) => !(listener.event === event && listener.handler === handler)
        );
    }

    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // 清理所有事件监听器
        this.removeAllListeners();

        // 清理所有API事件监听器
        this.removeAllAPIListeners();
    }

    removeAllListeners(): void {
        // 移除所有DOM事件监听器
        this.eventListeners.forEach(({element, event, handler}) => {
            try {
                element.removeEventListener(event, handler);
            } catch (error) {
                console.warn('⚠️ Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
    }

    removeAllAPIListeners(): void {
        // 移除所有API事件监听器
        console.log(`🗑️ Component: 移除 ${this.apiEventListeners.length} 个API事件监听器`);
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                console.log(`🗑️ Component: 移除API事件监听器 ${event}`);
                appEventController.off(event, handler as any);
            } catch (error) {
                console.warn('⚠️ Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners = [];
    }
}

export {Component};
