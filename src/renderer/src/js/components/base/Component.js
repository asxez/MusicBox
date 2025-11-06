import {EventEmitter} from '@js/utils';
import {api} from "@js/api";

class Component extends EventEmitter {
    constructor(element=null, has=true) {
        super();
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.isDestroyed = false;

        // 资源管理
        this.eventListeners = [];
        this.apiEventListeners = [];
        this.timers = [];
        this.observers = [];
        this.disposables = [];

        if (has && !this.element) {
            console.error('❌ Component element not found');
        }

        // this.init();
    }

    // init() {
    //     // 子类实现
    // }

    // 添加事件监听器
    addEventListenerManaged(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        // this.eventListeners.push({ element, event, handler, options });
        return () => this.removeEventListenerManaged(element, event, handler);
    }

    // 移除特定事件监听器
    removeEventListenerManaged(element, event, handler) {
        element.removeEventListener(event, handler);
        this.eventListeners = this.eventListeners.filter(
            listener => !(listener.element === element && listener.event === event && listener.handler === handler)
        );
    }

    // 添加API事件监听器
    addAPIEventListenerManaged(event, handler) {
        if (typeof api !== 'undefined' && api && api.on) {
            api.on(event, handler);
            // this.apiEventListeners.push({ event, handler });
        } else {
            console.warn(`⚠️ Component: API对象不可用，无法添加事件监听器 ${event}`);
        }
        return () => this.removeAPIEventListenerManaged(event, handler);
    }

    // 移除特定API事件监听器
    removeAPIEventListenerManaged(event, handler) {
        if (typeof api !== 'undefined' && api.off) {
            api.off(event, handler);
        }
        this.apiEventListeners = this.apiEventListeners.filter(
            listener => !(listener.event === event && listener.handler === handler)
        );
    }

    // 添加定时器
    addTimerManaged(timerId) {
        this.timers.push(timerId);
        return timerId;
    }

    // 添加观察者
    addObserverManaged(observer) {
        this.observers.push(observer);
        return observer;
    }

    // 添加可清理资源
    addDisposable(disposable) {
        this.disposables.push(disposable);
    }

    destroy() {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // 清理所有事件监听器
        this.removeAllListeners();

        // 清理所有API事件监听器
        this.removeAllAPIListeners();

        // 清理定时器
        this.clearAllTimers();

        // 清理观察者
        this.disconnectAllObservers();

        // 清理其他资源
        this.disposeAllResources();
    }

    removeAllListeners() {
        // 移除所有DOM事件监听器
        this.eventListeners.forEach(({ element, event, handler }) => {
            try {
                element.removeEventListener(event, handler);
            } catch (error) {
                console.warn('⚠️ Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
    }

    removeAllAPIListeners() {
        // 移除所有API事件监听器
        console.log(`🗑️ Component: 移除 ${this.apiEventListeners.length} 个API事件监听器`);
        this.apiEventListeners.forEach(({ event, handler }) => {
            try {
                if (typeof api !== 'undefined' && api && api.off) {
                    console.log(`🗑️ Component: 移除API事件监听器 ${event}`);
                    api.off(event, handler);
                }
            } catch (error) {
                console.warn('⚠️ Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners = [];
    }

    clearAllTimers() {
        // 清理所有定时器
        this.timers.forEach(timerId => {
            try {
                clearTimeout(timerId);
                clearInterval(timerId);
            } catch (error) {
                console.warn('Failed to clear timer:', error);
            }
        });
        this.timers = [];
    }

    disconnectAllObservers() {
        // 断开所有观察者
        this.observers.forEach(observer => {
            try {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            } catch (error) {
                console.warn('⚠️ Failed to disconnect observer:', error);
            }
        });
        this.observers = [];
    }

    disposeAllResources() {
        // 清理其他资源
        this.disposables.forEach(disposable => {
            try {
                if (typeof disposable === 'function') {
                    disposable();
                } else if (disposable && typeof disposable.dispose === 'function') {
                    disposable.dispose();
                }
            } catch (error) {
                console.warn('⚠️ Failed to dispose resource:', error);
            }
        });
        this.disposables = [];
    }
}

export { Component };
