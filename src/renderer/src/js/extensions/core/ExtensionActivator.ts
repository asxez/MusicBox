/**
 * ExtensionActivator - 扩展激活器
 * 参考 VSCode 的扩展激活机制，管理扩展的生命周期
 */

import {extensionsController} from '@js/features/extensions';
import {Disposable, DisposableStore} from '@extensions/core/Lifecycle';
import {createExtensionAPI, type ExtensionAPI} from '@extensions/api/index.js';
import {ExtensionDescriptor, ExtensionsRegistry} from '@extensions/core/ExtensionsRegistry';
import {InstantiationService} from '@extensions/core/Instantiation';
import type {PermissionManager} from '@extensions/core/ExtensionPermissions';
import {SandboxExtensionHost} from './sandbox/SandboxExtensionHost';
import './types';

export type ExtensionExports = Record<string, unknown> | object | null;

interface ExtensionModuleClass {
    new(context: ExtensionContext): {
        activate?: () => Promise<void> | void;
        deactivate?: () => Promise<void> | void;
    };
}

interface ExtensionModule {
    activate?: (context: ExtensionContext) => Promise<ExtensionExports> | ExtensionExports;
    deactivate?: () => Promise<void> | void;
    default?: ExtensionModuleClass;
    sandboxHost?: SandboxExtensionHost;
}

interface DeactivatableExtensionExports {
    deactivate: () => Promise<void> | void;
}

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
    readonly module: ExtensionModule | null;
    readonly exports: ExtensionExports;
    readonly subscriptions: DisposableStore;

    constructor(
        activationFailed: boolean,
        activationTimes: ExtensionActivationTimes,
        module: ExtensionModule | null,
        exports: ExtensionExports,
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

interface ExtensionStorageSnapshots {
    global: Record<string, unknown>;
    workspace: Record<string, unknown>;
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
    private _permissionManager: PermissionManager | null;
    private _activatedExtensions = new Map<string, ActivatedExtension>();
    private _activatingExtensions = new Map<string, Promise<ActivatedExtension>>();
    private _alreadyActivatedEvents: Record<string, boolean> = {};

    constructor(
        registry: ExtensionsRegistry,
        _instantiationService: InstantiationService,
        permissionManager: PermissionManager | null = null,
        _configurationManager: unknown = null
    ) {
        super();
        this._registry = registry;
        this._permissionManager = permissionManager;

        // Plugins receive createExtensionAPI only inside the sandbox runtime.
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
        let module: ExtensionModule | null = null;

        try {
            console.log(`🔌 ExtensionActivator: 开始激活扩展 ${extensionId}`);

            const storageSnapshots = await this._loadStorageSnapshots(descriptor.id);
            const context = this._createExtensionContext(descriptor, storageSnapshots);

            const codeLoadingStart = Date.now();
            module = await this._loadExtensionModule(descriptor, context, storageSnapshots);
            const codeLoadingTime = Date.now() - codeLoadingStart;

            const activateCallStart = Date.now();
            let exports: ExtensionExports = null;

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

            if (module && typeof module.deactivate === 'function') {
                try {
                    await module.deactivate();
                } catch (deactivateError) {
                    console.warn(`⚠️ ExtensionActivator: 清理失败的扩展 ${extensionId} 时出错:`, deactivateError);
                }
            } else if (module?.sandboxHost) {
                module.sandboxHost.dispose();
            }

            return new ActivatedExtension(
                true,
                ExtensionActivationTimes.NONE,
                null,
                null,
                new DisposableStore()
            );
        }
    }

    private async _loadExtensionModule(
        descriptor: ExtensionDescriptor,
        context: ExtensionContext,
        storageSnapshots: ExtensionStorageSnapshots
    ): Promise<ExtensionModule | null> {
        if (!descriptor.main) {
            return null;
        }

        try {
            console.log(`🔍 ExtensionActivator: 开始加载扩展模块 ${descriptor.id}`);
            console.log(`   - main: ${descriptor.main}`);
            console.log(`   - extensionLocation: ${descriptor.extensionLocation}`);
            console.log(`   - isBuiltin: ${descriptor.isBuiltin}`);

            const moduleVarName = this._pathToModuleVarName(descriptor.id);
            const code = await this._readExtensionCode(descriptor);
            console.log(`📦 ExtensionActivator: 插件通过 sandbox host 加载 ${descriptor.id}`);
            return await this._createSandboxExtensionModule(descriptor, moduleVarName, context, storageSnapshots, code);

        } catch (error) {
            console.error(`❌ ExtensionActivator: 加载扩展模块失败 ${descriptor.id}:`, error);
            throw error;
        }
    }

    private async _createSandboxExtensionModule(
        descriptor: ExtensionDescriptor,
        moduleVarName: string,
        context: ExtensionContext,
        storageSnapshots: ExtensionStorageSnapshots,
        code: string
    ): Promise<ExtensionModule> {
        try {
            console.log(`📄 ExtensionActivator: 已读取插件代码，长度: ${code.length} 字节，将在 sandbox iframe 中执行`);

            const sandboxHost = new SandboxExtensionHost({
                descriptor,
                code,
                moduleVarName,
                context,
                storageSnapshots,
                permissionManager: this._permissionManager
            });

            await sandboxHost.initialize();

            console.log(`✅ ExtensionActivator: 外部插件 sandbox 初始化完成 ${descriptor.id}`);
            return {
                sandboxHost,
                activate: async () => {
                    const result = await sandboxHost.activate();
                    return result.exports;
                },
                deactivate: async () => {
                    await sandboxHost.deactivate();
                    sandboxHost.dispose();
                }
            };

        } catch (error) {
            console.error(`❌ ExtensionActivator: 加载外部插件失败 ${descriptor.id}:`, error);
            throw error;
        }
    }

    private async _readExtensionCode(descriptor: ExtensionDescriptor): Promise<string> {
        if (descriptor.isBuiltin) {
            return await this._readBuiltinExtensionCode(descriptor);
        }

        const filePath = this._normalizeExternalExtensionMainPath(descriptor);
        const result = await extensionsController.readExtensionFile(descriptor.id, filePath);

        if (!result.success) {
            throw new Error(result.error || '读取扩展文件失败');
        }

        return result.content || '';
    }

    private async _readBuiltinExtensionCode(descriptor: ExtensionDescriptor): Promise<string> {
        const filePath = this._normalizeBuiltinExtensionMainPath(descriptor);
        const url = this._createRendererAssetUrl(filePath);
        const response = await fetch(url, {cache: 'no-cache'});

        if (!response.ok) {
            throw new Error(`读取内置扩展文件失败 ${url}: HTTP ${response.status}`);
        }

        const content = await response.text();
        this._assertJavaScriptExtensionSource(descriptor, url, content);
        return content;
    }

    private _createRendererAssetUrl(filePath: string): string {
        return new URL(filePath, document.baseURI).toString();
    }

    private _assertJavaScriptExtensionSource(descriptor: ExtensionDescriptor, url: string, content: string): void {
        const trimmedStart = content.trimStart();
        if (
            trimmedStart.startsWith('<!doctype html')
            || trimmedStart.startsWith('<html')
            || trimmedStart.startsWith('<')
        ) {
            throw new Error(
                `内置扩展 ${descriptor.id} 读取到了非 JS 内容: ${url}; ` +
                `preview=${trimmedStart.slice(0, 120).replace(/\s+/g, ' ')}`
            );
        }

        const moduleVarName = this._pathToModuleVarName(descriptor.id);
        if (!content.includes(moduleVarName)) {
            throw new Error(
                `内置扩展 ${descriptor.id} 源码未导出 ${moduleVarName}: ${url}; ` +
                `preview=${trimmedStart.slice(0, 120).replace(/\s+/g, ' ')}`
            );
        }
    }

    private _normalizeBuiltinExtensionMainPath(descriptor: ExtensionDescriptor): string {
        const main = (descriptor.main || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const location = (descriptor.extensionLocation || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const normalized = main.includes('/') ? main : `${location}/${main}`;

        if (!normalized.startsWith('js/extensions/builtin/')) {
            throw new Error(`非法的内置扩展入口: ${normalized}`);
        }

        if (normalized.includes('..') || !normalized.endsWith('.js')) {
            throw new Error(`非法的内置扩展文件路径: ${normalized}`);
        }

        return normalized;
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

    private _pathToModuleVarName(extensionId: string): string {
        return extensionId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Extension';
    }

    private _isDeactivatableExports(exports: ExtensionExports | undefined): exports is DeactivatableExtensionExports {
        return !!exports
            && typeof exports === 'object'
            && typeof (exports as Partial<DeactivatableExtensionExports>).deactivate === 'function';
    }

    private _createExtensionContext(
        descriptor: ExtensionDescriptor,
        storageSnapshots: ExtensionStorageSnapshots
    ): ExtensionContext {
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

            globalState: this._createMemento(descriptor.id, 'global', storageSnapshots.global),

            workspaceState: this._createMemento(descriptor.id, 'workspace', storageSnapshots.workspace),

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

    private async _loadStorageSnapshots(extensionId: string): Promise<ExtensionStorageSnapshots> {
        const [globalResult, workspaceResult] = await Promise.all([
            extensionsController.getStorageState(extensionId, 'global'),
            extensionsController.getStorageState(extensionId, 'workspace')
        ]);

        if (!globalResult.success) {
            console.warn(`⚠️ ExtensionActivator: 读取扩展全局存储失败 ${extensionId}: ${globalResult.error}`);
        }

        if (!workspaceResult.success) {
            console.warn(`⚠️ ExtensionActivator: 读取扩展工作区存储失败 ${extensionId}: ${workspaceResult.error}`);
        }

        return {
            global: globalResult.success ? globalResult.data : {},
            workspace: workspaceResult.success ? workspaceResult.data : {}
        };
    }

    private _createMemento(
        extensionId: string,
        scope: 'global' | 'workspace',
        initialState: Record<string, unknown>
    ): Memento {
        const state: Record<string, unknown> = Object.create(null);
        for (const [key, value] of Object.entries(initialState)) {
            if (this._isAllowedStorageKey(key)) {
                state[key] = value;
            }
        }

        const isAllowedStorageKey = this._isAllowedStorageKey.bind(this);

        return {
            get<T>(key: string, defaultValue?: T): T {
                return state[key] !== undefined ? state[key] as T : defaultValue!;
            },

            async update(key: string, value: any): Promise<void> {
                if (!isAllowedStorageKey(key)) {
                    return Promise.reject(new Error(`非法的扩展存储 key: ${key}`));
                }

                const hadPreviousValue = Object.prototype.hasOwnProperty.call(state, key);
                const previousValue = state[key];

                try {
                    if (typeof value === 'undefined') {
                        delete state[key];
                    } else {
                        state[key] = value;
                    }

                    const result = await extensionsController.updateStorage(extensionId, scope, key, value);
                    if (!result.success) {
                        throw new Error(result.error || '扩展存储写入失败');
                    }
                } catch (error) {
                    if (hadPreviousValue) {
                        state[key] = previousValue;
                    } else {
                        delete state[key];
                    }

                    return Promise.reject(error);
                }
            },

            keys(): string[] {
                return Object.keys(state);
            }
        };
    }

    private _isAllowedStorageKey(key: string): boolean {
        return key !== '__proto__' && key !== 'prototype' && key !== 'constructor';
    }

    getActivatedExtension(extensionId: string): ActivatedExtension | undefined {
        return this._activatedExtensions.get(extensionId);
    }

    getExtensionExports(extensionId: string): ExtensionExports | undefined {
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
            } else if (this._isDeactivatableExports(activated.exports)) {
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
