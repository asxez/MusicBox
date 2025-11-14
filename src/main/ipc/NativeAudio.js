// 原生音频引擎

let nativeAudioEngine = null;

/**
 * 注册 原生音频引擎 相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 */
function registerNativeAudioIpcHandlers({ipcMain, nativeAudioModule}) {
    if (!ipcMain) throw new Error('registerNativeAudioIpcHandlers: 缺少 ipcMain');

    ipcMain.handle('native-audio:initialize', async () => {
        try {
            if (!nativeAudioModule.NativeAudioEngine) {
                return {success: false, error: 'NativeAudioEngine类不存在'};
            }

            nativeAudioEngine = new nativeAudioModule.NativeAudioEngine();
            const result = await nativeAudioEngine.initialize();
            console.log('✅ Native音频引擎初始化成功');
            return result;
        } catch (error) {
            console.error('❌ Native音频引擎初始化失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 加载音轨
    ipcMain.handle('native-audio:load-track', async (event, filePath) => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            return await nativeAudioEngine.loadTrack(filePath);
        } catch (error) {
            console.error('❌ 加载音轨失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 播放
    ipcMain.handle('native-audio:play', async () => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            return await nativeAudioEngine.play();
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 暂停
    ipcMain.handle('native-audio:pause', async () => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            return await nativeAudioEngine.pause();
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 停止
    ipcMain.handle('native-audio:stop', async () => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            return await nativeAudioEngine.stop();
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 跳转
    ipcMain.handle('native-audio:seek', async (event, position) => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            return await nativeAudioEngine.seek(position);
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 设置音量
    ipcMain.handle('native-audio:set-volume', async (event, volume) => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            nativeAudioEngine.setVolume(volume);
            return {success: true};
        } catch (error) {
            console.error('❌ 设置音量失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 获取播放位置
    ipcMain.handle('native-audio:get-position', async () => {
        try {
            if (!nativeAudioEngine) {
                return {success: false, error: '引擎未初始化'};
            }
            return await nativeAudioEngine.getPosition();
        } catch (error) {
            console.error('❌ 获取播放位置失败:', error);
            return {success: false, error: error.message, position: 0};
        }
    });

    // 销毁引擎
    ipcMain.handle('native-audio:destroy', async () => {
        try {
            if (nativeAudioEngine) {
                // 如果Native模块提供了destroy方法，调用它
                if (typeof nativeAudioEngine.destroy === 'function') {
                    await nativeAudioEngine.destroy();
                }
                nativeAudioEngine = null;
            }
            return {success: true};
        } catch (error) {
            console.error('❌ 销毁引擎失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerNativeAudioIpcHandlers,
};
