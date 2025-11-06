/**
 * ExtensionActivator - 扩展激活器
 * 参考 VSCode 的扩展激活机制，管理扩展的生命周期
 */

import {cacheManager} from "@services/CacheManager";
import {Disposable, DisposableStore} from "@extensions/core/Lifecycle";
import {createExtensionAPI} from "@extensions/api/index.js";

/**
 * 扩展激活时间记录
 */
class ExtensionActivationTimes {
    constructor(startup, codeLoadingTime, activateCallTime, activateResolvedTime) {
        this.startup = startup;
        this.codeLoadingTime = codeLoadingTime;
        this.activateCallTime = activateCallTime;
        this.activateResolvedTime = activateResolvedTime;
    }

    static NONE = new ExtensionActivationTimes(false, -1, -1, -1);
}

/**
 * 扩展激活原因
 */
class ExtensionActivationReason {
    constructor(startup, extensionId, activationEvent) {
        this.startup = startup;
        this.extensionId = extensionId;
        this.activationEvent = activationEvent;
    }
}

/**
 * 已激活的扩展
 */
class ActivatedExtension {
    constructor(activationFailed, activationTimes, module, exports, subscriptions) {
        this.activationFailed = activationFailed;
        this.activationTimes = activationTimes;
        this.module = module;
        this.exports = exports;
        this.subscriptions = subscriptions;
    }
}

/**
 * 扩展激活器
 */
class ExtensionActivator extends Disposable {
    constructor(registry, instantiationService, permissionManager = null, configurationManager = null) {
        super();
        this._registry = registry;
        this._instantiationService = instantiationService;
        this._permissionManager = permissionManager;
        this._configurationManager = configurationManager;
        this._activatedExtensions = new Map();
        this._activatingExtensions = new Map();
        this._alreadyActivatedEvents = {};

        // 将 createExtensionAPI 注入到全局环境，供插件代码使用
        // 解决 ES 模块迁移后，插件代码无法访问模块导出的问题
        if (!window.createExtensionAPI) {
            window.createExtensionAPI = createExtensionAPI;
        }
    }

    /**
     * 通过ID激活扩展
     * @param {String} extensionId
     * @param {ExtensionActivationReason} reason
     */
    async activateById(extensionId, reason) {
        const descriptor = this._registry.getExtension(extensionId);
        if (!descriptor) {
            throw new Error(`未找到扩展: ${extensionId}`);
        }

        return this._activateExtension(descriptor, reason);
    }

    /**
     * 通过事件激活扩展
     * @param {String} activationEvent
     * @param {Boolean} startup
     */
    async activateByEvent(activationEvent, startup = false) {
        if (this._alreadyActivatedEvents[activationEvent]) {
            return;
        }

        const descriptors = this._registry.getExtensionsByActivationEvent(activationEvent);

        // 只激活已启用的扩展
        const enabledDescriptors = descriptors.filter(descriptor => descriptor.enabled !== false);

        await Promise.all(
            enabledDescriptors.map(descriptor =>
                this._activateExtension(
                    descriptor,
                    new ExtensionActivationReason(startup, descriptor.id, activationEvent)
                )
            )
        );

        this._alreadyActivatedEvents[activationEvent] = true;
    }

    /**
     * 激活扩展
     * @param {ExtensionDescriptor} descriptor
     * @param {ExtensionActivationReason} reason
     */
    async _activateExtension(descriptor, reason) {
        const extensionId = descriptor.id;

        // 检查是否已激活
        if (this._activatedExtensions.has(extensionId)) {
            return this._activatedExtensions.get(extensionId);
        }

        // 检查是否正在激活
        if (this._activatingExtensions.has(extensionId)) {
            return this._activatingExtensions.get(extensionId);
        }

        // 创建激活 Promise
        const activationPromise = this._doActivateExtension(descriptor, reason);
        this._activatingExtensions.set(extensionId, activationPromise);

        try {
            const result = await activationPromise;
            this._activatedExtensions.set(extensionId, result);
            return result;
        } finally {
            this._activatingExtensions.delete(extensionId);
        }
    }

    /**
     * 执行扩展激活
     * @param {ExtensionDescriptor} descriptor
     * @param {ExtensionActivationReason} reason
     */
    async _doActivateExtension(descriptor, reason) {
        const extensionId = descriptor.id;
        const startTime = Date.now();

        try {
            console.log(`🔌 ExtensionActivator: 开始激活扩展 ${extensionId}`);

            // 加载扩展模块
            const codeLoadingStart = Date.now();
            const module = await this._loadExtensionModule(descriptor);
            const codeLoadingTime = Date.now() - codeLoadingStart;

            // 创建扩展上下文
            const context = this._createExtensionContext(descriptor);

            // 调用激活函数
            const activateCallStart = Date.now();
            let exports = null;

            if (module && typeof module.activate === 'function') {
                exports = await module.activate(context);
            } else if (module && typeof module.default === 'function') {
                // 支持默认导出的类
                const ExtensionClass = module.default;
                const instance = new ExtensionClass(context);
                if (typeof instance.activate === 'function') {
                    await instance.activate();
                }
                exports = instance;
            }

            const activateCallTime = Date.now() - activateCallStart;
            const activateResolvedTime = Date.now() - startTime;

            const activationTimes = new ExtensionActivationTimes(
                reason.startup,
                codeLoadingTime,
                activateCallTime,
                activateResolvedTime
            );

            console.log(`✅ ExtensionActivator: 扩展 ${extensionId} 激活成功 (${activateResolvedTime}ms)`);

            return new ActivatedExtension(
                false,
                activationTimes,
                module,
                exports,
                context.subscriptions
            );

        } catch (error) {
            console.error(`❌ ExtensionActivator: 扩展 ${extensionId} 激活失败:`, error);

            return new ActivatedExtension(
                true,
                ExtensionActivationTimes.NONE,
                null,
                null,
                new DisposableStore()
            );
        }
    }

    /**
     * 加载扩展模块
     * @param {ExtensionDescriptor} descriptor
     */
    async _loadExtensionModule(descriptor) {
        if (!descriptor.main) {
            return null;
        }

        try {
            console.log(`🔍 ExtensionActivator: 开始加载扩展模块 ${descriptor.id}`);
            console.log(`   - main: ${descriptor.main}`);
            console.log(`   - extensionLocation: ${descriptor.extensionLocation}`);
            console.log(`   - isBuiltin: ${descriptor.isBuiltin}`);

            // 首先尝试从 window 对象获取已加载的模块
            // 将路径转换为驼峰命名的变量名
            const moduleVarName = this._pathToModuleVarName(descriptor.id);
            if (window[moduleVarName]) {
                console.log(`✅ ExtensionActivator: 从 window.${moduleVarName} 加载扩展模块`);
                return window[moduleVarName];
            }

            // 构建完整路径
            const fullPath = this._resolveExtensionPath(descriptor);
            console.log(`   - 解析后的完整路径: ${fullPath}`);

            // 如果是外部插件（fullPath为null），通过IPC加载
            if (fullPath === null) {
                console.log(`📦 ExtensionActivator: 外部插件，通过IPC加载 ${descriptor.id}`);
                await this._loadExternalExtensionModule(descriptor, moduleVarName);
            } else {
                // 内置插件，直接加载脚本
                await this._loadScript(fullPath);
            }

            // 再次尝试从 window 获取
            if (window[moduleVarName]) {
                console.log(`✅ ExtensionActivator: 动态加载后从 window.${moduleVarName} 获取模块`);
                return window[moduleVarName];
            }

            console.warn(`⚠️ ExtensionActivator: 未找到模块 window.${moduleVarName}`);
            return null;

        } catch (error) {
            console.error(`❌ ExtensionActivator: 加载扩展模块失败 ${descriptor.id}:`, error);
            throw error;
        }
    }

    /**
     * 加载外部扩展模块（通过IPC从主进程读取）
     * @param {ExtensionDescriptor} descriptor
     * @param {String} moduleVarName
     */
    async _loadExternalExtensionModule(descriptor, moduleVarName) {
        try {
            // 通过IPC请求主进程读取扩展文件内容
            const result = await window.electronAPI.extensions.readExtensionFile(descriptor.id, descriptor.main);

            if (!result.success) {
                throw new Error(result.error || '读取扩展文件失败');
            }

            const code = result.content;
            console.log(`📄 ExtensionActivator: 已读取外部插件代码，长度: ${code.length} 字节`);

            // 动态执行代码
            // 使用Function构造器而不是eval，更安全且可以指定变量名
            const wrappedCode = `
                (function() {
                    ${code}
                    // 假设扩展代码会将模块导出到 window.${moduleVarName}
                    // 如果没有，尝试返回最后一个表达式的值
                })();
            `;

            // 执行代码
            eval(wrappedCode);

            console.log(`✅ ExtensionActivator: 外部插件代码执行完成 ${descriptor.id}`);

        } catch (error) {
            console.error(`❌ ExtensionActivator: 加载外部插件失败 ${descriptor.id}:`, error);
            throw error;
        }
    }

    /**
     * 解析扩展路径
     * @param {ExtensionDescriptor} descriptor
     * @returns {String|null} 完整的扩展路径，如果是外部插件返回null（需要特殊处理）
     */
    _resolveExtensionPath(descriptor) {
        const modulePath = descriptor.main;

        console.log(`🔍 ExtensionActivator._resolveExtensionPath: ${descriptor.id}`);
        console.log(`     modulePath: "${modulePath}"`);
        console.log(`     extensionLocation: "${descriptor.extensionLocation || '(空)'}"`);
        console.log(`     isBuiltin: ${descriptor.isBuiltin}`);

        // 外部插件判断：不是内置插件的都需要通过IPC加载
        if (!descriptor.isBuiltin) {
            console.log(`     ➡️ 外部插件，返回null触发IPC加载`);
            return null;  // 外部插件统一通过IPC加载
        }

        // 内置插件处理
        // 如果 main 已经是完整路径（内置扩展的情况），直接使用
        if (modulePath.includes('/')) {
            console.log(`     ➡️ 内置插件，使用完整路径: ${modulePath}`);
            return modulePath;
        }

        // 如果有 extensionLocation，拼接路径
        if (descriptor.extensionLocation) {
            const fullPath = `${descriptor.extensionLocation}/${modulePath}`;
            console.log(`     ➡️ 内置插件，拼接路径: ${fullPath}`);
            return fullPath;
        }

        // 没有 extensionLocation，直接使用 main
        console.log(`     ➡️ 内置插件，直接使用main: ${modulePath}`);
        return modulePath;
    }

    /**
     * 将路径转换为模块变量名
     * @param {String} extensionId
     */
    _pathToModuleVarName(extensionId) {
        // 将 hello-world 转换为 helloWorldExtension
        return extensionId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Extension';
    }

    /**
     * 动态加载脚本
     * @param {String} src
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已加载
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 创建扩展上下文
     * @param {ExtensionDescriptor} descriptor
     */
    _createExtensionContext(descriptor) {
        const subscriptions = new DisposableStore();

        // 创建扩展 API（带权限代理）
        const apiOptions = {
            permissionManager: this._permissionManager,
            enableProxy: !!this._permissionManager,
            enableLogging: false // 可以根据配置启用
        };

        const context = {
            // 扩展信息
            extension: {
                id: descriptor.id,
                name: descriptor.name,
                version: descriptor.version,
                publisher: descriptor.publisher,
                isBuiltin: descriptor.isBuiltin
            },
            extensionId: descriptor.id,
            extensionPath: descriptor.extensionLocation,
            extensionUri: descriptor.extensionLocation,

            // 订阅管理
            subscriptions: subscriptions,

            // 全局状态
            globalState: this._createMemento(descriptor.id, true),

            // 工作区状态
            workspaceState: this._createMemento(descriptor.id, false),

            // 环境变量
            environmentVariableCollection: null,

            // 扩展模式
            extensionMode: 'production',

            // 日志
            logPath: '',
            logUri: '',

            // 存储路径
            storagePath: '',
            storageUri: '',
            globalStoragePath: '',
            globalStorageUri: '',

            // 扩展 API（带权限代理）
            api: createExtensionAPI(
                {
                    extension: {
                        id: descriptor.id,
                        name: descriptor.name,
                        version: descriptor.version
                    },
                    globalState: this._createMemento(descriptor.id, true),
                    workspaceState: this._createMemento(descriptor.id, false)
                },
                apiOptions
            )
        };

        return context;
    }

    /**
     * 创建状态存储
     * @param {String} extensionId
     * @param {Boolean} isGlobal
     */
    _createMemento(extensionId, isGlobal) {
        const storageKey = isGlobal
            ? `extension.${extensionId}.globalState`
            : `extension.${extensionId}.workspaceState`;

        return {
            get(key, defaultValue) {
                try {
                    const data = cacheManager?.getLocalCache(storageKey) || {};
                    return data[key] !== undefined ? data[key] : defaultValue;
                } catch (error) {
                    return defaultValue;
                }
            },

            update(key, value) {
                try {
                    const data = cacheManager?.getLocalCache(storageKey) || {};
                    data[key] = value;
                    cacheManager?.setLocalCache(storageKey, data);
                    return Promise.resolve();
                } catch (error) {
                    return Promise.reject(error);
                }
            },

            keys() {
                try {
                    const data = cacheManager?.getLocalCache(storageKey) || {};
                    return Object.keys(data);
                } catch (error) {
                    return [];
                }
            }
        };
    }

    /**
     * 获取已激活的扩展
     * @param {String} extensionId
     */
    getActivatedExtension(extensionId) {
        return this._activatedExtensions.get(extensionId);
    }

    /**
     * 获取扩展导出
     * @param {String} extensionId
     */
    getExtensionExports(extensionId) {
        const activated = this._activatedExtensions.get(extensionId);
        return activated ? activated.exports : undefined;
    }

    /**
     * 停用扩展
     * @param {String} extensionId
     */
    async deactivateExtension(extensionId) {
        const activated = this._activatedExtensions.get(extensionId);
        if (!activated) {
            return;
        }

        try {
            // 调用 deactivate 函数
            if (activated.module && typeof activated.module.deactivate === 'function') {
                await activated.module.deactivate();
            } else if (activated.exports && typeof activated.exports.deactivate === 'function') {
                await activated.exports.deactivate();
            }

            // 释放订阅
            if (activated.subscriptions) {
                activated.subscriptions.dispose();
            }

            this._activatedExtensions.delete(extensionId);
            console.log(`✅ ExtensionActivator: 扩展 ${extensionId} 已停用`);

        } catch (error) {
            console.error(`❌ ExtensionActivator: 停用扩展 ${extensionId} 失败:`, error);
        }
    }

    /**
     * 释放资源
     */
    dispose() {
        super.dispose();

        // 停用所有扩展
        for (const extensionId of this._activatedExtensions.keys()) {
            this.deactivateExtension(extensionId);
        }
    }
}

export {
    ExtensionActivationTimes,
    ExtensionActivationReason,
    ActivatedExtension,
    ExtensionActivator
};
