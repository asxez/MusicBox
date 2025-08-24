/**
 * 插件系统主入口文件
 * 统一导出插件系统的所有组件和API
 */

/**
 * 插件系统初始化函数
 * 在应用启动时调用，初始化整个插件系统
 */
async function initializePluginSystem() {
    try {
        console.log('🔌 开始初始化插件系统...');
        
        // 检查依赖
        if (!window.EventEmitter) {
            throw new Error('EventEmitter 未加载');
        }
        
        if (!window.cacheManager) {
            console.warn('⚠️ cacheManager 未加载，插件存储功能可能受限');
        }
        
        // 按正确顺序创建插件系统组件，避免循环依赖

        // 1. 首先创建插件加载器（无依赖）
        if (window.PluginLoader) {
            window.pluginLoader = new window.PluginLoader();
        } else {
            throw new Error('PluginLoader 类未定义');
        }

        // 2. 创建插件API（无依赖）
        if (window.PluginAPI) {
            window.pluginAPI = new window.PluginAPI();
        } else {
            throw new Error('PluginAPI 类未定义');
        }

        // 3. 创建插件管理器（依赖loader和api）
        if (window.PluginManager) {
            window.pluginManager = new window.PluginManager();
        } else {
            throw new Error('PluginManager 类未定义');
        }

        // 4. 设置相互引用
        if (window.pluginAPI.setPluginManager) {
            window.pluginAPI.setPluginManager(window.pluginManager);
        }

        // 5. 创建开发服务器（依赖其他组件）
        if (window.PluginDevServer) {
            window.pluginDevServer = new window.PluginDevServer();
        } else {
            throw new Error('PluginDevServer 类未定义');
        }

        // 更新插件管理器的上下文
        window.pluginManager.pluginContext = window.pluginAPI.createPluginContext('system');
        
        // 初始化插件管理器
        await window.pluginManager.initialize();
        
        // 设置全局插件系统引用
        window.plugins = {
            manager: window.pluginManager,
            loader: window.pluginLoader,
            api: window.pluginAPI,
            devServer: window.pluginDevServer,

            // 便捷方法
            install: (pluginData) => window.pluginManager.installPlugin(pluginData),
            uninstall: (pluginId) => window.pluginManager.uninstallPlugin(pluginId),
            enable: (pluginId) => window.pluginManager.enablePlugin(pluginId),
            disable: (pluginId) => window.pluginManager.disablePlugin(pluginId),
            reload: (pluginId) => window.pluginLoader.reloadPluginScript(pluginId),
            getAll: () => window.pluginManager.getAllPlugins(),
            get: (pluginId) => window.pluginManager.plugins.get(pluginId),

            // 开发工具方法
            dev: {
                start: () => window.pluginDevServer.start(),
                stop: () => window.pluginDevServer.stop(),
                create: (id, code) => window.pluginDevServer.createDevPlugin(id, code),
                remove: (id) => window.pluginDevServer.removeDevPlugin(id),
                status: () => window.pluginDevServer.getDevStatus(),
                panel: () => window.pluginDevServer.showDevPanel()
            }
        };
        
        // 触发初始化完成事件
        document.dispatchEvent(new CustomEvent('pluginSystemReady', {
            detail: { plugins: window.plugins }
        }));
        
        return true;
    } catch (error) {
        console.error('❌ 插件系统初始化失败:', error);
        return false;
    }
}

/**
 * 插件开发工具
 * 提供插件开发和调试的便捷方法
 */
class PluginDevTools {
    constructor() {
        this.isEnabled = false;
        this.devPlugins = new Map();
    }

    // 启用开发模式
    enable() {
        this.isEnabled = true;
        
        // 启用热重载
        if (window.pluginLoader && typeof window.pluginLoader.enableHotReload === 'function') {
            window.pluginLoader.enableHotReload();
        }
        
        // 添加开发工具到控制台
        window.pluginDev = {
            // 快速创建插件
            createPlugin: this.createDevPlugin.bind(this),
            
            // 重载插件
            reload: (pluginId) => {
                if (window.pluginLoader) {
                    return window.pluginLoader.reloadPluginScript(pluginId);
                }
            },
            
            // 调试信息
            debug: (pluginId) => {
                const manager = window.pluginManager;
                const loader = window.pluginLoader;
                
                return {
                    config: manager?.pluginConfigs.get(pluginId),
                    state: manager?.pluginStates.get(pluginId),
                    instance: manager?.plugins.get(pluginId),
                    loaded: loader?.loadedScripts.has(pluginId),
                    scriptPath: loader?.loadedScripts.get(pluginId)
                };
            },
            
            // 列出所有插件
            list: () => {
                if (window.pluginManager) {
                    return window.pluginManager.getAllPlugins();
                }
                return [];
            },
            
            // 测试API
            testAPI: () => {
                if (window.pluginAPI) {
                    return window.pluginAPI.getAllAPIs();
                }
                return null;
            }
        };
        
        console.log('🛠️ PluginDevTools: 开发模式已启用');
        console.log('💡 使用 window.pluginDev 访问开发工具');
    }

    // 禁用开发模式
    disable() {
        this.isEnabled = false;
        
        // 禁用热重载
        if (window.pluginLoader) {
            window.pluginLoader.disableHotReload();
        }
        
        // 移除开发工具
        delete window.pluginDev;
    }

    // 创建开发插件
    async createDevPlugin(pluginId, pluginCode) {
        try {
            // 创建临时插件配置
            const config = {
                id: pluginId,
                name: `Dev Plugin: ${pluginId}`,
                version: '0.1.0-dev',
                description: '开发测试插件',
                main: `data:text/javascript;base64,${btoa(pluginCode)}`,
                isDev: true
            };
            
            // 安装并启用插件
            await window.plugins.install(config);
            this.devPlugins.set(pluginId, config);

            return pluginId;
        } catch (error) {
            console.error(`❌ PluginDevTools: 创建开发插件失败:`, error);
            throw error;
        }
    }

    // 移除开发插件
    async removeDevPlugin(pluginId) {
        try {
            await window.plugins.uninstall(pluginId);
            this.devPlugins.delete(pluginId);
            console.log(`🛠️ PluginDevTools: 开发插件 ${pluginId} 已移除`);
        } catch (error) {
            console.error(`❌ PluginDevTools: 移除开发插件失败:`, error);
        }
    }

    // 获取开发插件列表
    getDevPlugins() {
        return Array.from(this.devPlugins.values());
    }
}

// 插件系统配置
let PLUGIN_SYSTEM_CONFIG = {
    // 插件目录
    pluginDirectory: 'plugins',
    
    // 支持的插件格式
    supportedFormats: ['.js', '.zip', '.tar.gz'],
    
    // 最大插件大小 (MB)
    maxPluginSize: 50,
    
    // 插件API版本
    apiVersion: '1.0.0',
    
    // 安全设置
    security: {
        allowSystemAccess: true,
        allowNetworkAccess: true,
        allowFileAccess: true,
        sandboxMode: false
    },
    
    // 开发设置
    development: {
        hotReload: true,
        devTools: true,
        verbose: true
    }
};

// 创建开发工具实例
window.pluginDevTools = new PluginDevTools();

// 导出配置
window.PLUGIN_SYSTEM_CONFIG = PLUGIN_SYSTEM_CONFIG;

// 导出初始化函数
window.initializePluginSystem = initializePluginSystem;

// 插件系统状态检查
function checkPluginSystemStatus() {
    const status = {
        initialized: !!window.pluginManager?.isInitialized,
        manager: !!window.pluginManager,
        loader: !!window.pluginLoader,
        api: !!window.pluginAPI,
        devTools: !!window.pluginDevTools,
        pluginCount: window.pluginManager?.plugins.size || 0,
        enabledCount: Array.from(window.pluginManager?.pluginStates.entries() || [])
            .filter(([_, enabled]) => enabled).length
    };

    console.log('🔌 插件系统状态:', status);
    return status;
}

// 导出状态检查函数
window.checkPluginSystemStatus = checkPluginSystemStatus;
// 如果在开发环境，自动启用开发工具
if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    setTimeout(() => {
        if (window.pluginDevTools) {
            window.pluginDevTools.enable();
        }
    }, 1000);
}
