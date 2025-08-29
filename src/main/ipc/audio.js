// 音频引擎 IPC

/**
 * 注册音频引擎相关的 IPC
 * @param {object} deps 依赖注入对象
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 * @param {object} deps.audioEngineState - 音频引擎状态对象
 */
function registerAudioIpcHandlers({ipcMain, audioEngineState}) {
    if (!ipcMain || !audioEngineState) {
        throw new Error('registerAudioIpcHandlers: 缺少必要依赖');
    }

    // 初始化
    ipcMain.handle('audio:init', async () => {
        try {
            audioEngineState.isInitialized = true;
            return true;
        } catch (error) {
            console.error('❌ 音频引擎初始化失败:', error);
            return false;
        }
    });

    // 加载歌曲
    ipcMain.handle('audio:loadTrack', async (event, filePath) => {
        const {parseMetadata} = require('../utils/metadata')
        try {
            console.log(`🔄 加载音频文件: ${filePath}`);

            const metadata = await parseMetadata(filePath);

            // 处理封面数据 - 确保不直接传递对象
            let coverUrl = null;
            if (metadata.cover && metadata.cover.data) {
                console.log('🔍 检测到内嵌封面，但不在主进程转换URL');
                // 让渲染进程处理封面数据转换
                coverUrl = null;
            }

            console.log('🔍 封面处理结果', {
                hasOriginalCover: !!(metadata.cover && metadata.cover.data),
                coverUrl: coverUrl,
                willUseEmbeddedManager: !!(metadata.cover && metadata.cover.data)
            });

            // 更新状态
            audioEngineState.currentTrack = {
                filePath: filePath,
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                duration: metadata.duration,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                year: metadata.year,
                genre: metadata.genre,
                track: metadata.track,
                disc: metadata.disc,
                cover: coverUrl, // 确保是URL或null
                embeddedLyrics: metadata.embeddedLyrics
            };

            console.log(`✅ 音频文件信息已更新: ${audioEngineState.currentTrack.title} (${metadata.duration.toFixed(2)}s)`);
            return true;
        } catch (error) {
            console.error('❌ 加载音频文件失败:', error);
            return false;
        }
    });

    // 播放/暂停/停止
    ipcMain.handle('audio:play', async () => {
        try {
            audioEngineState.isPlaying = true;
            console.log('▶️ 播放状态已更新');
            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    });

    ipcMain.handle('audio:pause', async () => {
        try {
            audioEngineState.isPlaying = false;
            console.log('⏸️ 暂停状态已更新');
            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    });

    ipcMain.handle('audio:stop', async () => {
        try {
            audioEngineState.isPlaying = false;
            audioEngineState.position = 0;
            console.log('⏹️ 停止状态已更新');
            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    });

    // 进度/音量
    ipcMain.handle('audio:seek', async (event, position) => {
        try {
            audioEngineState.position = Math.max(0, position);
            console.log(`⏭️ 跳转到位置: ${position.toFixed(2)}s`);
            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    });

    ipcMain.handle('audio:setVolume', async (event, volume) => {
        try {
            audioEngineState.volume = Math.max(0, Math.min(1, volume));
            console.log(`🔊 音量设置为: ${(audioEngineState.volume * 100).toFixed(0)}%`);
            return true;
        } catch (error) {
            console.error('❌ 音量设置失败:', error);
            return false;
        }
    });

    ipcMain.handle('audio:getVolume', async () => audioEngineState.volume);
    ipcMain.handle('audio:getPosition', async () => audioEngineState.position);
    ipcMain.handle('audio:getDuration', async () => (audioEngineState.currentTrack ? audioEngineState.currentTrack.duration : 0));

    // 当前歌曲和播放列表
    ipcMain.handle('audio:getCurrentTrack', async () => (
        audioEngineState.currentTrack || {
            filePath: '',
            title: '未选择音频文件',
            artist: '未知艺术家',
            album: '未知专辑',
            duration: 0
        }
    ));

    ipcMain.handle('audio:setPlaylist', async (event, tracks) => {
        try {
            audioEngineState.playlist = tracks;
            audioEngineState.currentIndex = 0;
            console.log(`📋 播放列表已设置: ${tracks.length}首歌曲`);
            return true;
        } catch (error) {
            console.error('❌ 设置播放列表失败:', error);
            return false;
        }
    });

    ipcMain.handle('audio:nextTrack', async () => {
        try {
            if (audioEngineState.playlist.length === 0) {
                console.log('⚠️ 播放列表为空');
                return false;
            }

            audioEngineState.currentIndex = (audioEngineState.currentIndex + 1) % audioEngineState.playlist.length;
            const nextTrack = audioEngineState.playlist[audioEngineState.currentIndex];

            console.log(`⏭️ 切换到下一首: ${nextTrack.title || nextTrack.filePath}`);

            // 更新当前歌曲
            audioEngineState.currentTrack = nextTrack;
            return true;
        } catch (error) {
            console.error('❌ 播放下一首失败:', error);
            return false;
        }
    });

    ipcMain.handle('audio:previousTrack', async () => {
        try {
            if (audioEngineState.playlist.length === 0) {
                console.log('⚠️ 播放列表为空');
                return false;
            }

            audioEngineState.currentIndex = audioEngineState.currentIndex > 0
                ? audioEngineState.currentIndex - 1
                : audioEngineState.playlist.length - 1;

            const prevTrack = audioEngineState.playlist[audioEngineState.currentIndex];

            console.log(`⏮️ 切换到上一首: ${prevTrack.title || prevTrack.filePath}`);

            // 更新当前歌曲
            audioEngineState.currentTrack = prevTrack;
            return true;
        } catch (error) {
            console.error('❌ 播放上一首失败:', error);
            return false;
        }
    });
}

module.exports = {
    registerAudioIpcHandlers,
};
