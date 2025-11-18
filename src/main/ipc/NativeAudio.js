// 原生音频引擎

const fs = require('fs');
const path = require('path');
const os = require('os');

let nativeAudioEngine = null;
let eventPollInterval = null;
let getMainWindowFn = null;
let networkFileAdapterFn = null;
let currentTempFilePath = null; // 跟踪当前临时文件

/**
 * 注册 原生音频引擎 相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {object} deps.nativeAudioModule - Native音频模块
 * @param {() => any} deps.getMainWindow - 获取主窗口函数
 * @param {() => any} deps.getNetworkFileAdapter - 获取网络文件适配器函数
 */
function registerNativeAudioIpcHandlers({ipcMain, nativeAudioModule, getMainWindow, getNetworkFileAdapter}) {
    if (!ipcMain) throw new Error('registerNativeAudioIpcHandlers: 缺少 ipcMain');

    // 保存主窗口获取函数
    if (getMainWindow) {
        getMainWindowFn = getMainWindow;
    }

    // 保存网络文件适配器获取函数
    if (getNetworkFileAdapter) {
        networkFileAdapterFn = getNetworkFileAdapter;
    }

    ipcMain.handle('native-audio:initialize', async () => {
        try {
            if (!nativeAudioModule.hasOwnProperty('NativeAudioEngine')) {
                return {success: false, error: 'NativeAudioEngine类不存在'};
            }

            nativeAudioEngine = new nativeAudioModule.NativeAudioEngine();
            const result = await nativeAudioEngine.initialize();
            console.log('✅ Native音频引擎初始化成功');

            // 启动事件轮询
            startEventPolling();

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

            const oldTempFilePath = currentTempFilePath;
            currentTempFilePath = null;

            let actualFilePath = filePath;
            const networkFileAdapter = networkFileAdapterFn ? networkFileAdapterFn() : null;

            // 检测是否为网络路径
            if (networkFileAdapter && networkFileAdapter.isNetworkPath(filePath)) {
                console.log(`🌐 NativeAudio: 检测到网络路径，下载到临时文件: ${filePath}`);

                try {
                    // 创建临时文件路径
                    const tempDir = os.tmpdir();
                    const fileExtension = path.extname(filePath);
                    const tempFileName = `musicbox_native_audio_${Date.now()}${fileExtension}`;
                    const newTempFilePath = path.join(tempDir, tempFileName);

                    console.log(`📁 临时文件路径: ${newTempFilePath}`);

                    // 下载网络文件到临时位置
                    console.log(`⬇️ 开始下载网络文件...`);
                    const buffer = await networkFileAdapter.readFile(filePath);
                    fs.writeFileSync(newTempFilePath, buffer);
                    console.log(`✅ 文件下载完成，大小: ${buffer.length} 字节`);

                    actualFilePath = newTempFilePath;
                    currentTempFilePath = newTempFilePath;
                } catch (networkError) {
                    console.error(`❌ 下载网络文件失败:`, networkError);
                    // 恢复旧的临时文件路径
                    currentTempFilePath = oldTempFilePath;
                    return {success: false, error: `下载网络文件失败: ${networkError.message}`};
                }
            }

            // 加载音频
            const result = await nativeAudioEngine.loadTrack(actualFilePath);

            // 只有在新音频加载成功后，才清理旧的临时文件
            if (result.success !== 0 && oldTempFilePath && oldTempFilePath !== currentTempFilePath) {
                try {
                    if (fs.existsSync(oldTempFilePath)) {
                        fs.unlinkSync(oldTempFilePath);
                        console.log(`🧹 已清理旧临时文件: ${oldTempFilePath}`);
                    }
                } catch (cleanupError) {
                    console.warn(`⚠️ 清理旧临时文件失败: ${cleanupError.message}`);
                }
            }

            return result;
        } catch (error) {
            console.error('❌ 加载音轨失败:', error);
            cleanupTempFile();
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
                await nativeAudioEngine.destroy();
                nativeAudioEngine = null;
            }
            // 销毁时清理临时文件
            cleanupTempFile();
            return {success: true};
        } catch (error) {
            console.error('❌ 销毁引擎失败:', error);
            return {success: false, error: error.message};
        }
    });
}

/**
 * 清理临时文件
 */
function cleanupTempFile() {
    if (currentTempFilePath) {
        try {
            if (fs.existsSync(currentTempFilePath)) {
                fs.unlinkSync(currentTempFilePath);
                console.log(`🧹 已清理临时文件: ${currentTempFilePath}`);
            }
        } catch (error) {
            console.warn(`⚠️ 清理临时文件失败: ${error.message}`);
        } finally {
            currentTempFilePath = null;
        }
    }
}

/**
 * 启动事件轮询
 */
function startEventPolling() {
    // 清除现有轮询
    if (eventPollInterval) {
        clearInterval(eventPollInterval);
    }

    // 每500ms轮询一次原生引擎的事件
    eventPollInterval = setInterval(() => {
        if (!nativeAudioEngine) {
            return;
        }

        if (nativeAudioEngine.hasOwnProperty('pollEvents')) {
            try {
                const event = nativeAudioEngine.pollEvents();
                if (event) {
                    handleNativeAudioEvent(event);
                }
            } catch (error) {
                console.error('❌ 轮询原生音频事件失败:', error);
            }
        }
    }, 500);

    console.log('✅ Native音频事件轮询已启动');
}

/**
 * 停止事件轮询
 */
function stopEventPolling() {
    if (eventPollInterval) {
        clearInterval(eventPollInterval);
        eventPollInterval = null;
        console.log('🛑 Native音频事件轮询已停止');
    }
}

/**
 * 处理原生音频事件
 */
function handleNativeAudioEvent(event) {
    console.log('📣 Native音频事件:', event);

    // 动态获取主窗口
    const mainWindow = getMainWindowFn ? getMainWindowFn() : null;
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.warn('⚠️ 主窗口不可用，无法发送事件');
        return;
    }

    if (event === 'finished') {
        mainWindow.webContents.send('native-audio:track-ended');
    } else if (event.startsWith('error:')) {
        const errorMsg = event.substring(6);
        console.error('❌ Native音频错误:', errorMsg);
        mainWindow.webContents.send('native-audio:error', errorMsg);
    }
}

module.exports = {
    registerNativeAudioIpcHandlers,
    cleanupTempFile
};
