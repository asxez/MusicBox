// 窗口控制相关 IPC

const {getMainWindow} = require('../core/window');

// 尺寸保护相关的缓存
let cachedOriginalSize = null;

/**
 * 注册窗口控制相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerWindowIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerWindowIpcHandlers: 缺少 ipcMain');

    // 窗口控制 IPC handlers
    ipcMain.handle('window:minimize', () => {
        const win = getMainWindow();
        if (win) win.minimize();
    });

    ipcMain.handle('window:maximize', () => {
        const win = getMainWindow();
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    ipcMain.handle('window:isMaximized', () => {
        const win = getMainWindow();
        return win ? win.isMaximized() : false;
    });

    ipcMain.handle('window:close', () => {
        const win = getMainWindow();
        if (win) win.close();
    });

    // 自定义拖拽处理（主动尺寸保护机制）
    ipcMain.on('custom-adsorption', (event, res) => {
        const win = getMainWindow();
        if (win && !win.isMaximized()) {
            // 缓存原始尺寸信息
            if (res.originalWidth && res.originalHeight) {
                cachedOriginalSize = {
                    width: res.originalWidth,
                    height: res.originalHeight
                };
            }

            // 调用前的窗口状态（仅用于日志）
            const [beforeX, beforeY] = win.getPosition();
            const [beforeWidth, beforeHeight] = win.getSize();

            console.log('🔍 拖拽前窗口状态:', {
                position: {x: beforeX, y: beforeY},
                size: {width: beforeWidth, height: beforeHeight},
                received: {x: res.appX, y: res.appY},
                cachedOriginalSize: cachedOriginalSize
            });

            const x = Math.round(res.appX);
            const y = Math.round(res.appY);

            const targetWidth = cachedOriginalSize ? cachedOriginalSize.width : beforeWidth;
            const targetHeight = cachedOriginalSize ? cachedOriginalSize.height : beforeHeight;

            win.setBounds({x, y, width: targetWidth, height: targetHeight});

            // 立即检查并恢复尺寸
            setTimeout(() => {
                const [afterX, afterY] = win.getPosition();
                const [afterWidth, afterHeight] = win.getSize();

                console.log('🔍 拖拽后窗口状态:', {
                    position: {x: afterX, y: afterY},
                    size: {width: afterWidth, height: afterHeight}
                });

                if (afterWidth !== targetWidth || afterHeight !== targetHeight) {
                    console.warn('⚠️ 检测到窗口尺寸偏差，正在强制恢复:', {
                        current: {width: afterWidth, height: afterHeight},
                        target: {width: targetWidth, height: targetHeight},
                        delta: {width: afterWidth - targetWidth, height: afterHeight - targetHeight}
                    });
                    try {
                        win.setSize(targetWidth, targetHeight);
                        console.log('✅ 窗口尺寸已强制恢复');

                        const [finalWidth, finalHeight] = win.getSize();
                        if (finalWidth !== targetWidth || finalHeight !== targetHeight) {
                            console.error('❌ 尺寸恢复失败:', {
                                expected: {width: targetWidth, height: targetHeight},
                                actual: {width: finalWidth, height: finalHeight}
                            });
                        }
                    } catch (error) {
                        console.error('❌ 强制恢复窗口尺寸失败:', error);
                    }
                }
            }, 0);
        }
    });

    // 清理缓存的尺寸信息
    ipcMain.on('clear-size-cache', () => {
        cachedOriginalSize = null;
        console.log('🧹 已清理缓存的窗口尺寸信息');
    });

    // 获取窗口位置
    ipcMain.handle('window:getPosition', () => {
        const win = getMainWindow();
        if (win) return win.getPosition();
        return [0, 0];
    });

    // 获取窗口大小
    ipcMain.handle('window:getSize', () => {
        const win = getMainWindow();
        if (win) return win.getSize();
        return [1440, 900];
    });

    // 设置窗口大小
    ipcMain.handle('window:setSize', (event, width, height) => {
        const win = getMainWindow();
        if (win && !win.isMaximized()) {
            try {
                const minWidth = 400;
                const minHeight = 120;
                const maxWidth = 3840;
                const maxHeight = 2160;

                const validWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
                const validHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(height)));

                win.setSize(validWidth, validHeight);
                return {success: true, width: validWidth, height: validHeight};
            } catch (error) {
                console.error('❌ 设置窗口尺寸失败:', error);
                return {success: false, error: error.message};
            }
        } else if (win && win.isMaximized()) {
            return {success: false, error: '窗口已最大化'};
        }
        return {success: false, error: '窗口不存在'};
    });

    ipcMain.handle('window:setBackgroundThrottling', (event, flag) => {
        const win = getMainWindow();
        if (win) {
            try {
                win.setBackgroundThrottling(flag);
            } catch (error) {
                console.error('❌ 设置窗口节流失败:', error);
            }
        }
    });

    // 迷你模式窗口控制
    ipcMain.handle('window:setAlwaysOnTop', (event, flag) => {
        const win = getMainWindow();
        if (win) {
            win.setAlwaysOnTop(flag);
            return true;
        }
        return false;
    });

    ipcMain.handle('window:isAlwaysOnTop', () => {
        const win = getMainWindow();
        return win ? win.isAlwaysOnTop() : false;
    });

    ipcMain.handle('window:setBounds', (event, bounds) => {
        const win = getMainWindow();
        if (win && !win.isMaximized()) {
            try {
                win.setBounds(bounds);
                return { success: true, bounds: win.getBounds() };
            } catch (error) {
                console.error('❌ 设置窗口边界失败:', error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: '窗口不可用' };
    });

    ipcMain.handle('window:getBounds', () => {
        const win = getMainWindow();
        return win ? win.getBounds() : null;
    });

    ipcMain.handle('window:setResizable', (event, resizable) => {
        const win = getMainWindow();
        if (win) {
            win.setResizable(resizable);
            return true;
        }
        return false;
    });

    // 设置窗口位置（用于手动拖动）
    ipcMain.handle('window:setPosition', (event, x, y) => {
        const win = getMainWindow();
        if (win && !win.isMaximized()) {
            try {
                win.setPosition(Math.round(x), Math.round(y));
                return { success: true };
            } catch (error) {
                console.error('❌ 设置窗口位置失败:', error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: '窗口不可用' };
    });

    // 设置是否显示在任务栏
    ipcMain.handle('window:setSkipTaskbar', (event, skip) => {
        const win = getMainWindow();
        if (win) {
            try {
                win.setSkipTaskbar(skip);
                return true;
            } catch (error) {
                return false;
            }
        }
    });

    // 设置窗口最小尺寸
    ipcMain.handle('window:setMinimumSize', (event, width, height) => {
        const win = getMainWindow();
        if (win) {
            try {
                win.setMinimumSize(width, height);
                return true;
            } catch (error) {
                return false;
            }
        }
    });
}

module.exports = {
    registerWindowIpcHandlers
};
