/**
 * 主题切换插件示例
 * 展示如何创建一个实用的插件，提供多种主题切换功能
 *
 */

class ThemeSwitcherPlugin extends PluginBase {
    constructor(context) {
        super(context);

        // 插件元数据
        this.metadata = {
            id: 'theme-switcher',
            name: '主题切换器',
            version: '六百六十六',
            description: '提供多种预设主题和自定义主题功能，支持实时切换和主题导入导出',
            author: 'MusicBox-ASXE',
            permissions: ['ui', 'settings', 'storage'],
            category: '界面增强'
        };

        // 预定义主题
        this.themes = {
            light: {
                name: '浅色主题',
                dataTheme: 'light',
                colors: {
                    'color-body-bg': '#ffffff',
                    'color-text': '#000000',
                    'color-text-secondary': '#7a7a7b',
                    'color-primary': '#335eea',
                    'color-secondary-bg': '#f5f5f7',
                    'color-navbar-bg': 'rgba(255, 255, 255, 0.86)',
                    'color-sidebar-bg': '#fafafa',
                    'color-player-bg': '#ffffff',
                    'color-border': '#e5e5e7',
                    'color-hover': '#f0f0f0'
                }
            },
            dark: {
                name: '深色主题',
                dataTheme: 'dark',
                colors: {
                    'color-body-bg': '#222222',
                    'color-text': '#ffffff',
                    'color-text-secondary': '#a0a0a0',
                    'color-primary': '#335eea',
                    'color-secondary-bg': '#323232',
                    'color-navbar-bg': 'rgba(34, 34, 34, 0.86)',
                    'color-sidebar-bg': '#1a1a1a',
                    'color-player-bg': '#2a2a2a',
                    'color-border': '#404040',
                    'color-hover': '#3a3a3a'
                }
            },
            ocean: {
                name: '海洋主题',
                dataTheme: 'custom',
                colors: {
                    'color-body-bg': '#001122',
                    'color-text': '#ffffff',
                    'color-text-secondary': '#88ccdd',
                    'color-primary': '#0077be',
                    'color-secondary-bg': '#003344',
                    'color-navbar-bg': 'rgba(0, 17, 34, 0.86)',
                    'color-sidebar-bg': '#001a2e',
                    'color-player-bg': '#002244',
                    'color-border': '#004466',
                    'color-hover': '#004455'
                }
            },
            forest: {
                name: '森林主题',
                dataTheme: 'custom',
                colors: {
                    'color-body-bg': '#0f1a0a',
                    'color-text': '#ffffff',
                    'color-text-secondary': '#88bb77',
                    'color-primary': '#2d5016',
                    'color-secondary-bg': '#1a2d15',
                    'color-navbar-bg': 'rgba(15, 26, 10, 0.86)',
                    'color-sidebar-bg': '#0a1505',
                    'color-player-bg': '#152a0f',
                    'color-border': '#2a4020',
                    'color-hover': '#1f3318'
                }
            },
            sunset: {
                name: '日落主题',
                dataTheme: 'custom',
                colors: {
                    'color-body-bg': '#2d1b0a',
                    'color-text': '#ffffff',
                    'color-text-secondary': '#ffcc99',
                    'color-primary': '#ff6b35',
                    'color-secondary-bg': '#4a2f1a',
                    'color-navbar-bg': 'rgba(45, 27, 10, 0.86)',
                    'color-sidebar-bg': '#1f1205',
                    'color-player-bg': '#3d2415',
                    'color-border': '#664433',
                    'color-hover': '#553322'
                }
            },
            purple: {
                name: '紫色主题',
                dataTheme: 'custom',
                colors: {
                    'color-body-bg': '#1a0d1a',
                    'color-text': '#ffffff',
                    'color-text-secondary': '#cc99cc',
                    'color-primary': '#8e44ad',
                    'color-secondary-bg': '#2d1a2d',
                    'color-navbar-bg': 'rgba(26, 13, 26, 0.86)',
                    'color-sidebar-bg': '#150a15',
                    'color-player-bg': '#2a152a',
                    'color-border': '#442244',
                    'color-hover': '#331833'
                }
            }
        };

        this.currentTheme = 'light';
        this.originalTheme = null; // 保存插件激活前的原始主题
        this.sidebarItemId = null;
        this.settingsSectionId = null;

        console.log('🎨 ThemeSwitcherPlugin: 主题切换插件构造完成');
    }

    /**
     * 插件激活
     */
    async activate() {
        await super.activate();

        // 保存当前主题状态
        this.saveOriginalTheme();

        // 加载保存的主题
        this.loadSavedTheme();

        // 添加插件样式
        this.addPluginStyles();

        // 扩展UI
        this.extendUI();

        // 注册命令
        this.registerCommands();

        // 添加快捷键
        this.setupShortcuts();

        // 监听应用主题变化
        this.setupThemeListener();

        this.showNotification('主题切换插件已激活', 'success');
        console.log('🎨 ThemeSwitcherPlugin: 插件激活完成');
    }

    /**
     * 插件停用
     */
    async deactivate() {
        // 恢复原始主题
        this.restoreOriginalTheme();

        // 移除主题监听器
        this.removeThemeListener();

        await super.deactivate();

        this.showNotification('主题切换插件已停用', 'info');
        console.log('🎨 ThemeSwitcherPlugin: 插件停用完成');
    }

    /**
     * 保存原始主题状态
     */
    saveOriginalTheme() {
        this.originalTheme = {
            dataTheme: document.documentElement.getAttribute('data-theme') || 'light',
            customColors: this.getCurrentCustomColors()
        };
        console.log('🎨 ThemeSwitcherPlugin: 已保存原始主题状态:', this.originalTheme);
    }

    /**
     * 恢复原始主题
     */
    restoreOriginalTheme() {
        if (this.originalTheme) {
            // 恢复data-theme属性
            document.documentElement.setAttribute('data-theme', this.originalTheme.dataTheme);

            // 清除自定义CSS变量
            this.clearCustomColors();

            // 如果有自定义颜色，恢复它们
            if (this.originalTheme.customColors) {
                this.applyCustomColors(this.originalTheme.customColors);
            }

            console.log('🎨 ThemeSwitcherPlugin: 已恢复原始主题');
        }
    }

    /**
     * 获取当前自定义颜色
     */
    getCurrentCustomColors() {
        const root = document.documentElement;
        const customColors = {};
        const style = getComputedStyle(root);

        // 检查是否有自定义的颜色变量
        const colorVars = [
            'color-body-bg', 'color-text', 'color-text-secondary', 'color-primary',
            'color-secondary-bg', 'color-navbar-bg', 'color-sidebar-bg',
            'color-player-bg', 'color-border', 'color-hover'
        ];

        colorVars.forEach(varName => {
            const value = root.style.getPropertyValue(`--${varName}`);
            if (value) {
                customColors[varName] = value;
            }
        });

        return Object.keys(customColors).length > 0 ? customColors : null;
    }

    /**
     * 应用自定义颜色
     */
    applyCustomColors(colors) {
        const root = document.documentElement;
        Object.entries(colors).forEach(([property, value]) => {
            root.style.setProperty(`--${property}`, value);
        });
    }

    /**
     * 清除自定义颜色
     */
    clearCustomColors() {
        const root = document.documentElement;
        const colorVars = [
            'color-body-bg', 'color-text', 'color-text-secondary', 'color-primary',
            'color-secondary-bg', 'color-navbar-bg', 'color-sidebar-bg',
            'color-player-bg', 'color-border', 'color-hover'
        ];

        colorVars.forEach(varName => {
            root.style.removeProperty(`--${varName}`);
        });
    }

    /**
     * 设置主题监听器
     */
    setupThemeListener() {
        this.themeChangeHandler = (e) => {
            const newTheme = e.detail || e;
            console.log('🎨 ThemeSwitcherPlugin: 检测到应用主题变化:', newTheme);
            // 如果是应用自身的主题变化，同步更新插件状态
            if (newTheme === 'light' || newTheme === 'dark') {
                this.currentTheme = newTheme;
                this.updateThemePanel();
            }
        };

        // 监听应用的主题变化事件
        if (window.theme && typeof window.theme.on === 'function') {
            window.theme.on('change', this.themeChangeHandler);
        }

        // 监听DOM变化
        this.themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme');
                    if (newTheme && (newTheme === 'light' || newTheme === 'dark')) {
                        this.currentTheme = newTheme;
                        this.updateThemePanel();
                    }
                }
            });
        });

        this.themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    /**
     * 移除主题监听器
     */
    removeThemeListener() {
        if (window.theme && typeof window.theme.off === 'function' && this.themeChangeHandler) {
            window.theme.off('change', this.themeChangeHandler);
        }

        if (this.themeObserver) {
            this.themeObserver.disconnect();
            this.themeObserver = null;
        }
    }

    /**
     * 加载保存的主题
     */
    loadSavedTheme() {
        const savedTheme = this.getStorage('currentTheme') || 'light';
        this.applyTheme(savedTheme);
    }

    /**
     * 添加插件样式
     */
    addPluginStyles() {
        this.addStyle(`
            .theme-switcher-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 280px;
                background: var(--color-secondary-bg);
                border: 1px solid var(--color-border);
                border-radius: 12px;
                padding: 16px;
                box-shadow: var(--shadow-large);
                z-index: 9999;
                transition: all 0.3s ease;
                transform: translateX(300px);
            }
            
            .theme-switcher-panel.visible {
                transform: translateX(0);
            }
            
            .theme-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .theme-panel-title {
                font-weight: 600;
                color: var(--color-text);
                font-size: 16px;
            }
            
            .theme-close-btn {
                background: none;
                border: none;
                color: var(--color-text-secondary);
                font-size: 18px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .theme-close-btn:hover {
                background: var(--color-hover);
                color: var(--color-text);
            }
            
            .theme-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .theme-card {
                padding: 12px;
                border: 2px solid var(--color-border);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: center;
            }
            
            .theme-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-medium);
            }
            
            .theme-card.active {
                border-color: var(--color-primary);
                background: rgba(102, 126, 234, 0.1);
            }
            
            .theme-preview {
                display: flex;
                height: 20px;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .theme-color {
                flex: 1;
            }
            
            .theme-name {
                font-size: 12px;
                font-weight: 500;
                color: var(--color-text);
            }
            
            .theme-actions {
                display: flex;
                gap: 8px;
            }
            
            .theme-btn {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--color-border);
                border-radius: 6px;
                background: var(--color-secondary-bg);
                color: var(--color-text);
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            
            .theme-btn:hover {
                background: var(--color-hover);
                transform: translateY(-1px);
            }
            
            .theme-btn.primary {
                background: var(--color-primary);
                color: white;
                border-color: var(--color-primary);
            }
            
            .theme-floating-btn {
                position: fixed;
                bottom: 100px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: var(--color-primary);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 20px;
                box-shadow: var(--shadow-large);
                transition: all 0.3s ease;
                z-index: 9998;
            }
            
            .theme-floating-btn:hover {
                transform: scale(1.1);
                box-shadow: var(--shadow-extra-large);
            }
        `);
    }

    /**
     * 扩展UI
     */
    extendUI() {
        // 添加侧边栏项目
        this.sidebarItemId = this.addSidebarItem({
            id: 'theme-switcher',
            name: '🎨 主题',
            icon: '🎨',
            order: 90,
            onClick: () => {
                this.toggleThemePanel();
            }
        });

        // 添加设置部分
        this.settingsSectionId = this.addSettingsSection({
            id: 'theme-switcher-settings',
            title: '主题切换设置',
            items: [
                {
                    type: 'select',
                    id: 'default-theme',
                    label: '默认主题',
                    description: '应用启动时使用的主题',
                    value: this.getStorage('defaultTheme') || 'light',
                    options: Object.entries(this.themes).map(([key, theme]) => ({
                        value: key,
                        label: theme.name
                    })),
                    onChange: (value) => {
                        this.setStorage('defaultTheme', value);
                        this.applyTheme(value);
                    }
                },
                {
                    type: 'toggle',
                    id: 'show-floating-btn',
                    label: '显示浮动按钮',
                    description: '在页面右下角显示主题切换按钮',
                    value: this.getStorage('showFloatingBtn') !== false,
                    onChange: (value) => {
                        this.setStorage('showFloatingBtn', value);
                        this.toggleFloatingButton(value);
                    }
                },
                {
                    type: 'button',
                    id: 'reset-theme',
                    label: '重置主题',
                    description: '恢复到默认主题设置',
                    buttonText: '重置',
                    onClick: () => {
                        this.resetTheme();
                    }
                }
            ]
        });

        // 创建主题面板
        this.createThemePanel();
        
        // 创建浮动按钮
        if (this.getStorage('showFloatingBtn') !== false) {
            this.createFloatingButton();
        }
    }

    /**
     * 注册命令
     */
    registerCommands() {
        // 切换主题命令
        this.registerCommand('switchTheme', (themeId) => {
            this.applyTheme(themeId);
        });

        // 下一个主题
        this.registerCommand('nextTheme', () => {
            this.switchToNextTheme();
        });

        // 上一个主题
        this.registerCommand('previousTheme', () => {
            this.switchToPreviousTheme();
        });

        // 切换主题面板
        this.registerCommand('togglePanel', () => {
            this.toggleThemePanel();
        });

        // 随机主题
        this.registerCommand('randomTheme', () => {
            this.applyRandomTheme();
        });
    }

    /**
     * 设置快捷键
     */
    setupShortcuts() {
        // Ctrl+Shift+T 切换主题面板
        this.addEventListener(document, 'keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleThemePanel();
            }
        });

        // Ctrl+Shift+N 下一个主题
        this.addEventListener(document, 'keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                this.switchToNextTheme();
            }
        });

        // Ctrl+Shift+R 随机主题
        this.addEventListener(document, 'keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                this.applyRandomTheme();
            }
        });
    }

    /**
     * 创建主题面板
     */
    createThemePanel() {
        const panel = this.createElement('div', {
            className: 'theme-switcher-panel',
            id: 'theme-switcher-panel'
        });

        panel.innerHTML = `
            <div class="theme-panel-header">
                <div class="theme-panel-title">🎨 主题切换</div>
                <button class="theme-close-btn" onclick="window.plugins.get('${this.id}')?.toggleThemePanel()">×</button>
            </div>
            
            <div class="theme-grid" id="theme-grid">
                ${this.renderThemeCards()}
            </div>
            
            <div class="theme-actions">
                <button class="theme-btn" onclick="window.plugins.get('${this.id}')?.applyRandomTheme()">
                    🎲 随机主题
                </button>
                <button class="theme-btn primary" onclick="window.plugins.get('${this.id}')?.resetTheme()">
                    🔄 重置
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        this.themePanel = panel;

        // 添加到清理列表
        this.disposables.push(() => {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        });
    }

    /**
     * 渲染主题卡片
     */
    renderThemeCards() {
        return Object.entries(this.themes).map(([themeId, theme]) => {
            const isActive = this.currentTheme === themeId;
            return `
                <div class="theme-card ${isActive ? 'active' : ''}" 
                     onclick="window.plugins.get('${this.id}')?.applyTheme('${themeId}')">
                    <div class="theme-preview">
                        <div class="theme-color" style="background: ${theme.colors.primary}"></div>
                        <div class="theme-color" style="background: ${theme.colors.secondary}"></div>
                        <div class="theme-color" style="background: ${theme.colors.background}"></div>
                        <div class="theme-color" style="background: ${theme.colors.surface}"></div>
                    </div>
                    <div class="theme-name">${theme.name}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * 创建浮动按钮
     */
    createFloatingButton() {
        const button = this.createElement('button', {
            className: 'theme-floating-btn',
            innerHTML: '🎨',
            title: '主题切换 (Ctrl+Shift+T)'
        });

        button.addEventListener('click', () => {
            this.toggleThemePanel();
        });

        document.body.appendChild(button);
        this.floatingButton = button;

        // 添加到清理列表
        this.disposables.push(() => {
            if (button.parentNode) {
                button.parentNode.removeChild(button);
            }
        });
    }

    /**
     * 切换浮动按钮显示
     */
    toggleFloatingButton(show) {
        if (show && !this.floatingButton) {
            this.createFloatingButton();
        } else if (!show && this.floatingButton) {
            this.floatingButton.remove();
            this.floatingButton = null;
        }
    }

    /**
     * 应用主题
     */
    applyTheme(themeId) {
        const theme = this.themes[themeId];
        if (!theme) {
            console.warn(`🎨 ThemeSwitcherPlugin: 主题不存在: ${themeId}`);
            return;
        }

        console.log(`🎨 ThemeSwitcherPlugin: 应用主题: ${theme.name}`);

        const root = document.documentElement;

        // 如果是内置主题（light/dark），使用data-theme属性
        if (theme.dataTheme === 'light' || theme.dataTheme === 'dark') {
            // 清除之前的自定义颜色
            this.clearCustomColors();

            // 设置data-theme属性
            root.setAttribute('data-theme', theme.dataTheme);

            // 通知应用主题系统
            if (window.theme && typeof window.theme.set === 'function') {
                // 临时移除监听器，避免循环调用
                this.removeThemeListener();
                window.theme.set(theme.dataTheme);
                // 重新设置监听器
                setTimeout(() => this.setupThemeListener(), 100);
            }
        } else {
            // 自定义主题：设置为custom并应用自定义颜色
            root.setAttribute('data-theme', 'custom');

            // 应用自定义CSS变量
            Object.entries(theme.colors).forEach(([property, value]) => {
                root.style.setProperty(`--${property}`, value);
            });
        }

        // 更新当前主题
        this.currentTheme = themeId;
        this.setStorage('currentTheme', themeId);

        // 更新主题面板
        this.updateThemePanel();

        // 显示通知
        this.showNotification(`已切换到 ${theme.name}`, 'success', 2000);

        // 发送主题变化事件
        this.emit('themeChanged', { themeId, theme });

        console.log(`🎨 ThemeSwitcherPlugin: 主题 ${theme.name} 应用完成`);
    }

    /**
     * 更新主题面板
     */
    updateThemePanel() {
        const themeGrid = document.getElementById('theme-grid');
        if (themeGrid) {
            themeGrid.innerHTML = this.renderThemeCards();
        }
    }

    /**
     * 切换主题面板
     */
    toggleThemePanel() {
        if (this.themePanel) {
            this.themePanel.classList.toggle('visible');
        }
    }

    /**
     * 切换到下一个主题
     */
    switchToNextTheme() {
        const themeIds = Object.keys(this.themes);
        const currentIndex = themeIds.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeIds.length;
        const nextThemeId = themeIds[nextIndex];
        
        this.applyTheme(nextThemeId);
    }

    /**
     * 切换到上一个主题
     */
    switchToPreviousTheme() {
        const themeIds = Object.keys(this.themes);
        const currentIndex = themeIds.indexOf(this.currentTheme);
        const prevIndex = (currentIndex - 1 + themeIds.length) % themeIds.length;
        const prevThemeId = themeIds[prevIndex];
        
        this.applyTheme(prevThemeId);
    }

    /**
     * 应用随机主题
     */
    applyRandomTheme() {
        const themeIds = Object.keys(this.themes);
        const randomIndex = Math.floor(Math.random() * themeIds.length);
        const randomThemeId = themeIds[randomIndex];
        
        this.applyTheme(randomThemeId);
    }

    /**
     * 重置主题
     */
    resetTheme() {
        this.applyTheme('light');
        this.setStorage('defaultTheme', 'light');
        this.setStorage('currentTheme', 'light');
        this.showNotification('主题已重置为浅色主题', 'info');
    }
}

window.PluginClass = ThemeSwitcherPlugin;
