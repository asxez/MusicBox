/**
 * 插件管理器 - MusicBox插件系统核心
 * 负责插件的加载、卸载、生命周期管理和API提供
 */

class PluginManager extends EventEmitter {
    constructor() {
        super();
        this.plugins = new Map(); // 已加载的插件实例
        this.pluginConfigs = new Map(); // 插件配置信息
        this.pluginStates = new Map(); // 插件状态（enabled/disabled）
        this.apiRegistry = new Map(); // 插件API注册表
        this.isInitialized = false;

        // 插件目录路径
        this.pluginDirectory = 'plugins';

        // 插件API上下文
        this.pluginContext = null;

        // 插件加载器和API实例
        this.loader = null;
        this.api = null;
    }

    // 初始化插件管理器
    async initialize() {
        if (this.isInitialized) {
            console.warn('🔌 PluginManager: 已经初始化过了');
            return;
        }

        try {
            // 获取已创建的插件加载器和API实例
            this.loader = window.pluginLoader;
            this.api = window.pluginAPI;

            // 验证依赖组件
            if (!this.loader) {
                throw new Error('PluginLoader 未初始化');
            }

            if (!this.api) {
                throw new Error('PluginAPI 未初始化');
            }

            // 创建插件API上下文
            this.createPluginContext();

            // 加载插件配置
            await this.loadPluginConfigs();

            // 自动加载已启用的插件
            await this.loadEnabledPlugins();

            this.isInitialized = true;
            this.emit('initialized');
            console.log('✅ PluginManager: 插件管理器初始化完成');

        } catch (error) {
            console.error('❌ PluginManager: 初始化失败:', error);
            throw error;
        }
    }

    // 应用完全初始化后的回调
    onAppReady(app) {
        try {
            console.log('🔌 PluginManager: 收到应用就绪通知');
            console.log('🔌 PluginManager: 应用组件状态:', {
                componentsCount: Object.keys(app.components || {}).length,
                availableComponents: Object.keys(app.components || {}),
                appInitialized: app.isInitialized
            });

            // 更新插件上下文
            if (this.api && typeof this.api.createPluginContext === 'function') {
                this.pluginContext = this.api.createPluginContext('system');
                console.log('🔌 PluginManager: 插件上下文已更新');
            }

            // 触发应用就绪事件
            this.emit('appReady', app);

            // 若有等待应用就绪的插件，则激活它们
            this.processWaitingPlugins();

        } catch (error) {
            console.error('❌ PluginManager: 处理应用就绪通知失败:', error);
        }
    }

    // 处理等待应用就绪的插件
    processWaitingPlugins() {
        // 重新验证所有已加载但可能因为组件未就绪而失败的插件
        for (const [pluginId, plugin] of this.plugins) {
            if (plugin.isActive && plugin.needsAppReady) {
                console.log(`🔌 PluginManager: 重新初始化插件 ${pluginId}`);
                // 此处可重新初始化插件的UI组件
            }
        }
    }

    // 创建插件API上下文
    // 为插件提供访问应用功能的接口
    createPluginContext() {
        this.pluginContext = {
            // 应用核心API
            app: window.app || null,
            api: window.api || null,
            
            // 高权限
            document: document,
            window: window,
            electronAPI: window.electronAPI,
            
            // 组件系统
            Component: window.Component,
            EventEmitter: window.EventEmitter,
            
            // 工具函数
            utils: {
                createElement: this.createElement.bind(this),
                addCSS: this.addCSS.bind(this),
                removeCSS: this.removeCSS.bind(this),
                showNotification: this.showNotification.bind(this),
                registerCommand: this.registerCommand.bind(this),
                unregisterCommand: this.unregisterCommand.bind(this)
            },
            
            // 插件间通信
            messaging: {
                emit: this.emit.bind(this),
                on: this.on.bind(this),
                off: this.off.bind(this)
            },
            
            // 存储API
            storage: {
                get: this.getPluginStorage.bind(this),
                set: this.setPluginStorage.bind(this),
                remove: this.removePluginStorage.bind(this)
            },
            
            // 系统API
            system: {
                fs: window.electronAPI.fs.fs || null,
                path: window.electronAPI.path || null,
                os: window.electronAPI.os || null
            }
        };
        
        console.log('🔌 PluginManager: 插件API上下文创建完成');
    }

    // 加载插件配置
    async loadPluginConfigs() {
        try {
            const configs = window.cacheManager?.getLocalCache('plugin-configs') || {};
            const states = window.cacheManager?.getLocalCache('plugin-states') || {};
            
            for (const [pluginId, config] of Object.entries(configs)) {
                this.pluginConfigs.set(pluginId, config);
                this.pluginStates.set(pluginId, states[pluginId] !== false); // 默认启用
            }
            
            console.log(`🔌 PluginManager: 加载了 ${this.pluginConfigs.size} 个插件配置`);
            
        } catch (error) {
            console.error('❌ PluginManager: 加载插件配置失败:', error);
        }
    }

    // 保存插件配置
    savePluginConfigs() {
        try {
            const configs = Object.fromEntries(this.pluginConfigs);
            const states = Object.fromEntries(this.pluginStates);
            window.cacheManager?.setLocalCache('plugin-configs', configs);
            window.cacheManager?.setLocalCache('plugin-states', states);
        } catch (error) {
            console.error('❌ PluginManager: 保存插件配置失败:', error);
        }
    }

    // 加载已启用的插件
    async loadEnabledPlugins() {
        const enabledPlugins = Array.from(this.pluginStates.entries())
            .filter(([_, enabled]) => enabled)
            .map(([pluginId, _]) => pluginId);
        for (const pluginId of enabledPlugins) {
            try {
                await this.loadPlugin(pluginId);
            } catch (error) {
                console.error(`❌ PluginManager: 加载插件 ${pluginId} 失败:`, error);
            }
        }
    }

    // 加载单个插件
    async loadPlugin(pluginId) {
        if (this.plugins.has(pluginId)) {
            console.warn(`🔌 PluginManager: 插件 ${pluginId} 已经加载`);
            return;
        }

        const config = this.pluginConfigs.get(pluginId);
        if (!config) {
            throw new Error(`插件配置不存在: ${pluginId}`);
        }

        try {
            // 使用插件加载器加载脚本
            const pluginModule = await this.loader.loadPluginScript(config);

            // 验证插件模块
            if (!pluginModule) {
                throw new Error(`插件模块加载失败: ${pluginId}`);
            }

            // 创建插件专用上下文
            const pluginContext = this.api.createPluginContext(pluginId);

            // 获取插件构造函数
            let PluginConstructor = null;

            // 多种方式获取构造函数
            if (pluginModule.default && typeof pluginModule.default === 'function') {
                PluginConstructor = pluginModule.default;
                console.log(`🔌 PluginManager: 使用 pluginModule.default 作为构造函数`);
            } else if (pluginModule.PluginClass && typeof pluginModule.PluginClass === 'function') {
                PluginConstructor = pluginModule.PluginClass;
                console.log(`🔌 PluginManager: 使用 pluginModule.PluginClass 作为构造函数`);
            } else {
                // 查找任何可能的构造函数
                const possibleConstructors = Object.keys(pluginModule).filter(key =>
                    typeof pluginModule[key] === 'function' &&
                    key !== 'default'
                );

                if (possibleConstructors.length > 0) {
                    PluginConstructor = pluginModule[possibleConstructors[0]];
                    console.log(`🔌 PluginManager: 使用 pluginModule.${possibleConstructors[0]} 作为构造函数`);
                }
            }

            if (!PluginConstructor || typeof PluginConstructor !== 'function') {
                console.error(`❌ PluginManager: 插件模块结构:`, {
                    hasDefault: !!pluginModule.default,
                    defaultType: typeof pluginModule.default,
                    hasPluginClass: !!pluginModule.PluginClass,
                    pluginClassType: typeof pluginModule.PluginClass,
                    allKeys: Object.keys(pluginModule),
                    moduleType: typeof pluginModule
                });
                throw new Error(`插件构造函数未找到或不是有效的构造函数: ${pluginId}`);
            }

            // 创建插件实例
            let pluginInstance;
            try {
                pluginInstance = new PluginConstructor(pluginContext);
                console.log(`✅ PluginManager: 插件实例创建成功 ${pluginId}`);
            } catch (constructorError) {
                console.error(`❌ PluginManager: 插件实例化失败:`, constructorError);
                throw new Error(`插件实例化失败: ${constructorError.message}`);
            }

            // 设置插件基本信息
            if (pluginInstance instanceof PluginBase) {
                pluginInstance.id = pluginId;
                pluginInstance.name = config.name;
                pluginInstance.version = config.version;

                // 如果插件有元数据，合并到配置中
                if (pluginInstance.metadata) {
                    const metadata = pluginInstance.metadata;
                    config.name = metadata.name || config.name;
                    config.version = metadata.version || config.version;
                    config.description = metadata.description || config.description;
                    config.author = metadata.author || config.author;
                    config.permissions = metadata.permissions || config.permissions;
                    config.category = metadata.category || config.category;

                    // 更新配置存储
                    this.pluginConfigs.set(pluginId, config);
                    this.savePluginConfigs();
                }
            }

            // 调用插件的activate方法
            if (typeof pluginInstance.activate === 'function') {
                await pluginInstance.activate();
            }

            // 保存插件实例
            this.plugins.set(pluginId, pluginInstance);

            this.emit('pluginLoaded', { pluginId, plugin: pluginInstance });
        } catch (error) {
            console.error(`❌ PluginManager: 加载插件 ${pluginId} 失败:`, error);
            throw error;
        }
    }

    // 卸载插件
    async unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            console.warn(`🔌 PluginManager: 插件 ${pluginId} 未加载`);
            return;
        }

        try {
            // 调用插件的deactivate方法
            if (typeof plugin.deactivate === 'function') {
                await plugin.deactivate();
            }

            // 清理插件的事件监听器
            if (this.api && typeof this.api.removeAllPluginEventListeners === 'function') {
                this.api.removeAllPluginEventListeners(pluginId);
                console.log(`✅ PluginManager: 已清理插件 ${pluginId} 的所有事件监听器`);
            }

            // 使用插件加载器卸载脚本
            if (this.loader) {
                this.loader.unloadPluginScript(pluginId);
            }

            // 移除插件实例
            this.plugins.delete(pluginId);

            console.log(`✅ PluginManager: 插件 ${pluginId} 卸载完成`);
            this.emit('pluginUnloaded', { pluginId });
        } catch (error) {
            console.error(`❌ PluginManager: 卸载插件 ${pluginId} 失败:`, error);
            throw error;
        }
    }

    // 启用插件
    async enablePlugin(pluginId) {
        this.pluginStates.set(pluginId, true);
        this.savePluginConfigs();
        
        if (!this.plugins.has(pluginId)) {
            await this.loadPlugin(pluginId);
        }
        
        this.emit('pluginEnabled', { pluginId });
    }

    // 禁用插件
    async disablePlugin(pluginId) {
        this.pluginStates.set(pluginId, false);
        this.savePluginConfigs();
        
        if (this.plugins.has(pluginId)) {
            await this.unloadPlugin(pluginId);
        }
        
        this.emit('pluginDisabled', { pluginId });
    }

    // 获取所有插件信息
    getAllPlugins() {
        const plugins = [];
        for (const [pluginId, config] of this.pluginConfigs) {
            plugins.push({
                id: pluginId,
                config: config,
                enabled: this.pluginStates.get(pluginId) || false,
                loaded: this.plugins.has(pluginId)
            });
        }
        return plugins;
    }

    // 动态加载插件脚本
    async loadPluginScript(config) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = config.main || `${this.pluginDirectory}/${config.id}/index.js`;

            script.onload = () => {
                // 假设插件会注册到全局变量中
                const pluginClass = window[`Plugin_${config.id}`] || window.PluginClass;
                if (pluginClass) {
                    resolve({ default: pluginClass });
                } else {
                    reject(new Error(`插件类未找到: ${config.id}`));
                }
            };

            script.onerror = () => {
                reject(new Error(`加载插件脚本失败: ${config.id}`));
            };

            document.head.appendChild(script);
        });
    }

    // --- 工具方法 ---

    // 创建DOM元素
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        // 设置属性
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        }

        // 添加子元素
        for (const child of children) {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        }

        return element;
    }

    // 添加CSS样式
    addCSS(pluginId, css) {
        const styleId = `plugin-style-${pluginId}`;
        let styleElement = document.getElementById(styleId);

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = css;
        console.log(`🎨 PluginManager: 为插件 ${pluginId} 添加了CSS样式`);
    }

    /**
     * 移除CSS样式
     */
    removeCSS(pluginId) {
        const styleId = `plugin-style-${pluginId}`;
        const styleElement = document.getElementById(styleId);

        if (styleElement) {
            styleElement.remove();
            console.log(`🎨 PluginManager: 移除了插件 ${pluginId} 的CSS样式`);
        }
    }

    // 显示通知
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`📢 Plugin Notification [${type}]: ${message}`);

        // 通知实现
        const notification = this.createElement('div', {
            className: `plugin-notification plugin-notification-${type}`,
            innerHTML: message
        });

        // 添加样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: type === 'error' ? '#ff4757' : type === 'warning' ? '#ffa502' : '#2ed573',
            color: 'white',
            zIndex: '10000',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    // 注册命令
    registerCommand(pluginId, commandId, handler) {
        const fullCommandId = `${pluginId}.${commandId}`;
        this.apiRegistry.set(fullCommandId, handler);
    }

    // 取消注册命令
    unregisterCommand(pluginId, commandId) {
        const fullCommandId = `${pluginId}.${commandId}`;
        this.apiRegistry.delete(fullCommandId);
    }

    // 执行命令
    async executeCommand(commandId, ...args) {
        const handler = this.apiRegistry.get(commandId);
        if (handler) {
            return await handler(...args);
        } else {
            throw new Error(`命令未找到: ${commandId}`);
        }
    }

    // 获取插件存储
    getPluginStorage(pluginId, key) {
        const storageKey = `plugin-${pluginId}-${key}`;
        return window.cacheManager?.getLocalCache(storageKey);
    }

    // 设置插件存储
    setPluginStorage(pluginId, key, value) {
        const storageKey = `plugin-${pluginId}-${key}`;
        window.cacheManager?.setLocalCache(storageKey, value);
    }

    // 移除插件存储
    removePluginStorage(pluginId, key) {
        const storageKey = `plugin-${pluginId}-${key}`;
        window.cacheManager?.removeLocalCache(storageKey);
    }

    // 安装插件
    async installPlugin(pluginData) {
        try {
            const config = typeof pluginData === 'string' ? JSON.parse(pluginData) : pluginData;

            // 验证插件配置
            if (!config.id || !config.name || !config.version) {
                throw new Error('插件配置不完整');
            }

            // 检查是否已安装
            if (this.pluginConfigs.has(config.id)) {
                throw new Error(`插件 ${config.id} 已经安装`);
            }

            // 保存插件配置
            this.pluginConfigs.set(config.id, config);
            this.pluginStates.set(config.id, true); // 默认启用
            this.savePluginConfigs();

            // 自动加载插件
            await this.loadPlugin(config.id);

            this.emit('pluginInstalled', { pluginId: config.id, config });
            return config.id;
        } catch (error) {
            console.error('❌ PluginManager: 安装插件失败:', error);
            throw error;
        }
    }

    // 卸载插件
    async uninstallPlugin(pluginId) {
        try {
            // 先卸载插件
            if (this.plugins.has(pluginId)) {
                await this.unloadPlugin(pluginId);
            }

            // 移除配置
            this.pluginConfigs.delete(pluginId);
            this.pluginStates.delete(pluginId);
            this.savePluginConfigs();

            // 清理插件存储
            // TODO: 实现插件存储清理

            // 移除插件样式
            this.removeCSS(pluginId);

            this.emit('pluginUninstalled', { pluginId });
        } catch (error) {
            console.error(`❌ PluginManager: 卸载插件 ${pluginId} 失败:`, error);
            throw error;
        }
    }
}

window.PluginManager = PluginManager;
