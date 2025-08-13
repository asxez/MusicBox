/**
 * 测试插件
 */

class SettingsTestPlugin extends PluginBase {
    constructor(context) {
        super(context);

        this.metadata = {
            id: 'settings-test-plugin',
            name: '测试插件',
            version: '1.0.0',
            description: '测试插件',
            author: 'MusicBox-ASXE',
            permissions: ['settings', 'navigation'],
            category: '功能测试'
        };

        // 测试数据
        this.testSettings = {
            enabled: true,
            theme: 'dark',
            volume: 75,
            username: 'TestUser',
            color: '#3498db',
            autoSave: false
        };
    }

    async activate() {
        await super.activate();
        console.log(`🔌 ${this.name}: 插件激活`);

        try {
            // 添加插件样式
            this.addPluginStyles();

            // 添加侧边栏导航项
            this.navigationItemId = await this.addSidebarItem({
                id: 'settings-test',
                name: '设置测试',
                icon: '⚙️',
                order: 90,
                onClick: () => this.showTestPage()
            });

            // 添加设置区域
            this.settingsSectionId = await this.addSettingsSection({
                id: 'settings-test-section',
                title: '设置测试插件',
                description: '测试各种类型的设置项和交互功能',
                order: 10,
                items: [
                    {
                        type: 'toggle',
                        id: 'enabled',
                        label: '启用插件',
                        description: '控制插件是否启用',
                        value: this.testSettings.enabled,
                        onChange: (value) => this.handleSettingChange('enabled', value)
                    },
                    {
                        type: 'select',
                        id: 'theme',
                        label: '主题选择',
                        description: '选择插件使用的主题',
                        value: this.testSettings.theme,
                        options: [
                            { value: 'light', label: '浅色主题' },
                            { value: 'dark', label: '深色主题' },
                            { value: 'auto', label: '跟随系统' }
                        ],
                        onChange: (value) => this.handleSettingChange('theme', value)
                    },
                    {
                        type: 'slider',
                        id: 'volume',
                        label: '音量设置',
                        description: '调整插件相关功能的音量',
                        value: this.testSettings.volume,
                        min: 0,
                        max: 100,
                        step: 5,
                        onChange: (value) => this.handleSettingChange('volume', value)
                    },
                    {
                        type: 'input',
                        id: 'username',
                        label: '用户名',
                        description: '设置用户显示名称',
                        value: this.testSettings.username,
                        placeholder: '请输入用户名',
                        onChange: (value) => this.handleSettingChange('username', value)
                    },
                    {
                        type: 'color',
                        id: 'color',
                        label: '主题颜色',
                        description: '选择插件的主题颜色',
                        value: this.testSettings.color,
                        onChange: (value) => this.handleSettingChange('color', value)
                    },
                    {
                        type: 'button',
                        id: 'reset',
                        label: '重置设置',
                        description: '将所有设置恢复为默认值',
                        buttonText: '重置',
                        onClick: () => this.resetSettings()
                    }
                ]
            });

            if (this.settingsSectionId) {
                console.log(`✅ ${this.name}: 设置区域添加成功 - ${this.settingsSectionId}`);
            }

            if (this.navigationItemId) {
                console.log(`✅ ${this.name}: 导航项添加成功 - ${this.navigationItemId}`);
            }

            this.showNotification('设置测试插件已激活！', 'success');

        } catch (error) {
            console.error(`❌ ${this.name}: 激活失败:`, error);
            this.showNotification('设置测试插件激活失败', 'error');
        }
    }

    async deactivate() {
        console.log(`🔌 ${this.name}: 插件停用`);

        // 清理测试页面事件监听器
        this.cleanupTestPageEvents();

        await super.deactivate();
    }

    /**
     * 添加插件样式
     */
    addPluginStyles() {
        // 添加设置页面样式（用于Settings页面中的插件设置区域）
        this.addStyle(`
            /* Settings页面插件设置区域样式 */
            .plugin-section {
                background: var(--color-secondary-bg);
                border: 1px solid var(--color-border);
                border-radius: 12px;
                padding: 1.5rem;
                margin-bottom: 1.5rem;
                transition: all 0.3s ease;
            }

            .plugin-section:hover {
                border-color: var(--color-primary-alpha);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .plugin-section-header {
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--color-border);
            }

            .plugin-section-title {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--color-text);
                margin: 0 0 0.5rem 0;
            }

            .plugin-section-description {
                font-size: 0.875rem;
                color: var(--color-text-secondary);
                margin: 0;
                line-height: 1.4;
            }

            .plugin-setting-item {
                margin-bottom: 1.5rem;
            }

            .plugin-setting-item:last-child {
                margin-bottom: 0;
            }

            .plugin-setting-item .setting-item {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1.5rem;
            }

            .plugin-setting-item .setting-info {
                flex: 1;
                min-width: 0;
            }

            .plugin-setting-item .setting-label {
                font-size: 1rem;
                font-weight: 500;
                color: var(--color-text);
                margin: 0 0 0.25rem 0;
                display: block;
                cursor: pointer;
            }

            .plugin-setting-item .setting-description {
                font-size: 0.875rem;
                color: var(--color-text-secondary);
                margin: 0;
                line-height: 1.4;
            }

            .plugin-setting-item .setting-control {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            /* 设置控件样式 */
            .plugin-setting-item .setting-select,
            .plugin-setting-item .setting-input {
                min-width: 150px;
                padding: 0.5rem 0.75rem;
                border: 1px solid var(--color-border);
                border-radius: 6px;
                background: var(--color-secondary-bg);
                color: var(--color-text);
                font-size: 0.875rem;
                transition: all 0.3s ease;
            }

            .plugin-setting-item .setting-select:focus,
            .plugin-setting-item .setting-input:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 2px var(--color-primary-alpha);
            }

            .plugin-setting-item .setting-button {
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                border-radius: 6px;
                transition: all 0.3s ease;
                background: var(--color-primary);
                color: white;
                border: none;
                cursor: pointer;
            }

            .plugin-setting-item .setting-button:hover {
                background: var(--color-primary-hover);
                transform: translateY(-1px);
            }

            .plugin-setting-item .setting-color {
                width: 50px;
                height: 35px;
                border: 1px solid var(--color-border);
                border-radius: 6px;
                background: transparent;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .plugin-setting-item .slider-container {
                display: flex;
                align-items: center;
                gap: 1rem;
                min-width: 200px;
            }

            .plugin-setting-item .setting-slider {
                flex: 1;
                height: 6px;
                border-radius: 3px;
                background: var(--color-border);
                outline: none;
                appearance: none;
                cursor: pointer;
            }

            .plugin-setting-item .setting-slider::-webkit-slider-thumb {
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--color-primary);
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .plugin-setting-item .setting-slider::-webkit-slider-thumb:hover {
                transform: scale(1.1);
            }

            .plugin-setting-item .slider-value {
                font-size: 0.875rem;
                color: var(--color-text-secondary);
                font-weight: 500;
                min-width: 40px;
                text-align: center;
            }
        `, { scoped: true, id: 'settings-page-styles' });

        console.log(`🎨 ${this.name}: 设置页面样式已添加`);
    }

    /**
     * 处理设置项变更
     */
    handleSettingChange(key, value) {
        console.log(`🔧 ${this.name}: 设置变更 - ${key}: ${value}`);
        this.testSettings[key] = value;

        // 保存到本地存储
        this.setStorage('testSettings', this.testSettings);

        // 应用设置变更
        this.applySettingChange(key, value);

        if (this.testSettings.autoSave) {
            this.showNotification(`设置已自动保存: ${key}`, 'info');
        }
    }

    /**
     * 应用设置变更
     */
    applySettingChange(key, value) {
        switch (key) {
            case 'enabled':
                if (value) {
                    console.log(`✅ ${this.name}: 插件已启用`);
                } else {
                    console.log(`❌ ${this.name}: 插件已禁用`);
                }
                break;
            case 'theme':
                console.log(`🎨 ${this.name}: 主题切换到 ${value}`);
                break;
            case 'volume':
                console.log(`🔊 ${this.name}: 音量设置为 ${value}%`);
                break;
            case 'color':
                console.log(`🎨 ${this.name}: 主题颜色设置为 ${value}`);
                break;
        }
    }

    /**
     * 重置所有设置
     */
    resetSettings() {
        console.log(`🔄 ${this.name}: 重置所有设置`);

        this.testSettings = {
            enabled: true,
            theme: 'dark',
            volume: 75,
            username: 'TestUser',
            color: '#3498db',
            autoSave: false
        };

        this.setStorage('testSettings', this.testSettings);
        this.showNotification('设置已重置为默认值', 'success');

        // 刷新设置页面以显示新值
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    /**
     * 显示测试页面
     */
    showTestPage() {
        const contentArea = document.querySelector('#content-area');
        if (!contentArea) return;

        // 添加测试页面样式（如果还没有添加）
        this.addTestPageStyles();

        // 创建页面HTML结构，并添加插件作用域属性
        const html = `
            <div class="plugin-test-page">
                <div class="test-header">
                    <h2>🔧 设置测试插件</h2>
                    <p>这是一个测试页面，展示插件的各种功能</p>
                </div>
                <div class="test-content">
                    <div class="test-section">
                        <h3>当前设置</h3>
                        <pre id="settings-display">${JSON.stringify(this.testSettings, null, 2)}</pre>
                        <button class="btn btn-outline" id="refresh-settings-btn">刷新设置显示</button>
                    </div>
                    <div class="test-section">
                        <h3>功能测试</h3>
                        <div class="test-buttons">
                            <button class="btn btn-primary" id="test-notification-btn">
                                🔔 测试通知
                            </button>
                            <button class="btn btn-secondary" id="test-navigation-btn">
                                🧭 测试导航
                            </button>
                            <button class="btn btn-success" id="test-settings-api-btn">
                                ⚙️ 测试设置API
                            </button>
                            <button class="btn btn-info" id="test-context-btn">
                                🔍 测试上下文
                            </button>
                        </div>
                    </div>
                    <div class="test-section">
                        <h3>插件信息</h3>
                        <div class="plugin-info">
                            <p><strong>插件ID:</strong> ${this.id}</p>
                            <p><strong>插件名称:</strong> ${this.name}</p>
                            <p><strong>版本:</strong> ${this.version}</p>
                            <p><strong>状态:</strong> ${this.isActive ? '已激活' : '未激活'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加插件作用域并设置内容
        contentArea.innerHTML = this.addScopeToHTML(html);

        // 为内容区域添加插件数据属性
        this.addPluginScope(contentArea);

        // 绑定事件监听器，使用箭头函数保持this上下文
        this.bindTestPageEvents();

        console.log(`📄 ${this.name}: 显示测试页面`);
    }

    /**
     * 添加测试页面样式
     */
    addTestPageStyles() {
        // 检查是否已经添加过测试页面样式
        if (this.testPageStylesAdded) return;

        this.addStyle(`
            /* 测试页面样式 */
            .plugin-test-page {
                padding: 2rem;
                max-width: 800px;
                margin: 0 auto;
                font-family: var(--font-family);
            }

            .test-header {
                text-align: center;
                margin-bottom: 2rem;
            }

            .test-header h2 {
                color: var(--color-text);
                margin-bottom: 0.5rem;
                font-size: 1.5rem;
                font-weight: 600;
            }

            .test-header p {
                color: var(--color-text-secondary);
                font-size: 1rem;
            }

            .test-content {
                display: grid;
                gap: 1.5rem;
            }

            .test-section {
                background: var(--color-secondary-bg);
                border-radius: 12px;
                padding: 1.5rem;
                border: 1px solid var(--color-border);
                transition: all 0.3s ease;
            }

            .test-section:hover {
                border-color: var(--color-primary-alpha);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .test-section h3 {
                color: var(--color-text);
                margin-bottom: 1rem;
                font-size: 1.125rem;
                font-weight: 600;
            }

            .test-buttons {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }

            .test-buttons .btn {
                margin: 0;
                padding: 0.75rem 1.5rem;
                font-weight: 500;
                transition: all 0.3s ease;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 0.875rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
            }

            .test-buttons .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .btn-primary {
                background: var(--color-primary);
                color: white;
            }

            .btn-secondary {
                background: var(--color-text-secondary);
                color: white;
            }

            .btn-success {
                background: #28a745;
                color: white;
            }

            .btn-info {
                background: #17a2b8;
                color: white;
            }

            .btn-outline {
                background: transparent;
                color: var(--color-text);
                border: 1px solid var(--color-border);
            }

            .plugin-info {
                background: var(--color-body-bg);
                border: 1px solid var(--color-border);
                border-radius: 8px;
                padding: 1rem;
            }

            .plugin-info p {
                margin: 0.25rem 0;
                font-size: 0.875rem;
            }

            .plugin-info strong {
                color: var(--color-text);
                font-weight: 600;
            }

            #settings-display {
                max-height: 300px;
                overflow-y: auto;
                margin-bottom: 1rem;
                background: var(--color-body-bg);
                border: 1px solid var(--color-border);
                border-radius: 8px;
                padding: 1rem;
                font-size: 0.875rem;
                color: var(--color-text);
                font-family: 'Courier New', monospace;
                white-space: pre-wrap;
            }

            #refresh-settings-btn {
                font-size: 0.875rem;
                padding: 0.5rem 1rem;
            }
        `, { scoped: true, id: 'test-page-styles' });

        this.testPageStylesAdded = true;
        console.log(`🎨 ${this.name}: 测试页面样式已添加`);
    }

    /**
     * 绑定测试页面事件
     */
    bindTestPageEvents() {
        // 测试通知按钮
        const testNotificationBtn = document.getElementById('test-notification-btn');
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('click', () => {
                this.testNotification();
            });
        }

        // 测试导航按钮
        const testNavigationBtn = document.getElementById('test-navigation-btn');
        if (testNavigationBtn) {
            testNavigationBtn.addEventListener('click', () => {
                this.testNavigation();
            });
        }

        // 测试设置API按钮
        const testSettingsAPIBtn = document.getElementById('test-settings-api-btn');
        if (testSettingsAPIBtn) {
            testSettingsAPIBtn.addEventListener('click', () => {
                this.testSettingsAPI();
            });
        }

        // 测试上下文按钮
        const testContextBtn = document.getElementById('test-context-btn');
        if (testContextBtn) {
            testContextBtn.addEventListener('click', () => {
                this.testContext();
            });
        }

        // 刷新设置显示按钮
        const refreshSettingsBtn = document.getElementById('refresh-settings-btn');
        if (refreshSettingsBtn) {
            refreshSettingsBtn.addEventListener('click', () => {
                this.refreshSettingsDisplay();
            });
        }

        console.log(`🔗 ${this.name}: 测试页面事件绑定完成`);
    }

    /**
     * 测试通知功能
     */
    testNotification() {
        this.showNotification('这是一个测试通知！', 'info');
        console.log(`🔔 ${this.name}: 测试通知已发送`);
    }

    /**
     * 测试导航功能
     */
    testNavigation() {
        this.context.navigation.navigateTo('library');
        this.showNotification('已导航到音乐库', 'success');
        console.log(`🧭 ${this.name}: 测试导航到音乐库`);
    }

    /**
     * 测试设置API
     */
    testSettingsAPI() {
        // 测试基本的get/set功能
        const testKey = 'plugin-test-key';
        const testValue = 'plugin-test-value';

        this.context.settings.set(testKey, testValue);
        const retrievedValue = this.context.settings.get(testKey);

        const success = retrievedValue === testValue;
        this.showNotification(
            success ? '设置API测试成功' : '设置API测试失败',
            success ? 'success' : 'error'
        );

        console.log(`🔧 ${this.name}: 设置API测试 - ${success ? '成功' : '失败'}`);
        console.log(`   设置值: ${testValue}, 获取值: ${retrievedValue}`);
    }

    /**
     * 测试上下文功能
     */
    testContext() {
        console.log(`🔍 ${this.name}: 测试上下文功能`);

        const contextInfo = {
            hasContext: !!this.context,
            contextKeys: Object.keys(this.context || {}),
            hasApp: !!this.context?.app,
            hasAPI: !!this.context?.api,
            appInitialized: this.context?.app?.isInitialized,
            availableComponents: Object.keys(this.context?.app?.components || {}),
            pluginId: this.context?.pluginId
        };

        console.log(`🔍 ${this.name}: 上下文信息:`, contextInfo);

        // 显示在页面上
        const message = `上下文测试完成！详情请查看控制台。\n` +
            `应用已初始化: ${contextInfo.appInitialized}\n` +
            `可用组件: ${contextInfo.availableComponents.length}个`;

        this.showNotification(message, 'info');
    }

    /**
     * 刷新设置显示
     */
    refreshSettingsDisplay() {
        const settingsDisplay = document.getElementById('settings-display');
        if (settingsDisplay) {
            // 从存储中重新加载设置
            const storedSettings = this.getStorage('testSettings');
            if (storedSettings) {
                this.testSettings = storedSettings;
            }

            settingsDisplay.textContent = JSON.stringify(this.testSettings, null, 2);
            this.showNotification('设置显示已刷新', 'success');
            console.log(`🔄 ${this.name}: 设置显示已刷新`);
        }
    }

    /**
     * 清理测试页面事件监听器
     */
    cleanupTestPageEvents() {
        // 移除所有测试页面相关的事件监听器
        const buttonIds = [
            'test-notification-btn',
            'test-navigation-btn',
            'test-settings-api-btn',
            'test-context-btn',
            'refresh-settings-btn'
        ];

        buttonIds.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                // 克隆节点以移除所有事件监听器
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
            }
        });

        console.log(`🧹 ${this.name}: 测试页面事件监听器已清理`);
    }
}

window.PluginClass = SettingsTestPlugin;
