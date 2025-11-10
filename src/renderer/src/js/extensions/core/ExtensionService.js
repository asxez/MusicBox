/**
 * ExtensionService - 扩展服务
 * 参考 VSCode 的 ExtensionService，提供扩展管理的核心功能
 */

import {cacheManager} from "@services/CacheManager";
import {ExtensionActivationReason, ExtensionActivator} from "@extensions/core/ExtensionActivator";
import {Emitter} from "@extensions/core/Event";
import {createDecorator} from "@extensions/core/Instantiation";
import {
    ActivationEvents,
    ContributionPoints,
    ExtensionDescriptor,
    extensionsRegistry
} from "@extensions/core/ExtensionsRegistry";
import {Disposable} from "@extensions/core/Lifecycle";
import {ExtensionHostManager} from "@extensions/core/ExtensionHostManager";
import {DependencyResolver} from "@extensions/core/ExtensionDependencies";
import {PermissionManager} from "@extensions/core/ExtensionPermissions";
import {ConfigurationManager} from "@extensions/core/ExtensionConfiguration";

/**
 * 扩展服务 - 管理所有扩展的生命周期
 */
class ExtensionService extends Disposable {
    constructor(instantiationService) {
        super();
        this._instantiationService = instantiationService;
        this._registry = extensionsRegistry;
        this._activator = null;
        this._isInitialized = false;
        this._onDidChangeExtensions = new Emitter();
        this._onWillActivateExtension = new Emitter();
        this._onDidActivateExtension = new Emitter();
        this._onDidActivateExtensionError = new Emitter();

        // 新增的管理器
        this._hostManager = new ExtensionHostManager(this);
        this._dependencyResolver = new DependencyResolver(this._registry);
        this._permissionManager = new PermissionManager();
        this._configurationManager = new ConfigurationManager();
    }

    /**
     * 扩展变化事件
     */
    get onDidChangeExtensions() {
        return this._onDidChangeExtensions.event;
    }

    /**
     * 扩展即将激活事件
     */
    get onWillActivateExtension() {
        return this._onWillActivateExtension.event;
    }

    /**
     * 扩展已激活事件
     */
    get onDidActivateExtension() {
        return this._onDidActivateExtension.event;
    }

    /**
     * 扩展激活错误事件
     */
    get onDidActivateExtensionError() {
        return this._onDidActivateExtensionError.event;
    }

    /**
     * 初始化扩展服务
     */
    async initialize() {
        if (this._isInitialized) {
            console.warn('⚠️ ExtensionService: 已经初始化');
            return;
        }

        try {
            console.log('🔌 ExtensionService: 开始初始化');

            // 创建激活器（传入权限和配置管理器）
            this._activator = new ExtensionActivator(
                this._registry,
                this._instantiationService,
                this._permissionManager,
                this._configurationManager
            );

            // 启动扩展主机
            await this._hostManager.startAll();

            // 注册核心扩展点
            this._registerCoreExtensionPoints();

            // 扫描并加载扩展
            await this._scanAndLoadExtensions();

            // 构建依赖图
            this._dependencyResolver.buildDependencyGraph();

            // 检测循环依赖
            const cycles = this._dependencyResolver.detectCircularDependencies();
            if (cycles.length > 0) {
                console.warn('⚠️ ExtensionService: 检测到循环依赖:', cycles);
            }

            this._isInitialized = true;
            console.log('✅ ExtensionService: 初始化完成（准备激活启动扩展）');

            // 激活启动扩展
            await this._activateStartupExtensions();

        } catch (error) {
            console.error('❌ ExtensionService: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 注册核心扩展点
     */
    _registerCoreExtensionPoints() {
        // 命令扩展点
        this._registry.registerExtensionPoint(ContributionPoints.COMMANDS, {
            description: '注册命令'
        });

        // 菜单扩展点
        this._registry.registerExtensionPoint(ContributionPoints.MENUS, {
            description: '注册菜单项'
        });

        // 视图扩展点
        this._registry.registerExtensionPoint(ContributionPoints.VIEWS, {
            description: '注册视图'
        });

        // 配置扩展点
        this._registry.registerExtensionPoint(ContributionPoints.CONFIGURATION, {
            description: '注册配置项'
        });

        // 主题扩展点
        this._registry.registerExtensionPoint(ContributionPoints.THEMES, {
            description: '注册主题'
        });

        // 快捷键扩展点
        this._registry.registerExtensionPoint(ContributionPoints.KEYBINDINGS, {
            description: '注册快捷键'
        });

        console.log('✅ ExtensionService: 核心扩展点注册完成');
    }

    /**
     * 扫描并加载扩展
     */
    async _scanAndLoadExtensions() {
        try {
            console.log('🔍 ExtensionService._scanAndLoadExtensions: 开始');

            // 注册内置扩展（异步）
            await this._registerBuiltinExtensions();

            // 同步主进程注册表到本地存储（解决存储不一致问题）
            await this._syncExtensionsFromMainProcess();

            // 从本地存储加载扩展配置
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            const installedExtensions = extensionsConfig.installed || [];

            console.log(`🔌 ExtensionService: 发现 ${installedExtensions.length} 个已安装的扩展`);

            // 🔍 调试：输出即将加载的扩展列表
            console.log(`🔍 ExtensionService: 即将加载的扩展列表:`);
            installedExtensions.forEach((ext, index) => {
                console.log(`   [${index}] ${ext.id}: isBuiltin=${ext.isBuiltin || false}`);
            });

            // 加载每个扩展
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

    /**
     * 从主进程同步扩展列表到本地存储
     * 解决主进程注册表和渲染进程localStorage不一致的问题
     * 注意：只同步外部插件，内置插件通过 builtinStates 管理
     */
    async _syncExtensionsFromMainProcess() {
        try {
            console.log('🔄 ExtensionService: 同步主进程扩展列表');

            // 获取主进程的已安装扩展列表
            const result = await window.electronAPI.extensions.getInstalled();

            if (!result.success) {
                console.warn('⚠️ ExtensionService: 获取主进程扩展列表失败:', result.error);
                return;
            }

            const allMainProcessExtensions = result.extensions || [];
            console.log(`📋 ExtensionService: 主进程扩展总数: ${allMainProcessExtensions.length}`);

            // 🔑 关键修复：过滤掉内置插件，只同步外部插件
            const mainProcessExtensions = allMainProcessExtensions.filter(ext => !ext.isBuiltin);
            console.log(`📋 ExtensionService: 主进程外部扩展数量: ${mainProcessExtensions.length}`);

            // 输出主进程扩展的详细信息（用于调试）
            allMainProcessExtensions.forEach(ext => {
                console.log(`   - ${ext.id}: isBuiltin=${ext.isBuiltin}, enabled=${ext.enabled}, extensionLocation="${ext.extensionLocation || '(空)'}"`);
            });

            // 获取本地存储的扩展配置
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            const localExtensions = extensionsConfig.installed || [];
            console.log(`💾 ExtensionService: 本地存储扩展数量: ${localExtensions.length}`);

            // 输出本地存储的扩展详细信息（用于调试）
            localExtensions.forEach((ext, index) => {
                console.log(`   [${index}] ${ext.id}: isBuiltin=${ext.isBuiltin || false}`);
            });

            // 创建本地扩展映射（保留enabled状态）
            const localExtensionMap = new Map(localExtensions.map(ext => [ext.id, ext]));
            const mainExtensionIds = new Set(mainProcessExtensions.map(ext => ext.id));

            // 找出需要添加到本地存储的扩展（主进程有但本地没有）
            const extensionsToAdd = mainProcessExtensions.filter(ext => !localExtensionMap.has(ext.id));

            // 找出需要从本地存储删除的扩展（本地有但主进程没有）
            const extensionsToRemove = localExtensions.filter(ext => !mainExtensionIds.has(ext.id));

            console.log(`🔄 ExtensionService: 需要同步 - 添加 ${extensionsToAdd.length} 个，删除 ${extensionsToRemove.length} 个`);

            // 始终进行同步，合并主进程数据和本地enabled状态
            const updatedExtensions = mainProcessExtensions.map(mainExt => {
                const localExt = localExtensionMap.get(mainExt.id);
                if (localExt) {
                    // 合并：使用主进程的最新数据，但保留本地的enabled状态
                    const merged = {
                        ...mainExt,
                        // 优先使用主进程的enabled状态（因为主进程是权威来源）
                        // 只有当主进程没有enabled字段时才使用本地的
                        enabled: mainExt.enabled !== undefined ? mainExt.enabled :
                            (localExt.enabled !== undefined ? localExt.enabled : true)
                    };
                    return merged;
                }
                // 新扩展，使用主进程的数据
                console.log(`➕ ExtensionService: 新增扩展 ${mainExt.id}, enabled=${mainExt.enabled}`);
                return mainExt;
            });

            // 🔧 清理：移除错误添加到 installed 数组中的内置插件
            const cleanedExtensions = updatedExtensions.filter(ext => {
                if (ext.isBuiltin) {
                    console.warn(`⚠️ ExtensionService: 检测到内置插件 ${ext.id} 在 installed 数组中，已移除`);
                    return false;
                }
                return true;
            });

            if (cleanedExtensions.length !== updatedExtensions.length) {
                console.log(`🧹 ExtensionService: 清理了 ${updatedExtensions.length - cleanedExtensions.length} 个错误的内置插件记录`);
            }

            extensionsConfig.installed = cleanedExtensions;
            cacheManager?.setLocalCache('extensions-config', extensionsConfig);

            console.log(`✅ ExtensionService: 扩展列表同步完成，当前共 ${cleanedExtensions.length} 个外部扩展`);

            // 🔍 调试：输出同步后的installed数组内容
            console.log(`🔍 ExtensionService: 同步后的installed数组:`);
            cleanedExtensions.forEach((ext, index) => {
                console.log(`   [${index}] ${ext.id}: isBuiltin=${ext.isBuiltin || false}, enabled=${ext.enabled}`);
            });

        } catch (error) {
            console.error('❌ ExtensionService: 同步扩展列表失败:', error);
        }
    }

    /**
     * 注册内置扩展
     * 动态扫描 builtin 目录下的所有内置扩展
     */
    async _registerBuiltinExtensions() {
        try {
            console.log('🔌 ExtensionService: 扫描并注册内置扩展');

            const builtinPath = 'js/extensions/builtin';
            const builtinExtensions = await this._scanBuiltinExtensions(builtinPath);

            console.log(`📦 ExtensionService: 发现 ${builtinExtensions.length} 个内置扩展`);

            // 读取已保存的内置插件状态
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            const builtinStates = extensionsConfig.builtinStates || {};
            console.log(`📋 ExtensionService: 已保存的内置插件状态:`, builtinStates);

            for (const manifest of builtinExtensions) {
                try {
                    // 标记为内置扩展
                    manifest.isBuiltin = true;

                    // 恢复已保存的enabled状态
                    if (builtinStates[manifest.id]) {
                        manifest.enabled = builtinStates[manifest.id].enabled;
                        console.log(`🔄 ExtensionService: 恢复内置扩展 ${manifest.id} 的状态: enabled=${manifest.enabled}`);
                    }

                    // 创建扩展描述符
                    const descriptor = new ExtensionDescriptor(manifest);

                    // 注册到注册表
                    this._registry.registerExtension(descriptor);

                    // 注册权限
                    const permissions = this._permissionManager.extractPermissions(manifest);
                    this._permissionManager.registerExtensionPermissions(descriptor.id, permissions);

                    // 注册配置
                    if (manifest.contributes && manifest.contributes.configuration) {
                        this._configurationManager.registerConfiguration(
                            descriptor.id,
                            manifest.contributes.configuration
                        );
                    }

                    console.log(`✅ ExtensionService: 已注册内置扩展 ${descriptor.id}, enabled=${descriptor.enabled}`);
                } catch (error) {
                    console.error(`❌ ExtensionService: 注册内置扩展 ${manifest.id} 失败:`, error);
                }
            }

            console.log('✅ ExtensionService: 内置扩展注册完成');

        } catch (error) {
            console.error('❌ ExtensionService: 注册内置扩展失败:', error);
        }
    }

    /**
     * 扫描内置扩展目录
     * @param {String} builtinPath 内置扩展目录路径
     */
    async _scanBuiltinExtensions(builtinPath) {
        const extensions = [];

        try {
            // 内置扩展列表（硬编码目录名，避免需要文件系统 API）
            const builtinExtensionDirs = [
                'hello-world',
                'extension-api-test',
                'advanced-extension',
                'keybindings-demo',
            ];

            for (const dirName of builtinExtensionDirs) {
                try {
                    const manifestPath = `${builtinPath}/${dirName}/manifest.json`;
                    const manifest = await this._loadManifestFromPath(manifestPath);

                    if (manifest) {
                        // 设置扩展位置
                        manifest.extensionLocation = `${builtinPath}/${dirName}`;

                        // 设置主文件路径（相对于扩展目录）
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

    /**
     * 从路径加载 manifest.json
     * @param {String} manifestPath manifest.json 文件路径
     */
    async _loadManifestFromPath(manifestPath) {
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

    /**
     * 加载单个扩展
     * @param {Object} manifest 扩展清单
     */
    async _loadExtension(manifest) {
        try {
            // 创建扩展描述符
            const descriptor = new ExtensionDescriptor(manifest);

            // 注册到注册表
            this._registry.registerExtension(descriptor);

            // 注册权限
            const permissions = this._permissionManager.extractPermissions(manifest);
            this._permissionManager.registerExtensionPermissions(descriptor.id, permissions);

            // 注册配置
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

    /**
     * 激活启动扩展
     */
    async _activateStartupExtensions() {
        try {
            // 只激活已启用的扩展
            const allExtensions = this._registry.getAllExtensions();
            const enabledExtensions = allExtensions.filter(ext => ext.enabled !== false);

            console.log(`🔌 ExtensionService: 发现 ${enabledExtensions.length} 个已启用的扩展（共 ${allExtensions.length} 个）`);

            // 获取需要启动激活的扩展
            const startupExtensions = enabledExtensions.filter(ext => {
                return ext.activationEvents && (
                    ext.activationEvents.includes(ActivationEvents.ON_START_UP) ||
                    ext.activationEvents.includes(ActivationEvents.WILDCARD)
                );
            });

            // 按依赖关系排序
            const extensionIds = startupExtensions.map(ext => ext.id);
            let sortedIds;
            try {
                sortedIds = this._dependencyResolver.topologicalSort(extensionIds);
                console.log(`📊 ExtensionService: 依赖排序完成，顺序:`, sortedIds);
            } catch (error) {
                console.warn('⚠️ ExtensionService: 依赖排序失败，使用原始顺序:', error);
                sortedIds = extensionIds;
            }

            // 按顺序激活扩展
            for (const extensionId of sortedIds) {
                try {
                    // 检查依赖
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

    /**
     * 通过ID激活扩展
     * @param {String} extensionId
     */
    async activateById(extensionId) {
        if (!this._isInitialized) {
            throw new Error('ExtensionService 未初始化');
        }

        this._onWillActivateExtension.fire({extensionId});

        try {
            const reason = new ExtensionActivationReason(false, extensionId, 'api');
            await this._activator.activateById(extensionId, reason);

            this._onDidActivateExtension.fire({extensionId});

        } catch (error) {
            this._onDidActivateExtensionError.fire({extensionId, error});
            throw error;
        }
    }

    /**
     * 通过事件激活扩展
     * @param {String} activationEvent
     */
    async activateByEvent(activationEvent) {
        if (!this._isInitialized) {
            console.warn('⚠️ ExtensionService: 未初始化，延迟激活');
            // 等待初始化完成
            await new Promise(resolve => {
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

        await this._activator.activateByEvent(activationEvent, false);
    }

    /**
     * 安装扩展
     * @param {Object} manifest 扩展清单
     */
    async installExtension(manifest) {
        try {
            // 验证清单
            if (!manifest.id || !manifest.name || !manifest.version) {
                throw new Error('扩展清单不完整');
            }

            // 检查是否已安装
            if (this._registry.getExtension(manifest.id)) {
                throw new Error(`扩展 ${manifest.id} 已安装`);
            }

            // 保存到本地存储
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (!extensionsConfig.installed) {
                extensionsConfig.installed = [];
            }
            extensionsConfig.installed.push(manifest);
            cacheManager?.setLocalCache('extensions-config', extensionsConfig);

            // 加载扩展
            await this._loadExtension(manifest);

            // 触发变化事件
            this._onDidChangeExtensions.fire({added: [manifest.id], removed: []});

            console.log(`✅ ExtensionService: 安装扩展 ${manifest.id}`);

            return manifest.id;

        } catch (error) {
            console.error('❌ ExtensionService: 安装扩展失败:', error);
            throw error;
        }
    }

    /**
     * 卸载扩展
     * @param {String} extensionId
     */
    async uninstallExtension(extensionId) {
        try {
            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            // 停用扩展
            await this._activator.deactivateExtension(extensionId);

            // 从注册表移除
            this._registry.unregisterExtension(extensionId);

            // 从本地存储移除
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (extensionsConfig.installed) {
                extensionsConfig.installed = extensionsConfig.installed.filter(
                    ext => ext.id !== extensionId
                );
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
            }

            // 触发变化事件
            this._onDidChangeExtensions.fire({added: [], removed: [extensionId]});

            console.log(`✅ ExtensionService: 卸载扩展 ${extensionId}`);

        } catch (error) {
            console.error('❌ ExtensionService: 卸载扩展失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有扩展
     */
    getExtensions() {
        const extensions = this._registry.getAllExtensions();
        // 为每个扩展添加 isActive 状态
        return extensions.map(ext => ({
            ...ext,
            isActive: this.isExtensionActivated(ext.id)
        }));
    }

    /**
     * 检查扩展是否已激活
     * @param {String} extensionId
     */
    isExtensionActivated(extensionId) {
        if (!this._activator) {
            return false;
        }
        const activated = this._activator.getActivatedExtension(extensionId);
        return activated !== undefined && !activated.activationFailed;
    }

    /**
     * 获取扩展
     * @param {String} extensionId
     */
    getExtension(extensionId) {
        return this._registry.getExtension(extensionId);
    }

    /**
     * 获取扩展导出
     * @param {String} extensionId
     */
    getExtensionExports(extensionId) {
        return this._activator.getExtensionExports(extensionId);
    }

    /**
     * 从文件安装扩展（通过主进程）
     * @param {String} filePath - ZIP 文件路径
     */
    async installExtensionFromFile(filePath) {
        try {
            console.log('📦 ExtensionService: 从文件安装扩展', filePath);
            console.log('📦 ExtensionService: filePath 类型:', typeof filePath);
            console.log('📦 ExtensionService: 调用 IPC 前的 filePath:', filePath);

            // 通过 IPC 调用主进程安装
            const result = await window.electronAPI.extensions.installFromFile(filePath);

            console.log('📦 ExtensionService: IPC 调用返回结果:', result);

            if (!result.success) {
                throw new Error(result.error || '安装失败');
            }

            const extensionInfo = result.extension;

            // 同步到本地存储（确保与主进程注册表一致）
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (!extensionsConfig.installed) {
                extensionsConfig.installed = [];
            }

            // 检查是否已存在，避免重复添加
            const existingIndex = extensionsConfig.installed.findIndex(ext => ext.id === extensionInfo.id);
            if (existingIndex === -1) {
                extensionsConfig.installed.push(extensionInfo);
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`💾 ExtensionService: 已同步扩展到本地存储 ${extensionInfo.id}`);
            } else {
                // 更新现有扩展信息
                extensionsConfig.installed[existingIndex] = extensionInfo;
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`💾 ExtensionService: 已更新本地存储中的扩展 ${extensionInfo.id}`);
            }

            // 加载扩展到注册表
            await this._loadExtension(extensionInfo);

            // 如果扩展设置为启动激活，立即激活
            if (extensionInfo.activationEvents && extensionInfo.activationEvents.includes('onStartUp')) {
                await this.activateById(extensionInfo.id);
            }

            // 触发变化事件
            this._onDidChangeExtensions.fire({added: [extensionInfo.id], removed: []});

            console.log(`✅ ExtensionService: 扩展安装成功 ${extensionInfo.id}`);
            return extensionInfo;

        } catch (error) {
            console.error('❌ ExtensionService: 从文件安装扩展失败:', error);
            throw error;
        }
    }

    /**
     * 卸载扩展（通过主进程）
     * @param {String} extensionId
     * @param {Boolean} keepData - 是否保留数据
     */
    async uninstallExtensionFromDisk(extensionId, keepData = false) {
        try {
            console.log('🗑️ ExtensionService: 卸载扩展', extensionId);

            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            if (descriptor.isBuiltin) {
                throw new Error('内置扩展不能卸载');
            }

            // 停用扩展
            await this._activator.deactivateExtension(extensionId);

            // 通过 IPC 调用主进程卸载
            const result = await window.electronAPI.extensions.uninstall(extensionId, keepData);

            if (!result.success) {
                throw new Error(result.error || '卸载失败');
            }

            // 从本地存储移除（与主进程注册表保持同步）
            const extensionsConfig = cacheManager?.getLocalCache('extensions-config') || {};
            if (extensionsConfig.installed) {
                extensionsConfig.installed = extensionsConfig.installed.filter(
                    ext => ext.id !== extensionId
                );
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`💾 ExtensionService: 已从本地存储移除扩展 ${extensionId}`);
            }

            // 从注册表移除
            this._registry.unregisterExtension(extensionId);

            // 触发变化事件
            this._onDidChangeExtensions.fire({added: [], removed: [extensionId]});

            console.log(`✅ ExtensionService: 扩展卸载成功 ${extensionId}`);

        } catch (error) {
            console.error('❌ ExtensionService: 卸载扩展失败:', error);
            throw error;
        }
    }

    /**
     * 启用扩展
     * @param {String} extensionId
     */
    async enableExtension(extensionId) {
        try {
            console.log('✅ ExtensionService: 启用扩展', extensionId);

            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            console.log(`   当前状态: enabled=${descriptor.enabled}, isBuiltin=${descriptor.isBuiltin}`);

            // 更新描述符状态
            descriptor.enabled = true;

            // 更新本地存储
            this._updateExtensionEnabledState(extensionId, true);
            console.log(`   ✓ 已更新本地存储`);

            // 同步到主进程（如果不是内置扩展）
            if (!descriptor.isBuiltin) {
                try {
                    console.log(`   ⏳ 同步到主进程...`);
                    const result = await window.electronAPI.extensions.enable(extensionId);
                    if (result.success) {
                        console.log(`   ✓ 已同步到主进程`);
                    } else {
                        console.warn('⚠️ ExtensionService: 同步启用状态到主进程失败:', result.error);
                    }
                } catch (error) {
                    console.warn('⚠️ ExtensionService: 同步启用状态到主进程失败:', error);
                }
            } else {
                console.log(`   ⊘ 内置扩展，跳过主进程同步`);
            }

            // 激活扩展
            await this.activateById(extensionId);

            // 触发变化事件
            this._onDidChangeExtensions.fire({added: [], removed: [], changed: [extensionId]});

            console.log(`✅ ExtensionService: 扩展已启用 ${extensionId}`);

        } catch (error) {
            console.error('❌ ExtensionService: 启用扩展失败:', error);
            throw error;
        }
    }

    /**
     * 禁用扩展
     * @param {String} extensionId
     */
    async disableExtension(extensionId) {
        try {
            console.log('⏸️ ExtensionService: 禁用扩展', extensionId);

            const descriptor = this._registry.getExtension(extensionId);
            if (!descriptor) {
                throw new Error(`未找到扩展: ${extensionId}`);
            }

            console.log(`   当前状态: enabled=${descriptor.enabled}, isBuiltin=${descriptor.isBuiltin}, canDisable=${descriptor.canDisable}`);

            // 检查是否允许禁用：内置扩展需要检查 canDisable 属性
            if (descriptor.isBuiltin && !descriptor.canDisable) {
                throw new Error('该内置扩展不允许被禁用');
            }

            // 更新描述符状态
            descriptor.enabled = false;

            // 更新本地存储
            this._updateExtensionEnabledState(extensionId, false);
            console.log(`   ✓ 已更新本地存储`);

            // 同步到主进程（如果不是内置扩展）
            if (!descriptor.isBuiltin) {
                try {
                    console.log(`   ⏳ 同步到主进程...`);
                    const result = await window.electronAPI.extensions.disable(extensionId);
                    if (result.success) {
                        console.log(`   ✓ 已同步到主进程`);
                    } else {
                        console.warn('⚠️ ExtensionService: 同步禁用状态到主进程失败:', result.error);
                    }
                } catch (error) {
                    console.warn('⚠️ ExtensionService: 同步禁用状态到主进程失败:', error);
                }
            } else {
                console.log(`   ⊘ 内置扩展，跳过主进程同步`);
            }

            // 停用扩展
            await this._activator.deactivateExtension(extensionId);

            // 触发变化事件
            this._onDidChangeExtensions.fire({added: [], removed: [], changed: [extensionId]});

            console.log(`✅ ExtensionService: 扩展已禁用 ${extensionId}`);

        } catch (error) {
            console.error('❌ ExtensionService: 禁用扩展失败:', error);
            throw error;
        }
    }

    /**
     * 更新扩展的启用状态到本地存储
     * @param {String} extensionId
     * @param {Boolean} enabled
     */
    _updateExtensionEnabledState(extensionId, enabled) {
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

            // 查找并更新扩展配置（外部插件）
            const extIndex = extensionsConfig.installed.findIndex(ext => ext.id === extensionId);
            if (extIndex !== -1) {
                console.log(`   ➡️ 找到外部扩展，索引: ${extIndex}`);
                extensionsConfig.installed[extIndex].enabled = enabled;
                cacheManager?.setLocalCache('extensions-config', extensionsConfig);
                console.log(`   ✓ 已保存外部扩展 ${extensionId} 的启用状态: ${enabled}`);
                return;
            }

            // 如果不是外部插件，保存到内置插件状态映射中
            console.log(`   ➡️ 未找到外部扩展，保存为内置扩展状态`);
            extensionsConfig.builtinStates[extensionId] = {enabled};
            cacheManager?.setLocalCache('extensions-config', extensionsConfig);
            console.log(`   ✓ 已保存内置扩展 ${extensionId} 的启用状态: ${enabled}`);
            console.log(`   更新后的builtinStates:`, extensionsConfig.builtinStates);

        } catch (error) {
            console.error('❌ ExtensionService: 保存扩展启用状态失败:', error);
        }
    }

    /**
     * 获取已安装的扩展列表（从主进程）
     */
    async getInstalledExtensions() {
        try {
            const result = await window.electronAPI.extensions.getInstalled();

            if (!result.success) {
                throw new Error(result.error || '获取扩展列表失败');
            }

            return result.extensions || [];

        } catch (error) {
            console.error('❌ ExtensionService: 获取扩展列表失败:', error);
            return [];
        }
    }

    /**
     * 获取权限管理器
     */
    getPermissionManager() {
        return this._permissionManager;
    }

    /**
     * 获取配置管理器
     */
    getConfigurationManager() {
        return this._configurationManager;
    }

    /**
     * 获取依赖解析器
     */
    getDependencyResolver() {
        return this._dependencyResolver;
    }

    /**
     * 获取扩展主机管理器
     */
    getHostManager() {
        return this._hostManager;
    }

    /**
     * 释放资源
     */
    dispose() {
        super.dispose();

        if (this._activator) {
            this._activator.dispose();
        }

        if (this._hostManager) {
            this._hostManager.dispose();
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

// 创建服务标识符
const IExtensionService = createDecorator('extensionService');

export {
    ExtensionService,
    IExtensionService
};
