/**
 * Lifecycle - 生命周期管理和资源清理
 * 参考 VSCode 的 Disposable 模式，提供统一的资源管理机制
 */

export interface IDisposable {
    dispose(): void;
}

/**
 * 表示可以被释放的对象
 */
export class Disposable implements IDisposable {
    protected _isDisposed = false;

    dispose(): void {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    static None: IDisposable = Object.freeze({
        dispose() {
        }
    });
}

type DisposableLike = IDisposable | (() => void);

/**
 * 管理多个 Disposable 对象的容器
 */
export class DisposableStore extends Disposable {
    private _disposables = new Set<DisposableLike>();

    add<T extends DisposableLike>(disposable: T): T {
        if (!disposable) {
            return disposable;
        }

        if (this._isDisposed) {
            console.warn('⚠️ DisposableStore: 尝试向已释放的 DisposableStore 添加资源');
            if (typeof disposable === 'function') {
                disposable();
            } else if ('dispose' in disposable) {
                disposable.dispose();
            }
            return disposable;
        }

        this._disposables.add(disposable);
        return disposable;
    }

    delete(disposable: DisposableLike): void {
        if (!disposable || !this._disposables.has(disposable)) {
            return;
        }

        this._disposables.delete(disposable);
        if (typeof disposable === 'function') {
            disposable();
        } else if ('dispose' in disposable) {
            disposable.dispose();
        }
    }

    clear(): void {
        this._disposables.clear();
    }

    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        super.dispose();

        for (const disposable of this._disposables) {
            try {
                if (typeof disposable === 'function') {
                    disposable();
                } else if ('dispose' in disposable) {
                    disposable.dispose();
                }
            } catch (error) {
                console.error('❌ DisposableStore: 释放资源时出错:', error);
            }
        }

        this._disposables.clear();
    }
}

export function toDisposable(fn: () => void): IDisposable {
    return {dispose: fn};
}

export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
    return toDisposable(() => {
        for (const disposable of disposables) {
            if (disposable?.dispose) {
                disposable.dispose();
            }
        }
    });
}

/**
 * 可释放的 Map
 */
export class DisposableMap<K, V extends IDisposable> extends Disposable {
    private _map = new Map<K, V>();

    set(key: K, value: V): void {
        if (this._map.has(key)) {
            const oldValue = this._map.get(key);
            oldValue?.dispose();
        }
        this._map.set(key, value);
    }

    get(key: K): V | undefined {
        return this._map.get(key);
    }

    has(key: K): boolean {
        return this._map.has(key);
    }

    delete(key: K): boolean {
        if (!this._map.has(key)) {
            return false;
        }

        const value = this._map.get(key);
        this._map.delete(key);
        value?.dispose();

        return true;
    }

    clear(): void {
        for (const value of this._map.values()) {
            value?.dispose();
        }
        this._map.clear();
    }

    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        super.dispose();
        this.clear();
    }

    keys(): IterableIterator<K> {
        return this._map.keys();
    }

    values(): IterableIterator<V> {
        return this._map.values();
    }

    entries(): IterableIterator<[K, V]> {
        return this._map.entries();
    }

    forEach(callback: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
        this._map.forEach(callback, thisArg);
    }

    get size(): number {
        return this._map.size;
    }
}

export function markAsDisposable<T extends object>(obj: T): T & IDisposable {
    if (!obj) {
        return obj as T & IDisposable;
    }

    const disposableObj = obj as any;
    if (!disposableObj.dispose) {
        disposableObj.dispose = function () {
            if (this._disposables && Array.isArray(this._disposables)) {
                for (const disposable of this._disposables) {
                    if (typeof disposable === 'function') {
                        disposable();
                    } else if (disposable?.dispose) {
                        disposable.dispose();
                    }
                }
                this._disposables = [];
            }
        };
    }

    return disposableObj;
}
