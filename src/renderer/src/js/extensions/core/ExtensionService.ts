/**
 * ExtensionService - 扩展服务
 * 参考 VSCode 的 ExtensionService,提供扩展管理的核心功能
 */

import {extensionsController} from '@js/features/extensions';
import {
    ExtensionActivationReason,
    ExtensionActivator,
    type ExtensionExports
} from '@extensions/core/ExtensionActivator';
import {Emitter} from '@extensions/core/Event';
import {createDecorator, InstantiationService} from '@extensions/core/Instantiation';
import {
    ActivationEvents,
    ContributionPoints,
    ExtensionDescriptor,
    ExtensionManifest,
    ExtensionsRegistry,
    extensionsRegistry
} from '@extensions/core/ExtensionsRegistry';
import {Disposable} from '@extensions/core/Lifecycle';
import {DependencyResolver} from '@extensions/core/ExtensionDependencies';
import {PermissionManager} from '@extensions/core/ExtensionPermissions';
import {ConfigurationManager} from '@extensions/core/ExtensionConfiguration';
import {cacheManager} from "@js/shared/cache";
import '@extensions/core/types';
import type {ExtensionInfo} from '@extensions/core/types';

interface ExtensionChangeEvent {
    added?: string[];
    removed?: string[];
    changed?: string[];
}

interface ExtensionActivationEvent {
    extensionId: string;
}

interface ExtensionActivationErrorEvent {
    extensionId: string;
    error: Error;
}

type BuiltinExtensionIndexEntry = string | { path?: string };

interface BuiltinExtensionIndex {
    extensions?: BuiltinExtensionIndexEntry[];
}

/**
 * 扩展服务 - 管理所有扩展的生命周期
 */
class ExtensionService extends Disposable {
    private _instantiationService: InstantiationService;
    private _registry: ExtensionsRegistry;
    private _activator: ExtensionActivator | null = null;
    private _isInitialized = false;
    private _onDidChangeExtensions = new Emitter<ExtensionChangeEvent>();
    private _onWillActivateExtension = new Emitter<ExtensionActivationEvent>();
    private _onDidActivateExtension = new Emitter<ExtensionActivationEvent>();
    private _onDidActivateExtensionError = new Emitter<ExtensionActivationErrorEvent>();
    private _dependencyResolver: DependencyResolver;
    private _permissionManager: PermissionManager;
    private _configurationManager: ConfigurationManager;

    constructor(instantiationService: InstantiationService) {
        super();
        this._instantiationService = instantiationService;
        this._registry = extensionsRegistry;
        this._dependencyResolver = new DependencyResolver(this._registry);
        this._permissionManager = new PermissionManager();
        this._configurationManager = new ConfigurationManager();
    }

    async initialize(): Promise<void> {
        if (this._isInitialized) {
            console.warn('⚠️ ExtensionService: 已经初始化');
            return;
        }

        try {
            console.log('🔌 ExtensionService: 开始初始化');

            this._activator = new ExtensionActivator(
                this._registry,
                this._instantiationService,
                this._permissionManager,
                this._configurationManager
            );

            this._registerCoreExtensionPoints();
            await this._scanAndLoadExtensions();
            this._dependencyResolver.buildDependencyGraph();

            const cycles = this._dependencyResolver.detectCircularDependencies();
            if (cycles.length > 0) {
                console.warn('⚠️ ExtensionService: 检测到循环依赖:', cycles);
            }

            this._isInitialized = true;
            console.log('✅ ExtensionService: 初始化完成（准备激活启动扩展）');

            await this._activateStartupExtensions();
        } catch (error) {
            console.error('❌ ExtensionService: 初始化失败:', error);
            throw error;
        }
    }

    private _registerCoreExtensionPoints(): void {
        this._registry.registerExtensionPoint(ContributionPoints.COMMANDS, {
            description: '注册命令'
        });

        this._registry.registerExtensionPoint(ContributionPoints.MENUS, {
            description: '注册菜单项'
        });

        this._registry.registerExtensionPoint(ContributionPoints.VIEWS, {
            description: '注册视图'
        });

        this._registry.registerExtensionPoint(ContributionPoints.CONFIGURATION, {
            description: '注册配置项'
        });

        this._registry.registerExtensionPoint(ContributionPoints.THEMES, {
            description: '注册主题'
        });

        this._registry.registerExtensionPoint(ContributionPoints.KEYBINDINGS, {
            description: '注册快捷键'
        });

        console.log('✅ ExtensionService: 核心扩展点注册完成');
    }

    private async _scanAndLoadExtensions(): Promise<void> {
        try {
            console.log('🔍 ExtensionService._scanAndLoadExtensions: 开始');

            await this._registerBuiltinExtensions();
            await this._syncExtensionsFromMainProcess();

            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            const installedExtensions = extensionsConfig.installed || [];

            console.log(`🔌 ExtensionService: 发现 ${installedExtensions.length} 个已安装的扩展`);

            for (const extensionManifest of installedExtensions) {
                try {
                    await this._loadExtension(extensionManifest);
                } catch (error) {
                    console.error(`❌ ExtensionService: 加载扩展失败 ${extensionManifest.id}:`, error);
                }
            }

            console.log('🔍 ExtensionService._scanAndLoadExtensions: 完成');
        } catch (error) {
            console.error('❌ ExtensionService: 扫描扩展失败:', error);
        }
    }

    private async _syncExtensionsFromMainProcess(): Promise<void> {
        try {
            console.log('🔄 ExtensionService: 同步主进程扩展列表');

            const result = await extensionsController.getInstalled();

            if (!result.success) {
                console.warn('⚠️ ExtensionService: 获取主进程扩展列表失败:', result.error);
                return;
            }

            const allMainProcessExtensions = result.extensions || [];
            console.log(`📋 ExtensionService: 主进程扩展总数: ${allMainProcessExtensions.length}`);

            const mainProcessExtensions = allMainProcessExtensions.filter(ext => !ext.isBuiltin);
            console.log(`📋 ExtensionService: 主进程外部扩展数量: ${mainProcessExtensions.length}`);

            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            const localExtensions = extensionsConfig.installed || [];
            console.log(`💾 ExtensionService: 本地存储扩展数量: ${localExtensions.length}`);

            const localExtensionMap = new Map(localExtensions.map((ext: ExtensionInfo) => [ext.id, ext]));
            const mainExtensionIds = new Set(mainProcessExtensions.map(ext => ext.id));

            const extensionsToAdd = mainProcessExtensions.filter(ext => !localExtensionMap.has(ext.id));
            const extensionsToRemove = localExtensions.filter((ext: ExtensionInfo) => !mainExtensionIds.has(ext.id));

            console.log(`🔄 ExtensionService: 需要同步 - 添加 ${extensionsToAdd.length} 个,删除 ${extensionsToRemove.length} 个`);

            const updatedExtensions = mainProcessExtensions.map(mainExt => {
                const localExt = localExtensionMap.get(mainExt.id) as ExtensionInfo | undefined;
                if (localExt) {
                    return {
                        ...mainExt,
                        enabled: mainExt.enabled !== undefined ? mainExt.enabled :
                            (localExt.enabled !== undefined ? localExt.enabled : true)
                    };
                }
                console.log(`➕ ExtensionService: 新增扩展 ${mainExt.id}, enabled=${mainExt.enabled}`);
                return mainExt;
            });

            const cleanedExtensions = updatedExtensions.filter(ext => {
                if (ext.isBuiltin) {
                    console.warn(`⚠️ ExtensionService: 检测到内置插件 ${ext.id} 在 installed 数组中,已移除`);
                    return false;
                }
                return true;
            });

            if (cleanedExtensions.length !== updatedExtensions.length) {
                console.log(`🧹 ExtensionService: 清理了 ${updatedExtensions.length - cleanedExtensions.length} 个错误的内置插件记录`);
            }

            extensionsConfig.installed = cleanedExtensions;
            cacheManager?.setLocalCache('extensions-config', extensionsConfig);

            console.log(`✅ ExtensionService: 扩展列表同步完成,当前共 ${cleanedExtensions.length} 个外部扩展`);
        } catch (error) {
            console.error('❌ ExtensionService: 同步扩展列表失败:', error);
        }
    }

    private async _registerBuiltinExtensions(): Promise<void> {
        try {
            console.log('🔌 ExtensionService: 扫描并注册内置扩展');

            const builtinPath = 'js/extensions/builtin';
            const builtinExtensions = await this._scanBuiltinExtensions(builtinPath);

            console.log(`📦 ExtensionService: 发现 ${builtinExtensions.length} 个内置扩展`);

            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            const builtinStates: Record<string, { enabled: boolean }> = extensionsConfig.builtinStates || {};
            console.log(`📋 ExtensionService: 已保存的内置插件状态:`, builtinStates);

            for (const manifest of builtinExtensions) {
                try {
                    manifest.isBuiltin = true;

                    if (builtinStates[manifest.id]) {
                        manifest.enabled = builtinStates[manifest.id].enabled;
                        console.log(`🔄 ExtensionService: 恢复内置扩展 ${manifest.id} 的状态: enabled=${manifest.enabled}`);
                    } else {
                        console.log(`🆕 ExtensionService: 首次加载内置扩展 ${manifest.id}, 使用默认状态: enabledByDefault=${manifest.enabledByDefault !== false}`);
                    }

                    const descriptor = new ExtensionDescriptor(manifest);
                    this._registry.registerExtension(descriptor);

                    const permissions = this._permissionManager.extractPermissions(manifest);
                    this._permissionManager.registerExtensionPermissions(descriptor.id, permissions);

                    if (manifest.contributes && manifest.contributes.configuration) {
                        this._configurationManager.registerConfiguration(
                            descriptor.id,
                            manifest.contributes.configuration
                        );
                    }

                    console.log(`✅ ExtensionService: 已注册内置扩展 ${descriptor.id}, enabled=${descriptor.enabled}, enabledByDefault=${descriptor.enabledByDefault}`);
                } catch (error) {
                    console.error(`❌ ExtensionService: 注册内置扩展 ${manifest.id} 失败:`, error);
                }
            }

            console.log('✅ ExtensionService: 内置扩展注册完成');
        } catch (error) {
            console.error('❌ ExtensionService: 注册内置扩展失败:', error);
        }
    }

    private async _scanBuiltinExtensions(builtinPath: string): Promise<ExtensionManifest[]> {
        const extensions: ExtensionManifest[] = [];

        try {
            const builtinExtensionDirs = await this._loadBuiltinExtensionDirs(builtinPath);

            for (const dirName of builtinExtensionDirs) {
                try {
                    const manifestPath = `${builtinPath}/${dirName}/manifest.json`;
                    const manifest = await this._loadManifestFromPath(manifestPath);

                    if (manifest) {
                        manifest.extensionLocation = `${builtinPath}/${dirName}`;

                        if (manifest.main) {
                            manifest.main = `${builtinPath}/${dirName}/${manifest.main}`;
                        }

                        extensions.push(manifest);
                    }
                } catch (error) {
                    console.error(`❌ ExtensionService: 加载内置扩展 ${dirName} 失败:`, error);
                }
            }
        } catch (error) {
            console.error('❌ ExtensionService: 扫描内置扩展目录失败:', error);
        }

        return extensions;
    }

    private async _loadBuiltinExtensionDirs(builtinPath: string): Promise<string[]> {
        const indexPath = `${builtinPath}/extensions.json`;

        try {
            const response = await fetch(indexPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const index = await response.json() as BuiltinExtensionIndex;
            if (!index || !Array.isArray(index.extensions)) {
                throw new Error('内置扩展索引格式无效');
            }

            const dirs = index.extensions
                .map((entry, index) => this._normalizeBuiltinExtensionDir(entry, index))
                .filter((dirName): dirName is string => !!dirName);

            return Array.from(new Set(dirs));
        } catch (error) {
            console.error(`❌ ExtensionService: 加载内置扩展索引失败 (${indexPath}):`, error);
            return [];
        }
    }

    private _normalizeBuiltinExtensionDir(entry: BuiltinExtensionIndexEntry, index: number): string | null {
        const rawPath = typeof entry === 'string' ? entry : entry?.path;
        if (typeof rawPath !== 'string') {
            console.warn(`⚠️ ExtensionService: 内置扩展索引项 ${index} 缺少 path`);
            return null;
        }

        const normalized = rawPath.trim().replace(/\\/g, '/');
        if (!this._isSafeBuiltinExtensionDir(normalized)) {
            console.warn(`⚠️ ExtensionService: 内置扩展索引项 ${index} 路径无效: ${rawPath}`);
            return null;
        }

        return normalized;
    }

    private _isSafeBuiltinExtensionDir(dirName: string): boolean {
        if (!dirName || dirName.startsWith('/') || dirName.includes('..')) {
            return false;
        }

        return dirName
            .split('/')
            .every(part => /^[a-zA-Z0-9._-]+$/.test(part));
    }

    private async _loadManifestFromPath(manifestPath: string): Promise<ExtensionManifest | null> {
        try {
            const response = await fetch(manifestPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`❌ ExtensionService: 加载 manifest 失败 (${manifestPath}):`, error);
            return null;
        }
    }

    private async _loadExtension(manifest: ExtensionManifest): Promise<void> {
        try {
            const descriptor = new ExtensionDescriptor(manifest);
            this._registry.registerExtension(descriptor);

            const permissions = this._permissionManager.extractPermissions(manifest);
            this._permissionManager.registerExtensionPermissions(descriptor.id, permissions);

            if (manifest.contributes && manifest.contributes.configuration) {
                this._configurationManager.registerConfiguration(
                    descriptor.id,
                    manifest.contributes.configuration
                );
            }
        } catch (error) {
            console.error(`❌ ExtensionService: 加载扩展失败:`, error);
            throw error;
        }
    }

    private async _activateStartupExtensions(): Promise<void> {
        try {
            const allExtensions = this._registry.getAllExtensions();
            const enabledExtensions = allExtensions.filter(ext => ext.enabled);

            console.log(`🔌 ExtensionService: 发现 ${enabledExtensions.length} 个已启用的扩展（共 ${allExtensions.length} 个）`);

            const startupExtensions = enabledExtensions.filter(ext => {
                return ext.activationEvents && (
                    ext.activationEvents.includes(ActivationEvents.ON_START_UP) ||
                    ext.activationEvents.includes(ActivationEvents.WILDCARD)
                );
            });

            const extensionIds = startupExtensions.map(ext => ext.id);
            let sortedIds: string[];
            try {
                sortedIds = this._dependencyResolver.topologicalSort(extensionIds);
                console.log(`📊 ExtensionService: 依赖排序完成,顺序:`, sortedIds);
            } catch (error) {
                console.warn('⚠️ ExtensionService: 依赖排序失败,使用原始顺序:', error);
                sortedIds = extensionIds;
            }

            for (const extensionId of sortedIds) {
                try {
                    const depCheck = this._dependencyResolver.checkDependencies(extensionId);
                    if (!depCheck.satisfied) {
                        console.warn(`⚠️ ExtensionService: 扩展 ${extensionId} 依赖未满足:`, depCheck);
                        continue;
                    }

                    await this.activateById(extensionId);
                } catch (error) {
                    console.error(`❌ ExtensionService: 激活扩展 ${extensionId} 失败:`, error);
                }
            }

            console.log('✅ ExtensionService: 启动扩展激活完成');
        } catch (error) {
            console.error('❌ ExtensionService: 激活启动扩展失败:', error);
        }
    }

    async activateById(extensionId: string): Promise<void> {
        if (!this._isInitialized) {
            throw new Error('ExtensionService 未初始化');
        }

        this._onWillActivateExtension.fire({extensionId});

        try {
            const reason = new ExtensionActivationReason(false, extensionId, 'api');
            await this._activator!.activateById(extensionId, reason);

            this._onDidActivateExtension.fire({extensionId});
        } catch (error) {
            this._onDidActivateExtensionError.fire({extensionId, error: error as Error});
            throw error;
        }
    }

    async activateByEvent(activationEvent: string): Promise<void> {
        if (!this._isInitialized) {
            console.warn('⚠️ ExtensionService: 未初始化,延迟激活');
            await new Promise<void>(resolve => {
                const checkInit = () => {
                    if (this._isInitialized) {
                        resolve();
                    } else {
                        setTimeout(checkInit, 100);
                    }
                };
                checkInit();
            });
        }

        if (!this._registry.containsActivationEvent(activationEvent)) {
            return;
        }

        await this._activator!.activateByEvent(activationEvent, false);
    }

    async installExtension(manifest: ExtensionManifest): Promise<string> {
        try {
            if (!manifest.id || !manifest.name || !manifest.version) {
                throw new Error('扩展清单不完整');
            }

            if (this._registry.getExtension(manifest.id)) {
                throw new Error(`扩展 ${manifest.id} 已安装`);
            }

            const extensionsConfig = cacheManager.getLocalCache('extensions-config') || {};
            if (!extensionsConfig.installed) {
                extensionsConfig.installed = [];
            }
            extensionsConfig.installed.push(manifest);
            cacheManager.setLocalCache('extensions-config', extensionsConfig);

            await this._loadExtension(manifest);

            this._onDidChangeExtensions.fire({added: [manifest.id], removed: []});

            console.log(`✅ ExtensionService: 安装扩展 ${manifest.id}`);

            return manifest.id;
        } catch (error) {
            console.error('❌ ExtensionService: 安装扩展失败:', error);
            throw error;
        }
    }

    async uninstallExtension(extensionId: string): Promise<void> {
        try {
            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            await this._activator!.deactivateExtension(extensionId);
            this._registry.unregisterExtension(extensionId);

            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (extensionsConfig.installed) {
                extensionsConfig.installed = extensionsConfig.installed.filter(
                    (ext: ExtensionInfo) => ext.id !== extensionId
                );
                cacheManager.setLocalCache('extensions-config', extensionsConfig);
            }

            this._onDidChangeExtensions.fire({added: [], removed: [extensionId]});

            console.log(`✅ ExtensionService: 卸载扩展 ${extensionId}`);
        } catch (error) {
            console.error('❌ ExtensionService: 卸载扩展失败:', error);
            throw error;
        }
    }

    getExtensions(): Array<ExtensionDescriptor & { isActive: boolean }> {
        const extensions = this._registry.getAllExtensions();
        return extensions.map(ext => Object.assign(ext, {
            isActive: this.isExtensionActivated(ext.id)
        }));
    }

    isExtensionActivated(extensionId: string): boolean {
        if (!this._activator) {
            return false;
        }
        const activated = this._activator.getActivatedExtension(extensionId);
        return activated !== undefined && !activated.activationFailed;
    }

    getExtension(extensionId: string): ExtensionDescriptor | undefined {
        return this._registry.getExtension(extensionId);
    }

    getExtensionExports(extensionId: string): ExtensionExports | undefined {
        return this._activator?.getExtensionExports(extensionId);
    }

    async installExtensionFromFile(filePath: string): Promise<ExtensionInfo> {
        try {
            console.log('📦 ExtensionService: 从文件安装扩展', filePath);

            const result = await extensionsController.installFromFile(filePath);

            if (!result.success) {
                throw new Error(result.error || '安装失败');
            }

            const extensionInfo = result.extension!;

            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (!extensionsConfig.installed) {
                extensionsConfig.installed = [];
            }

            const existingIndex = extensionsConfig.installed.findIndex((ext: ExtensionInfo) => ext.id === extensionInfo.id);
            if (existingIndex === -1) {
                extensionsConfig.installed.push(extensionInfo);
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`💾 ExtensionService: 已同步扩展到本地存储 ${extensionInfo.id}`);
            } else {
                extensionsConfig.installed[existingIndex] = extensionInfo;
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`💾 ExtensionService: 已更新本地存储中的扩展 ${extensionInfo.id}`);
            }

            await this._loadExtension(extensionInfo as ExtensionManifest);

            if (extensionInfo.activationEvents && extensionInfo.activationEvents.includes('onStartUp')) {
                await this.activateById(extensionInfo.id);
            }

            this._onDidChangeExtensions.fire({added: [extensionInfo.id], removed: []});

            console.log(`✅ ExtensionService: 扩展安装成功 ${extensionInfo.id}`);
            return extensionInfo;
        } catch (error) {
            console.error('❌ ExtensionService: 从文件安装扩展失败:', error);
            throw error;
        }
    }

    async uninstallExtensionFromDisk(extensionId: string, keepData = false): Promise<void> {
        try {
            console.log('🗑️ ExtensionService: 卸载扩展', extensionId);

            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            if (descriptor.isBuiltin) {
                throw new Error('内置扩展不能卸载');
            }

            await this._activator!.deactivateExtension(extensionId);

            const result = await extensionsController.uninstall(extensionId, keepData);

            if (!result.success) {
                throw new Error(result.error || '卸载失败');
            }

            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (extensionsConfig.installed) {
                extensionsConfig.installed = extensionsConfig.installed.filter(
                    (ext: ExtensionInfo) => ext.id !== extensionId
                );
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`💾 ExtensionService: 已从本地存储移除扩展 ${extensionId}`);
            }

            this._registry.unregisterExtension(extensionId);
            this._onDidChangeExtensions.fire({added: [], removed: [extensionId]});

            console.log(`✅ ExtensionService: 扩展卸载成功 ${extensionId}`);
        } catch (error) {
            console.error('❌ ExtensionService: 卸载扩展失败:', error);
            throw error;
        }
    }

    async enableExtension(extensionId: string): Promise<void> {
        try {
            console.log('✅ ExtensionService: 启用扩展', extensionId);

            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            console.log(`   当前状态: enabled=${descriptor.enabled}, isBuiltin=${descriptor.isBuiltin}`);

            descriptor.enabled = true;

            this._updateExtensionEnabledState(extensionId, true);
            console.log(`   ✓ 已更新本地存储`);

            if (!descriptor.isBuiltin) {
                try {
                    console.log(`   ⏳ 同步到主进程...`);
                    const result = await extensionsController.enable(extensionId);
                    if (result.success) {
                        console.log(`   ✓ 已同步到主进程`);
                    } else {
                        console.warn('⚠️ ExtensionService: 同步启用状态到主进程失败:', result.error);
                    }
                } catch (error) {
                    console.warn('⚠️ ExtensionService: 同步启用状态到主进程失败:', error);
                }
            } else {
                console.log(`   ⊘ 内置扩展,跳过主进程同步`);
            }

            await this.activateById(extensionId);

            this._onDidChangeExtensions.fire({added: [], removed: [], changed: [extensionId]});

            console.log(`✅ ExtensionService: 扩展已启用 ${extensionId}`);
        } catch (error) {
            console.error('❌ ExtensionService: 启用扩展失败:', error);
            throw error;
        }
    }

    async disableExtension(extensionId: string): Promise<void> {
        try {
            console.log('⏸️ ExtensionService: 禁用扩展', extensionId);

            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            console.log(`   当前状态: enabled=${descriptor.enabled}, isBuiltin=${descriptor.isBuiltin}, canDisable=${descriptor.canDisable}`);

            if (descriptor.isBuiltin && !descriptor.canDisable) {
                throw new Error('该内置扩展不允许被禁用');
            }

            descriptor.enabled = false;

            this._updateExtensionEnabledState(extensionId, false);
            console.log(`   ✓ 已更新本地存储`);

            if (!descriptor.isBuiltin) {
                try {
                    console.log(`   ⏳ 同步到主进程...`);
                    const result = await extensionsController.disable(extensionId);
                    if (result.success) {
                        console.log(`   ✓ 已同步到主进程`);
                    } else {
                        console.warn('⚠️ ExtensionService: 同步禁用状态到主进程失败:', result.error);
                    }
                } catch (error) {
                    console.warn('⚠️ ExtensionService: 同步禁用状态到主进程失败:', error);
                }
            } else {
                console.log(`   ⊘ 内置扩展,跳过主进程同步`);
            }

            await this._activator!.deactivateExtension(extensionId);

            this._onDidChangeExtensions.fire({added: [], removed: [], changed: [extensionId]});

            console.log(`✅ ExtensionService: 扩展已禁用 ${extensionId}`);
        } catch (error) {
            console.error('❌ ExtensionService: 禁用扩展失败:', error);
            throw error;
        }
    }

    private _updateExtensionEnabledState(extensionId: string, enabled: boolean): void {
        try {
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (!extensionsConfig.installed) {
                extensionsConfig.installed = [];
            }
            if (!extensionsConfig.builtinStates) {
                extensionsConfig.builtinStates = {};
            }

            console.log(`   当前localStorage状态:`);
            console.log(`     - installed数量: ${extensionsConfig.installed.length}`);
            console.log(`     - builtinStates:`, extensionsConfig.builtinStates);

            const extIndex = extensionsConfig.installed.findIndex((ext: ExtensionInfo) => ext.id === extensionId);
            if (extIndex !== -1) {
                console.log(`   ➡️ 找到外部扩展,索引: ${extIndex}`);
                extensionsConfig.installed[extIndex].enabled = enabled;
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`   ✓ 已保存外部扩展 ${extensionId} 的启用状态: ${enabled}`);
                return;
            }

            console.log(`   ➡️ 未找到外部扩展,保存为内置扩展状态`);
            extensionsConfig.builtinStates[extensionId] = {enabled};
            cacheManager?.setLocalCache('extensions-config', extensionsConfig);
            console.log(`   ✓ 已保存内置扩展 ${extensionId} 的启用状态: ${enabled}`);
            console.log(`   更新后的builtinStates:`, extensionsConfig.builtinStates);
        } catch (error) {
            console.error('❌ ExtensionService: 保存扩展启用状态失败:', error);
        }
    }

    async getInstalledExtensions(): Promise<ExtensionInfo[]> {
        try {
            const result = await extensionsController.getInstalled();

            if (!result.success) {
                throw new Error(result.error || '获取扩展列表失败');
            }

            return result.extensions || [];
        } catch (error) {
            console.error('❌ ExtensionService: 获取扩展列表失败:', error);
            return [];
        }
    }

    getPermissionManager(): PermissionManager {
        return this._permissionManager;
    }

    getConfigurationManager(): ConfigurationManager {
        return this._configurationManager;
    }

    getDependencyResolver(): DependencyResolver {
        return this._dependencyResolver;
    }

    dispose(): void {
        super.dispose();

        if (this._activator) {
            this._activator.dispose();
        }

        if (this._permissionManager) {
            this._permissionManager.dispose();
        }

        if (this._configurationManager) {
            this._configurationManager.dispose();
        }

        this._onDidChangeExtensions.dispose();
        this._onWillActivateExtension.dispose();
        this._onDidActivateExtension.dispose();
        this._onDidActivateExtensionError.dispose();
    }
}

const IExtensionService = createDecorator('extensionService');

export {
    ExtensionService,
    IExtensionService
};
