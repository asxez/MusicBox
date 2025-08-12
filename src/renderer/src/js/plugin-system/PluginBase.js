/**
 * 插件基类 - 所有插件都应该继承此类
 * 提供插件的基础功能和生命周期管理
 */

class PluginBase {
    constructor(context) {
        this.context = context;
        this.id = null;
        this.name = null;
        this.version = null;
        this.metadata = {
            id: null,
            name: null,
            version: null,
            description: null,
            author: null,
            permissions: [],
            category: null
        };
        this.isActive = false;
        
        // 插件资源管理
        this.disposables = [];
        this.styleElements = [];
        this.eventListeners = [];
    }

    // 插件激活 - 子类必须实现
    async activate() {
        this.isActive = true;
        console.log(`🔌 Plugin ${this.id}: 激活`);
    }

    // 插件停用 - 子类可以重写
    async deactivate() {
        // 清理所有资源
        this.dispose();
        this.isActive = false;
        console.log(`🔌 Plugin ${this.id}: 停用`);
    }

    // 清理插件资源
    dispose() {
        // 移除事件监听器
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];

        // 移除样式
        this.styleElements.forEach(style => {
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        });
        this.styleElements = [];

        // 清理其他资源
        this.disposables.forEach(disposable => {
            if (typeof disposable === 'function') {
                disposable();
            } else if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose();
            }
        });
        this.disposables = [];
    }

    // --- 提供快捷方法 ---

    // 添加CSS样式
    addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        this.styleElements.push(style);
        return style;
    }

    // 创建DOM元素
    createElement(tag, attributes = {}, children = []) {
        return this.context.utils.createElement(tag, attributes, children);
    }

    // 添加事件监听器
    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
        return () => element.removeEventListener(event, handler);
    }

    // 显示通知
    showNotification(message, type = 'info', duration = 3000) {
        this.context.utils.showNotification(message, type, duration);
    }

    // 注册命令
    registerCommand(commandId, handler) {
        this.context.utils.registerCommand(this.id, commandId, handler);
        
        // 添加到清理列表
        this.disposables.push(() => {
            this.context.utils.unregisterCommand(this.id, commandId);
        });
    }

    // 获取存储数据
    getStorage(key) {
        return this.context.storage.get(this.id, key);
    }

    // 设置存储数据
    setStorage(key, value) {
        this.context.storage.set(this.id, key, value);
    }

    // 移除存储数据
    removeStorage(key) {
        this.context.storage.remove(this.id, key);
    }

    // 发送插件间消息
    emit(event, data) {
        this.context.messaging.emit(`plugin:${this.id}:${event}`, data);
    }

    // 监听插件间消息
    on(event, handler) {
        this.context.messaging.on(`plugin:${this.id}:${event}`, handler);
        
        // 添加到清理列表
        this.disposables.push(() => {
            this.context.messaging.off(`plugin:${this.id}:${event}`, handler);
        });
    }

    // 监听其他插件消息
    onPlugin(pluginId, event, handler) {
        this.context.messaging.on(`plugin:${pluginId}:${event}`, handler);
        
        // 添加到清理列表
        this.disposables.push(() => {
            this.context.messaging.off(`plugin:${pluginId}:${event}`, handler);
        });
    }

    // --- 应用API ---

    // 获取应用实例
    getApp() {
        return this.context.app;
    }

    // 获取API实例
    getAPI() {
        return this.context.api;
    }

    // 获取组件
    getComponent(name) {
        const app = this.getApp();

        // 调试
        console.log(`🔌 Plugin ${this.id}: 尝试获取组件 '${name}'`);
        console.log(`🔌 Plugin ${this.id}: 应用状态:`, {
            appExists: !!app,
            appInitialized: app?.isInitialized,
            componentsExists: !!app?.components,
            componentsCount: Object.keys(app?.components || {}).length,
            availableComponents: Object.keys(app?.components || {}),
            requestedComponent: name,
            componentExists: !!(app?.components?.[name])
        });

        if (!app) {
            console.error(`❌ Plugin ${this.id}: 应用实例不存在，无法获取组件 '${name}'`);
            return null;
        }

        if (!app.components) {
            console.error(`❌ Plugin ${this.id}: 应用组件系统未初始化，无法获取组件 '${name}'`);
            return null;
        }

        const component = app.components[name];
        if (!component) {
            console.warn(`⚠️ Plugin ${this.id}: 组件 '${name}' 不存在。可用组件: ${Object.keys(app.components).join(', ')}`);
            return null;
        }

        console.log(`✅ Plugin ${this.id}: 成功获取组件 '${name}'`);
        return component;
    }

    // 等待应用完全初始化
    async waitForAppInitialization(timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const app = this.getApp();
            if (app && app.isInitialized && app.components && Object.keys(app.components).length > 0) {
                console.log(`✅ Plugin ${this.id}: 应用初始化完成，可用组件: ${Object.keys(app.components).join(', ')}`);
                return true;
            }
            console.log(`⏳ Plugin ${this.id}: 等待应用初始化... (${Date.now() - startTime}ms)`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.error(`❌ Plugin ${this.id}: 等待应用初始化超时 (${timeout}ms)`);
        return false;
    }

    // 添加侧边栏菜单项
    async addSidebarItem(config) {
        console.log(`🔌 Plugin ${this.id}: 尝试添加侧边栏项目`);

        // 等待应用初始化完成
        const appReady = await this.waitForAppInitialization();
        if (!appReady) {
            console.error(`❌ Plugin ${this.id}: 应用未完全初始化，无法添加侧边栏项目`);
            return null;
        }

        const navigation = this.getComponent('navigation');
        if (!navigation) {
            console.error(`❌ Plugin ${this.id}: Navigation组件不存在，无法添加侧边栏项目`);
            return null;
        }

        if (typeof navigation.addPluginItem !== 'function') {
            console.error(`❌ Plugin ${this.id}: Navigation组件不支持addPluginItem方法`);
            console.log(`🔍 Plugin ${this.id}: Navigation组件可用方法:`, Object.getOwnPropertyNames(Object.getPrototypeOf(navigation)));
            return null;
        }

        try {
            // 添加插件ID到配置中
            const configWithPluginId = { ...config, pluginId: this.id };
            const itemId = navigation.addPluginItem(configWithPluginId);

            if (itemId) {
                console.log(`✅ Plugin ${this.id}: 成功添加侧边栏项目 ${itemId}`);

                // 添加到清理列表
                this.disposables.push(() => {
                    navigation.removePluginItem(itemId);
                });

                return itemId;
            } else {
                console.error(`❌ Plugin ${this.id}: addPluginItem返回了无效的itemId`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Plugin ${this.id}: 添加侧边栏项目失败:`, error);
            return null;
        }
    }

    // 添加设置项
    async addSettingsSection(config) {
        console.log(`🔌 Plugin ${this.id}: 尝试添加设置部分`);

        // 等待应用初始化完成
        const appReady = await this.waitForAppInitialization();
        if (!appReady) {
            console.error(`❌ Plugin ${this.id}: 应用未完全初始化，无法添加设置部分`);
            return null;
        }

        const settings = this.getComponent('settings');
        if (!settings) {
            console.error(`❌ Plugin ${this.id}: Settings组件不存在，无法添加设置部分`);
            return null;
        }

        if (typeof settings.addPluginSection !== 'function') {
            console.error(`❌ Plugin ${this.id}: Settings组件不支持addPluginSection方法`);
            console.log(`🔍 Plugin ${this.id}: Settings组件可用方法:`, Object.getOwnPropertyNames(Object.getPrototypeOf(settings)));
            return null;
        }

        try {
            // 添加插件ID到配置中
            const configWithPluginId = { ...config, pluginId: this.id };
            const sectionId = settings.addPluginSection(configWithPluginId);

            if (sectionId) {
                console.log(`✅ Plugin ${this.id}: 成功添加设置部分 ${sectionId}`);

                // 添加到清理列表
                this.disposables.push(() => {
                    settings.removePluginSection(sectionId);
                });

                return sectionId;
            } else {
                console.error(`❌ Plugin ${this.id}: addPluginSection返回了无效的sectionId`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Plugin ${this.id}: 添加设置部分失败:`, error);
            return null;
        }
    }

    // 添加右键菜单项
    addContextMenuItem(config) {
        const contextMenu = this.getComponent('contextMenu');
        if (contextMenu && typeof contextMenu.addPluginItem === 'function') {
            const itemId = contextMenu.addPluginItem(config);
            
            // 添加到清理列表
            this.disposables.push(() => {
                contextMenu.removePluginItem(itemId);
            });
            return itemId;
        }
        console.warn(`🔌 Plugin ${this.id}: 无法添加右键菜单项，ContextMenu组件不支持`);
        return null;
    }

    // 注册页面
    registerPage(pageId, pageComponent) {
        const app = this.getApp();
        if (app && typeof app.registerPluginPage === 'function') {
            app.registerPluginPage(pageId, pageComponent);
            
            // 添加到清理列表
            this.disposables.push(() => {
                app.unregisterPluginPage(pageId);
            });
            
            return pageId;
        }
        
        console.warn(`🔌 Plugin ${this.id}: 无法注册页面，App不支持插件页面`);
        return null;
    }

    // --- 系统API ---

    // 文件系统
    get fs() {
        return this.context.system.fs;
    }

    // 路径工具
    get path() {
        return this.context.system.path;
    }

    // 操作系统信息
    get os() {
        return this.context.system.os;
    }

    get document() {
        return this.context.document;
    }

    get window() {
        return this.context.window;
    }
}

window.PluginBase = PluginBase;
