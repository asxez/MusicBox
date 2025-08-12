// 音乐库 - 元数据 IPC

const {BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 注册音乐库元数据相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 * @param {(filePath: string) => Promise<any>} deps.parseMetadata - 统一的元数据解析函数
 * @param {object} deps.metadataHandler - 元数据读写处理器（含 isFormatSupported, updateMetadata）
 * @param {() => any} deps.getNetworkFileAdapter - 获取网络文件适配器
 * @param {() => any} deps.getLibraryCacheManager - 获取 LibraryCacheManager 实例
 * @param {object} deps.audioEngineState - 音频引擎的内存状态
 */
function registerLibraryMetadataIpcHandlers(
    {
        ipcMain,
        parseMetadata,
        metadataHandler,
        getNetworkFileAdapter,
        getLibraryCacheManager,
        audioEngineState,
    }
) {
    if (!ipcMain) throw new Error('registerLibraryMetadataIpcHandlers: 缺少 ipcMain');
    if (!parseMetadata) throw new Error('registerLibraryMetadataIpcHandlers: 缺少 parseMetadata');
    if (!metadataHandler) throw new Error('registerLibraryMetadataIpcHandlers: 缺少 metadataHandler');
    if (!getNetworkFileAdapter) throw new Error('registerLibraryMetadataIpcHandlers: 缺少 getNetworkFileAdapter');
    if (!getLibraryCacheManager) throw new Error('registerLibraryMetadataIpcHandlers: 缺少 getLibraryCacheManager');
    if (!audioEngineState) throw new Error('registerLibraryMetadataIpcHandlers: 缺少 audioEngineState');

    // 获取音频文件元数据
    ipcMain.handle('library:getTrackMetadata', async (event, filePath) => {
        try {
            // console.log(`📋 获取音频文件元数据: ${filePath}`);
            const metadata = await parseMetadata(filePath);
            return {
                filePath,
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
                cover: metadata.cover,
                embeddedLyrics: metadata.embeddedLyrics,
            };
        } catch (error) {
            console.error('❌ 获取元数据失败:', error);
            return null;
        }
    });

    // 更新歌曲元数据
    ipcMain.handle('library:updateTrackMetadata', async (event, updatedData) => {
        const DEBUG_METADATA_UPDATE = true;
        try {
            console.log(`📝 更新音频文件元数据: ${updatedData.filePath}`);
            if (DEBUG_METADATA_UPDATE) {
                console.log(`🔍 调试信息 - 更新数据:`, updatedData);
            }

            const {filePath, title, artist, album, year, genre, cover} = updatedData;
            const networkFileAdapter = getNetworkFileAdapter();

            const isNetworkFile = networkFileAdapter && networkFileAdapter.isNetworkPath(filePath);
            if (isNetworkFile) {
                console.log(`🌐 检测到网络文件: ${filePath}`);
                const networkFileExists = await networkFileAdapter.exists(filePath);
                if (!networkFileExists) throw new Error('网络文件不存在');
                console.log(`✅ 网络文件存在性验证通过: ${filePath}`);
            } else {
                if (!fs.existsSync(filePath)) throw new Error('文件不存在');
                try {
                    fs.accessSync(filePath, fs.constants.W_OK);
                    console.log(`✅ 文件写入权限验证通过: ${filePath}`);
                } catch (permissionError) {
                    throw new Error(`文件没有写入权限: ${permissionError.message}`);
                }
            }

            const fileExtension = path.extname(filePath).toLowerCase();
            console.log(`🔍 文件格式: ${fileExtension}`);

            let originalStats;
            if (isNetworkFile) {
                originalStats = await networkFileAdapter.stat(filePath);
                console.log(`📊 网络文件修改时间: ${originalStats.mtime}`);
            } else {
                originalStats = fs.statSync(filePath);
                console.log(`📊 原始文件修改时间: ${originalStats.mtime}`);
            }

            if (!metadataHandler.isFormatSupported(filePath)) {
                throw new Error(`不支持的音频格式: ${fileExtension}。目前支持的格式: MP3, FLAC, M4A, OGG`);
            }

            const metadata = {
                title: (title || '').toString().trim(),
                artist: (artist || '').toString().trim(),
                album: (album || '').toString().trim(),
                year: year ? parseInt(year) : null,
                genre: (genre || '').toString().trim(),
                cover: cover && Array.isArray(cover) ? cover : null,
            };

            console.log(`📝 准备写入的元数据:`, {
                ...metadata,
                cover: metadata.cover ? `[封面数据: ${metadata.cover.length} 字节]` : null,
            });

            let result;
            if (isNetworkFile) {
                console.log(`🌐 网络文件元数据更新：使用临时文件方案`);
                result = await updateNetworkFileMetadata(filePath, metadata, metadataHandler, networkFileAdapter);
            } else {
                result = await metadataHandler.updateMetadata(filePath, metadata);
                if (!result.success) throw new Error(result.error || '元数据更新失败');
            }

            console.log(`✅ 元数据更新成功 (使用方法: ${result.method})`);

            if (!isNetworkFile) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            console.log(`🔄 重新读取文件以验证元数据更新...`);
            const updatedMetadata = await parseMetadata(filePath);

            const verificationResults = {
                title: updatedMetadata.title === metadata.title,
                artist: updatedMetadata.artist === metadata.artist,
                album: updatedMetadata.album === metadata.album,
                year: metadata.year ? (updatedMetadata.year?.toString() === metadata.year.toString()) : true,
                genre: updatedMetadata.genre === metadata.genre,
            };
            console.log(`🔍 元数据验证结果:`, verificationResults);

            const failedFields = Object.entries(verificationResults)
                .filter(([_, success]) => !success)
                .map(([field]) => field);
            if (failedFields.length > 0) {
                console.warn(`⚠️ 以下字段可能未正确写入: ${failedFields.join(', ')}`);
                console.warn(`期望值:`, metadata);
                console.warn(`实际值:`, {
                    title: updatedMetadata.title,
                    artist: updatedMetadata.artist,
                    album: updatedMetadata.album,
                    year: updatedMetadata.year,
                    genre: updatedMetadata.genre,
                });
                const criticalFields = ['title', 'artist'];
                const failedCriticalFields = failedFields.filter((f) => criticalFields.includes(f));
                if (failedCriticalFields.length > 0) {
                    throw new Error(`关键元数据字段写入失败: ${failedCriticalFields.join(', ')}。这可能是由于文件格式不支持或文件损坏导致的。`);
                }
            } else {
                console.log(`✅ 所有元数据字段验证通过`);
            }

            let updatedStats;
            if (isNetworkFile) {
                try {
                    updatedStats = await networkFileAdapter.stat(filePath);
                    console.log(`📊 网络文件实际更新时间: ${updatedStats.mtime}`);
                } catch (statError) {
                    console.warn(`⚠️ 获取网络文件更新后状态失败，使用当前时间: ${statError.message}`);
                    updatedStats = {mtime: new Date(), size: originalStats.size};
                }
            } else {
                updatedStats = fs.statSync(filePath);
                console.log(`📊 更新后文件修改时间: ${updatedStats.mtime}`);
            }

            if (audioEngineState.scannedTracks) {
                const trackIndex = audioEngineState.scannedTracks.findIndex((t) => t.filePath === filePath);
                if (trackIndex !== -1) {
                    audioEngineState.scannedTracks[trackIndex] = {
                        ...audioEngineState.scannedTracks[trackIndex],
                        title: updatedMetadata.title,
                        artist: updatedMetadata.artist,
                        album: updatedMetadata.album,
                        year: updatedMetadata.year,
                        genre: updatedMetadata.genre,
                        cover: updatedMetadata.cover,
                        lastModified: updatedStats.mtime.getTime(),
                    };
                    console.log(`✅ 已更新内存中的歌曲数据: ${updatedMetadata.title}`);
                }
            }

            const libraryCacheManager = getLibraryCacheManager();
            if (libraryCacheManager) {
                try {
                    const newFileId = libraryCacheManager.generateFileId(filePath, updatedStats);
                    const cacheUpdateSuccess = libraryCacheManager.updateTrackInCache(filePath, {
                        fileId: newFileId,
                        title: updatedMetadata.title,
                        artist: updatedMetadata.artist,
                        album: updatedMetadata.album,
                        year: updatedMetadata.year,
                        genre: updatedMetadata.genre,
                        cover: updatedMetadata.cover,
                        lastModified: updatedStats.mtime.getTime(),
                        fileSize: updatedStats.size,
                    });
                    if (cacheUpdateSuccess) {
                        await libraryCacheManager.saveCache();
                        console.log(`✅ 已更新并保存缓存中的歌曲数据: ${updatedMetadata.title}`);
                        console.log(`🔑 已更新缓存中的fileId: ${newFileId}`);
                    } else {
                        console.warn(`⚠️ 缓存更新失败，歌曲可能不在缓存中: ${filePath}`);
                    }
                } catch (cacheError) {
                    console.error('❌ 更新缓存失败:', cacheError);
                }
            }

            console.log(`✅ 歌曲元数据更新成功: ${updatedMetadata.title} - ${updatedMetadata.artist}`);

            const coverUpdated = metadata.cover && Array.isArray(metadata.cover) && metadata.cover.length > 0;
            if (coverUpdated) {
                console.log('封面已更新，通知渲染进程刷新显示');
                const eventData = {
                    filePath,
                    title: updatedMetadata.title,
                    artist: updatedMetadata.artist,
                    album: updatedMetadata.album,
                    timestamp: Date.now(),
                };
                const allWindows = BrowserWindow.getAllWindows();
                allWindows.forEach((win) => {
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('cover-updated', eventData);
                    }
                });
            }

            return {
                success: true,
                coverUpdated,
                updatedMetadata: {
                    filePath,
                    title: updatedMetadata.title,
                    artist: updatedMetadata.artist,
                    album: updatedMetadata.album,
                    year: updatedMetadata.year,
                    genre: updatedMetadata.genre,
                    cover: updatedMetadata.cover,
                },
            };
        } catch (error) {
            console.error('❌ 更新歌曲元数据失败:', error);
            return {success: false, error: error.message};
        }
    });
}

// 网络文件元数据更新
async function updateNetworkFileMetadata(filePath, metadata, metadataHandler, networkFileAdapter) {
    const tempDir = os.tmpdir();
    const tempFileName = `musicbox_temp_${Date.now()}_${path.basename(filePath)}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    try {
        console.log(`🌐 开始网络文件元数据更新: ${filePath}`);
        console.log(`📁 临时文件路径: ${tempFilePath}`);

        console.log(`⬇️ 下载网络文件到临时位置...`);
        const networkBuffer = await networkFileAdapter.readFile(filePath);
        fs.writeFileSync(tempFilePath, networkBuffer);
        console.log(`✅ 文件下载完成，大小: ${networkBuffer.length} 字节`);

        console.log(`📝 在临时文件上更新元数据...`);
        const result = await metadataHandler.updateMetadata(tempFilePath, metadata);
        if (!result.success) throw new Error(result.error || '临时文件元数据更新失败');
        console.log(`✅ 临时文件元数据更新成功 (使用方法: ${result.method})`);

        console.log(`📖 读取修改后的临时文件...`);
        const modifiedBuffer = fs.readFileSync(tempFilePath);
        console.log(`✅ 修改后文件大小: ${modifiedBuffer.length} 字节`);

        console.log(`⬆️ 将修改后的文件写回网络位置...`);
        await networkFileAdapter.writeFile(filePath, modifiedBuffer);
        console.log(`✅ 网络文件写入完成`);

        return {success: true, method: '网络文件临时编辑'};
    } catch (error) {
        console.error(`❌ 网络文件元数据更新失败: ${error.message}`);
        throw error;
    } finally {
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`🧹 临时文件已清理: ${tempFilePath}`);
            }
        } catch (cleanupError) {
            console.warn(`⚠️ 清理临时文件失败: ${cleanupError.message}`);
        }
    }
}

module.exports = {
    registerLibraryMetadataIpcHandlers,
};
