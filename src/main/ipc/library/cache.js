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

    async function ensureCacheManager() {
        if (!getLibraryCacheManager()) {
            await initializeCacheManager();
        }
        return getLibraryCacheManager();
    }

    // 加载缓存歌曲
    ipcMain.handle('library:loadCachedTracks', async () => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const cachedTracks = libraryCacheManager.getAllTracks();

            // 将缓存的音乐文件加载到内存状态
            audioEngineState.scannedTracks = cachedTracks;

            console.log(`✅ 从缓存加载 ${cachedTracks.length} 个音乐文件`);
            return cachedTracks;
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

            const libraryCacheManager = await ensureCacheManager();
            if (networkDriveManager) {
                const mountedDrives = Array.from(networkDriveManager.mountedDrives.keys());
                console.log(`🔍 缓存管理器初始化后，已挂载的驱动器: [${mountedDrives.join(', ')}]`);
            }

            console.log('🔍 开始验证音乐库缓存...');

            const validation = await libraryCacheManager.validateCachedTracks((progress) => {
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
            const libraryCacheManager = await ensureCacheManager();
            return libraryCacheManager.getCacheStatistics();
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error);
            return null;
        }
    });

    // 清空缓存
    ipcMain.handle('library:clearCache', async () => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const success = await libraryCacheManager.clearCache();
            if (success) {
                audioEngineState.scannedTracks = [];
                console.log('✅ 音乐库缓存已清空');
            }
            return success;
        } catch (error) {
            console.error('❌ 清空缓存失败:', error);
            return false;
        }
    });

    // 从音乐库删除歌曲
    ipcMain.handle('library:removeTrack', async (event, trackFileId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const track = libraryCacheManager.removeTrack(trackFileId);
            await libraryCacheManager.saveCache();

            audioEngineState.scannedTracks = libraryCacheManager.getAllTracks();

            console.log(`🗑️ 从音乐库删除歌曲成功: ${track.title}`);
            return {success: true, track};
        } catch (error) {
            console.error('❌ 从音乐库删除歌曲失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 获取指定网络磁盘的歌曲
    ipcMain.handle('library:getTracksByDrive', async (event, driveId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const tracks = libraryCacheManager.getTracksByDrive(driveId);
            console.log(`📀 获取网络磁盘 ${driveId} 的歌曲: ${tracks.length} 首`);
            return tracks;
        } catch (error) {
            console.error('❌ 获取网络磁盘歌曲失败:', error);
            return [];
        }
    });

    // 移除指定网络磁盘的所有歌曲
    ipcMain.handle('library:removeTracksByDrive', async (event, driveId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const removedCount = libraryCacheManager.removeTracksByDrive(driveId);
            await libraryCacheManager.saveCache();

            audioEngineState.scannedTracks = libraryCacheManager.getAllTracks();

            console.log(`🗑️ 从网络磁盘 ${driveId} 删除了 ${removedCount} 首歌曲`);
            return {success: true, removedCount};
        } catch (error) {
            console.error('❌ 删除网络磁盘歌曲失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 清空忽略列表
    ipcMain.handle('library:clearIgnoreList', async () => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            libraryCacheManager.clearIgnoreList();
            await libraryCacheManager.saveCache();

            console.log('✅ 忽略列表已清空');
            return {success: true};
        } catch (error) {
            console.error('❌ 清空忽略列表失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerLibraryCacheIpcHandlers,
};
