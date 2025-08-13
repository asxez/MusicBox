/**
 * 主题切换插件
 * 提供多种预设主题和主题切换功能
 */
class ThemeSwitcherPlugin extends PluginBase {
    constructor(context) {
        super(context);

        this.metadata = {
            id: 'theme-switcher',
            name: '主题切换器',
            version: '666',
            description: '提供多种预设主题和自定义主题功能，支持实时切换',
            author: 'MusicBox-ASXE',
            permissions: ['ui', 'storage'],
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
        this.originalTheme = null;
        this.themePanel = null;
        this.floatingButton = null;
        this.themeChangeHandler = null;
        this.themeObserver = null;
    }

    async activate() {
        await super.activate();

        this.saveOriginalTheme();
        this.loadSavedTheme();
        this.addPluginStyles();
        this.extendUI();
        this.registerCommands();
        this.setupShortcuts();
        this.setupThemeListener();

        this.showNotification('主题切换插件已激活', 'success');
    }

    async deactivate() {
        this.restoreOriginalTheme();
        this.removeThemeListener();
        this.cleanupDOMReferences();

        await super.deactivate();
        this.showNotification('主题切换插件已停用', 'info');
    }

    saveOriginalTheme() {
        this.originalTheme = {
            dataTheme: document.documentElement.getAttribute('data-theme') || 'light',
            customColors: this.getCurrentCustomColors()
        };
    }

    restoreOriginalTheme() {
        if (this.originalTheme) {
            document.documentElement.setAttribute('data-theme', this.originalTheme.dataTheme);
            this.clearCustomColors();

            if (this.originalTheme.customColors) {
                this.applyCustomColors(this.originalTheme.customColors);
            }
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

    setupThemeListener() {
        this.themeChangeHandler = (e) => {
            const newTheme = e.detail || e;
            if (newTheme === 'light' || newTheme === 'dark') {
                this.currentTheme = newTheme;
                this.updateThemePanel();
            }
        };

        if (window.theme && typeof window.theme.on === 'function') {
            window.theme.on('change', this.themeChangeHandler);
        }

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

    removeThemeListener() {
        if (window.theme && typeof window.theme.off === 'function' && this.themeChangeHandler) {
            window.theme.off('change', this.themeChangeHandler);
            this.themeChangeHandler = null;
        }

        if (this.themeObserver) {
            this.themeObserver.disconnect();
            this.themeObserver = null;
        }
    }

    cleanupDOMReferences() {
        this.themePanel = null;
        this.floatingButton = null;
    }


    loadSavedTheme() {
        const savedTheme = this.getStorage('currentTheme') || 'light';
        this.applyTheme(savedTheme);
    }

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
                opacity: 0;
                visibility: hidden;
            }

            .theme-switcher-panel.visible {
                transform: translateX(0);
                opacity: 1;
                visibility: visible;
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
                background: var(--color-secondary-bg);
            }

            .theme-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-medium);
                border-color: var(--color-primary);
            }

            .theme-card.active {
                border-color: var(--color-primary);
                background: rgba(102, 126, 234, 0.1);
                box-shadow: var(--shadow-medium);
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

            .theme-btn.primary:hover {
                background: var(--color-primary);
                opacity: 0.9;
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

            .theme-floating-btn:active {
                transform: scale(0.95);
            }
        `, {
            id: 'theme-switcher-styles'
        });
    }

    extendUI() {
        this.createThemePanel();

        const showFloatingBtn = this.getStorage('showFloatingBtn');
        if (showFloatingBtn === null || showFloatingBtn === undefined || showFloatingBtn !== 'false') {
            this.createFloatingButton();
        }
    }

    registerCommands() {
        this.registerCommand('switchTheme', (themeId) => {
            this.applyTheme(themeId);
        });

        this.registerCommand('nextTheme', () => {
            this.switchToNextTheme();
        });

        this.registerCommand('previousTheme', () => {
            this.switchToPreviousTheme();
        });

        this.registerCommand('togglePanel', () => {
            this.toggleThemePanel();
        });

        this.registerCommand('randomTheme', () => {
            this.applyRandomTheme();
        });
    }

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

    createThemePanel() {
        const panel = this.createElement('div', {
            className: 'theme-switcher-panel',
            id: 'theme-switcher-panel'
        });

        this.addPluginScope(panel);

        panel.innerHTML = `
            <div class="theme-panel-header">
                <div class="theme-panel-title">🎨 主题切换</div>
                <button class="theme-close-btn" data-action="close">×</button>
            </div>

            <div class="theme-grid" id="theme-grid">
                ${this.renderThemeCards()}
            </div>

            <div class="theme-actions">
                <button class="theme-btn" data-action="random">
                    🎲 随机主题
                </button>
                <button class="theme-btn primary" data-action="reset">
                    🔄 重置
                </button>
            </div>
        `;

        this.setupPanelEventListeners(panel);
        document.body.appendChild(panel);
        this.themePanel = panel;

        this.disposables.push(() => {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        });
    }


    setupPanelEventListeners(panel) {
        const closeBtn = panel.querySelector('[data-action="close"]');
        if (closeBtn) {
            this.addEventListener(closeBtn, 'click', () => {
                this.toggleThemePanel();
            });
        }

        const randomBtn = panel.querySelector('[data-action="random"]');
        if (randomBtn) {
            this.addEventListener(randomBtn, 'click', () => {
                this.applyRandomTheme();
            });
        }

        const resetBtn = panel.querySelector('[data-action="reset"]');
        if (resetBtn) {
            this.addEventListener(resetBtn, 'click', () => {
                this.resetTheme();
            });
        }

        const themeGrid = panel.querySelector('#theme-grid');
        if (themeGrid) {
            this.rebindThemeCardEvents(themeGrid);
        }
    }

    testThemeCardClick(themeId) {
        if (this.themePanel) {
            const card = this.themePanel.querySelector(`[data-theme="${themeId}"]`);
            if (card) {
                card.click();
            }
        }
    }

    renderThemeCards() {
        return Object.entries(this.themes).map(([themeId, theme]) => {
            const isActive = this.currentTheme === themeId;
            return `
                <div class="theme-card ${isActive ? 'active' : ''}"
                     data-theme="${themeId}">
                    <div class="theme-preview">
                        <div class="theme-color" style="background: ${theme.colors['color-primary'] || theme.colors.primary || '#335eea'}"></div>
                        <div class="theme-color" style="background: ${theme.colors['color-secondary-bg'] || theme.colors.secondary || '#f5f5f7'}"></div>
                        <div class="theme-color" style="background: ${theme.colors['color-body-bg'] || theme.colors.background || '#ffffff'}"></div>
                        <div class="theme-color" style="background: ${theme.colors['color-player-bg'] || theme.colors.surface || '#ffffff'}"></div>
                    </div>
                    <div class="theme-name">${theme.name}</div>
                </div>
            `;
        }).join('');
    }

    createFloatingButton() {
        const button = this.createElement('button', {
            className: 'theme-floating-btn',
            innerHTML: '🎨',
            title: '主题切换 (Ctrl+Shift+T)'
        });

        this.addPluginScope(button);
        this.addEventListener(button, 'click', () => {
            this.toggleThemePanel();
        });

        document.body.appendChild(button);
        this.floatingButton = button;

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

    applyTheme(themeId) {
        const theme = this.themes[themeId];
        if (!theme) {
            this.showNotification(`主题 ${themeId} 不存在`, 'error');
            return false;
        }

        if (this.currentTheme === themeId) {
            return true;
        }

        const root = document.documentElement;

        requestAnimationFrame(() => {
            if (theme.dataTheme === 'light' || theme.dataTheme === 'dark') {
                this.clearCustomColors();
                root.setAttribute('data-theme', theme.dataTheme);

                if (window.theme && typeof window.theme.set === 'function') {
                    this.removeThemeListener();
                    window.theme.set(theme.dataTheme);
                    setTimeout(() => this.setupThemeListener(), 100);
                }
            } else {
                root.setAttribute('data-theme', 'custom');
                const cssText = Object.entries(theme.colors)
                    .map(([property, value]) => `--${property}: ${value}`)
                    .join('; ');

                if (cssText) {
                    root.style.cssText += '; ' + cssText;
                }
            }

            this.currentTheme = themeId;
            this.setStorage('currentTheme', themeId);
            this.updateThemePanel();
            this.showNotification(`已切换到 ${theme.name}`, 'success');
            this.emit('themeChanged', {themeId, theme});
        });

        return true;
    }

    updateThemePanel() {
        const themeGrid = document.getElementById('theme-grid');
        if (themeGrid) {
            themeGrid.innerHTML = this.renderThemeCards();
            this.rebindThemeCardEvents(themeGrid);
        }
    }

    rebindThemeCardEvents(themeGrid) {
        const themeCards = themeGrid.querySelectorAll('.theme-card');

        themeCards.forEach((card) => {
            const themeId = card.dataset.theme || card.getAttribute('data-theme');

            if (themeId) {
                this.addEventListener(card, 'click', () => {
                    this.applyTheme(themeId);
                });
            }
        });
    }

    toggleThemePanel() {
        if (this.themePanel) {
            this.themePanel.classList.toggle('visible');
        } else {
            this.createThemePanel();
        }
    }

    switchToNextTheme() {
        const themeIds = Object.keys(this.themes);
        const currentIndex = themeIds.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeIds.length;
        const nextThemeId = themeIds[nextIndex];

        this.applyTheme(nextThemeId);
    }

    switchToPreviousTheme() {
        const themeIds = Object.keys(this.themes);
        const currentIndex = themeIds.indexOf(this.currentTheme);
        const prevIndex = (currentIndex - 1 + themeIds.length) % themeIds.length;
        const prevThemeId = themeIds[prevIndex];

        this.applyTheme(prevThemeId);
    }

    applyRandomTheme() {
        const themeIds = Object.keys(this.themes);
        const randomIndex = Math.floor(Math.random() * themeIds.length);
        const randomThemeId = themeIds[randomIndex];

        this.applyTheme(randomThemeId);
    }

    resetTheme() {
        this.applyTheme('light');
        this.setStorage('defaultTheme', 'light');
        this.setStorage('currentTheme', 'light');
        this.showNotification('主题已重置为浅色主题', 'info');
    }
}

window.PluginClass = ThemeSwitcherPlugin;
