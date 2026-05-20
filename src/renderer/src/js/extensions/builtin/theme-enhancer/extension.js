/**
 * 主题增强插件
 * 提供多种预设主题和自定义主题功能
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}

let config = {};
let currentTheme = 'light';
let floatingThemePanelDisposable = null;

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
    const api = getExtensionAPI(context);

    config = await loadConfiguration(api.settings);

    await registerSettingsContributions(context, api);
    await registerCommands(context, api);
    await setupConfigurationListener(context, api);
    await setupThemeListener(context, api);
    await restoreTheme(api);
    await registerFloatingThemePanel(context, api);

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
    await disposeFloatingThemePanel();
    console.log('主题增强已停用');
}

/**
 * 加载配置
 */
async function loadConfiguration(settings) {
    return {
        currentTheme: await settings.get('themeEnhancer.currentTheme', 'light'),
        customColors: await settings.get('themeEnhancer.customColors', {})
    };
}

/**
 * 注册设置页
 */
async function registerSettingsContributions(context, api) {
    const sectionDisposable = await api.ui.registerSettingsSection('themeEnhancer', '主题增强', {
        order: 50
    });
    context.subscriptions.add(sectionDisposable);

    const themeOptions = Object.entries(PRESET_THEMES).map(([value, theme]) => ({
        value,
        label: theme.name
    }));

    const themeChoices = Object.entries(PRESET_THEMES).map(([value, theme]) => ({
        value,
        label: theme.name,
        description: value,
        swatches: [
            theme.colors['color-primary'],
            theme.colors['color-body-bg'],
            theme.colors['color-secondary-bg'],
            theme.colors['color-border']
        ]
    }));

    const pageDisposable = await api.ui.registerSettingsPageSchema('themeEnhancer', {
        items: [
            {
                id: 'currentTheme',
                type: 'select',
                label: '默认主题',
                description: '应用启动时使用的主题',
                value: config.currentTheme,
                options: themeOptions,
                async onChange(value) {
                    await applyTheme(value, api);
                }
            },
            {
                id: 'themePreview',
                type: 'choiceGrid',
                label: '主题预览',
                description: '选择一个预设主题并立即应用',
                value: currentTheme,
                choices: themeChoices,
                async onChange(value) {
                    await applyTheme(value, api);
                }
            },
            {
                id: 'resetTheme',
                type: 'button',
                label: '重置主题',
                description: '将主题重置为默认的浅色主题',
                buttonText: '重置',
                secondary: true,
                async onClick() {
                    await applyTheme('light', api);
                    await api.ui.showNotification('主题已重置', 'success');
                }
            }
        ]
    });
    context.subscriptions.add(pageDisposable);
}

/**
 * 注册浮动主题面板
 */
async function registerFloatingThemePanel(context, api) {
    await refreshFloatingThemePanel(api);
    context.subscriptions.add({
        dispose() {
            return disposeFloatingThemePanel();
        }
    });
}

async function refreshFloatingThemePanel(api) {
    if (floatingThemePanelDisposable) {
        await floatingThemePanelDisposable.dispose();
        floatingThemePanelDisposable = null;
    }

    floatingThemePanelDisposable = await api.ui.registerFloatingPanel({
        id: 'themeEnhancer.themePanel',
        title: '主题增强',
        buttonLabel: '🎨',
        buttonTitle: '主题增强',
        panelTitle: '选择主题',
        order: 50,
        selectionMode: 'single',
        closeOnSelect: true,
        items: Object.entries(PRESET_THEMES).map(([value, theme]) => ({
            id: value,
            label: theme.name,
            description: value,
            selected: value === currentTheme,
            swatches: [
                theme.colors['color-primary'],
                theme.colors['color-body-bg'],
                theme.colors['color-secondary-bg'],
                theme.colors['color-border']
            ],
            async onClick(themeName) {
                await applyTheme(themeName, api);
            }
        }))
    });
}

async function disposeFloatingThemePanel() {
    if (!floatingThemePanelDisposable) {
        return;
    }

    const disposable = floatingThemePanelDisposable;
    floatingThemePanelDisposable = null;
    await disposable.dispose();
}

/**
 * 注册命令
 */
async function registerCommands(context, api) {
    const customizeCmd = await api.commands.registerCommand('themeEnhancer.customizeTheme', async () => {
        await api.ui.showNotification('自定义主题功能开发中...', 'info');
    });
    context.subscriptions.add(customizeCmd);

    const exportCmd = await api.commands.registerCommand('themeEnhancer.exportTheme', async () => {
        try {
            const themeData = {
                name: currentTheme,
                colors: config.customColors
            };
            const json = JSON.stringify(themeData, null, 2);
            await api.storage.update('exported-theme', json);
            await api.ui.showNotification('主题已导出到存储', 'success');
        } catch (error) {
            console.error('❌ 导出主题失败:', error);
            await api.ui.showNotification('导出主题失败', 'error');
        }
    });
    context.subscriptions.add(exportCmd);

    const importCmd = await api.commands.registerCommand('themeEnhancer.importTheme', async () => {
        try {
            const json = await api.storage.get('exported-theme');
            if (json) {
                const themeData = JSON.parse(json);
                await applyCustomTheme(themeData.colors, api);
                await api.ui.showNotification('主题已导入', 'success');
            } else {
                await api.ui.showNotification('没有找到导出的主题', 'warning');
            }
        } catch (error) {
            console.error('❌ 导入主题失败:', error);
            await api.ui.showNotification('导入主题失败', 'error');
        }
    });
    context.subscriptions.add(importCmd);

    const resetCmd = await api.commands.registerCommand('themeEnhancer.resetTheme', async () => {
        await applyTheme('light', api);
        await api.ui.showNotification('主题已重置为浅色主题', 'success');
    });
    context.subscriptions.add(resetCmd);
}

/**
 * 设置配置监听
 */
async function setupConfigurationListener(context, api) {
    const configDisposable = await api.settings.onDidChange(async (event) => {
        if (event.key.startsWith('themeEnhancer.')) {
            config = await loadConfiguration(api.settings);
            console.log('⚙️ 主题增强配置已更新:', config);
        }
    });
    context.subscriptions.add(configDisposable);
}

/**
 * 设置主题监听
 */
async function setupThemeListener(context, api) {
    const themeDisposable = await api.ui.onThemeChanged((themeName) => {
        console.log('🎨 主题已切换:', themeName);
    });
    context.subscriptions.add(themeDisposable);
}

/**
 * 恢复主题
 */
async function restoreTheme(api) {
    const savedTheme = await api.storage.get('themeEnhancer.currentTheme', config.currentTheme);
    if (savedTheme && PRESET_THEMES[savedTheme]) {
        await applyTheme(savedTheme, api, false);
    }
}

/**
 * 应用主题
 */
async function applyTheme(themeName, api, showNotification = true) {
    if (!PRESET_THEMES[themeName]) {
        await api.ui.showNotification(`未知主题: ${themeName}`, 'error');
        return;
    }

    const theme = PRESET_THEMES[themeName];

    const baseTheme = themeName === 'light' ? 'light' : 'dark';
    await api.ui.setTheme(baseTheme);

    for (const [name, value] of Object.entries(theme.colors)) {
        await api.ui.setCSSVariable(name, value);
    }

    currentTheme = themeName;
    config.currentTheme = themeName;

    await api.storage.update('themeEnhancer.currentTheme', themeName);
    await api.settings.set('themeEnhancer.currentTheme', themeName);

    if (showNotification) {
        await api.ui.showNotification(`已切换到${theme.name}主题`, 'success');
    }

    await refreshFloatingThemePanel(api);

    console.log(`🎨 主题已应用: ${themeName}`);
}

/**
 * 应用自定义主题
 */
async function applyCustomTheme(colors, api) {
    for (const [name, value] of Object.entries(colors)) {
        await api.ui.setCSSVariable(name, value);
    }

    currentTheme = 'custom';
    config.customColors = colors;

    await api.storage.update('themeEnhancer.customColors', colors);
    await api.settings.set('themeEnhancer.customColors', colors);
    await api.settings.set('themeEnhancer.currentTheme', 'custom');
    await api.ui.showNotification('自定义主题已应用', 'success');
}

window.themeEnhancerExtension = {
    activate,
    deactivate
};
