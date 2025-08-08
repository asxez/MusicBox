// 音乐库 - 缓存 IPC

/**
 * 注册音乐库缓存相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {() => any} deps.getLibraryCacheManager - 获取 LibraryCacheManager 实例
 * @param {() => Promise<boolean>} deps.initializeCacheManager - 初始化缓存管理器
 * @param {object} deps.audioEngineState - 音频引擎的内存状态
 * @param {() => any} deps.getNetworkDriveManager - 获取 NetworkDriveManager 实例
 */
function registerLibraryCacheIpcHandlers(
    {
        ipcMain,
        getLibraryCacheManager,
        initializeCacheManager,
        audioEngineState,
        getNetworkDriveManager,
    }
) {
    if (!ipcMain) throw new Error('registerLibraryCacheIpcHandlers: 缺少 ipcMain');
    if (!getLibraryCacheManager) throw new Error('registerLibraryCacheIpcHandlers: 缺少 getLibraryCacheManager');
    if (!initializeCacheManager) throw new Error('registerLibraryCacheIpcHandlers: 缺少 initializeCacheManager');
    if (!audioEngineState) throw new Error('registerLibraryCacheIpcHandlers: 缺少 audioEngineState');

    // 加载缓存歌曲
    ipcMain.handle('library:loadCachedTracks', async () => {
        try {
            if (!getLibraryCacheManager()) {
                await initializeCacheManager();
            }
            const libraryCacheManager = getLibraryCacheManager();
            const cachedTracks = libraryCacheManager.getAllTracks();

            // 将缓存的音乐文件加载到内存状态
            audioEngineState.scannedTracks = cachedTracks;

            // 清理返回给渲染进程的tracks中的cover对象
            const cleanedTracks = cachedTracks.map(track => {
                const cleanedTrack = {...track};
                if (cleanedTrack.cover && typeof cleanedTrack.cover === 'object') {
                    console.log(`🔍 清理缓存track.cover对象 - ${track.title}`);
                    cleanedTrack.cover = null;
                }
                return cleanedTrack;
            });

            console.log(`✅ 从缓存加载 ${cleanedTracks.length} 个音乐文件，已清理cover对象`);
            return cleanedTracks;
        } catch (error) {
            console.error('❌ 加载缓存音乐库失败:', error);
            return [];
        }
    });

    // 验证缓存
    ipcMain.handle('library:validateCache', async (event) => {
        try {
            const networkDriveManager = getNetworkDriveManager ? getNetworkDriveManager() : null;
            if (networkDriveManager) {
                const mountedDrives = Array.from(networkDriveManager.mountedDrives.keys());
                console.log(`🔍 缓存验证前，已挂载的驱动器: [${mountedDrives.join(', ')}]`);
            } else {
                console.log(`⚠️ 缓存验证前，NetworkDriveManager未初始化`);
            }

            if (!getLibraryCacheManager()) {
                console.log('🔧 缓存管理器未初始化，开始初始化...');
                await initializeCacheManager();
                const networkDriveManagerAfter = getNetworkDriveManager ? getNetworkDriveManager() : null;
                if (networkDriveManagerAfter) {
                    const mountedDrives = Array.from(networkDriveManagerAfter.mountedDrives.keys());
                    console.log(`🔍 缓存管理器初始化后，已挂载的驱动器: [${mountedDrives.join(', ')}]`);
                }
            }

            const libraryCacheManager = getLibraryCacheManager();
            console.log('🔍 开始验证音乐库缓存...');

            const validation = await libraryCacheManager.validateCachedTracks((progress) => {
                // 发送验证进度到渲染进程
                event.sender.send('library:cacheValidationProgress', progress);
            });

            // 移除无效的缓存条目
            if (validation.invalid.length > 0) {
                libraryCacheManager.removeInvalidTracks(validation.invalid);
            }

            // 保存更新后的缓存
            await libraryCacheManager.saveCache();

            // 更新内存中的音乐库
            const validTracks = libraryCacheManager.getAllTracks();
            audioEngineState.scannedTracks = validTracks;
            console.log(`✅ 缓存验证完成 - 有效: ${validation.valid.length}, 无效: ${validation.invalid.length}, 已修改: ${validation.modified.length}`);

            return {
                valid: validation.valid.length,
                invalid: validation.invalid.length,
                modified: validation.modified.length,
                tracks: validTracks,
            };
        } catch (error) {
            console.error('❌ 缓存验证失败:', error);
            return null;
        }
    });

    // 获取缓存统计
    ipcMain.handle('library:getCacheStatistics', async () => {
        try {
            if (!getLibraryCacheManager()) {
                await initializeCacheManager();
            }
            const libraryCacheManager = getLibraryCacheManager();
            return libraryCacheManager.getCacheStatistics();
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error);
            return null;
        }
    });

    // 清空缓存
    ipcMain.handle('library:clearCache', async () => {
        try {
            if (!getLibraryCacheManager()) {
                await initializeCacheManager();
            }
            const libraryCacheManager = getLibraryCacheManager();
            const success = await libraryCacheManager.clearCache();
            if (success) {
                // 清空内存中的音乐库
                audioEngineState.scannedTracks = [];
                console.log('✅ 音乐库缓存已清空');
            }
            return success;
        } catch (error) {
            console.error('❌ 清空缓存失败:', error);
            return false;
        }
    });
}

module.exports = {
    registerLibraryCacheIpcHandlers,
};
