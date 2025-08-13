/**
 * 插件基类 - 所有插件都应该继承此类
 * 提供插件的基础功能和生命周期管理
 */

class PluginBase {
    constructor(context) {
        if (!context) {
            throw new Error('PluginBase构造函数需要context参数。请确保插件构造函数正确接收并传递context参数。');
        }

        this.context = context;
        this.id = null;
        this.name = null;
        this.version = null;

        // 插件元数据
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
    // 建议重写此方法，除非确实没有其他的资源需要清理
    async deactivate() {
        // 清理所有资源
        this.dispose();
        this.isActive = false;
        console.log(`🔌 Plugin ${this.id}: 停用`);
    }

    // 清理插件资源
    dispose() {
        // 移除事件监听器
        this.eventListeners.forEach(({element, event, handler}) => {
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
    addStyle(css, options = {}) {
        const {
            scoped = false,
            important = false,
            id = null
        } = options;

        const style = document.createElement('style');

        // 设置样式元素ID
        if (id) {
            style.id = `plugin-${this.id}-${id}`;
        } else {
            style.id = `plugin-${this.id}-style-${this.styleElements.length}`;
        }

        // 处理CSS内容
        let processedCSS = css;

        // 如果启用作用域，为所有选择器添加插件前缀
        if (scoped && this.id) {
            processedCSS = this.scopeCSS(css);
        }

        // 如果启用重要性，为所有属性添加!important
        if (important) {
            processedCSS = this.addImportantToCSS(processedCSS);
        }

        style.textContent = processedCSS;
        document.head.appendChild(style);
        this.styleElements.push(style);

        console.log(`🎨 Plugin ${this.id}: 添加样式 ${style.id}`);
        return style;
    }

    // 为CSS添加插件作用域
    scopeCSS(css) {
        const pluginScope = `[data-plugin="${this.id}"]`;

        // 简单的CSS选择器作用域处理
        return css.replace(/([^{}]+)\s*{/g, (match, selector) => {
            // 跳过@规则（如@media, @keyframes等）
            if (selector.trim().startsWith('@')) {
                return match;
            }

            // 为每个选择器添加插件作用域
            const scopedSelectors = selector.split(',').map(sel => {
                const trimmedSel = sel.trim();

                // 如果选择器已经包含插件作用域，跳过
                if (trimmedSel.includes(`[data-plugin="${this.id}"]`)) {
                    return trimmedSel;
                }

                // 如果是全局选择器（如body, html），不添加作用域
                if (trimmedSel.match(/^(html|body|:root)(\s|$|:)/)) {
                    return trimmedSel;
                }

                // 添加插件作用域
                return `${pluginScope} ${trimmedSel}`;
            }).join(', ');

            return `${scopedSelectors} {`;
        });
    }

    // 为CSS属性添加!important
    addImportantToCSS(css) {
        return css.replace(/([^{}]+):\s*([^;!]+);/g, (match, property, value) => {
            // 如果已经有!important，跳过
            if (value.includes('!important')) {
                return match;
            }
            return `${property}: ${value} !important;`;
        });
    }

    // 创建DOM元素
    createElement(tag, attributes = {}, children = []) {
        return this.context.utils.createElement(tag, attributes, children);
    }

    // 为元素添加插件数据属性
    // 此方法用于CSS作用域
    addPluginScope(element) {
        if (element && this.id) {
            element.setAttribute('data-plugin', this.id);
        }
        return element;
    }

    // 为HTML字符串添加插件作用域属性
    addScopeToHTML(html) {
        if (!this.id) return html;

        // 为根元素添加data-plugin属性
        return html.replace(/^(\s*<[^>]+)/, `$1 data-plugin="${this.id}"`);
    }

    // 添加事件监听器
    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({element, event, handler});
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
    getStorage(key, defaultValue) {
        return this.context.storage.get(this.id, key) || defaultValue;
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
        if (!this.context) {
            throw new Error(`Plugin ${this.id || 'Unknown'}: context未初始化。请检查插件构造函数是否正确传递了context参数。`);
        }

        if (!this.context.app) {
            console.warn(`⚠️ Plugin ${this.id || 'Unknown'}: context.app为空，应用可能尚未完全初始化`);
            console.log(`🔍 Plugin ${this.id || 'Unknown'}: context内容:`, {
                hasContext: !!this.context,
                contextKeys: Object.keys(this.context || {}),
                appExists: !!this.context.app,
                windowAppExists: !!window.app
            });
        }

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
    async waitForAppInitialization(timeout = 5000) {
        const startTime = Date.now();
        let lastLogTime = 0;

        console.log(`⏳ Plugin ${this.id}: 开始等待应用初始化...`);

        while (Date.now() - startTime < timeout) {
            try {
                // 首先检查window.app是否存在
                if (!window.app) {
                    const elapsed = Date.now() - startTime;
                    if (elapsed - lastLogTime > 1000) { // 每秒记录一次
                        console.log(`⏳ Plugin ${this.id}: 等待window.app初始化... (${elapsed}ms)`);
                        lastLogTime = elapsed;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }

                // 检查context.app是否与window.app同步
                if (!this.context.app && window.app) {
                    console.log(`🔄 Plugin ${this.id}: 同步context.app与window.app`);
                    // 如果context.app为空但window.app存在，可能需要重新创建context
                    // 这里我们直接使用window.app作为备用
                }

                const app = this.context.app || window.app;

                if (app && app.isInitialized && app.components && Object.keys(app.components).length > 0) {
                    console.log(`✅ Plugin ${this.id}: 应用初始化完成，可用组件: ${Object.keys(app.components).join(', ')}`);
                    return true;
                }

                const elapsed = Date.now() - startTime;
                if (elapsed - lastLogTime > 1000) { // 每秒记录一次
                    console.log(`⏳ Plugin ${this.id}: 等待应用组件初始化... (${elapsed}ms)`, {
                        appExists: !!app,
                        isInitialized: app?.isInitialized,
                        componentsExists: !!app?.components,
                        componentsCount: Object.keys(app?.components || {}).length
                    });
                    lastLogTime = elapsed;
                }

            } catch (error) {
                console.error(`❌ Plugin ${this.id}: 等待应用初始化时出错:`, error);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.error(`❌ Plugin ${this.id}: 等待应用初始化超时 (${timeout}ms)`);
        console.error(`❌ Plugin ${this.id}: 最终状态:`, {
            windowAppExists: !!window.app,
            contextAppExists: !!this.context?.app,
            appInitialized: window.app?.isInitialized || this.context?.app?.isInitialized,
            componentsCount: Object.keys(window.app?.components || this.context?.app?.components || {}).length
        });
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

        try {
            // 使用统一的context.navigation接口
            const itemId = this.context.navigation.addItem(config);

            if (itemId) {
                console.log(`✅ Plugin ${this.id}: 成功添加侧边栏项目 ${itemId}`);

                // 添加到清理列表
                this.disposables.push(() => {
                    this.context.navigation.removeItem(itemId);
                });

                return itemId;
            } else {
                console.error(`❌ Plugin ${this.id}: addItem返回了无效的itemId`);
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

        try {
            // 使用统一的context.settings接口，传递pluginId和config
            const sectionId = this.context.settings.addSection(this.id, config);

            if (sectionId) {
                console.log(`✅ Plugin ${this.id}: 成功添加设置部分 ${sectionId}`);

                // 添加到清理列表
                this.disposables.push(() => {
                    this.context.settings.removeSection(this.id, sectionId);
                });

                return sectionId;
            } else {
                console.error(`❌ Plugin ${this.id}: addSection返回了无效的sectionId`);
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
