/**
 * ExtensionActivator - 扩展激活器
 * 参考 VSCode 的扩展激活机制，管理扩展的生命周期
 */

import {extensionsGateway} from '@js/infrastructure/electron';
import {cacheManager} from '@services/CacheManager';
import {Disposable, DisposableStore} from '@extensions/core/Lifecycle';
import {createExtensionAPI, type ExtensionAPI} from '@extensions/api/index.js';
import {ExtensionDescriptor, ExtensionsRegistry} from '@extensions/core/ExtensionsRegistry';
import {InstantiationService} from '@extensions/core/Instantiation';
import './types';

export class ExtensionActivationTimes {
    readonly startup: boolean;
    readonly codeLoadingTime: number;
    readonly activateCallTime: number;
    readonly activateResolvedTime: number;

    constructor(startup: boolean, codeLoadingTime: number, activateCallTime: number, activateResolvedTime: number) {
        this.startup = startup;
        this.codeLoadingTime = codeLoadingTime;
        this.activateCallTime = activateCallTime;
        this.activateResolvedTime = activateResolvedTime;
    }

    static NONE = new ExtensionActivationTimes(false, -1, -1, -1);
}

export class ExtensionActivationReason {
    readonly startup: boolean;
    readonly extensionId: string;
    readonly activationEvent: string;

    constructor(startup: boolean, extensionId: string, activationEvent: string) {
        this.startup = startup;
        this.extensionId = extensionId;
        this.activationEvent = activationEvent;
    }
}

export class ActivatedExtension {
    readonly activationFailed: boolean;
    readonly activationTimes: ExtensionActivationTimes;
    readonly module: any;
    readonly exports: any;
    readonly subscriptions: DisposableStore;

    constructor(
        activationFailed: boolean,
        activationTimes: ExtensionActivationTimes,
        module: any,
        exports: any,
        subscriptions: DisposableStore
    ) {
        this.activationFailed = activationFailed;
        this.activationTimes = activationTimes;
        this.module = module;
        this.exports = exports;
        this.subscriptions = subscriptions;
    }
}

interface Memento {
    get<T>(key: string, defaultValue?: T): T;

    update(key: string, value: any): Promise<void>;

    keys(): string[];
}

export interface ExtensionContext {
    extension: {
        id: string;
        name: string;
        version: string;
        publisher?: string;
        isBuiltin: boolean;
    };
    extensionId: string;
    extensionPath: string;
    extensionUri: string;
    subscriptions: DisposableStore;
    globalState: Memento;
    workspaceState: Memento;
    environmentVariableCollection: any;
    extensionMode: string;
    logPath: string;
    logUri: string;
    storagePath: string;
    storageUri: string;
    globalStoragePath: string;
    globalStorageUri: string;
    api: ExtensionAPI;
}

export class ExtensionActivator extends Disposable {
    private _registry: ExtensionsRegistry;
    private _permissionManager: any;
    private _activatedExtensions = new Map<string, ActivatedExtension>();
    private _activatingExtensions = new Map<string, Promise<ActivatedExtension>>();
    private _alreadyActivatedEvents: Record<string, boolean> = {};

    constructor(
        registry: ExtensionsRegistry,
        _instantiationService: InstantiationService,
        permissionManager: any = null,
        _configurationManager: any = null
    ) {
        super();
        this._registry = registry;
        this._permissionManager = permissionManager;

        if (!window.createExtensionAPI) {
            // Compatibility bridge for legacy script-style extensions. Bundled extensions should use context.api.
            window.createExtensionAPI = createExtensionAPI;
        }
    }

    async activateById(extensionId: string, reason: ExtensionActivationReason): Promise<ActivatedExtension> {
        const descriptor = this._registry.getExtension(extensionId);
        if (!descriptor) {
            throw new Error(`未找到扩展: ${extensionId}`);
        }

        return this._activateExtension(descriptor, reason);
    }

    async activateByEvent(activationEvent: string, startup = false): Promise<void> {
        if (this._alreadyActivatedEvents[activationEvent]) {
            return;
        }

        const descriptors = this._registry.getExtensionsByActivationEvent(activationEvent);

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

    private async _activateExtension(descriptor: ExtensionDescriptor, reason: ExtensionActivationReason): Promise<ActivatedExtension> {
        const extensionId = descriptor.id;

        if (this._activatedExtensions.has(extensionId)) {
            return this._activatedExtensions.get(extensionId)!;
        }

        if (this._activatingExtensions.has(extensionId)) {
            return this._activatingExtensions.get(extensionId)!;
        }

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

    private async _doActivateExtension(descriptor: ExtensionDescriptor, reason: ExtensionActivationReason): Promise<ActivatedExtension> {
        const extensionId = descriptor.id;
        const startTime = Date.now();

        try {
            console.log(`🔌 ExtensionActivator: 开始激活扩展 ${extensionId}`);

            const codeLoadingStart = Date.now();
            const module = await this._loadExtensionModule(descriptor);
            const codeLoadingTime = Date.now() - codeLoadingStart;

            const context = this._createExtensionContext(descriptor);

            const activateCallStart = Date.now();
            let exports = null;

            if (module && typeof module.activate === 'function') {
                exports = await module.activate(context);
            } else if (module && typeof module.default === 'function') {
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

    private async _loadExtensionModule(descriptor: ExtensionDescriptor): Promise<any> {
        if (!descriptor.main) {
            return null;
        }

        try {
            console.log(`🔍 ExtensionActivator: 开始加载扩展模块 ${descriptor.id}`);
            console.log(`   - main: ${descriptor.main}`);
            console.log(`   - extensionLocation: ${descriptor.extensionLocation}`);
            console.log(`   - isBuiltin: ${descriptor.isBuiltin}`);

            const moduleVarName = this._pathToModuleVarName(descriptor.id);
            if ((window as any)[moduleVarName]) {
                console.log(`✅ ExtensionActivator: 从 window.${moduleVarName} 加载扩展模块`);
                return (window as any)[moduleVarName];
            }

            const fullPath = this._resolveExtensionPath(descriptor);
            console.log(`   - 解析后的完整路径: ${fullPath}`);

            if (fullPath === null) {
                console.log(`📦 ExtensionActivator: 外部插件，通过IPC加载 ${descriptor.id}`);
                await this._loadExternalExtensionModule(descriptor, moduleVarName);
            } else {
                await this._loadScript(fullPath);
            }

            if ((window as any)[moduleVarName]) {
                console.log(`✅ ExtensionActivator: 动态加载后从 window.${moduleVarName} 获取模块`);
                return (window as any)[moduleVarName];
            }

            console.warn(`⚠️ ExtensionActivator: 未找到模块 window.${moduleVarName}`);
            return null;

        } catch (error) {
            console.error(`❌ ExtensionActivator: 加载扩展模块失败 ${descriptor.id}:`, error);
            throw error;
        }
    }

    private async _loadExternalExtensionModule(descriptor: ExtensionDescriptor, _moduleVarName: string): Promise<void> {
        try {
            const filePath = this._normalizeExternalExtensionMainPath(descriptor);
            const result = await extensionsGateway.readExtensionFile(descriptor.id, filePath);

            if (!result.success) {
                throw new Error(result.error || '读取扩展文件失败');
            }

            const code = result.content || '';
            console.log(`📄 ExtensionActivator: 已读取外部插件代码，长度: ${code.length} 字节`);

            const wrappedCode = `
                (function() {
                    ${code}
                })();
            `;

            eval(wrappedCode);

            console.log(`✅ ExtensionActivator: 外部插件代码执行完成 ${descriptor.id}`);

        } catch (error) {
            console.error(`❌ ExtensionActivator: 加载外部插件失败 ${descriptor.id}:`, error);
            throw error;
        }
    }

    private _normalizeExternalExtensionMainPath(descriptor: ExtensionDescriptor): string {
        const main = (descriptor.main || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const idPrefix = `${descriptor.id}/`;

        if (main.startsWith(idPrefix)) {
            const normalized = main.slice(idPrefix.length);
            console.log(`🔧 ExtensionActivator: 归一化外部插件入口 ${main} -> ${normalized}`);
            return normalized;
        }

        return main;
    }

    private _resolveExtensionPath(descriptor: ExtensionDescriptor): string | null {
        const modulePath = descriptor.main!;

        if (!descriptor.isBuiltin) {
            console.log(`     ➡️ 外部插件，返回null触发IPC加载`);
            return null;
        }

        if (modulePath.includes('/')) {
            console.log(`     ➡️ 内置插件，使用完整路径: ${modulePath}`);
            return modulePath;
        }

        if (descriptor.extensionLocation) {
            const fullPath = `${descriptor.extensionLocation}/${modulePath}`;
            console.log(`     ➡️ 内置插件，拼接路径: ${fullPath}`);
            return fullPath;
        }

        console.log(`     ➡️ 内置插件，直接使用main: ${modulePath}`);
        return modulePath;
    }

    private _pathToModuleVarName(extensionId: string): string {
        return extensionId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Extension';
    }

    private _loadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    private _createExtensionContext(descriptor: ExtensionDescriptor): ExtensionContext {
        const subscriptions = new DisposableStore();

        const apiOptions = {
            permissionManager: this._permissionManager,
            enableProxy: !!this._permissionManager,
            enableLogging: false
        };

        const context: ExtensionContext = {
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

            subscriptions: subscriptions,

            globalState: this._createMemento(descriptor.id, true),

            workspaceState: this._createMemento(descriptor.id, false),

            environmentVariableCollection: null,

            extensionMode: 'production',

            logPath: '',
            logUri: '',

            storagePath: '',
            storageUri: '',
            globalStoragePath: '',
            globalStorageUri: '',

            api: null as unknown as ExtensionAPI
        };

        context.api = createExtensionAPI(context, apiOptions);

        return context;
    }

    private _createMemento(extensionId: string, isGlobal: boolean): Memento {
        const storageKey = isGlobal
            ? `extension.${extensionId}.globalState`
            : `extension.${extensionId}.workspaceState`;

        return {
            get<T>(key: string, defaultValue?: T): T {
                try {
                    const data = cacheManager.getLocalCache(storageKey) || {};
                    return data[key] !== undefined ? data[key] : defaultValue!;
                } catch (error) {
                    return defaultValue!;
                }
            },

            update(key: string, value: any): Promise<void> {
                try {
                    const data = cacheManager.getLocalCache(storageKey) || {};
                    data[key] = value;
                    cacheManager?.setLocalCache(storageKey, data);
                    return Promise.resolve();
                } catch (error) {
                    return Promise.reject(error);
                }
            },

            keys(): string[] {
                try {
                    const data = cacheManager.getLocalCache(storageKey) || {};
                    return Object.keys(data);
                } catch (error) {
                    return [];
                }
            }
        };
    }

    getActivatedExtension(extensionId: string): ActivatedExtension | undefined {
        return this._activatedExtensions.get(extensionId);
    }

    getExtensionExports(extensionId: string): any {
        const activated = this._activatedExtensions.get(extensionId);
        return activated ? activated.exports : undefined;
    }

    async deactivateExtension(extensionId: string): Promise<void> {
        const activated = this._activatedExtensions.get(extensionId);
        if (!activated) {
            return;
        }

        try {
            if (activated.module && typeof activated.module.deactivate === 'function') {
                await activated.module.deactivate();
            } else if (activated.exports && typeof activated.exports.deactivate === 'function') {
                await activated.exports.deactivate();
            }

            if (activated.subscriptions) {
                activated.subscriptions.dispose();
            }

            this._activatedExtensions.delete(extensionId);
            console.log(`✅ ExtensionActivator: 扩展 ${extensionId} 已停用`);

        } catch (error) {
            console.error(`❌ ExtensionActivator: 停用扩展 ${extensionId} 失败:`, error);
        }
    }

    dispose(): void {
        super.dispose();

        for (const extensionId of this._activatedExtensions.keys()) {
            this.deactivateExtension(extensionId);
        }
    }
}
