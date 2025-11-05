/**
 * Event - 增强的事件系统
 * 参考 VSCode 的 Event/Emitter 模式，提供类型安全和资源管理
 */

import {Disposable, DisposableStore, toDisposable} from "@js/plugin-system/core/Lifecycle";

/**
 * Emitter - 事件发射器
 * 用于创建和管理事件
 */
class Emitter extends Disposable {
    constructor(options = {}) {
        super();
        this._options = options;
        this._listeners = null;
        this._deliveryQueue = null;
        this._size = 0;
    }

    /**
     * 获取事件订阅函数
     */
    get event() {
        if (!this._event) {
            this._event = (callback, thisArgs, disposables) => {
                if (this._isDisposed) {
                    return Disposable.None;
                }

                // 首次添加监听器
                if (!this._listeners) {
                    this._listeners = [];
                    if (this._options.onWillAddFirstListener) {
                        this._options.onWillAddFirstListener(this);
                    }
                }

                const firstListener = this._listeners.length === 0;

                // 添加监听器
                const listener = {
                    callback,
                    thisArgs,
                    subscription: null
                };

                this._listeners.push(listener);
                this._size++;

                if (firstListener && this._options.onDidAddFirstListener) {
                    this._options.onDidAddFirstListener(this);
                }

                if (this._options.onDidAddListener) {
                    this._options.onDidAddListener(this, callback, thisArgs);
                }

                // 创建取消订阅函数
                const removeListener = () => {
                    if (!this._listeners) {
                        return;
                    }

                    const index = this._listeners.indexOf(listener);
                    if (index > -1) {
                        this._listeners.splice(index, 1);
                        this._size--;

                        if (this._options.onDidRemoveListener) {
                            this._options.onDidRemoveListener(this, callback, thisArgs);
                        }

                        if (this._listeners.length === 0) {
                            if (this._options.onDidRemoveLastListener) {
                                this._options.onDidRemoveLastListener(this);
                            }
                            this._listeners = null;
                        }
                    }
                };

                const result = toDisposable(removeListener);

                // 如果提供了 disposables 参数，添加到其中
                if (disposables instanceof DisposableStore) {
                    disposables.add(result);
                } else if (Array.isArray(disposables)) {
                    disposables.push(result);
                }

                return result;
            };
        }

        return this._event;
    }

    /**
     * 触发事件
     * @param {*} event 事件数据
     */
    fire(event) {
        if (this._listeners) {
            // 复制监听器列表，防止在回调中修改
            const listeners = [...this._listeners];

            for (const listener of listeners) {
                try {
                    if (listener.thisArgs) {
                        listener.callback.call(listener.thisArgs, event);
                    } else {
                        listener.callback(event);
                    }
                } catch (error) {
                    if (this._options.onListenerError) {
                        this._options.onListenerError(error);
                    } else {
                        console.error('❌ Emitter: 事件监听器执行出错:', error);
                    }
                }
            }
        }
    }

    /**
     * 检查是否有监听器
     */
    hasListeners() {
        return this._size > 0;
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();

        if (this._options.onWillDispose) {
            this._options.onWillDispose(this);
        }

        this._listeners = null;
        this._deliveryQueue = null;
        this._size = 0;
        this._event = null;
    }
}

/**
 * Event 命名空间 - 提供事件相关的工具函数
 */
const Event = {
    /**
     * 空事件
     */
    None: () => Disposable.None,

    /**
     * 将多个事件合并为一个
     * @param {...Function} events
     */
    any(...events) {
        return (listener, thisArgs, disposables) => {
            const disposableStore = new DisposableStore();

            for (const event of events) {
                disposableStore.add(event(e => listener.call(thisArgs, e)));
            }

            if (disposables instanceof DisposableStore) {
                disposables.add(disposableStore);
            } else if (Array.isArray(disposables)) {
                disposables.push(disposableStore);
            }

            return disposableStore;
        };
    },

    /**
     * 映射事件数据
     * @param {Function} event
     * @param {Function} map
     */
    map(event, map) {
        return (listener, thisArgs, disposables) => {
            return event(e => listener.call(thisArgs, map(e)), null, disposables);
        };
    },

    /**
     * 过滤事件
     * @param {Function} event
     * @param {Function} filter
     */
    filter(event, filter) {
        return (listener, thisArgs, disposables) => {
            return event(e => {
                if (filter(e)) {
                    listener.call(thisArgs, e);
                }
            }, null, disposables);
        };
    },

    /**
     * 只触发一次
     * @param {Function} event
     */
    once(event) {
        return (listener, thisArgs, disposables) => {
            let didFire = false;
            const result = event(e => {
                if (!didFire) {
                    didFire = true;
                    result.dispose();
                    return listener.call(thisArgs, e);
                }
            }, null, disposables);

            return result;
        };
    },

    /**
     * 防抖
     * @param {Function} event
     * @param {Number} delay
     */
    debounce(event, delay = 100) {
        return (listener, thisArgs, disposables) => {
            let timer = null;

            return event(e => {
                if (timer) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    timer = null;
                    listener.call(thisArgs, e);
                }, delay);
            }, null, disposables);
        };
    },

    /**
     * 从 DOM 事件创建
     * @param {Element} element
     * @param {String} eventName
     */
    fromDOMEvent(element, eventName) {
        const emitter = new Emitter({
            onWillAddFirstListener: () => {
                element.addEventListener(eventName, handler);
            },
            onDidRemoveLastListener: () => {
                element.removeEventListener(eventName, handler);
            }
        });

        const handler = (e) => emitter.fire(e);

        return emitter.event;
    },

    /**
     * 转换为 Promise
     * @param {Function} event
     */
    toPromise(event) {
        return new Promise(resolve => {
            const subscription = Event.once(event)(resolve);
        });
    }
};

/**
 * EventMultiplexer - 事件多路复用器
 * 将多个事件源合并为一个事件
 */
class EventMultiplexer extends Disposable {
    constructor() {
        super();
        this._emitter = new Emitter({
            onWillAddFirstListener: () => this._onFirstListenerAdd(),
            onDidRemoveLastListener: () => this._onLastListenerRemove()
        });
        this._hasListeners = false;
        this._events = [];
    }

    get event() {
        return this._emitter.event;
    }

    /**
     * 添加事件源
     * @param {Function} event
     */
    add(event) {
        const entry = {event, listener: null};
        this._events.push(entry);

        if (this._hasListeners) {
            this._hook(entry);
        }

        return toDisposable(() => {
            if (this._hasListeners) {
                this._unhook(entry);
            }

            const index = this._events.indexOf(entry);
            if (index > -1) {
                this._events.splice(index, 1);
            }
        });
    }

    _onFirstListenerAdd() {
        this._hasListeners = true;
        this._events.forEach(e => this._hook(e));
    }

    _onLastListenerRemove() {
        this._hasListeners = false;
        this._events.forEach(e => this._unhook(e));
    }

    _hook(entry) {
        entry.listener = entry.event(e => this._emitter.fire(e));
    }

    _unhook(entry) {
        if (entry.listener) {
            entry.listener.dispose();
            entry.listener = null;
        }
    }

    dispose() {
        super.dispose();
        this._emitter.dispose();
    }
}

export {
    Emitter,
    Event,
    EventMultiplexer
};
