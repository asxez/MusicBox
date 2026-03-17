import {EventEmitter} from '@utils';
import {api} from "@api/api";

class Component extends EventEmitter {
    constructor(element = null, has = true) {
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

    show() {}
    hide() {}

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
        api.on(event, handler);
        // this.apiEventListeners.push({ event, handler });
        return () => this.removeAPIEventListenerManaged(event, handler);
    }

    // 移除特定API事件监听器
    removeAPIEventListenerManaged(event, handler) {
        api.off(event, handler);
        this.apiEventListeners = this.apiEventListeners.filter(
            listener => !(listener.event === event && listener.handler === handler)
        );
    }

    destroy() {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // 清理所有事件监听器
        this.removeAllListeners();

        // 清理所有API事件监听器
        this.removeAllAPIListeners();
    }

    removeAllListeners() {
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

    removeAllAPIListeners() {
        // 移除所有API事件监听器
        console.log(`🗑️ Component: 移除 ${this.apiEventListeners.length} 个API事件监听器`);
        this.apiEventListeners.forEach(({event, handler}) => {
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
}

export {Component};
