/**
 * Keybindings Demo Extension
 * 演示如何使用快捷键 API 的示例扩展
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}

/**
 * 扩展激活函数
 * @param {Object} context 扩展上下文
 */
async function activate(context) {
    console.log('🎹 Keybindings Demo Extension 已激活!');

    // 获取 API
    const api = getExtensionAPI(context);

    // 显示激活通知
    api.ui.showNotification('快捷键演示扩展已加载！', 'success');

    // ========== 方式一：通过 API 直接注册快捷键 ==========

    // 1. 注册局部快捷键 - 显示通知
    const showNotificationDisposable = await api.keybindings.registerKeybinding(
        'Ctrl+Shift+M',
        () => {
            const timestamp = new Date().toLocaleTimeString();
            api.ui.showNotification(`快捷键触发时间: ${timestamp}`, 'info');
            console.log('🎹 快捷键 Ctrl+Shift+M 被触发');
        },
        {
            commandId: 'keybindingsDemo.showTime',
            description: '显示当前时间',
            when: 'always'
        }
    );
    context.subscriptions.add(showNotificationDisposable);

    // 2. 注册局部快捷键 - 音量控制
    const volumeUpDisposable = await api.keybindings.registerKeybinding(
        'Ctrl+Shift+ArrowUp',
        async () => {
            const currentVolume = await api.player.getVolume();
            const newVolume = Math.min(1, currentVolume + 0.1);
            await api.player.setVolume(newVolume);
            api.ui.showNotification(`音量: ${Math.round(newVolume * 100)}%`, 'success');
            console.log('🎹 音量增加快捷键触发');
        },
        {
            description: '增加音量',
            when: 'always'
        }
    );
    context.subscriptions.add(volumeUpDisposable);

    const volumeDownDisposable = await api.keybindings.registerKeybinding(
        'Ctrl+Shift+ArrowDown',
        async () => {
            const currentVolume = await api.player.getVolume();
            const newVolume = Math.max(0, currentVolume - 0.1);
            await api.player.setVolume(newVolume);
            api.ui.showNotification(`音量: ${Math.round(newVolume * 100)}%`, 'success');
            console.log('🎹 音量减少快捷键触发');
        },
        {
            description: '减少音量',
            when: 'always'
        }
    );
    context.subscriptions.add(volumeDownDisposable);

    // 3. 注册全局快捷键（如果支持）
    try {
        const globalDisposable = await api.keybindings.registerGlobalKeybinding(
            'Alt+Ctrl+P',
            async () => {
                const state = await api.player.getState();
                if (state.isPlaying) {
                    await api.player.pause();
                    api.ui.showNotification('已暂停', 'info');
                } else {
                    await api.player.play();
                    api.ui.showNotification('正在播放', 'info');
                }
                console.log('🎹 全局快捷键 Alt+Ctrl+M 被触发');
            },
            {
                id: 'playAndPause',
                description: '播放和控制',
                name: '播放控制',
            }
        );
        context.subscriptions.add(globalDisposable);
        console.log('✅ 全局快捷键注册成功');
    } catch (error) {
        console.warn('⚠️ 全局快捷键注册失败:', error);
    }

    // ========== 方式二：通过命令系统注册快捷键 ==========

    // 注册命令
    const showNotificationCommand = api.commands.registerCommand(
        'keybindingsDemo.showNotification',
        () => {
            api.ui.showNotification('这是通过命令触发的通知！', 'info');
            console.log('🎯 命令 keybindingsDemo.showNotification 执行');
        }
    );
    context.subscriptions.add(showNotificationCommand);
    await api.commands.executeCommand('keybindingsDemo.showNotification');

    const togglePlayPauseCommand = api.commands.registerCommand(
        'keybindingsDemo.togglePlayPause',
        async () => {
            const state = await api.player.getState();
            if (state.isPlaying) {
                await api.player.pause();
                api.ui.showNotification('已暂停播放', 'info');
            } else {
                await api.player.resume();
                api.ui.showNotification('继续播放', 'info');
            }
            console.log('🎯 命令 keybindingsDemo.togglePlayPause 执行');
        }
    );
    context.subscriptions.add(togglePlayPauseCommand);

    const nextTrackCommand = api.commands.registerCommand(
        'keybindingsDemo.nextTrack',
        async () => {
            await api.player.next();
            api.ui.showNotification('下一首', 'info');
            console.log('🎯 命令 keybindingsDemo.nextTrack 执行');
        }
    );
    context.subscriptions.add(nextTrackCommand);

    // ========== 快捷键信息查询 ==========

    // 获取所有已注册的快捷键
    const allKeybindings = api.keybindings.getKeybindings();
    console.log('📋 所有已注册的快捷键:', allKeybindings);

    // 检查特定快捷键是否已注册
    const hasKeybinding = api.keybindings.hasKeybinding('Ctrl+Shift+M');
    console.log('🔍 Ctrl+Shift+M 是否已注册:', hasKeybinding);

    // 获取特定快捷键的信息
    const keybindingInfo = api.keybindings.getKeybindingInfo('Ctrl+Shift+M');
    console.log('ℹ️ Ctrl+Shift+M 的信息:', keybindingInfo);

    // ========== 监听播放器事件 ==========

    const trackChangedDisposable = api.events.on('trackChanged', (track) => {
        if (track) {
            console.log('🎵 当前播放:', track.title);
        }
    });
    context.subscriptions.add(trackChangedDisposable);

    // ========== 演示：动态注册和注销快捷键 ==========

    // 5秒后注册一个临时快捷键
    setTimeout(async () => {
        const tempDisposable = await api.keybindings.registerKeybinding(
            'Ctrl+Shift+T',
            () => {
                api.ui.showNotification('临时快捷键触发！', 'warning');
                console.log('🎹 临时快捷键 Ctrl+Shift+T 被触发');
            },
            {
                description: '临时快捷键（10秒后自动注销）'
            }
        );

        console.log('✅ 临时快捷键 Ctrl+Shift+T 已注册（10秒后自动注销）');

        // 10秒后注销这个快捷键
        setTimeout(async () => {
            await tempDisposable.dispose();
            console.log('🗑️ 临时快捷键 Ctrl+Shift+T 已注销');
            api.ui.showNotification('临时快捷键已注销', 'info');
        }, 10000);
    }, 5000);

    console.log('✅ Keybindings Demo Extension 初始化完成');
    console.log('📖 使用说明:');
    console.log('  - Ctrl+Shift+M: 显示当前时间');
    console.log('  - Ctrl+Shift+Up: 增加音量');
    console.log('  - Ctrl+Shift+Down: 减少音量');
    console.log('  - Ctrl+Shift+K: 显示通知（通过 manifest 贡献）');
    console.log('  - Ctrl+Alt+P: 播放/暂停（通过 manifest 贡献）');
    console.log('  - Ctrl+Alt+N: 下一首（通过 manifest 贡献）');
    console.log('  - Alt+Ctrl+M: 全局播放/暂停（如果支持）');
    console.log('  - Ctrl+Shift+T: 临时快捷键（5秒后出现，10秒后消失）');

    // 返回公共 API（可选）
    return {
        getRegisteredKeybindings() {
            return api.keybindings.getKeybindings();
        },
        triggerKeybinding(keybinding) {
            return api.keybindings.triggerKeybinding(keybinding);
        }
    };
}

/**
 * 停用函数 - 扩展被停用时调用
 */
async function deactivate() {
    console.log('🎹 Keybindings Demo Extension 已停用');
}


window.keybindingsDemoExtension = {
    activate,
    deactivate
};
