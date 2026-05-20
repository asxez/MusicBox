import {EventEmitter} from '@utils/index.js';
import {appEventService} from "@/features/events/service/AppEventService";
import type {KnownEventName} from "@/features/events/service/AppEventService";

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

type IdleCallbackHandle = number;

class Component extends EventEmitter {
    public element: Element | null;
    protected isDestroyed: boolean;
    protected eventListeners: ManagedDOMListener[];
    protected apiEventListeners: ManagedAPIListener[];
    private managedTimeouts: Set<ReturnType<typeof setTimeout>>;
    private managedIntervals: Set<ReturnType<typeof setInterval>>;
    private managedAnimationFrames: Set<number>;
    private managedIdleCallbacks: Set<IdleCallbackHandle>;
    private managedObjectUrls: Set<string>;

    constructor(element: string | Element | null = null, has = true) {
        super();
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.isDestroyed = false;

        // 资源管理
        this.eventListeners = [];
        this.apiEventListeners = [];
        this.managedTimeouts = new Set();
        this.managedIntervals = new Set();
        this.managedAnimationFrames = new Set();
        this.managedIdleCallbacks = new Set();
        this.managedObjectUrls = new Set();

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
        return () => this.removeEventListenerManaged(element, event, handler, options);
    }

    // 移除特定事件监听器
    removeEventListenerManaged(
        element: ManagedEventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: EventListenerOptions | boolean
    ): void {
        element.removeEventListener(event, handler, options);
        this.eventListeners = this.eventListeners.filter(
            (listener) => !(listener.element === element && listener.event === event && listener.handler === handler)
        );
    }

    // 添加API事件监听器
    addAPIEventListenerManaged(event: KnownEventName, handler: (...args: any[]) => void): () => void {
        appEventService.on(event, handler as any);
        this.apiEventListeners.push({event, handler});
        return () => this.removeAPIEventListenerManaged(event, handler);
    }

    // 移除特定API事件监听器
    removeAPIEventListenerManaged(event: KnownEventName, handler: (...args: any[]) => void): void {
        appEventService.off(event, handler as any);
        this.apiEventListeners = this.apiEventListeners.filter(
            (listener) => !(listener.event === event && listener.handler === handler)
        );
    }

    protected setTimeoutManaged(handler: () => void, timeout?: number): ReturnType<typeof setTimeout> {
        const timeoutId = setTimeout(() => {
            this.managedTimeouts.delete(timeoutId);
            if (!this.isDestroyed) {
                handler();
            }
        }, timeout);
        this.managedTimeouts.add(timeoutId);
        return timeoutId;
    }

    protected clearTimeoutManaged(timeoutId: ReturnType<typeof setTimeout> | null | undefined): void {
        if (!timeoutId) {
            return;
        }

        clearTimeout(timeoutId);
        this.managedTimeouts.delete(timeoutId);
    }

    protected setIntervalManaged(handler: () => void, timeout?: number): ReturnType<typeof setInterval> {
        const intervalId = setInterval(() => {
            if (this.isDestroyed) {
                this.clearIntervalManaged(intervalId);
                return;
            }
            handler();
        }, timeout);
        this.managedIntervals.add(intervalId);
        return intervalId;
    }

    protected clearIntervalManaged(intervalId: ReturnType<typeof setInterval> | null | undefined): void {
        if (!intervalId) {
            return;
        }

        clearInterval(intervalId);
        this.managedIntervals.delete(intervalId);
    }

    protected requestAnimationFrameManaged(handler: FrameRequestCallback): number {
        const frameId = requestAnimationFrame((time) => {
            this.managedAnimationFrames.delete(frameId);
            if (!this.isDestroyed) {
                handler(time);
            }
        });
        this.managedAnimationFrames.add(frameId);
        return frameId;
    }

    protected cancelAnimationFrameManaged(frameId: number | null | undefined): void {
        if (!frameId) {
            return;
        }

        cancelAnimationFrame(frameId);
        this.managedAnimationFrames.delete(frameId);
    }

    protected requestIdleCallbackManaged(handler: IdleRequestCallback, options?: IdleRequestOptions): IdleCallbackHandle | ReturnType<typeof setTimeout> {
        if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback((deadline) => {
                this.managedIdleCallbacks.delete(idleId);
                if (!this.isDestroyed) {
                    handler(deadline);
                }
            }, options);
            this.managedIdleCallbacks.add(idleId);
            return idleId;
        }

        return this.setTimeoutManaged(() => {
            handler({
                didTimeout: false,
                timeRemaining: () => 0
            });
        }, options?.timeout ?? 0);
    }

    protected cancelIdleCallbackManaged(callbackId: IdleCallbackHandle | ReturnType<typeof setTimeout> | null | undefined): void {
        if (!callbackId) {
            return;
        }

        if (this.managedIdleCallbacks.has(callbackId as IdleCallbackHandle)) {
            window.cancelIdleCallback(callbackId as IdleCallbackHandle);
            this.managedIdleCallbacks.delete(callbackId as IdleCallbackHandle);
            return;
        }

        this.clearTimeoutManaged(callbackId as ReturnType<typeof setTimeout>);
    }

    protected manageObjectUrl(url: string | null | undefined): string | null {
        if (!url) {
            return null;
        }

        if (url.startsWith('blob:')) {
            this.managedObjectUrls.add(url);
        }
        return url;
    }

    protected revokeObjectUrlManaged(url: string | null | undefined): void {
        if (!url || !this.managedObjectUrls.has(url)) {
            return;
        }

        URL.revokeObjectURL(url);
        this.managedObjectUrls.delete(url);
    }

    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // 清理所有事件监听器
        this.removeAllDOMListeners();

        // 清理所有API事件监听器
        this.removeAllAPIListeners();

        // 清理组件托管的异步资源
        this.removeAllManagedResources();

        // 清理组件自身 EventEmitter 订阅
        super.removeAllListeners();
    }

    removeAllDOMListeners(): void {
        // 移除所有DOM事件监听器
        this.eventListeners.forEach(({element, event, handler, options}) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn('⚠️ Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
    }

    removeAllManagedResources(): void {
        this.managedTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
        this.managedTimeouts.clear();

        this.managedIntervals.forEach((intervalId) => clearInterval(intervalId));
        this.managedIntervals.clear();

        this.managedAnimationFrames.forEach((frameId) => cancelAnimationFrame(frameId));
        this.managedAnimationFrames.clear();

        this.managedIdleCallbacks.forEach((idleId) => window.cancelIdleCallback(idleId));
        this.managedIdleCallbacks.clear();

        this.managedObjectUrls.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                console.warn('⚠️ Failed to revoke object URL:', error);
            }
        });
        this.managedObjectUrls.clear();
    }

    removeAllListeners(eventName?: string): void {
        super.removeAllListeners(eventName);
    }

    removeAllAPIListeners(): void {
        // 移除所有API事件监听器
        console.log(`🗑️ Component: 移除 ${this.apiEventListeners.length} 个API事件监听器`);
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                console.log(`🗑️ Component: 移除API事件监听器 ${event}`);
                appEventService.off(event, handler as any);
            } catch (error) {
                console.warn('⚠️ Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners = [];
    }
}

export {Component};
