/**
 * Lifecycle - 生命周期管理和资源清理
 * 参考 VSCode 的 Disposable 模式，提供统一的资源管理机制
 */

/**
 * 表示可以被释放的对象
 */
class Disposable {
    constructor() {
        this._isDisposed = false;
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
    }

    /**
     * 检查是否已释放
     */
    get isDisposed() {
        return this._isDisposed;
    }

    /**
     * 静态方法：创建一个空的 Disposable
     */
    static None = Object.freeze({
        dispose() {
        }
    });
}

/**
 * 管理多个 Disposable 对象的容器
 */
class DisposableStore extends Disposable {
    constructor() {
        super();
        this._disposables = new Set();
    }

    /**
     * 添加一个 Disposable 对象
     * @param {Disposable|Function} disposable
     * @returns {Disposable|Function}
     */
    add(disposable) {
        if (!disposable) {
            return disposable;
        }

        if (this._isDisposed) {
            console.warn('⚠️ DisposableStore: 尝试向已释放的 DisposableStore 添加资源');
            // 立即释放
            if (typeof disposable.dispose === 'function') {
                disposable.dispose();
            } else if (typeof disposable === 'function') {
                disposable();
            }
            return disposable;
        }

        this._disposables.add(disposable);
        return disposable;
    }

    /**
     * 删除并释放一个 Disposable 对象
     * @param {Disposable|Function} disposable
     */
    delete(disposable) {
        if (!disposable || !this._disposables.has(disposable)) {
            return;
        }

        this._disposables.delete(disposable);
        if (typeof disposable.dispose === 'function') {
            disposable.dispose();
        } else if (typeof disposable === 'function') {
            disposable();
        }
    }

    /**
     * 清空所有 Disposable 对象但不释放它们
     */
    clear() {
        this._disposables.clear();
    }

    /**
     * 释放所有资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();

        // 释放所有资源
        for (const disposable of this._disposables) {
            try {
                if (typeof disposable.dispose === 'function') {
                    disposable.dispose();
                } else if (typeof disposable === 'function') {
                    disposable();
                }
            } catch (error) {
                console.error('❌ DisposableStore: 释放资源时出错:', error);
            }
        }

        this._disposables.clear();
    }
}

/**
 * 创建一个 Disposable 对象
 * @param {Function} fn 释放时调用的函数
 * @returns {Disposable}
 */
function toDisposable(fn) {
    return {
        dispose: fn
    };
}

/**
 * 组合多个 Disposable 对象
 * @param {...Disposable} disposables
 * @returns {Disposable}
 */
function combinedDisposable(...disposables) {
    return toDisposable(() => {
        for (const disposable of disposables) {
            if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose();
            }
        }
    });
}

/**
 * 可释放的 Map
 */
class DisposableMap extends Disposable {
    constructor() {
        super();
        this._map = new Map();
    }

    /**
     * 设置键值对
     * @param {*} key
     * @param {Disposable} value
     */
    set(key, value) {
        // 如果已存在，先释放旧值
        if (this._map.has(key)) {
            const oldValue = this._map.get(key);
            if (oldValue && typeof oldValue.dispose === 'function') {
                oldValue.dispose();
            }
        }
        this._map.set(key, value);
    }

    /**
     * 获取值
     * @param {*} key
     */
    get(key) {
        return this._map.get(key);
    }

    /**
     * 检查是否存在
     * @param {*} key
     */
    has(key) {
        return this._map.has(key);
    }

    /**
     * 删除并释放
     * @param {*} key
     */
    delete(key) {
        if (!this._map.has(key)) {
            return false;
        }

        const value = this._map.get(key);
        this._map.delete(key);

        if (value && typeof value.dispose === 'function') {
            value.dispose();
        }

        return true;
    }

    /**
     * 清空
     */
    clear() {
        for (const value of this._map.values()) {
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        }
        this._map.clear();
    }

    /**
     * 释放所有资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();
        this.clear();
    }

    /**
     * 获取所有键
     */
    keys() {
        return this._map.keys();
    }

    /**
     * 获取所有值
     */
    values() {
        return this._map.values();
    }

    /**
     * 获取所有条目
     */
    entries() {
        return this._map.entries();
    }

    /**
     * 遍历
     */
    forEach(callback, thisArg) {
        this._map.forEach(callback, thisArg);
    }

    /**
     * 获取大小
     */
    get size() {
        return this._map.size;
    }
}

/**
 * 标记为可释放的对象
 * @param {Object} obj
 * @returns {Object}
 */
function markAsDisposable(obj) {
    if (!obj) {
        return obj;
    }

    if (!obj.dispose) {
        obj.dispose = function () {
            // 默认的释放逻辑
            if (this._disposables && Array.isArray(this._disposables)) {
                for (const disposable of this._disposables) {
                    if (disposable && typeof disposable.dispose === 'function') {
                        disposable.dispose();
                    } else if (typeof disposable === 'function') {
                        disposable();
                    }
                }
                this._disposables = [];
            }
        };
    }

    return obj;
}

export {
    Disposable,
    DisposableStore,
    DisposableMap,
    toDisposable,
    combinedDisposable,
    markAsDisposable,
};
