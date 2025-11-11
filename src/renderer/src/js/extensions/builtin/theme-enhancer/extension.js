/**
 * 主题增强插件
 * 提供多种预设主题和自定义主题功能
 */

// 插件状态
let autoSwitchTimer = null;
let config = {};
let currentTheme = 'light';
let themeSelectorUI = null;

// 预设主题配置
const PRESET_THEMES = {
    light: {
        name: '浅色',
        colors: {
            'color-primary': '#335eea',
            'color-primary-rgb': '51, 94, 234',
            'color-body-bg': '#ffffff',
            'color-text': '#000000',
            'color-text-secondary': '#7a7a7b',
            'color-navbar-bg': 'rgba(255, 255, 255, 0.72)',
            'color-secondary-bg': '#f5f5f7',
            'color-border': '#e5e5e5'
        }
    },
    dark: {
        name: '深色',
        colors: {
            'color-primary': '#335eea',
            'color-primary-rgb': '51, 94, 234',
            'color-body-bg': '#222222',
            'color-text': '#ffffff',
            'color-text-secondary': '#a0a0a0',
            'color-navbar-bg': 'rgba(34, 34, 34, 0.72)',
            'color-secondary-bg': '#2a2a2a',
            'color-border': '#3a3a3a'
        }
    },
    blue: {
        name: '蓝色',
        colors: {
            'color-primary': '#0ea5e9',
            'color-primary-rgb': '14, 165, 233',
            'color-body-bg': '#0c1e2e',
            'color-text': '#e0f2fe',
            'color-text-secondary': '#7dd3fc',
            'color-navbar-bg': 'rgba(12, 30, 46, 0.72)',
            'color-secondary-bg': '#0f2438',
            'color-border': '#1e3a52'
        }
    },
    purple: {
        name: '紫色',
        colors: {
            'color-primary': '#a855f7',
            'color-primary-rgb': '168, 85, 247',
            'color-body-bg': '#1e1b2e',
            'color-text': '#f3e8ff',
            'color-text-secondary': '#d8b4fe',
            'color-navbar-bg': 'rgba(30, 27, 46, 0.72)',
            'color-secondary-bg': '#2a2640',
            'color-border': '#3d3654'
        }
    },
    green: {
        name: '绿色',
        colors: {
            'color-primary': '#10b981',
            'color-primary-rgb': '16, 185, 129',
            'color-body-bg': '#0f1e1a',
            'color-text': '#d1fae5',
            'color-text-secondary': '#6ee7b7',
            'color-navbar-bg': 'rgba(15, 30, 26, 0.72)',
            'color-secondary-bg': '#142824',
            'color-border': '#1f3d35'
        }
    }
};

/**
 * 激活扩展
 * @param {Object} context - 扩展上下文
 */
async function activate(context) {
    // 获取 API
    const api = createExtensionAPI(context);

    // 加载配置
    config = loadConfiguration(api.settings);

    // 创建主题选择器UI
    themeSelectorUI = createThemeSelectorUI(api);
    context.subscriptions.add({
        dispose() {
            if (themeSelectorUI) {
                themeSelectorUI.dispose();
                themeSelectorUI = null;
            }
        }
    });

    // 注册设置页
    registerSettingsPage(context, api);

    // 注册命令
    registerCommands(context, api);

    // 监听配置变化
    setupConfigurationListener(context, api);

    // 监听主题变化
    setupThemeListener(context, api);

    // 恢复保存的主题
    await restoreTheme(api);

    // 启动自动切换主题
    if (config.autoSwitchTheme) {
        startAutoSwitchTheme(api);
    }

    // 返回公共 API
    return {
        setTheme(themeName) {
            return applyTheme(themeName, api);
        },
        getCurrentTheme() {
            return currentTheme;
        },
        getPresetThemes() {
            return Object.keys(PRESET_THEMES);
        },
        customizeTheme(colors) {
            return applyCustomTheme(colors, api);
        }
    };
}

/**
 * 停用扩展
 */
async function deactivate() {
    // 清理定时器
    if (autoSwitchTimer) {
        clearInterval(autoSwitchTimer);
        autoSwitchTimer = null;
    }
}

/**
 * 加载配置
 */
function loadConfiguration(settings) {
    return {
        currentTheme: settings.get('themeEnhancer.currentTheme', 'light'),
        autoSwitchTheme: settings.get('themeEnhancer.autoSwitchTheme', false),
        darkModeStartTime: settings.get('themeEnhancer.darkModeStartTime', '18:00'),
        lightModeStartTime: settings.get('themeEnhancer.lightModeStartTime', '06:00'),
        customColors: settings.get('themeEnhancer.customColors', {})
    };
}

/**
 * 注册设置页
 */
function registerSettingsPage(context, api) {
    // 注册设置页导航项
    const sectionDisposable = api.ui.registerSettingsSection('themeEnhancer', '主题增强', {
        order: 50
    });
    context.subscriptions.add(sectionDisposable);

    // 注册设置页内容
    const pageDisposable = api.ui.registerSettingsPage('themeEnhancer', (container) => {
        // 自动切换主题设置
        const autoSwitchToggle = api.ui.createToggleSetting(
            '自动切换主题',
            '根据时间自动在浅色和深色主题之间切换（6:00-18:00 使用浅色主题）',
            config.autoSwitchTheme,
            (value) => {
                config.autoSwitchTheme = value;
                api.settings.set('themeEnhancer.autoSwitchTheme', value);

                if (value) {
                    startAutoSwitchTheme(api);
                    api.ui.showNotification('已启用自动切换主题', 'success');
                } else {
                    stopAutoSwitchTheme();
                    api.ui.showNotification('已禁用自动切换主题', 'info');
                }
            }
        );
        container.appendChild(autoSwitchToggle);

        // 默认主题设置
        const themeOptions = Object.entries(PRESET_THEMES).map(([value, theme]) => ({
            value,
            label: theme.name
        }));

        const defaultThemeSelect = api.ui.createSelectSetting(
            '默认主题',
            '应用启动时使用的主题',
            themeOptions,
            config.currentTheme,
            (value) => {
                config.currentTheme = value;
                api.settings.set('themeEnhancer.currentTheme', value);
                applyTheme(value, api);
            }
        );
        container.appendChild(defaultThemeSelect);

        // 主题预览
        const previewSection = document.createElement('div');
        previewSection.className = 'settings-item';
        previewSection.style.flexDirection = 'column';
        previewSection.style.alignItems = 'flex-start';

        const previewLabel = document.createElement('label');
        previewLabel.className = 'item-label';
        previewLabel.textContent = '主题预览';
        previewLabel.style.marginBottom = '12px';

        const previewDescription = document.createElement('p');
        previewDescription.className = 'item-description';
        previewDescription.textContent = '点击下方主题卡片可快速切换主题';
        previewDescription.style.marginBottom = '16px';

        const previewGrid = document.createElement('div');
        previewGrid.style.display = 'grid';
        previewGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        previewGrid.style.gap = '12px';
        previewGrid.style.width = '100%';

        Object.entries(PRESET_THEMES).forEach(([themeId, theme]) => {
            const themeCard = document.createElement('div');
            themeCard.style.cssText = `
                padding: 12px;
                border-radius: 8px;
                border: 2px solid ${currentTheme === themeId ? 'var(--color-primary)' : 'var(--color-border)'};
                cursor: pointer;
                transition: all 0.2s;
                background: ${theme.colors['color-body-bg']};
            `;

            const themeName = document.createElement('div');
            themeName.textContent = theme.name;
            themeName.style.cssText = `
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 8px;
                color: ${theme.colors['color-text']};
            `;

            const colorPreview = document.createElement('div');
            colorPreview.style.cssText = `
                display: flex;
                gap: 4px;
                height: 24px;
            `;

            const primaryColor = document.createElement('div');
            primaryColor.style.cssText = `
                flex: 1;
                border-radius: 4px;
                background: ${theme.colors['color-primary']};
            `;

            const secondaryColor = document.createElement('div');
            secondaryColor.style.cssText = `
                flex: 1;
                border-radius: 4px;
                background: ${theme.colors['color-secondary-bg']};
            `;

            colorPreview.appendChild(primaryColor);
            colorPreview.appendChild(secondaryColor);

            themeCard.appendChild(themeName);
            themeCard.appendChild(colorPreview);

            themeCard.addEventListener('click', () => {
                applyTheme(themeId, api);
                // 更新所有卡片的边框
                previewGrid.querySelectorAll('div').forEach((card, index) => {
                    const id = Object.keys(PRESET_THEMES)[Math.floor(index / 2)];
                    if (card.style.border) {
                        card.style.border = `2px solid ${currentTheme === id ? 'var(--color-primary)' : 'var(--color-border)'}`;
                    }
                });
            });

            themeCard.addEventListener('mouseenter', () => {
                if (currentTheme !== themeId) {
                    themeCard.style.borderColor = 'var(--color-primary)';
                    themeCard.style.opacity = '0.8';
                }
            });

            themeCard.addEventListener('mouseleave', () => {
                if (currentTheme !== themeId) {
                    themeCard.style.borderColor = 'var(--color-border)';
                    themeCard.style.opacity = '1';
                }
            });

            previewGrid.appendChild(themeCard);
        });

        previewSection.appendChild(previewLabel);
        previewSection.appendChild(previewDescription);
        previewSection.appendChild(previewGrid);
        container.appendChild(previewSection);

        // 重置按钮
        const resetButton = api.ui.createButtonSetting(
            '重置主题',
            '将主题重置为默认的浅色主题',
            '重置',
            async () => {
                await applyTheme('light', api);
                api.ui.showNotification('主题已重置', 'success');
            },
            { secondary: true }
        );
        container.appendChild(resetButton);
    });
    context.subscriptions.add(pageDisposable);
}

/**
 * 注册命令
 */
function registerCommands(context, api) {
    // 切换主题
    const setThemeCmd = api.commands.registerCommand('themeEnhancer.setTheme', async () => {
        const themes = Object.keys(PRESET_THEMES);
        const themeLabels = themes.map(t => {
            const theme = PRESET_THEMES[t];
            const indicator = currentTheme === t ? '● ' : '○ ';
            return `${indicator}${theme.name}`;
        });

        const selected = await api.ui.showQuickPick(themeLabels, {
            placeholder: `选择主题 (当前: ${PRESET_THEMES[currentTheme]?.name || currentTheme})`
        });

        if (selected) {
            const index = themeLabels.indexOf(selected);
            const themeName = themes[index];
            await applyTheme(themeName, api);
        }
    });
    context.subscriptions.add(setThemeCmd);

    // 自定义主题
    const customizeCmd = api.commands.registerCommand('themeEnhancer.customizeTheme', async () => {
        api.ui.showNotification('自定义主题功能开发中...', 'info');
        // TODO: 实现自定义主题界面
    });
    context.subscriptions.add(customizeCmd);

    // 导出主题
    const exportCmd = api.commands.registerCommand('themeEnhancer.exportTheme', async () => {
        try {
            const themeData = {
                name: currentTheme,
                colors: config.customColors
            };
            const json = JSON.stringify(themeData, null, 2);
            await api.storage.update('exported-theme', json);
            api.ui.showNotification('主题已导出到存储', 'success');
        } catch (error) {
            console.error('❌ 导出主题失败:', error);
            api.ui.showNotification('导出主题失败', 'error');
        }
    });
    context.subscriptions.add(exportCmd);

    // 导入主题
    const importCmd = api.commands.registerCommand('themeEnhancer.importTheme', async () => {
        try {
            const json = api.storage.get('exported-theme');
            if (json) {
                const themeData = JSON.parse(json);
                await applyCustomTheme(themeData.colors, api);
                api.ui.showNotification('主题已导入', 'success');
            } else {
                api.ui.showNotification('没有找到导出的主题', 'warning');
            }
        } catch (error) {
            console.error('❌ 导入主题失败:', error);
            api.ui.showNotification('导入主题失败', 'error');
        }
    });
    context.subscriptions.add(importCmd);

    // 重置主题
    const resetCmd = api.commands.registerCommand('themeEnhancer.resetTheme', async () => {
        await applyTheme('light', api);
        api.ui.showNotification('主题已重置为浅色主题', 'success');
    });
    context.subscriptions.add(resetCmd);
}

/**
 * 设置配置监听
 */
function setupConfigurationListener(context, api) {
    const configDisposable = api.settings.onDidChange((e) => {
        if (e.key.startsWith('themeEnhancer.')) {
            config = loadConfiguration(api.settings);
            
            if (e.key === 'themeEnhancer.autoSwitchTheme') {
                if (config.autoSwitchTheme) {
                    startAutoSwitchTheme(api);
                } else {
                    stopAutoSwitchTheme();
                }
            }
            
            console.log('⚙️ 主题增强配置已更新:', config);
        }
    });
    context.subscriptions.add(configDisposable);
}

/**
 * 设置主题监听
 */
function setupThemeListener(context, api) {
    const themeDisposable = api.ui.onThemeChanged((themeName) => {
        console.log('🎨 主题已切换:', themeName);
    });
    context.subscriptions.add(themeDisposable);
}

/**
 * 恢复主题
 */
async function restoreTheme(api) {
    const savedTheme = api.storage.get('themeEnhancer.currentTheme', config.currentTheme);
    if (savedTheme && PRESET_THEMES[savedTheme]) {
        await applyTheme(savedTheme, api, false);
    }
}

/**
 * 应用主题
 */
async function applyTheme(themeName, api, showNotification = true) {
    if (!PRESET_THEMES[themeName]) {
        api.ui.showNotification(`未知主题: ${themeName}`, 'error');
        return;
    }

    const theme = PRESET_THEMES[themeName];

    // 应用基础主题（light/dark）
    const baseTheme = themeName === 'light' ? 'light' : 'dark';
    api.ui.setTheme(baseTheme);

    // 应用主题颜色
    Object.entries(theme.colors).forEach(([name, value]) => {
        api.ui.setCSSVariable(name, value);
    });

    currentTheme = themeName;

    // 保存主题
    await api.storage.update('themeEnhancer.currentTheme', themeName);
    await api.settings.set('themeEnhancer.currentTheme', themeName);

    if (showNotification) {
        api.ui.showNotification(`已切换到${theme.name}主题`, 'success');
    }

    console.log(`🎨 主题已应用: ${themeName}`);
}

/**
 * 应用自定义主题
 */
async function applyCustomTheme(colors, api) {
    Object.entries(colors).forEach(([name, value]) => {
        api.ui.setCSSVariable(name, value);
    });

    currentTheme = 'custom';
    config.customColors = colors;

    await api.storage.update('themeEnhancer.customColors', colors);
    await api.settings.set('themeEnhancer.customColors', colors);
    await api.settings.set('themeEnhancer.currentTheme', 'custom');
    api.ui.showNotification('自定义主题已应用', 'success');
}

/**
 * 启动自动切换主题
 */
function startAutoSwitchTheme(api) {
    stopAutoSwitchTheme();
    
    // 立即检查一次
    checkAndSwitchTheme(api);
    
    // 每分钟检查一次
    autoSwitchTimer = setInterval(() => {
        checkAndSwitchTheme(api);
    }, 60000);
    
    console.log('🕐 自动切换主题已启动');
}

/**
 * 停止自动切换主题
 */
function stopAutoSwitchTheme() {
    if (autoSwitchTimer) {
        clearInterval(autoSwitchTimer);
        autoSwitchTimer = null;
        console.log('🕐 自动切换主题已停止');
    }
}

/**
 * 检查并切换主题
 */
function checkAndSwitchTheme(api) {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const darkStart = config.darkModeStartTime;
    const lightStart = config.lightModeStartTime;

    let targetTheme = 'light';

    if (currentTime >= darkStart || currentTime < lightStart) {
        targetTheme = 'dark';
    }

    if (currentTheme !== targetTheme) {
        applyTheme(targetTheme, api, true);
    }
}

/**
 * 创建主题选择器UI
 */
function createThemeSelectorUI(api) {
    // 创建悬浮按钮
    const fab = document.createElement('button');
    fab.className = 'theme-enhancer-fab';
    fab.innerHTML = '🎨';

    // 创建主题选择面板
    const panel = document.createElement('div');
    panel.className = 'theme-enhancer-panel';
    panel.style.display = 'none';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'theme-panel-header';
    panelHeader.innerHTML = `
        <h3>选择主题</h3>
        <button class="theme-panel-close">×</button>
    `;

    const panelContent = document.createElement('div');
    panelContent.className = 'theme-panel-content';

    // 创建主题选项
    Object.entries(PRESET_THEMES).forEach(([key, theme]) => {
        const option = document.createElement('div');
        option.className = 'theme-option';
        option.dataset.theme = key;

        const colorPreview = document.createElement('div');
        colorPreview.className = 'theme-color-preview';
        colorPreview.style.background = theme.colors['color-primary'];

        const themeInfo = document.createElement('div');
        themeInfo.className = 'theme-info';
        themeInfo.innerHTML = `
            <div class="theme-name">${theme.name}</div>
            <div class="theme-desc">${key}</div>
        `;

        const checkmark = document.createElement('div');
        checkmark.className = 'theme-checkmark';
        checkmark.innerHTML = '✓';

        option.appendChild(colorPreview);
        option.appendChild(themeInfo);
        option.appendChild(checkmark);

        option.addEventListener('click', async () => {
            await applyTheme(key, api);
            updatePanelSelection();
            hidePanel();
        });

        panelContent.appendChild(option);
    });

    panel.appendChild(panelHeader);
    panel.appendChild(panelContent);

    // 添加到DOM
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // 更新选中状态
    function updatePanelSelection() {
        panelContent.querySelectorAll('.theme-option').forEach(opt => {
            if (opt.dataset.theme === currentTheme) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    // 显示面板
    function showPanel() {
        updatePanelSelection();
        panel.style.display = 'block';
        requestAnimationFrame(() => {
            panel.classList.add('show');
        });
    }

    // 隐藏面板
    function hidePanel() {
        panel.classList.remove('show');
        setTimeout(() => {
            panel.style.display = 'none';
        }, 200);
    }

    // 事件监听
    fab.addEventListener('click', () => {
        if (panel.style.display === 'none') {
            showPanel();
        } else {
            hidePanel();
        }
    });

    panelHeader.querySelector('.theme-panel-close').addEventListener('click', hidePanel);

    // 点击面板外部关闭
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !fab.contains(e.target)) {
            hidePanel();
        }
    });

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .theme-enhancer-fab {
            position: fixed;
            right: 24px;
            bottom: 88px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--color-primary);
            color: white;
            border: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            z-index: 98;
        }

        .theme-enhancer-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .theme-enhancer-fab:active {
            transform: scale(0.95);
        }

        .theme-enhancer-panel {
            position: fixed;
            right: 24px;
            bottom: 156px;
            width: 320px;
            background: var(--color-body-bg);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 99;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.2s ease;
        }

        .theme-enhancer-panel.show {
            opacity: 1;
            transform: translateY(0);
        }

        .theme-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--color-border);
        }

        .theme-panel-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--color-text);
        }

        .theme-panel-close {
            background: none;
            border: none;
            font-size: 24px;
            color: var(--color-text-secondary);
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s ease;
        }

        .theme-panel-close:hover {
            background: var(--color-secondary-bg);
            color: var(--color-text);
        }

        .theme-panel-content {
            padding: 8px;
            max-height: 400px;
            overflow-y: auto;
        }

        .theme-option {
            display: flex;
            align-items: center;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
        }

        .theme-option:hover {
            background: var(--color-secondary-bg);
        }

        .theme-option.active {
            background: rgba(var(--color-primary-rgb), 0.1);
        }

        .theme-color-preview {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            margin-right: 12px;
            flex-shrink: 0;
        }

        .theme-info {
            flex: 1;
        }

        .theme-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--color-text);
            margin-bottom: 2px;
        }

        .theme-desc {
            font-size: 12px;
            color: var(--color-text-secondary);
        }

        .theme-checkmark {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--color-primary);
            color: white;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
        }

        .theme-option.active .theme-checkmark {
            display: flex;
        }
    `;
    document.head.appendChild(style);

    return {
        dispose() {
            fab.remove();
            panel.remove();
            style.remove();
        }
    };
}

// 导出扩展
window.themeEnhancerExtension = {
    activate,
    deactivate
};
