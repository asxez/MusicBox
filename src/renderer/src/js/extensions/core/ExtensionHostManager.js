/**
 * ExtensionHostManager - 扩展主机管理器
 * 参考 VSCode 的 ExtensionHostManager，管理扩展的隔离运行环境
 */

import {Disposable, DisposableStore} from "@extensions/core/Lifecycle";
import {Emitter} from "@extensions/core/Event";

/**
 * 扩展主机类型
 */
export const ExtensionHostKind = {
    LocalProcess: 'localProcess',      // 本地进程（未实现）
    LocalWebWorker: 'localWebWorker',  // Web Worker
    LocalIframe: 'localIframe',        // iframe 隔离
    LocalSandbox: 'localSandbox'       // 同进程沙箱（默认）
};

/**
 * 扩展主机状态
 */
export const ExtensionHostState = {
    Stopped: 0,
    Starting: 1,
    Running: 2,
    Stopping: 3,
    Crashed: 4
};

/**
 * 扩展主机 - 提供扩展运行的隔离环境
 */
export class ExtensionHost extends Disposable {
    constructor(kind, extensionService) {
        super();
        this.kind = kind;
        this.extensionService = extensionService;
        this.state = ExtensionHostState.Stopped;
        this._onDidExit = new Emitter();
        this._onDidChangeState = new Emitter();
        this._extensions = new Map();
        this._sandboxes = new Map();
    }

    /**
     * 主机退出事件
     */
    get onDidExit() {
        return this._onDidExit.event;
    }

    /**
     * 状态变化事件
     */
    get onDidChangeState() {
        return this._onDidChangeState.event;
    }

    /**
     * 启动扩展主机
     */
    async start() {
        if (this.state !== ExtensionHostState.Stopped) {
            throw new Error('ExtensionHost 已经启动');
        }

        this._setState(ExtensionHostState.Starting);

        try {
            await this._doStart();
            this._setState(ExtensionHostState.Running);
            console.log(`✅ ExtensionHost: 启动成功 (${this.kind})`);
        } catch (error) {
            this._setState(ExtensionHostState.Crashed);
            console.error('❌ ExtensionHost: 启动失败:', error);
            throw error;
        }
    }

    /**
     * 停止扩展主机
     */
    async stop() {
        if (this.state === ExtensionHostState.Stopped || this.state === ExtensionHostState.Stopping) {
            return;
        }

        this._setState(ExtensionHostState.Stopping);

        try {
            await this._doStop();
            this._setState(ExtensionHostState.Stopped);
            console.log(`✅ ExtensionHost: 停止成功 (${this.kind})`);
        } catch (error) {
            console.error('❌ ExtensionHost: 停止失败:', error);
            throw error;
        }
    }

    /**
     * 在主机中运行扩展
     */
    async runExtension(extensionId, extensionModule, context) {
        if (this.state !== ExtensionHostState.Running) {
            throw new Error('ExtensionHost 未运行');
        }

        try {
            // 根据主机类型选择运行方式
            switch (this.kind) {
                case ExtensionHostKind.LocalWebWorker:
                    return await this._runInWebWorker(extensionId, extensionModule, context);
                case ExtensionHostKind.LocalIframe:
                    return await this._runInIframe(extensionId, extensionModule, context);
                case ExtensionHostKind.LocalSandbox:
                default:
                    return await this._runInSandbox(extensionId, extensionModule, context);
            }
        } catch (error) {
            console.error(`❌ ExtensionHost: 运行扩展失败 ${extensionId}:`, error);
            throw error;
        }
    }

    /**
     * 执行启动逻辑
     */
    async _doStart() {
        // 子类实现
    }

    /**
     * 执行停止逻辑
     */
    async _doStop() {
        // 停用所有扩展
        for (const [extensionId, sandbox] of this._sandboxes) {
            try {
                await this._cleanupSandbox(extensionId, sandbox);
            } catch (error) {
                console.error(`❌ ExtensionHost: 清理沙箱失败 ${extensionId}:`, error);
            }
        }
        this._sandboxes.clear();
        this._extensions.clear();
    }

    /**
     * 在沙箱中运行扩展（默认方式）
     */
    async _runInSandbox(extensionId, extensionModule, context) {
        // 创建沙箱环境
        const sandbox = this._createSandbox(extensionId, context);
        this._sandboxes.set(extensionId, sandbox);

        try {
            // 在沙箱中执行 activate 函数
            const activate = extensionModule.activate;
            if (typeof activate !== 'function') {
                throw new Error('扩展缺少 activate 函数');
            }

            // 使用沙箱的 API 代理
            const result = await activate.call(sandbox.global, context);

            this._extensions.set(extensionId, {
                module: extensionModule,
                sandbox: sandbox,
                exports: result
            });

            return result;
        } catch (error) {
            // 清理失败的沙箱
            await this._cleanupSandbox(extensionId, sandbox);
            this._sandboxes.delete(extensionId);
            throw error;
        }
    }

    /**
     * 在 Web Worker 中运行扩展
     */
    async _runInWebWorker(extensionId, extensionModule, context) {
        // TODO: 实现 Web Worker 隔离
        console.warn('⚠️ ExtensionHost: Web Worker 模式尚未实现，回退到沙箱模式');
        return await this._runInSandbox(extensionId, extensionModule, context);
    }

    /**
     * 在 iframe 中运行扩展
     */
    async _runInIframe(extensionId, extensionModule, context) {
        // TODO: 实现 iframe 隔离
        console.warn('⚠️ ExtensionHost: iframe 模式尚未实现，回退到沙箱模式');
        return await this._runInSandbox(extensionId, extensionModule, context);
    }

    /**
     * 创建沙箱环境
     */
    _createSandbox(extensionId, context) {
        // 创建受限的全局对象
        const sandboxGlobal = Object.create(null);

        // 只暴露安全的全局对象
        const safeGlobals = [
            'console',
            'setTimeout',
            'setInterval',
            'clearTimeout',
            'clearInterval',
            'Promise',
            'Array',
            'Object',
            'String',
            'Number',
            'Boolean',
            'Date',
            'Math',
            'JSON',
            'RegExp',
            'Error',
            'Map',
            'Set',
            'WeakMap',
            'WeakSet'
        ];

        for (const name of safeGlobals) {
            if (typeof window[name] !== 'undefined') {
                sandboxGlobal[name] = window[name];
            }
        }

        // 添加扩展 API（通过 context）
        sandboxGlobal.musicbox = context.api || {};
        sandboxGlobal.extensionContext = context;

        return {
            extensionId,
            global: sandboxGlobal,
            disposables: new DisposableStore()
        };
    }

    /**
     * 清理沙箱
     */
    async _cleanupSandbox(extensionId, sandbox) {
        if (!sandbox) {
            return;
        }

        // 释放资源
        if (sandbox.disposables) {
            sandbox.disposables.dispose();
        }

        // 清空全局对象
        if (sandbox.global) {
            for (const key in sandbox.global) {
                delete sandbox.global[key];
            }
        }
    }

    /**
     * 停用扩展
     */
    async deactivateExtension(extensionId) {
        const extension = this._extensions.get(extensionId);
        if (!extension) {
            return;
        }

        try {
            // 调用 deactivate 函数
            if (extension.module && typeof extension.module.deactivate === 'function') {
                await extension.module.deactivate();
            }

            // 清理沙箱
            if (extension.sandbox) {
                await this._cleanupSandbox(extensionId, extension.sandbox);
            }

            this._extensions.delete(extensionId);
            this._sandboxes.delete(extensionId);
        } catch (error) {
            console.error(`❌ ExtensionHost: 停用扩展失败 ${extensionId}:`, error);
            throw error;
        }
    }

    /**
     * 设置状态
     */
    _setState(newState) {
        if (this.state === newState) {
            return;
        }

        const oldState = this.state;
        this.state = newState;
        this._onDidChangeState.fire({oldState, newState});
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();

        // 停止主机
        if (this.state === ExtensionHostState.Running) {
            this.stop().catch(error => {
                console.error('❌ ExtensionHost: 释放时停止失败:', error);
            });
        }

        this._onDidExit.dispose();
        this._onDidChangeState.dispose();
    }
}

/**
 * 扩展主机管理器 - 管理多个扩展主机
 */
export class ExtensionHostManager extends Disposable {
    constructor(extensionService) {
        super();
        this.extensionService = extensionService;
        this._hosts = new Map();
        this._defaultHostKind = ExtensionHostKind.LocalSandbox;
    }

    /**
     * 获取或创建扩展主机
     */
    getOrCreateHost(kind = this._defaultHostKind) {
        if (this._hosts.has(kind)) {
            return this._hosts.get(kind);
        }

        const host = new ExtensionHost(kind, this.extensionService);
        this._hosts.set(kind, host);
        return host;
    }

    /**
     * 启动所有主机
     */
    async startAll() {
        const promises = [];
        for (const host of this._hosts.values()) {
            if (host.state === ExtensionHostState.Stopped) {
                promises.push(host.start());
            }
        }
        await Promise.all(promises);
    }

    /**
     * 停止所有主机
     */
    async stopAll() {
        const promises = [];
        for (const host of this._hosts.values()) {
            if (host.state === ExtensionHostState.Running) {
                promises.push(host.stop());
            }
        }
        await Promise.all(promises);
    }

    /**
     * 释放资源
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        super.dispose();

        for (const host of this._hosts.values()) {
            host.dispose();
        }
        this._hosts.clear();
    }
}
