/**
 * 插件管理模态框组件
 */

class PluginManagerModal extends Component {
    constructor() {
        super('#plugin-manager-modal');

        // 若根元素不存在，避免阻塞应用初始化
        if (!this.element) {
            console.warn('PluginManagerModal: root element #plugin-manager-modal not found.');
            return;
        }

        // 插件设置
        this.pluginSections = new Map(); // 存储插件添加的设置部分
        this.pluginSectionIdCounter = 0; // 插件设置部分ID计数器

        this.setupElements();
        this.setupEventListeners();
        this.initialize();

        // 全局引用
        if (!window.app?.components) window.app = {components: {}};
        window.app.components.pluginManagerModal = this;
        window.app.components.pluginManager = this; // 保持向后兼容
    }

    show() {
        this.modal.style.display = 'flex';
        setTimeout(() => this.modal.classList.add('show'), 10);
        // 焦点管理
        this.prevFocus = document.activeElement;
        this.closeBtn?.focus();
        // 刷新数据
        this.updatePluginStatus();
        this.refreshPluginList();
    }

    hide() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.style.display = 'none';
            this.prevFocus?.focus?.();
        }, 300);
        this.hideInstallPanel();
    }

    setupElements() {
        this.modal = this.element;
        this.closeBtn = this.element.querySelector('#plugin-manager-close');
        this.openBtn = document.querySelector('#open-plugin-manager-btn');

        // 顶部状态与控制
        this.pluginStatusIndicator = this.element.querySelector('#pm-status-indicator');
        this.pluginStatusText = this.element.querySelector('#pm-status-text');
        this.pluginCountText = this.element.querySelector('#pm-count-text');
        this.pluginDevModeToggle = this.element.querySelector('#pm-dev-mode-toggle');
        this.installPluginBtn = this.element.querySelector('#pm-install-plugin-btn');
        this.importPluginBtn = this.element.querySelector('#pm-import-plugin-btn');
        this.refreshPluginsBtn = this.element.querySelector('#pm-refresh-plugins-btn');

        // 列表
        this.pluginList = this.element.querySelector('#pm-plugin-list');
        this.pluginListEmpty = this.element.querySelector('#pm-plugin-list-empty');

        // 安装子面板
        this.installPanel = this.element.querySelector('#pm-install-panel');
        this.installPanelCloseBtn = this.element.querySelector('#pm-install-panel-close');

        // 安装面板元素
        this.installTabs = this.element.querySelectorAll('.install-tab-btn');
        this.installTabPanels = this.element.querySelectorAll('.install-tab-panel');
        this.installCancelBtn = this.element.querySelector('#pm-install-cancel');
        this.installConfirmBtn = this.element.querySelector('#pm-install-confirm');

        // 安装输入元素
        this.codeInput = this.element.querySelector('#pm-plugin-code-input');
        this.pluginIdInput = this.element.querySelector('#pm-plugin-id-input');
        this.configInput = this.element.querySelector('#pm-plugin-config-input');
        this.templateSelect = this.element.querySelector('#pm-template-select');
        this.templateIdInput = this.element.querySelector('#pm-template-id');
        this.templateNameInput = this.element.querySelector('#pm-template-name');

        // 搜索和筛选元素
        this.searchInput = this.element.querySelector('#pm-search-input');
        this.statusFilter = this.element.querySelector('#pm-status-filter');
        this.sortSelect = this.element.querySelector('#pm-sort-select');

        // 插件数据缓存
        this.allPlugins = [];
        this.filteredPlugins = [];
    }

    setupEventListeners() {
        // 模态框控制
        this.openBtn?.addEventListener('click', () => this.show());
        this.closeBtn?.addEventListener('click', () => this.hide());
        this.installPanelCloseBtn?.addEventListener('click', () => this.hideInstallPanel());

        // 遮罩点击关闭
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                if (this.installPanel && this.installPanel.style.display !== 'none') {
                    this.hideInstallPanel();
                } else {
                    this.hide();
                }
            }
        });

        // 开发模式切换
        this.pluginDevModeToggle?.addEventListener('change', (e) => {
            try {
                window.settings?.updateSetting('pluginDevMode', e.target.checked);
            } catch {
            }
            this.togglePluginDevMode(e.target.checked);
        });

        // 操作按钮
        this.installPluginBtn?.addEventListener('click', () => this.showInstallPanel());
        this.importPluginBtn?.addEventListener('click', () => this.importPluginFile());
        this.refreshPluginsBtn?.addEventListener('click', () => this.refreshPluginList());

        // 安装面板事件
        this.setupInstallPanelEvents();

        // 搜索和筛选事件
        this.setupSearchAndFilterEvents();

        // 监听插件系统事件
        if (window.pluginManager) {
            window.pluginManager.on('pluginLoaded', () => this.updatePluginStatus());
            window.pluginManager.on('pluginUnloaded', () => this.updatePluginStatus());
            window.pluginManager.on('pluginEnabled', () => this.refreshPluginList());
            window.pluginManager.on('pluginDisabled', () => this.refreshPluginList());
            window.pluginManager.on('pluginInstalled', () => this.refreshPluginList());
            window.pluginManager.on('pluginUninstalled', () => this.refreshPluginList());
        }
    }

    setupInstallPanelEvents() {
        // 选项卡切换
        this.installTabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                this.installTabs.forEach(t => t.classList.remove('active'));
                this.installTabPanels?.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const targetPanel = this.element.querySelector(`#pm-install-tab-${tab.dataset.tab}`);
                targetPanel?.classList.add('active');
            });
        });

        // 安装按钮
        this.installCancelBtn?.addEventListener('click', () => this.hideInstallPanel());
        this.installConfirmBtn?.addEventListener('click', () => this.handlePluginInstall());
    }

    setupSearchAndFilterEvents() {
        // 搜索输入
        this.searchInput?.addEventListener('input', (e) => {
            this.filterAndDisplayPlugins();
        });

        // 状态筛选
        this.statusFilter?.addEventListener('change', (e) => {
            this.filterAndDisplayPlugins();
        });

        // 排序选择
        this.sortSelect?.addEventListener('change', (e) => {
            this.filterAndDisplayPlugins();
        });
    }

    initialize() {
        // 初始化开发模式开关
        if (this.pluginDevModeToggle) {
            const devMode = window.settings?.getSetting('pluginDevMode', false) ?? false;
            this.pluginDevModeToggle.checked = devMode;
            this.togglePluginDevMode(devMode);
        }
        this.updatePluginStatus();
        this.refreshPluginList();
    }

    togglePluginDevMode(enabled) {
        if (window.pluginDevTools) {
            if (enabled) {
                window.pluginDevTools.enable();
                this.showNotification('插件开发模式已启用', 'success');
            } else {
                window.pluginDevTools.disable();
                this.showNotification('插件开发模式已禁用', 'info');
            }
        }
        console.log(`🔌 PluginManagerModal: 开发模式${enabled ? '启用' : '禁用'}`);
    }

    isVisible() {
        return this.modal.classList.contains('show');
    }

    // 状态与列表
    updatePluginStatus() {
        if (!this.pluginStatusIndicator || !this.pluginStatusText || !this.pluginCountText) return;
        const pm = window.pluginManager;
        if (!pm) {
            this.pluginStatusIndicator.className = 'status-indicator inactive';
            this.pluginStatusText.textContent = '未初始化';
            this.pluginCountText.textContent = '0 个插件';
            return;
        }
        if (pm.isInitialized) {
            this.pluginStatusIndicator.className = 'status-indicator active';
            this.pluginStatusText.textContent = '运行中';
            const all = pm.getAllPlugins();
            const enabled = all.filter(p => p.enabled).length;
            const loaded = all.filter(p => p.loaded).length;
            this.pluginCountText.textContent = `${all.length} 个插件 (${enabled} 启用, ${loaded} 已加载)`;
        } else {
            this.pluginStatusIndicator.className = 'status-indicator inactive';
            this.pluginStatusText.textContent = '初始化中';
            this.pluginCountText.textContent = '0 个插件';
        }
    }

    refreshPluginList() {
        if (!this.pluginList) return;
        const pm = window.pluginManager;
        if (!pm) {
            this.allPlugins = [];
            this.showEmptyPluginList();
            return;
        }
        this.allPlugins = pm.getAllPlugins();
        if (this.allPlugins.length === 0) {
            this.showEmptyPluginList();
            return;
        }
        this.filterAndDisplayPlugins();
    }

    filterAndDisplayPlugins() {
        if (!this.pluginList) return;

        let plugins = [...this.allPlugins];

        // 搜索筛选
        const searchTerm = this.searchInput?.value.toLowerCase().trim();
        if (searchTerm) {
            plugins = plugins.filter(plugin => {
                const name = (plugin.config.name || plugin.id).toLowerCase();
                const description = (plugin.config.description || '').toLowerCase();
                const author = (plugin.config.author || '').toLowerCase();
                return name.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    author.includes(searchTerm);
            });
        }

        // 状态筛选
        const statusFilter = this.statusFilter?.value;
        if (statusFilter && statusFilter !== 'all') {
            plugins = plugins.filter(plugin => {
                if (statusFilter === 'enabled') return plugin.enabled && plugin.loaded;
                if (statusFilter === 'disabled') return !plugin.enabled;
                if (statusFilter === 'loading') return plugin.enabled && !plugin.loaded;
                return true;
            });
        }

        // 排序
        const sortBy = this.sortSelect?.value || 'name';
        plugins.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return (a.config.name || a.id).localeCompare(b.config.name || b.id);
                case 'status':
                    const getStatusPriority = (plugin) => {
                        if (plugin.enabled && plugin.loaded) return 0; // 已启用
                        if (plugin.enabled && !plugin.loaded) return 1; // 加载中
                        return 2; // 已禁用
                    };
                    return getStatusPriority(a) - getStatusPriority(b);
                case 'author':
                    return (a.config.author || '').localeCompare(b.config.author || '');
                case 'size':
                    return (b.config.size || 0) - (a.config.size || 0);
                default:
                    return 0;
            }
        });

        this.filteredPlugins = plugins;
        this.displayPlugins(plugins);
    }

    displayPlugins(plugins) {
        if (plugins.length === 0) {
            this.showEmptyPluginList();
            return;
        }

        this.pluginList.innerHTML = '';
        plugins.forEach(plugin => this.pluginList.appendChild(this.createPluginItem(plugin)));

        // 隐藏空状态
        if (this.pluginListEmpty) {
            this.pluginListEmpty.style.display = 'none';
        }
    }

    showEmptyPluginList() {
        if (this.pluginList && this.pluginListEmpty) {
            this.pluginList.innerHTML = '';
            this.pluginList.appendChild(this.pluginListEmpty.cloneNode(true));
        }
    }

    createPluginItem(plugin) {
        const item = document.createElement('div');
        item.className = `pm-plugin-card ${plugin.enabled ? '' : 'disabled'}`;
        item.dataset.pluginId = plugin.id;
        const statusBadgeClass = plugin.loaded ? 'enabled' : (plugin.enabled ? 'loading' : 'disabled');
        const statusBadgeText = plugin.loaded ? '已加载' : (plugin.enabled ? '加载中' : '已禁用');
        item.innerHTML = `
            <div class="pm-plugin-info">
                <div class="pm-plugin-header">
                    <div class="pm-plugin-name">${plugin.config.name || plugin.id}</div>
                    <div class="pm-plugin-version">v${plugin.config.version || '1.0.0'}</div>
                    <div class="pm-status-badge ${statusBadgeClass}">${statusBadgeText}</div>
                </div>
                <div class="pm-plugin-description">${plugin.config.description || '暂无描述'}</div>
                <div class="pm-plugin-meta">
                    <div class="pm-plugin-author"><span>👤</span><span>${plugin.config.author || '未知作者'}</span></div>
                    <div class="pm-plugin-size"><span>📦</span><span>${this.formatFileSize(plugin.config.size || 0)}</span></div>
                </div>
            </div>
            <div class="pm-plugin-controls">
                <div class="pm-plugin-toggle">
                    <div class="toggle-switch">
                        <input type="checkbox" id="pm-plugin-toggle-${plugin.id}" class="toggle-input" ${plugin.enabled ? 'checked' : ''}>
                        <label for="pm-plugin-toggle-${plugin.id}" class="toggle-label"></label>
                    </div>
                </div>
                <div class="pm-action-buttons">
                    <button class="pm-action-btn" data-action="configure" ${!plugin.loaded ? 'disabled' : ''}>配置</button>
                    <button class="pm-action-btn" data-action="reload" ${!plugin.enabled ? 'disabled' : ''}>重载</button>
                    <button class="pm-action-btn danger" data-action="uninstall">卸载</button>
                </div>
            </div>`;
        this.setupPluginItemEvents(item, plugin);
        return item;
    }

    setupPluginItemEvents(item, plugin) {
        const toggle = item.querySelector('.toggle-input');
        const actionButtons = item.querySelectorAll('.pm-action-btn');
        if (toggle) {
            toggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                try {
                    if (enabled) {
                        await window.plugins.enable(plugin.id);
                        this.showNotification(`插件 ${plugin.config.name} 已启用`, 'success');
                    } else {
                        await window.plugins.disable(plugin.id);
                        this.showNotification(`插件 ${plugin.config.name} 已禁用`, 'info');
                    }
                } catch (error) {
                    console.error('插件状态切换失败:', error);
                    this.showNotification(`操作失败: ${error.message}`, 'error');
                    e.target.checked = !enabled;
                }
            });
        }
        actionButtons.forEach(btn => btn.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            await this.handlePluginAction(plugin, action);
        }));
    }

    async handlePluginAction(plugin, action) {
        try {
            switch (action) {
                case 'configure':
                    this.showPluginConfigDialog(plugin);
                    break;
                case 'reload':
                    await window.plugins.reload(plugin.id);
                    this.showNotification(`插件 ${plugin.config.name} 已重载`, 'success');
                    this.refreshPluginList();
                    break;
                case 'uninstall':
                    if (confirm(`确定要卸载插件 "${plugin.config.name}" 吗？`)) {
                        await window.plugins.uninstall(plugin.id);
                        this.showNotification(`插件 ${plugin.config.name} 已卸载`, 'success');
                        this.refreshPluginList();
                    }
                    break;
                default:
                    console.warn('未知的插件操作:', action);
            }
        } catch (error) {
            console.error('插件操作失败:', error);
            this.showNotification(`操作失败: ${error.message}`, 'error');
        }
    }

    // 插件安装面板
    showInstallPanel() {
        if (!this.installPanel) return;
        this.installPanel.style.display = 'block';
        this.installPanel.classList.add('show');
        // 初始填充示例
        if (this.codeInput && !this.codeInput.value) {
            this.codeInput.value = this.getExamplePluginCode();
        }
        if (this.configInput && !this.configInput.value) {
            this.configInput.value = this.getExamplePluginConfig();
        }
        if (this.pluginIdInput && !this.pluginIdInput.value) {
            this.pluginIdInput.value = `example-plugin-${Date.now()}`;
        }
        if (this.templateIdInput && !this.templateIdInput.value) {
            this.templateIdInput.value = `template-plugin-${Date.now()}`;
        }
        if (this.templateNameInput && !this.templateNameInput.value) {
            this.templateNameInput.value = '模板插件';
        }
    }

    hideInstallPanel() {
        if (!this.installPanel) return;
        this.installPanel.classList.remove('show');
        setTimeout(() => this.installPanel.style.display = 'none', 200);
    }

    async handlePluginInstall() {
        try {
            const activeTab = this.element.querySelector('.install-tab-btn.active')?.dataset.tab;
            if (activeTab === 'code') await this.installFromCode();
            else if (activeTab === 'config') await this.installFromConfig();
            else if (activeTab === 'template') await this.installFromTemplate();
            this.hideInstallPanel();
        } catch (error) {
            console.error('安装插件失败:', error);
            this.showNotification(`安装失败: ${error.message}`, 'error');
        }
    }

    async installFromCode() {
        const code = this.codeInput?.value || '';
        const pluginId = this.pluginIdInput?.value || `temp_plugin_${Date.now()}`;
        await this.installPluginFromCode(code, pluginId, `临时插件 ${pluginId}`);
    }

    async installFromConfig() {
        const json = this.configInput?.value || '{}';
        const config = JSON.parse(json);
        await window.plugins?.install(config);
        this.showNotification('插件安装成功', 'success');
        this.refreshPluginList();
    }

    async installFromTemplate() {
        const template = this.templateSelect?.value || 'basic';
        const pluginId = this.templateIdInput?.value || `template_plugin_${Date.now()}`;
        const pluginName = this.templateNameInput?.value || '模板插件';
        let code;
        if (window.pluginDevServer) {
            code = template === 'ui' ? window.pluginDevServer.getUITemplate()
                : template === 'music' ? window.pluginDevServer.getMusicTemplate()
                    : window.pluginDevServer.getBasicTemplate();
        } else {
            code = this.getExamplePluginCode();
        }
        await this.installPluginFromCode(code, pluginId, pluginName);
    }

    // UTF-8 安全的 Base64 编码函数
    // 解决包含非Latin1字符时 btoa 函数抛出异常的问题
    encodeUTF8ToBase64(str) {
        try {
            // 使用 TextEncoder 将字符串编码为 UTF-8 字节数组
            const encoder = new TextEncoder();
            const utf8Bytes = encoder.encode(str);

            // 将字节数组转换为二进制字符串
            let binaryString = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                binaryString += String.fromCharCode(utf8Bytes[i]);
            }

            // 使用 btoa 对二进制字符串进行 Base64 编码
            return btoa(binaryString);
        } catch (error) {
            console.error('UTF-8 Base64 编码失败:', error);
            // 如果编码失败，尝试直接使用 btoa
            try {
                return btoa(str);
            } catch (fallbackError) {
                throw new Error(`Base64编码失败: ${error.message}`);
            }
        }
    }

    async installPluginFromCode(code, pluginId = null, pluginName = null) {
        try {
            const finalPluginId = pluginId || `temp_plugin_${Date.now()}`;
            const finalPluginName = pluginName || `临时插件 ${finalPluginId}`;
            if (window.pluginDevTools && window.pluginDevTools.isEnabled) {
                await window.pluginDevTools.createDevPlugin(finalPluginId, code);
                this.showNotification('开发插件安装成功', 'success');
            } else {
                const config = {
                    id: finalPluginId,
                    name: finalPluginName,
                    version: '1.0.0',
                    description: '通过代码安装的插件',
                    author: '用户',
                    main: `data:text/javascript;base64,${this.encodeUTF8ToBase64(code)}`
                };
                await window.plugins?.install(config);
                this.showNotification('插件安装成功', 'success');
            }
            this.refreshPluginList();
        } catch (error) {
            console.error('安装插件失败:', error);
            this.showNotification(`安装失败: ${error.message}`, 'error');
        }
    }

    // 导入
    async importPluginFile() {
        try {
            const result = await window.electronAPI?.dialog?.showOpenDialog({
                title: '选择插件文件',
                filters: [
                    {name: 'JavaScript插件文件', extensions: ['js']},
                    {name: 'JSON配置文件', extensions: ['json']},
                    {name: 'ZIP压缩包', extensions: ['zip']},
                    {name: 'TAR压缩包', extensions: ['tar', 'tar.gz', 'tgz']},
                    {name: '所有文件', extensions: ['*']}
                ],
                properties: ['openFile']
            });
            const files = result && !result.canceled ? result.filePaths : null;
            if (files && files.length > 0) {
                const filePath = files[0];
                const ext = filePath.split('.').pop().toLowerCase();
                if (ext === 'js') await this.importJavaScriptPlugin(filePath);
                else if (ext === 'json') await this.importJSONPlugin(filePath);
                else if (['zip', 'tar', 'gz', 'tgz'].includes(ext)) await this.importCompressedPlugin(filePath);
                else this.showNotification('不支持的文件格式', 'error');
            }
        } catch (error) {
            console.error('导入插件文件失败:', error);
            this.showNotification(`导入失败: ${error.message}`, 'error');
        }
    }

    async importJavaScriptPlugin(filePath) {
        try {
            const content = await window.electronAPI?.fs?.readFile(filePath, 'utf8');
            if (!content) throw new Error('无法读取文件内容');
            const fileName = filePath.split(/[/\\]/).pop().replace('.js', '');
            const pluginId = `imported_${fileName}_${Date.now()}`;
            const base64Content = this.encodeUTF8ToBase64(content);
            const config = {
                id: pluginId,
                name: fileName,
                version: '1.0.0',
                description: `从文件 ${fileName}.js 导入的插件`,
                author: '用户导入',
                main: `data:text/javascript;base64,${base64Content}`,
                imported: true,
                importPath: filePath
            };
            await window.plugins?.install(config);
            this.showNotification(`插件 ${fileName} 导入成功`, 'success');
            this.refreshPluginList();
        } catch (error) {
            console.error('导入JavaScript插件失败:', error);
            this.showNotification(`导入失败: ${error.message}`, 'error');
        }
    }

    async importJSONPlugin(filePath) {
        try {
            const content = await window.electronAPI?.fs?.readFile(filePath, 'utf8');
            const config = JSON.parse(content);
            if (!config.id || !config.name || !config.version) throw new Error('插件配置不完整');
            await window.plugins?.install(config);
            this.showNotification(`插件 ${config.name} 导入成功`, 'success');
            this.refreshPluginList();
        } catch (error) {
            console.error('导入JSON插件失败:', error);
            this.showNotification(`导入失败: ${error.message}`, 'error');
        }
    }

    async importCompressedPlugin(filePath) {
        this.showNotification('压缩包插件导入功能开发中，请使用JS或JSON文件', 'info');
        console.log('压缩包插件文件:', filePath);
    }

    // 示例代码
    getExamplePluginCode() {
        return `/**
 * 示例插件 - MusicBox插件开发模板
 */
class ExamplePlugin extends PluginBase {
    constructor(context) {
        super(context);
        console.log('🔌 ExamplePlugin: 插件构造');
    }

    async activate() {
        console.log('🔌 ExamplePlugin: 插件激活');
        await super.activate();

        // 显示激活通知
        this.showNotification('示例插件已激活！', 'success');

        // 注册命令
        this.registerCommand('hello', () => {
            this.showNotification('Hello from Example Plugin!', 'info');
        });

        // 添加样式
        this.addStyle(\`
            .example-plugin-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                background: #2ed573;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
            }
        \`);

        // 添加UI指示器
        this.addUIIndicator();
    }

    async deactivate() {
        console.log('🔌 ExamplePlugin: 插件停用');
        this.removeUIIndicator();
        await super.deactivate();
        this.showNotification('示例插件已停用', 'info');
    }

    addUIIndicator() {
        const indicator = this.createElement('div', {
            className: 'example-plugin-indicator',
            textContent: '示例插件运行中'
        });
        document.body.appendChild(indicator);
        this.uiIndicator = indicator;
    }

    removeUIIndicator() {
        if (this.uiIndicator && this.uiIndicator.parentNode) {
            this.uiIndicator.parentNode.removeChild(this.uiIndicator);
            this.uiIndicator = null;
        }
    }
}

window.PluginClass = ExamplePlugin;`;
    }

    getExamplePluginConfig() {
        return JSON.stringify({
            "id": "example-plugin",
            "name": "示例插件",
            "version": "1.0.0",
            "description": "这是一个示例插件，展示基本的插件功能",
            "author": "MusicBox开发团队",
            "main": "index.js",
            "permissions": ["ui", "player", "settings"],
            "dependencies": [],
            "engines": {
                "musicbox": ">=0.1.0"
            }
        }, null, 2);
    }

    showPluginConfigDialog(plugin) {
        alert(`插件配置信息:\n\n${JSON.stringify(plugin.config, null, 2)}`);
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        showToast(message, type);
    }
}

window.components.component.PluginManagerModal = PluginManagerModal;
