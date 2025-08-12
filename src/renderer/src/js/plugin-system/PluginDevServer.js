/**
 * 插件开发服务器
 * 提供插件热重载和开发调试功能
 */

class PluginDevServer extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.watchedPlugins = new Map();
        this.devPlugins = new Map();
        this.hotReloadEnabled = false;
        this.checkInterval = null;
    }

    // 启动开发服务器
    start() {
        if (this.isRunning) {
            console.warn('🛠️ PluginDevServer: 开发服务器已在运行');
            return;
        }

        this.isRunning = true;
        this.hotReloadEnabled = true;
        
        // 启动文件监听
        this.startFileWatching();
        
        // 注册开发命令
        this.registerDevCommands();
        
        // 设置全局开发工具
        this.setupGlobalDevTools();
        
        this.emit('started');
    }

    // 停止开发服务器
    stop() {
        if (!this.isRunning) {
            console.warn('🛠️ PluginDevServer: 开发服务器未运行');
            return;
        }

        this.isRunning = false;
        this.hotReloadEnabled = false;
        
        // 停止文件监听
        this.stopFileWatching();
        
        // 清理开发工具
        this.cleanupGlobalDevTools();
        
        this.emit('stopped');
    }

    // 启动文件监听
    startFileWatching() {
        // 暂时用轮询
        this.checkInterval = setInterval(() => {
            this.checkForChanges();
        }, 2000);
    }

    // 停止文件监听
    stopFileWatching() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // 检查文件变化
    async checkForChanges() {
        if (!this.hotReloadEnabled) return;

        for (const [pluginId, watchInfo] of this.watchedPlugins) {
            try {
                // todo 实现文件变化检测
                await this.checkPluginFileChange(pluginId, watchInfo);
            } catch (error) {
                console.error(`❌ PluginDevServer: 检查插件 ${pluginId} 文件变化失败:`, error);
            }
        }
    }

    // 检查单个插件文件变化
    async checkPluginFileChange(pluginId, watchInfo) {
        // 暂时模拟文件变化检测
        const now = Date.now();
        if (now - watchInfo.lastCheck > 5000) {
            watchInfo.lastCheck = now;
            if (Math.random() < 0.1) {
                await this.handleFileChange(pluginId);
            }
        }
    }

    // 处理文件变化
    async handleFileChange(pluginId) {
        try {
            console.log(`🔥 PluginDevServer: 检测到插件 ${pluginId} 文件变化，开始热重载`);
            
            // 通知插件管理器重载插件
            if (window.pluginManager) {
                await window.pluginManager.unloadPlugin(pluginId);
                await window.pluginManager.loadPlugin(pluginId);
                
                this.emit('pluginReloaded', { pluginId });
                console.log(`✅ PluginDevServer: 插件 ${pluginId} 热重载成功`);
                
                // 显示重载通知
                if (window.pluginManager.showNotification) {
                    window.pluginManager.showNotification(`插件 ${pluginId} 已热重载`, 'info', 2000);
                }
            }
            
        } catch (error) {
            console.error(`❌ PluginDevServer: 插件 ${pluginId} 热重载失败:`, error);
            this.emit('reloadError', { pluginId, error });
        }
    }

    // 监听插件文件
    watchPlugin(pluginId, filePath) {
        if (!this.hotReloadEnabled) return;
        this.watchedPlugins.set(pluginId, {
            filePath: filePath,
            lastCheck: Date.now(),
            lastModified: Date.now()
        });
    }

    // 停止监听插件文件
    unwatchPlugin(pluginId) {
        this.watchedPlugins.delete(pluginId);
    }

    // 注册开发命令
    registerDevCommands() {
        const commands = {
            // 创建新插件
            'dev.createPlugin': this.createDevPlugin.bind(this),
            
            // 重载插件
            'dev.reloadPlugin': this.reloadPlugin.bind(this),
            
            // 删除开发插件
            'dev.removePlugin': this.removeDevPlugin.bind(this),
            
            // 获取开发状态
            'dev.getStatus': this.getDevStatus.bind(this),
            
            // 切换热重载
            'dev.toggleHotReload': this.toggleHotReload.bind(this),
            
            // 清理开发环境
            'dev.cleanup': this.cleanup.bind(this)
        };

        // 注册到插件管理器
        if (window.pluginManager) {
            for (const [command, handler] of Object.entries(commands)) {
                window.pluginManager.registerCommand('dev-server', command, handler);
            }
        }

        console.log('🛠️ PluginDevServer: 开发命令已注册');
    }

    // 设置全局开发工具
    setupGlobalDevTools() {
        window.pluginDev = {
            // 服务器控制
            server: this,
            
            // 快速创建插件
            create: (id, code) => this.createDevPlugin(id, code),
            
            // 重载插件
            reload: (id) => this.reloadPlugin(id),
            
            // 删除插件
            remove: (id) => this.removeDevPlugin(id),
            
            // 获取状态
            status: () => this.getDevStatus(),
            
            // 切换热重载
            toggleHotReload: () => this.toggleHotReload(),
            
            // 插件模板
            templates: {
                basic: () => this.getBasicTemplate(),
                ui: () => this.getUITemplate(),
                music: () => this.getMusicTemplate()
            },
            
            // 调试工具
            debug: {
                listPlugins: () => window.plugins?.getAll() || [],
                getPlugin: (id) => window.plugins?.get(id),
                checkSystem: () => window.checkPluginSystemStatus?.(),
                testAPI: () => this.testPluginAPI()
            }
        };
        
        console.log('🛠️ PluginDevServer: 全局开发工具已设置');
        console.log('💡 使用 window.pluginDev 访问开发工具');
    }

    // 清理全局开发工具
    cleanupGlobalDevTools() {
        delete window.pluginDev;
    }

    // 创建开发插件
    async createDevPlugin(pluginId, code) {
        try {
            // 插件配置
            const config = {
                id: pluginId,
                name: `Dev: ${pluginId}`,
                version: '0.1.0-dev',
                description: '开发测试插件',
                author: '开发者',
                main: `data:text/javascript;base64,${btoa(code)}`,
                isDev: true
            };
            
            // 安装插件
            await window.plugins?.install(config);
            
            // 添加到开发插件列表
            this.devPlugins.set(pluginId, {
                config: config,
                code: code,
                created: Date.now()
            });
            return pluginId;
        } catch (error) {
            console.error(`❌ PluginDevServer: 创建开发插件失败:`, error);
            throw error;
        }
    }

    // 重载插件
    async reloadPlugin(pluginId) {
        try {
            if (window.pluginManager) {
                await window.pluginManager.unloadPlugin(pluginId);
                await window.pluginManager.loadPlugin(pluginId);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ PluginDevServer: 重载插件失败:`, error);
            throw error;
        }
    }

    // 删除开发插件
    async removeDevPlugin(pluginId) {
        try {
            await window.plugins?.uninstall(pluginId);
            this.devPlugins.delete(pluginId);
            this.unwatchPlugin(pluginId);
            return true;
        } catch (error) {
            console.error(`❌ PluginDevServer: 删除开发插件失败:`, error);
            throw error;
        }
    }

    // 获取开发状态
    getDevStatus() {
        return {
            running: this.isRunning,
            hotReloadEnabled: this.hotReloadEnabled,
            watchedPlugins: this.watchedPlugins.size,
            devPlugins: this.devPlugins.size,
            pluginSystem: window.checkPluginSystemStatus?.() || null
        };
    }

    // 切换热重载
    toggleHotReload() {
        this.hotReloadEnabled = !this.hotReloadEnabled;
        
        if (this.hotReloadEnabled) {
            this.startFileWatching();
            console.log('🔥 PluginDevServer: 热重载已启用');
        } else {
            this.stopFileWatching();
            console.log('🔥 PluginDevServer: 热重载已禁用');
        }
        
        return this.hotReloadEnabled;
    }

    // 清理开发环境
    async cleanup() {
        // 删除所有开发插件
        const devPluginIds = Array.from(this.devPlugins.keys());
        for (const pluginId of devPluginIds) {
            await this.removeDevPlugin(pluginId);
        }
        
        // 清理监听
        this.watchedPlugins.clear();
    }

    // 获取基础插件模板
    getBasicTemplate() {
        return `
class BasicPlugin extends PluginBase {
    async activate() {
        await super.activate();
        this.showNotification('基础插件已激活！', 'success');
    }
    
    async deactivate() {
        await super.deactivate();
    }
}

window.PluginClass = BasicPlugin;
        `.trim();
    }

    // 获取UI扩展模板
    getUITemplate() {
        return `
class UIPlugin extends PluginBase {
    async activate() {
        await super.activate();
        
        // 添加侧边栏项目
        this.addSidebarItem({
            id: 'my-page',
            name: '我的页面',
            icon: '🔌',
            onClick: () => this.showPage()
        });
        
        this.showNotification('UI插件已激活！', 'success');
    }
    
    showPage() {
        const content = this.createElement('div', {
            innerHTML: '<h2>我的插件页面</h2><p>这是一个自定义页面</p>'
        });
        
        const contentArea = document.querySelector('#content-area');
        if (contentArea) {
            contentArea.innerHTML = '';
            contentArea.appendChild(content);
        }
    }
}

window.PluginClass = UIPlugin;
        `.trim();
    }

    // 获取音乐增强模板
    getMusicTemplate() {
        return `
class MusicPlugin extends PluginBase {
    async activate() {
        await super.activate();
        
        // 监听播放事件
        this.context.player.onTrackChanged?.((track) => {
            console.log('当前播放:', track.title);
        });
        
        // 注册命令
        this.registerCommand('info', () => {
            const track = this.context.player.getCurrentTrack?.();
            this.showNotification(\`当前播放: \${track?.title || '无'}\`, 'info');
        });
        
        this.showNotification('音乐插件已激活！', 'success');
    }
}

window.PluginClass = MusicPlugin;
        `.trim();
    }

    // 测试插件API
    testPluginAPI() {
        const tests = {
            pluginManager: !!window.pluginManager,
            pluginLoader: !!window.pluginLoader,
            pluginAPI: !!window.pluginAPI,
            pluginBase: !!window.PluginBase,
            globalPlugins: !!window.plugins,
            devTools: !!window.pluginDevTools
        };
        
        console.log('🧪 PluginDevServer: API测试结果:', tests);
        return tests;
    }

    // 创建插件开发面板
    createDevPanel() {
        const panel = document.createElement('div');
        panel.id = 'plugin-dev-panel';
        panel.className = 'plugin-dev-panel';
        
        panel.innerHTML = `
            <div class="dev-panel-header">
                <h3>🛠️ 插件开发工具</h3>
                <button class="dev-panel-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
            </div>
            
            <div class="dev-panel-content">
                <div class="dev-section">
                    <h4>快速创建</h4>
                    <div class="dev-controls">
                        <input type="text" id="dev-plugin-id" placeholder="插件ID" />
                        <select id="dev-template-select">
                            <option value="basic">基础插件</option>
                            <option value="ui">UI扩展</option>
                            <option value="music">音乐增强</option>
                        </select>
                        <button onclick="window.pluginDev.server.quickCreate()">创建</button>
                    </div>
                </div>
                
                <div class="dev-section">
                    <h4>开发状态</h4>
                    <div id="dev-status">加载中...</div>
                </div>
                
                <div class="dev-section">
                    <h4>插件列表</h4>
                    <div id="dev-plugin-list">加载中...</div>
                </div>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .plugin-dev-panel {
                position: fixed;
                top: 20px;
                left: 20px;
                width: 350px;
                max-height: 80vh;
                background: var(--color-secondary-bg);
                border: 1px solid var(--color-border);
                border-radius: 12px;
                box-shadow: var(--shadow-large);
                z-index: 10000;
                overflow: hidden;
                font-family: var(--font-family);
            }
            
            .dev-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                background: var(--color-primary);
                color: white;
            }
            
            .dev-panel-header h3 {
                margin: 0;
                font-size: 16px;
            }
            
            .dev-panel-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .dev-panel-content {
                padding: 16px;
                max-height: calc(80vh - 60px);
                overflow-y: auto;
            }
            
            .dev-section {
                margin-bottom: 20px;
            }
            
            .dev-section h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: var(--color-text);
            }
            
            .dev-controls {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .dev-controls input,
            .dev-controls select,
            .dev-controls button {
                padding: 6px 10px;
                border: 1px solid var(--color-border);
                border-radius: 4px;
                font-size: 12px;
            }
            
            .dev-controls button {
                background: var(--color-primary);
                color: white;
                cursor: pointer;
            }
            
            #dev-status,
            #dev-plugin-list {
                font-size: 12px;
                color: var(--color-text-secondary);
                background: var(--color-body-bg);
                padding: 10px;
                border-radius: 6px;
                border: 1px solid var(--color-border);
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(panel);
        
        // 更新状态
        this.updateDevPanel();
        
        return panel;
    }

    // /快速创建插件
    async quickCreate() {
        const idInput = document.getElementById('dev-plugin-id');
        const templateSelect = document.getElementById('dev-template-select');
        
        if (!idInput || !templateSelect) return;
        
        const pluginId = idInput.value.trim();
        const template = templateSelect.value;
        
        if (!pluginId) {
            alert('请输入插件ID');
            return;
        }
        
        try {
            let code;
            switch (template) {
                case 'ui':
                    code = this.getUITemplate();
                    break;
                case 'music':
                    code = this.getMusicTemplate();
                    break;
                default:
                    code = this.getBasicTemplate();
            }
            
            await this.createDevPlugin(pluginId, code);
            
            // 清空输入
            idInput.value = '';
            
            // 更新面板
            this.updateDevPanel();
            
        } catch (error) {
            alert(`创建失败: ${error.message}`);
        }
    }

    // 更新开发面板
    updateDevPanel() {
        const statusElement = document.getElementById('dev-status');
        const listElement = document.getElementById('dev-plugin-list');
        
        if (statusElement) {
            const status = this.getDevStatus();
            statusElement.innerHTML = `
                <div>服务器: ${status.running ? '运行中' : '已停止'}</div>
                <div>热重载: ${status.hotReloadEnabled ? '启用' : '禁用'}</div>
                <div>监听插件: ${status.watchedPlugins}</div>
                <div>开发插件: ${status.devPlugins}</div>
            `;
        }
        
        if (listElement) {
            const plugins = window.plugins?.getAll() || [];
            listElement.innerHTML = plugins.map(p => 
                `<div>${p.id} - ${p.enabled ? '启用' : '禁用'} - ${p.loaded ? '已加载' : '未加载'}</div>`
            ).join('');
        }
    }

    // 显示开发面板
    showDevPanel() {
        let panel = document.getElementById('plugin-dev-panel');
        if (!panel) {
            panel = this.createDevPanel();
        }
        
        panel.style.display = 'block';
        this.updateDevPanel();
    }

    // 隐藏开发面板
    hideDevPanel() {
        const panel = document.getElementById('plugin-dev-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
}

window.PluginDevServer = PluginDevServer;
