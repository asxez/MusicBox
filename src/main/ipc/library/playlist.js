// 音乐库 - 歌单管理 IPC

/**
 * 注册歌单管理 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {() => any} deps.getLibraryCacheManager - 获取当前 LibraryCacheManager 实例
 * @param {() => Promise<boolean>} deps.initializeCacheManager - 初始化缓存管理器
 */
function registerLibraryPlaylistIpcHandlers({ipcMain, getLibraryCacheManager, initializeCacheManager}) {
    if (!ipcMain) throw new Error('registerLibraryPlaylistIpcHandlers: 缺少 ipcMain');
    if (!getLibraryCacheManager) throw new Error('registerLibraryPlaylistIpcHandlers: 缺少 getLibraryCacheManager');
    if (!initializeCacheManager) throw new Error('registerLibraryPlaylistIpcHandlers: 缺少 initializeCacheManager');

    async function ensureCacheManager() {
        if (!getLibraryCacheManager()) {
            await initializeCacheManager();
        }
        return getLibraryCacheManager();
    }

    // 创建新歌单
    ipcMain.handle('library:createPlaylist', async (event, name, description = '') => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const playlist = libraryCacheManager.createPlaylist(name, description);
            await libraryCacheManager.saveCache();
            console.log(`✅ 创建歌单成功: ${playlist.name}`);
            return {success: true, playlist};
        } catch (error) {
            console.error('❌ 创建歌单失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 获取所有歌单
    ipcMain.handle('library:getPlaylists', async () => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const playlists = libraryCacheManager.getAllPlaylists();
            console.log(`📋 获取歌单列表: ${playlists.length} 个歌单`);
            return playlists;
        } catch (error) {
            console.error('❌ 获取歌单列表失败:', error);
            return [];
        }
    });

    // 获取歌单详情（包含歌曲）
    ipcMain.handle('library:getPlaylistDetail', async (event, playlistId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const playlist = libraryCacheManager.getPlaylistById(playlistId);
            if (!playlist) {
                return {success: false, error: '歌单不存在'};
            }
            const tracks = libraryCacheManager.getPlaylistTracks(playlistId);
            console.log(`📋 获取歌单详情: ${playlist.name} (${tracks.length} 首歌曲)`);
            return {success: true, playlist: {...playlist, tracks}};
        } catch (error) {
            console.error('❌ 获取歌单详情失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 删除歌单
    ipcMain.handle('library:deletePlaylist', async (event, playlistId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const playlist = libraryCacheManager.getPlaylistById(playlistId);
            if (!playlist) {
                return {success: false, error: '歌单不存在'};
            }
            const playlistName = playlist.name;
            libraryCacheManager.deletePlaylist(playlistId);
            await libraryCacheManager.saveCache();
            console.log(`🗑️ 删除歌单成功: ${playlistName}`);
            return {success: true};
        } catch (error) {
            console.error('❌ 删除歌单失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 重命名歌单
    ipcMain.handle('library:renamePlaylist', async (event, playlistId, newName) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const playlist = libraryCacheManager.renamePlaylist(playlistId, newName);
            await libraryCacheManager.saveCache();
            console.log(`✏️ 重命名歌单成功: ${playlist.name}`);
            return {success: true, playlist};
        } catch (error) {
            console.error('❌ 重命名歌单失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 添加歌曲到歌单
    ipcMain.handle('library:addToPlaylist', async (event, playlistId, trackFileIds) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const trackIds = Array.isArray(trackFileIds) ? trackFileIds : [trackFileIds];
            const results = [];
            for (const trackId of trackIds) {
                try {
                    libraryCacheManager.addTrackToPlaylist(playlistId, trackId);
                    results.push({trackId, success: true});
                } catch (error) {
                    results.push({trackId, success: false, error: error.message});
                    console.warn(`⚠️ 添加歌曲到歌单失败: ${trackId} - ${error.message}`);
                }
            }
            await libraryCacheManager.saveCache();
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ 添加歌曲到歌单: ${successCount}/${trackIds.length} 成功`);
            return {success: true, results};
        } catch (error) {
            console.error('❌ 添加歌曲到歌单失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 更新歌单封面
    ipcMain.handle('library:updatePlaylistCover', async (event, playlistId, imagePath) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const success = libraryCacheManager.updatePlaylistCover(playlistId, imagePath);
            if (success) {
                await libraryCacheManager.saveCache();
                console.log(`✅ 更新歌单封面成功: ${playlistId} -> ${imagePath}`);
                return {success: true};
            } else {
                return {success: false, error: '更新歌单封面失败'};
            }
        } catch (error) {
            console.error('❌ 更新歌单封面失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 获取歌单封面
    ipcMain.handle('library:getPlaylistCover', async (event, playlistId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const coverPath = libraryCacheManager.getPlaylistCover(playlistId);
            return {success: true, coverPath};
        } catch (error) {
            console.error('❌ 获取歌单封面失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 移除歌单封面
    ipcMain.handle('library:removePlaylistCover', async (event, playlistId) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const success = libraryCacheManager.removePlaylistCover(playlistId);
            if (success) {
                await libraryCacheManager.saveCache();
                console.log(`✅ 移除歌单封面成功: ${playlistId}`);
                return {success: true};
            } else {
                return {success: false, error: '移除歌单封面失败'};
            }
        } catch (error) {
            console.error('❌ 移除歌单封面失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 从歌单移除歌曲
    ipcMain.handle('library:removeFromPlaylist', async (event, playlistId, trackFileIds) => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const trackIds = Array.isArray(trackFileIds) ? trackFileIds : [trackFileIds];
            const results = [];
            for (const trackId of trackIds) {
                try {
                    libraryCacheManager.removeTrackFromPlaylist(playlistId, trackId);
                    results.push({trackId, success: true});
                } catch (error) {
                    results.push({trackId, success: false, error: error.message});
                    console.warn(`⚠️ 从歌单移除歌曲失败: ${trackId} - ${error.message}`);
                }
            }
            await libraryCacheManager.saveCache();
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ 从歌单移除歌曲: ${successCount}/${trackIds.length} 成功`);
            return {success: true, results};
        } catch (error) {
            console.error('❌ 从歌单移除歌曲失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 清理歌单中的无效歌曲引用
    ipcMain.handle('library:cleanupPlaylists', async () => {
        try {
            const libraryCacheManager = await ensureCacheManager();
            const cleanedCount = libraryCacheManager.cleanupPlaylistTracks();
            if (cleanedCount > 0) {
                await libraryCacheManager.saveCache();
            }
            console.log(`🧹 清理歌单完成: 移除了 ${cleanedCount} 个无效引用`);
            return {success: true, cleanedCount};
        } catch (error) {
            console.error('❌ 清理歌单失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerLibraryPlaylistIpcHandlers,
};
