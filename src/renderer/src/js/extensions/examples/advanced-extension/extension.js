/**
 * Advanced Extension Example
 * 演示 MusicBox 插件系统的高级功能
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}

// 扩展状态
let statusBarItem = null;
let refreshTimer = null;
let playCount = 0;

/**
 * 激活扩展
 * @param {ExtensionContext} context
 */
function activate(context) {
    console.log('✅ Advanced Example 扩展已激活');

    // 解构 API
    const {
        player,
        library,
        ui,
        storage,
        settings,
        commands,
        network
    } = getExtensionAPI(context);

    // 读取配置
    const config = loadConfiguration(settings);
    console.log('📋 配置:', config);

    // 初始化扩展
    initializeExtension(context, config);

    // 注册命令
    registerCommands(context, config);

    // 监听播放器事件
    setupPlayerListeners(context, config);

    // 监听配置变化
    setupConfigurationListener(context);

    // 设置定时刷新
    if (config.enabled) {
        setupRefreshTimer(context, config);
    }

    // 显示欢迎消息
    if (config.autoNotify) {
        ui.showNotification('Advanced Example 扩展已启动', 'success');
    }

    // 返回公共 API
    return {
        getPlayCount() {
            return playCount;
        },
        resetPlayCount() {
            playCount = 0;
            storage.update('playCount', 0);
        }
    };
}

/**
 * 停用扩展
 */
function deactivate() {
    console.log('⏹️ Advanced Example 扩展已停用');

    // 清理定时器
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    // 清理状态栏
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }
}

window.advancedExampleExtension = {
    activate,
    deactivate,
};

/**
 * 加载配置
 */
function loadConfiguration(settings) {
    return {
        enabled: settings.get('advancedExample.enabled', true),
        autoNotify: settings.get('advancedExample.autoNotify', true),
        apiEndpoint: settings.get('advancedExample.apiEndpoint', 'https://api.example.com'),
        maxItems: settings.get('advancedExample.maxItems', 10),
        refreshInterval: settings.get('advancedExample.refreshInterval', 5000),
        features: settings.get('advancedExample.features', ['notifications', 'stats'])
    };
}

/**
 * 初始化扩展
 */
async function initializeExtension(context, config) {
    const {storage, ui} = getExtensionAPI(context);

    try {
        // 从存储恢复状态
        playCount = await storage.get('playCount', 0);
        console.log(`📊 恢复播放计数: ${playCount}`);

        // 创建状态栏项
        if (config.features.includes('stats')) {
            statusBarItem = ui.createStatusBarItem(`播放: ${playCount}`);
            context.subscriptions.add(statusBarItem);
        }
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        ui.showErrorMessage(`初始化失败: ${error.message}`);
    }
}

/**
 * 注册命令
 */
function registerCommands(context, config) {
    const {commands, ui, storage, network} = getExtensionAPI(context);

    // Hello 命令
    const helloCommand = commands.registerCommand(
        'advancedExample.hello',
        async () => {
            const response = await ui.showDialog({
                title: 'Hello',
                message: 'Hello from Advanced Example!',
                buttons: ['OK', 'Cancel']
            });

            if (response === 'OK') {
                ui.showNotification('你点击了 OK', 'info');
            }
        }
    );
    context.subscriptions.add(helloCommand);

    // 显示统计命令
    const statsCommand = commands.registerCommand(
        'advancedExample.showStats',
        async () => {
            const stats = await getStatistics(context);
            ui.showNotification(
                `统计信息:\n播放次数: ${stats.playCount}\n总曲目: ${stats.totalTracks}`,
                'info'
            );
        }
    );
    context.subscriptions.add(statsCommand);

    // 获取数据命令
    const fetchCommand = commands.registerCommand(
        'advancedExample.fetchData',
        async () => {
            if (!config.features.includes('network')) {
                ui.showWarningMessage('网络功能未启用');
                return;
            }

            try {
                ui.showNotification('正在获取数据...', 'info');

                const response = await network.fetch(config.apiEndpoint);
                const data = await response.json();

                await storage.update('lastFetchData', data);
                await storage.update('lastFetchTime', Date.now());

                ui.showNotification('数据获取成功', 'success');
            } catch (error) {
                console.error('❌ 获取数据失败:', error);
                ui.showErrorMessage(`获取数据失败: ${error.message}`);
            }
        }
    );
    context.subscriptions.add(fetchCommand);
}

/**
 * 设置播放器监听器
 */
function setupPlayerListeners(context, config) {
    const {player, ui, storage, window} = getExtensionAPI(context);

    // 监听播放状态变化
    const stateListener = player.onPlaybackStateChanged(async (state) => {
        if (state === 'playing') {
            console.log(await window.getSize());
            playCount++;
            await storage.update('playCount', playCount);

            // 更新状态栏
            if (statusBarItem && config.features.includes('stats')) {
                statusBarItem.dispose();
                statusBarItem = ui.createStatusBarItem(`播放: ${playCount}`);
                context.subscriptions.add(statusBarItem);
            }

            // 显示通知
            const track = await player.getCurrentTrack();
            if (track) {
                ui.showNotification(
                    `正在播放: ${track.title} - ${track.artist}`,
                    'info'
                );
            }
        }
    });
    context.subscriptions.add(stateListener);
}

/**
 * 设置配置监听器
 */
function setupConfigurationListener(context) {
    const {settings, ui} = getExtensionAPI(context);

    const configListener = settings.onDidChange((event) => {
        if (event.key.startsWith('advancedExample.')) {
            console.log(`⚙️ 配置已更改: ${event.key} = ${event.newValue}`);

            // 重新加载配置
            const newConfig = loadConfiguration(settings);

            // 根据配置变化更新行为
            if (event.key === 'advancedExample.enabled') {
                if (event.newValue) {
                    ui.showNotification('扩展已启用', 'success');
                    setupRefreshTimer(context, newConfig);
                } else {
                    ui.showNotification('扩展已禁用', 'warning');
                    if (refreshTimer) {
                        clearInterval(refreshTimer);
                        refreshTimer = null;
                    }
                }
            }

            if (event.key === 'advancedExample.refreshInterval') {
                // 重新设置定时器
                if (refreshTimer) {
                    clearInterval(refreshTimer);
                }
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
    if (!config.enabled) {
        return;
    }

    refreshTimer = setInterval(async () => {
        try {
            await refreshData(context, config);
        } catch (error) {
            console.error('❌ 刷新数据失败:', error);
        }
    }, config.refreshInterval);

    // 注册清理函数
    context.subscriptions.add({
        dispose() {
            if (refreshTimer) {
                clearInterval(refreshTimer);
                refreshTimer = null;
            }
        }
    });
}

/**
 * 刷新数据
 */
async function refreshData(context, config) {
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
        const tracks = await library.getTracks();
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
