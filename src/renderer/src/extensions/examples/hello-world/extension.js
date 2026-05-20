/**
 * Hello World Extension
 * 一个简单的示例扩展，演示如何使用新的插件系统
 */

function getExtensionAPI(context) {
    return context.api || createExtensionAPI(context);
}

/**
 * 扩展激活函数
 * @param {Object} context 扩展上下文
 */
async function activate(context) {
    console.log('🎉 Hello World Extension 已激活!');

    // 获取 API
    const api = getExtensionAPI(context);

    // 显示欢迎通知
    await api.ui.showNotification('Hello World Extension 已加载！', 'success');

    // 注册命令
    const disposable = await api.commands.registerCommand('helloWorld.sayHello', async () => {
        await api.ui.showNotification('Hello from Extension!', 'info');
    });

    // 添加到订阅列表，确保在扩展停用时清理
    context.subscriptions.add(disposable);

    // 监听播放器事件
    const eventDisposable = await api.events.on('trackChanged', (track) => {
        console.log('🎵 当前播放:', track?.title || '未知');
    });

    context.subscriptions.add(eventDisposable);

    // 使用存储 API
    const visitCount = await api.storage.get('visitCount', 0);
    await api.storage.update('visitCount', visitCount + 1);
    console.log(`📊 扩展已被激活 ${visitCount + 1} 次`);

    // 返回扩展的公共 API（可选）
    return {
        sayHello() {
            return 'Hello from Hello World Extension!';
        }
    };
}

/**
 * 扩展停用函数
 */
async function deactivate() {
    console.log('👋 Hello World Extension 已停用');
}

// 导出激活和停用函数
let helloWorldExtension = {
    activate,
    deactivate
};

window.helloWorldExtension = helloWorldExtension;
