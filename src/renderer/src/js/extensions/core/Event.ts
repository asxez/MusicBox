/**
 * Event - 增强的事件系统
 * 参考 VSCode 的 Event/Emitter 模式，提供类型安全和资源管理
 */

import {Disposable, DisposableStore, IDisposable, toDisposable} from '@extensions/core/Lifecycle';

export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore): IDisposable;
}

interface EmitterOptions {
    onWillAddFirstListener?: (emitter: Emitter<any>) => void;
    onDidAddFirstListener?: (emitter: Emitter<any>) => void;
    onDidAddListener?: (emitter: Emitter<any>, listener: Function, thisArgs?: any) => void;
    onDidRemoveListener?: (emitter: Emitter<any>, listener: Function, thisArgs?: any) => void;
    onDidRemoveLastListener?: (emitter: Emitter<any>) => void;
    onWillDispose?: (emitter: Emitter<any>) => void;
    onListenerError?: (error: any) => void;
}

interface Listener<T> {
    callback: (e: T) => any;
    thisArgs?: any;
    subscription: IDisposable | null;
}

/**
 * Emitter - 事件发射器
 */
export class Emitter<T> extends Disposable {
    private _options: EmitterOptions;
    private _listeners: Listener<T>[] | null = null;
    // private _deliveryQueue: any = null;
    private _size = 0;
    private _event?: Event<T>;

    constructor(options: EmitterOptions = {}) {
        super();
        this._options = options;
    }

    get event(): Event<T> {
        if (!this._event) {
            this._event = (callback: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
                if (this._isDisposed) {
                    return Disposable.None;
                }

                if (!this._listeners) {
                    this._listeners = [];
                    if (this._options.onWillAddFirstListener) {
                        this._options.onWillAddFirstListener(this);
                    }
                }

                const firstListener = this._listeners.length === 0;

                const listener: Listener<T> = {
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

    fire(event: T): void {
        if (this._listeners) {
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

    hasListeners(): boolean {
        return this._size > 0;
    }

    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        super.dispose();

        if (this._options.onWillDispose) {
            this._options.onWillDispose(this);
        }

        this._listeners = null;
        // this._deliveryQueue = null;
        this._size = 0;
        this._event = undefined;
    }
}

export namespace Event {
    export const None: Event<any> = () => Disposable.None;

    export function any<T>(...events: Event<T>[]): Event<T> {
        return (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
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
    }

    export function map<I, O>(event: Event<I>, map: (i: I) => O): Event<O> {
        return (listener: (e: O) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
            return event(e => listener.call(thisArgs, map(e)), null, disposables);
        };
    }

    export function filter<T>(event: Event<T>, filter: (e: T) => boolean): Event<T> {
        return (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
            return event(e => {
                if (filter(e)) {
                    listener.call(thisArgs, e);
                }
            }, null, disposables);
        };
    }

    export function once<T>(event: Event<T>): Event<T> {
        return (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
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
    }

    export function debounce<T>(event: Event<T>, delay = 100): Event<T> {
        return (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
            let timer: ReturnType<typeof setTimeout> | null = null;

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
    }

    export function fromDOMEvent<T extends Event<T>>(element: HTMLElement | Window | Document, eventName: string): Event<T> {
        const emitter = new Emitter<T>({
            onWillAddFirstListener: () => {
                element.addEventListener(eventName, handler as EventListener);
            },
            onDidRemoveLastListener: () => {
                element.removeEventListener(eventName, handler as EventListener);
            }
        });

        const handler = (e: any) => emitter.fire(e);

        return emitter.event;
    }

    export function toPromise<T>(event: Event<T>): Promise<T> {
        return new Promise(resolve => {
            once(event)(resolve);
        });
    }
}

/**
 * EventMultiplexer - 事件多路复用器
 */
export class EventMultiplexer<T> extends Disposable {
    private _emitter: Emitter<T>;
    private _hasListeners = false;
    private _events: Array<{ event: Event<T>; listener: IDisposable | null }> = [];

    constructor() {
        super();
        this._emitter = new Emitter<T>({
            onWillAddFirstListener: () => this._onFirstListenerAdd(),
            onDidRemoveLastListener: () => this._onLastListenerRemove()
        });
    }

    get event(): Event<T> {
        return this._emitter.event;
    }

    add(event: Event<T>): IDisposable {
        const entry = {event, listener: null as IDisposable | null};
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

    private _onFirstListenerAdd(): void {
        this._hasListeners = true;
        this._events.forEach(e => this._hook(e));
    }

    private _onLastListenerRemove(): void {
        this._hasListeners = false;
        this._events.forEach(e => this._unhook(e));
    }

    private _hook(entry: { event: Event<T>; listener: IDisposable | null }): void {
        entry.listener = entry.event(e => this._emitter.fire(e));
    }

    private _unhook(entry: { event: Event<T>; listener: IDisposable | null }): void {
        if (entry.listener) {
            entry.listener.dispose();
            entry.listener = null;
        }
    }

    dispose(): void {
        super.dispose();
        this._emitter.dispose();
    }
}
