// 歌词相关 IPC

const fs = require('fs');
const {getMimeTypeFromExtension, extractEmbeddedLyrics} = require('../utils/metadata');

/**
 * 注册歌词相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 * @param {object} [deps.networkFileAdapter] - 可选的网络文件适配器
 */
function registerLyricsIpcHandlers({ipcMain, networkFileAdapter}) {
    if (!ipcMain) throw new Error('registerLyricsIpcHandlers: 缺少 ipcMain');

    // 读取本地歌词文件
    ipcMain.handle('lyrics:readLocalFile', async (event, filePath) => {
        const chardet = require('chardet');
        const iconv = require('iconv-lite');
        try {
            console.log(`📖 读取本地歌词文件: ${filePath}`);
            const buffer = await fs.promises.readFile(filePath);
            const detectedEncoding = chardet.detect(buffer) || 'utf8';
            console.log(`🔍 检测到文件编码: ${detectedEncoding}`);
            const utf8Content = iconv.decode(buffer, detectedEncoding);
            console.log('✅ 文件内容转换成功');
            return {success: true, content: utf8Content};
        } catch (error) {
            console.error('❌ 读取本地歌词文件失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 获取内嵌歌词
    ipcMain.handle('lyrics:getEmbedded', async (event, filePath) => {
        const mm = require('music-metadata');
        try {
            if (!filePath || typeof filePath !== 'string') {
                console.error('❌ 内嵌歌词获取失败: 无效的文件路径参数');
                return {success: false, error: '无效的文件路径参数'};
            }

            // 检查文件是否存在（网络路径放行）
            if (!networkFileAdapter || !networkFileAdapter.isNetworkPath(filePath)) {
                try {
                    await fs.promises.access(filePath);
                } catch {
                    console.error(`❌ 内嵌歌词获取失败: 文件不存在 - ${filePath}`);
                    return {success: false, error: '指定的音频文件不存在'};
                }
            }

            console.log(`🎵 获取内嵌歌词: ${filePath}`);

            let metadata;
            if (networkFileAdapter && networkFileAdapter.isNetworkPath(filePath)) {
                // console.log(`🌐 检测到网络路径，使用网络文件解析: ${filePath}`);
                const buffer = await networkFileAdapter.readFile(filePath);
                metadata = await mm.parseBuffer(buffer, {
                    mimeType: getMimeTypeFromExtension(filePath),
                    size: buffer.length,
                });
            } else {
                metadata = await mm.parseFile(filePath);
            }

            if (!metadata) {
                console.error(`❌ 内嵌歌词获取失败: 无法解析音频文件元数据 - ${filePath}`);
                return {success: false, error: '无法解析音频文件元数据'};
            }

            if (metadata.native) {
                console.log('🔍 原生标签格式:');
                for (const [format, tags] of Object.entries(metadata.native)) {
                    console.log(`  - ${format}: ${tags.length} 个标签`);
                    const tagIds = tags.slice(0, 5).map(tag => tag.id).filter(id => id);
                    if (tagIds.length > 0) {
                        console.log(`    标签ID: ${tagIds.join(', ')}${tags.length > 5 ? '...' : ''}`);
                    }
                }
            } else {
                console.log('🔍 未找到原生标签数据');
            }

            const embeddedLyrics = extractEmbeddedLyrics(metadata);
            if (embeddedLyrics) {
                console.log(`✅ 成功提取内嵌歌词: ${embeddedLyrics.type} 格式 (语言: ${embeddedLyrics.language || '未知'})`);
                return {success: true, lyrics: embeddedLyrics, source: 'embedded'};
            } else {
                console.log(`ℹ️ 未找到内嵌歌词: ${filePath}`);
                return {success: false, error: '文件中未包含内嵌歌词'};
            }
        } catch (error) {
            console.error('❌ 获取内嵌歌词失败:', error);

            let errorMessage = error.message;
            if (error.code === 'ENOENT') {
                errorMessage = '音频文件不存在或无法访问';
            } else if (error.code === 'EACCES') {
                errorMessage = '没有权限访问音频文件';
            } else if (error.message.includes('unsupported format')) {
                errorMessage = '不支持的音频文件格式';
            } else if (error.message.includes('corrupted')) {
                errorMessage = '音频文件已损坏';
            }

            return {success: false, error: errorMessage};
        }
    });

    // 搜索本地歌词文件
    ipcMain.handle('lyrics:searchLocalFiles', async (event, lyricsDir, title, artist, album, extension = '.lrc') => {
        const {generateLyricsSearchPatterns, findBestLyricsMatch} = require('../utils/FileSearch');
        const path = require('path');
        try {
            console.log(`🔍 搜索本地歌词文件: ${title} - ${artist} 在目录 ${lyricsDir} (格式: ${extension})`);

            try {
                await fs.promises.access(lyricsDir);
            } catch {
                return {success: false, error: '歌词目录不存在'};
            }

            const files = await fs.promises.readdir(lyricsDir);
            const lyricsFiles = files.filter(file => path.extname(file).toLowerCase() === extension.toLowerCase());
            console.log(`📁 找到 ${lyricsFiles.length} 个${extension}歌词文件`);

            const searchPatterns = generateLyricsSearchPatterns(title, artist, album, extension);
            console.log(`🔍 生成 ${searchPatterns.length} 个搜索模式:`, searchPatterns);

            const matchedFile = findBestLyricsMatch(lyricsFiles, searchPatterns);
            if (matchedFile) {
                const fullPath = path.join(lyricsDir, matchedFile);
                console.log(`✅ 找到匹配的歌词文件: ${matchedFile}`);
                return {success: true, filePath: fullPath, fileName: matchedFile};
            } else {
                console.log(`❌ 未找到匹配的歌词文件`);
                return {success: false, error: '未找到匹配的歌词文件'};
            }
        } catch (error) {
            console.error('❌ 搜索本地歌词文件失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 保存歌词到本地文件
    ipcMain.handle('lyrics:saveToLocal', async (event, lyricsDir, title, artist, album, content, format = 'lrc') => {
        const path = require('path');
        try {
            console.log(`💾 保存歌词到本地: ${title} - ${artist} (格式: ${format})`);

            if (!lyricsDir) {
                return {success: false, error: '歌词目录未设置'};
            }

            // 确保歌词目录存在
            await fs.promises.mkdir(lyricsDir, {recursive: true});

            // 生成文件名：优先使用 "艺术家 - 歌曲名" 格式
            let fileName;
            if (artist && artist.trim()) {
                fileName = `${artist.trim()} - ${title.trim()}.${format}`;
            } else {
                fileName = `${title.trim()}.${format}`;
            }

            // 清理文件名中的非法字符
            fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
            const filePath = path.join(lyricsDir, fileName);

            // 写入文件
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return {
                success: true,
                filePath: filePath,
                fileName: fileName
            };
        } catch (error) {
            console.error('❌ 保存歌词文件失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerLyricsIpcHandlers
};
