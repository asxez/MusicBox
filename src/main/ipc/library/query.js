// 音乐库 - 查询 IPC

/**
 * 注册音乐库查询相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {object} deps.audioEngineState - 音频引擎的内存状态
 */
function registerLibraryQueryIpcHandlers({ipcMain, audioEngineState}) {
    if (!ipcMain) throw new Error('registerLibraryQueryIpcHandlers: 缺少 ipcMain');
    if (!audioEngineState) throw new Error('registerLibraryQueryIpcHandlers: 缺少 audioEngineState');

    // 获取内存中的歌曲列表（清理 cover 对象）
    ipcMain.handle('library:getTracks', async () => {
        const tracks = audioEngineState.scannedTracks || [];

        // 确保返回的tracks中的cover字段不是对象
        const cleanedTracks = tracks.map(track => {
            const cleanedTrack = {...track};
            // 如果cover是对象，设置为null，让渲染进程的封面管理器处理
            if (cleanedTrack.cover && typeof cleanedTrack.cover === 'object') {
                console.log(`🔍 清理track.cover对象 - ${track.title}`);
                cleanedTrack.cover = null; // 设置为null，让渲染进程异步获取
            }
            return cleanedTrack;
        });

        console.log(`📚 返回 ${cleanedTracks.length} 个tracks，已清理cover对象`);
        return cleanedTracks;
    });

    // 简单搜索
    ipcMain.handle('library:search', async (event, query) => {
        try {
            console.log(`🔍 搜索音乐库: ${query}`);

            if (!audioEngineState.scannedTracks) {
                return [];
            }

            const searchTerm = query.trim().toLowerCase();
            const results = audioEngineState.scannedTracks.filter(track => {
                return track.title.toLowerCase().includes(searchTerm) ||
                    track.artist.toLowerCase().includes(searchTerm) ||
                    track.album.toLowerCase().includes(searchTerm) ||
                    track.fileName.toLowerCase().includes(searchTerm);
            });

            console.log(`✅ 搜索完成，找到 ${results.length} 个结果`);
            return results;
        } catch (error) {
            console.error('❌ 搜索失败:', error);
            return [];
        }
    });
}

module.exports = {
    registerLibraryQueryIpcHandlers,
};
