/**
 * Advanced Extension Example
 * 演示 MusicBox 插件系统的高级功能
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}

let refreshTimer = null;
let playCount = 0;

/**
 * 激活扩展
 * @param {ExtensionContext} context
 */
async function activate(context) {
    console.log('✅ Advanced Example 扩展已激活');

    const api = getExtensionAPI(context);
    const config = await loadConfiguration(api.settings);
    console.log('📋 配置:', config);

    await initializeExtension(context, config);
    await registerSettingsContributions(context, config);
    await registerCommands(context, config);
    await setupPlayerListeners(context, config);
    await setupConfigurationListener(context);

    if (config.enabled) {
        setupRefreshTimer(context, config);
    }

    if (config.autoNotify) {
        await api.ui.showNotification('Advanced Example 扩展已启动', 'success');
    }

    return {
        getPlayCount() {
            return playCount;
        },
        async resetPlayCount() {
            playCount = 0;
            await api.storage.update('playCount', 0);
        }
    };
}

/**
 * 停用扩展
 */
function deactivate() {
    console.log('⏹️ Advanced Example 扩展已停用');
    clearRefreshTimer();
}

window.advancedExampleExtension = {
    activate,
    deactivate,
};

/**
 * 加载配置
 */
async function loadConfiguration(settings) {
    const features = await settings.get('advancedExample.features', ['notifications', 'stats']);

    return {
        enabled: await settings.get('advancedExample.enabled', true),
        autoNotify: await settings.get('advancedExample.autoNotify', true),
        apiEndpoint: await settings.get('advancedExample.apiEndpoint', 'https://api.example.com'),
        maxItems: await settings.get('advancedExample.maxItems', 10),
        refreshInterval: await settings.get('advancedExample.refreshInterval', 5000),
        features: Array.isArray(features) ? features : ['notifications', 'stats']
    };
}

/**
 * 初始化扩展
 */
async function initializeExtension(context, _config) {
    const {storage, ui} = getExtensionAPI(context);

    try {
        playCount = await storage.get('playCount', 0);
        console.log(`📊 恢复播放计数: ${playCount}`);
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        await ui.showErrorMessage(`初始化失败: ${error.message}`);
    }
}

/**
 * 注册设置页贡献
 */
async function registerSettingsContributions(context, config) {
    const {ui, settings, storage} = getExtensionAPI(context);

    const sectionDisposable = await ui.registerSettingsSection('advancedExample', 'Advanced Example', {
        order: 450
    });
    context.subscriptions.add(sectionDisposable);

    const pageDisposable = await ui.registerSettingsPageSchema('advancedExample', {
        items: [
            {
                id: 'enabled',
                type: 'toggle',
                label: '启用扩展',
                description: '控制示例扩展的定时刷新和播放器监听行为',
                value: Boolean(config.enabled),
                async onChange(value) {
                    await settings.set('advancedExample.enabled', value);
                    if (value) {
                        setupRefreshTimer(context, await loadConfiguration(settings));
                        await ui.showNotification('Advanced Example 已启用', 'success');
                    } else {
                        clearRefreshTimer();
                        await ui.showNotification('Advanced Example 已禁用', 'warning');
                    }
                }
            },
            {
                id: 'autoNotify',
                type: 'toggle',
                label: '启动通知',
                description: '扩展激活时显示提示通知',
                value: Boolean(config.autoNotify),
                async onChange(value) {
                    await settings.set('advancedExample.autoNotify', value);
                }
            },
            {
                id: 'apiEndpoint',
                type: 'input',
                label: 'API 端点',
                description: '用于网络请求示例的 HTTP 地址',
                value: String(config.apiEndpoint),
                inputType: 'url',
                placeholder: 'https://api.example.com',
                async onChange(value) {
                    await settings.set('advancedExample.apiEndpoint', value);
                }
            },
            {
                id: 'refreshInterval',
                type: 'input',
                label: '刷新间隔',
                description: '后台刷新间隔，单位毫秒',
                value: String(config.refreshInterval),
                inputType: 'number',
                min: 1000,
                step: 500,
                async onChange(value) {
                    const nextInterval = Math.max(1000, Number(value) || 5000);
                    await settings.set('advancedExample.refreshInterval', nextInterval);
                    setupRefreshTimer(context, await loadConfiguration(settings));
                }
            },
            {
                id: 'resetPlayCount',
                type: 'button',
                label: '播放计数',
                description: '清空此示例扩展保存的播放次数',
                buttonText: '重置计数',
                secondary: true,
                async onClick() {
                    playCount = 0;
                    await storage.update('playCount', 0);
                    await ui.showNotification('播放计数已重置', 'success');
                }
            }
        ]
    });
    context.subscriptions.add(pageDisposable);
}

/**
 * 注册命令
 */
async function registerCommands(context, config) {
    const {commands, ui, storage, network} = getExtensionAPI(context);

    const helloCommand = await commands.registerCommand(
        'advancedExample.hello',
        async () => {
            const confirmed = await ui.showConfirmDialog('Hello from Advanced Example!', {
                title: 'Hello',
                confirmText: 'OK',
                cancelText: 'Cancel'
            });

            if (confirmed) {
                await ui.showNotification('你点击了 OK', 'info');
            }
        }
    );
    context.subscriptions.add(helloCommand);

    const statsCommand = await commands.registerCommand(
        'advancedExample.showStats',
        async () => {
            const stats = await getStatistics(context);
            await ui.showNotification(
                `统计信息:\n播放次数: ${stats.playCount}\n总曲目: ${stats.totalTracks}`,
                'info'
            );
        }
    );
    context.subscriptions.add(statsCommand);

    const fetchCommand = await commands.registerCommand(
        'advancedExample.fetchData',
        async () => {
            if (!config.features.includes('network')) {
                await ui.showWarningMessage('网络功能未启用');
                return;
            }

            try {
                await ui.showNotification('正在获取数据...', 'info');

                const text = await network.get(config.apiEndpoint);
                const previewLength = Math.max(0, Number(config.maxItems) || 10);
                await storage.update('lastFetchData', {
                    preview: text.slice(0, previewLength),
                    length: text.length
                });
                await storage.update('lastFetchTime', Date.now());

                await ui.showNotification('数据获取成功', 'success');
            } catch (error) {
                console.error('❌ 获取数据失败:', error);
                await ui.showErrorMessage(`获取数据失败: ${error.message}`);
            }
        }
    );
    context.subscriptions.add(fetchCommand);
}

/**
 * 设置播放器监听器
 */
async function setupPlayerListeners(context, config) {
    const {player, ui, storage, window} = getExtensionAPI(context);

    const stateListener = await player.onPlaybackStateChanged(async (state) => {
        if (state === 'playing') {
            console.log('🪟 当前窗口大小:', await window.getSize());
            playCount++;
            await storage.update('playCount', playCount);

            if (config.features.includes('notifications')) {
                const track = await player.getCurrentTrack();
                if (track) {
                    await ui.showNotification(
                        `正在播放: ${track.title} - ${track.artist}`,
                        'info'
                    );
                }
            }
        }
    });
    context.subscriptions.add(stateListener);
}

/**
 * 设置配置监听器
 */
async function setupConfigurationListener(context) {
    const {settings, ui} = getExtensionAPI(context);

    const configListener = await settings.onDidChange(async (event) => {
        if (event.key.startsWith('advancedExample.')) {
            console.log(`⚙️ 配置已更改: ${event.key} = ${event.newValue}`);

            const newConfig = await loadConfiguration(settings);

            if (event.key === 'advancedExample.enabled') {
                if (event.newValue) {
                    await ui.showNotification('扩展已启用', 'success');
                    setupRefreshTimer(context, newConfig);
                } else {
                    await ui.showNotification('扩展已禁用', 'warning');
                    clearRefreshTimer();
                }
            }

            if (event.key === 'advancedExample.refreshInterval') {
                setupRefreshTimer(context, newConfig);
            }
        }
    });
    context.subscriptions.add(configListener);
}

/**
 * 设置定时刷新
 */
function setupRefreshTimer(context, config) {
    clearRefreshTimer();

    if (!config.enabled) {
        return;
    }

    refreshTimer = setInterval(async () => {
        try {
            await refreshData(context);
        } catch (error) {
            console.error('❌ 刷新数据失败:', error);
        }
    }, config.refreshInterval);
}

function clearRefreshTimer() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

/**
 * 刷新数据
 */
async function refreshData(context) {
    const {player, storage} = getExtensionAPI(context);

    try {
        const state = await player.getState();
        const track = await player.getCurrentTrack();

        await storage.update('lastRefresh', {
            time: Date.now(),
            state: state,
            track: track
        });

        console.log('🔄 数据已刷新');
    } catch (error) {
        console.error('❌ 刷新失败:', error);
    }
}

/**
 * 获取统计信息
 */
async function getStatistics(context) {
    const {library, storage} = getExtensionAPI(context);

    try {
        const tracks = await library.getAllTracks();
        const storedPlayCount = await storage.get('playCount', 0);

        return {
            playCount: storedPlayCount,
            totalTracks: tracks.length,
            lastRefresh: await storage.get('lastRefresh')
        };
    } catch (error) {
        console.error('❌ 获取统计信息失败:', error);
        return {
            playCount: 0,
            totalTracks: 0,
            lastRefresh: null
        };
    }
}
