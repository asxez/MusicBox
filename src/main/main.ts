/**
 * 应用入口文件
 * 使用新架构的 Application 类替代旧的全局变量模式
 */

import {app, BrowserWindow, protocol} from 'electron';
import {Application} from './core/Application';
import {getAudioStreamScheme} from './services/audio/AudioStreamProtocol';

// 必须在 app ready 之前调用（硬件加速设置在 Application.applyConfiguration 中处理）
protocol.registerSchemesAsPrivileged([{
    scheme: getAudioStreamScheme(),
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
    }
}]);

const application = new Application();

app.whenReady().then(async () => {
    // 尝试启用垃圾回收
    if (typeof global.gc !== 'function') {
        try {
            require('v8').setFlagsFromString('--expose_gc');
            (global as any).gc = require('vm').runInNewContext('gc');
            console.log('🔧 主进程: 尝试手动启用垃圾回收功能');
        } catch (e: any) {
            console.warn('⚠️ 主进程: 手动启用垃圾回收失败:', e.message);
        }
    }

    await application.start();

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await application.createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    await application.stop();
});
