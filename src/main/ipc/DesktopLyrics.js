// 桌面歌词相关 IPC

const {
    createDesktopLyricsWindow,
    showDesktopLyrics,
    hideDesktopLyrics,
    closeDesktopLyrics,
    isDesktopLyricsVisible,
    sendToDesktopLyrics,
    getDesktopLyricsWindow,
} = require('../core/window');

/**
 * 注册桌面歌词相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerDesktopLyricsIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerDesktopLyricsIpcHandlers: 缺少 ipcMain');

    // 创建桌面歌词窗口
    ipcMain.handle('desktopLyrics:create', async () => {
        try {
            await createDesktopLyricsWindow();
            return {success: true};
        } catch (error) {
            console.error('❌ 创建桌面歌词窗口失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 显示/隐藏/关闭/状态
    ipcMain.handle('desktopLyrics:show', () => ({success: showDesktopLyrics()}));
    ipcMain.handle('desktopLyrics:hide', () => ({success: hideDesktopLyrics()}));
    ipcMain.handle('desktopLyrics:close', () => ({success: closeDesktopLyrics()}));
    ipcMain.handle('desktopLyrics:isVisible', () => isDesktopLyricsVisible());

    // 切换显示状态
    ipcMain.handle('desktopLyrics:toggle', async () => {
        try {
            const win = getDesktopLyricsWindow();
            if (!win) {
                await createDesktopLyricsWindow();
                return {success: true, visible: true};
            } else if (win.isVisible()) {
                hideDesktopLyrics();
                return {success: true, visible: false};
            } else {
                showDesktopLyrics();
                return {success: true, visible: true};
            }
        } catch (error) {
            console.error('❌ 切换桌面歌词窗口失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 向桌面歌词窗口发送播放状态/歌词/进度/歌曲信息
    ipcMain.handle('desktopLyrics:updatePlaybackState', (event, state) => ({
        success: sendToDesktopLyrics('playback:stateChanged', state),
    }));

    ipcMain.handle('desktopLyrics:updateLyrics', (event, lyricsData) => ({
        success: sendToDesktopLyrics('lyrics:updated', lyricsData),
    }));

    ipcMain.handle('desktopLyrics:updatePosition', (event, position) => ({
        success: sendToDesktopLyrics('playback:positionChanged', position),
    }));

    ipcMain.handle('desktopLyrics:updateTrack', (event, trackInfo) => ({
        success: sendToDesktopLyrics('track:changed', trackInfo),
    }));

    // 位置和大小控制
    ipcMain.handle('desktopLyrics:setPosition', (event, x, y) => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const posX = parseInt(x);
                const posY = parseInt(y);
                if (isNaN(posX) || isNaN(posY)) {
                    return {success: false, error: '无效的窗口位置参数'};
                }
                win.setPosition(posX, posY);
                return {success: true};
            } catch (error) {
                console.error('❌ 设置桌面歌词窗口位置失败:', error);
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    });

    ipcMain.handle('desktopLyrics:setSize', (event, width, height) => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const w = parseInt(width);
                const h = parseInt(height);

                const minWidth = 10;
                const minHeight = 10;
                const maxWidth = 2000;
                const maxHeight = 1500;

                if (isNaN(w) || isNaN(h) || w < minWidth || h < minHeight || w > maxWidth || h > maxHeight) {
                    console.warn(`❌ 桌面歌词窗口尺寸验证失败: (${w}x${h}), 限制: ${minWidth}-${maxWidth} x ${minHeight}-${maxHeight}`);
                    return {
                        success: false,
                        error: `窗口尺寸超出限制范围 (${minWidth}-${maxWidth} x ${minHeight}-${maxHeight})`
                    };
                }

                win.setSize(w, h);
                console.log(`✅ 桌面歌词窗口尺寸已设置: (${w}x${h})`);
                return {success: true};
            } catch (error) {
                console.error('❌ 设置桌面歌词窗口大小失败:', error);
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    });

    ipcMain.handle('desktopLyrics:setOpacity', (event, opacity) => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.setOpacity(opacity);
            return {success: true};
        }
        return {success: false};
    });

    // 设置窗口是否置顶
    ipcMain.handle('desktopLyrics:setAlwaysOnTop', (event, flag) => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                win.setAlwaysOnTop(flag);
                console.log(`✅ 桌面歌词窗口置顶状态已设置: ${flag}`);
                return {success: true};
            } catch (error) {
                console.error('❌ 设置桌面歌词窗口置顶状态失败:', error);
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    });

    // 设置窗口是否可点击穿透
    ipcMain.handle('desktopLyrics:setIgnoreMouseEvents', (event, ignore, options) => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                win.setIgnoreMouseEvents(ignore, options || {});
                console.log(`✅ 桌面歌词窗口鼠标穿透状态已设置: ${ignore}`);
                return {success: true};
            } catch (error) {
                console.error('❌ 设置桌面歌词窗口鼠标穿透状态失败:', error);
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    });

    // 更新桌面歌词设置
    ipcMain.handle('desktopLyrics:updateSettings', (event, settings) => {
        try {
            const success = sendToDesktopLyrics('settings:changed', settings);
            return {success};
        } catch (error) {
            console.error('❌ 更新桌面歌词设置失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 查询窗口位置/大小
    ipcMain.handle('desktopLyrics:getPosition', () => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            return {success: true, position: win.getPosition()};
        }
        return {success: false};
    });

    ipcMain.handle('desktopLyrics:getSize', () => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            return {success: true, size: win.getSize()};
        }
        return {success: false};
    });

    // 将窗口居中到屏幕中央
    ipcMain.handle('desktopLyrics:centerOnScreen', () => {
        const win = getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const {screen} = require('electron');
                const primaryDisplay = screen.getPrimaryDisplay();
                const {width: screenWidth, height: screenHeight} = primaryDisplay.workAreaSize;
                const [winWidth, winHeight] = win.getSize();

                // 计算居中位置
                const x = Math.round((screenWidth - winWidth) / 2);
                const y = Math.round((screenHeight - winHeight) / 2);

                win.setPosition(x, y);
                console.log(`✅ 桌面歌词窗口已居中: 屏幕(${screenWidth}x${screenHeight}), 窗口(${winWidth}x${winHeight}), 位置(${x}, ${y})`);
                return {success: true, position: [x, y]};
            } catch (error) {
                console.error('❌ 居中桌面歌词窗口失败:', error);
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    });
}

module.exports = {
    registerDesktopLyricsIpcHandlers
};
