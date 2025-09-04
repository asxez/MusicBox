// 封面相关 IPC

const fs = require('fs');
const path = require('path');

/**
 * 从URL下载图片
 * @param {string} url
 * @param {string} filePath
 * @returns {Promise<{success:boolean, error?:string}>}
 */
async function downloadImageFromUrl(url, filePath) {
    try {
        const https = require('https');
        const http = require('http');

        return new Promise((resolve) => {
            const client = url.startsWith('https') ? https : http;

            const request = client.get(url, (response) => {
                if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(filePath);
                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve({success: true});
                    });

                    fileStream.on('error', (error) => {
                        fs.unlink(filePath, () => {
                        });
                        resolve({success: false, error: error.message});
                    });
                } else {
                    resolve({success: false, error: `HTTP ${response.statusCode}`});
                }
            });

            request.on('error', (error) => {
                resolve({success: false, error: error.message});
            });

            request.setTimeout(10000, () => {
                request.destroy();
                resolve({success: false, error: '下载超时'});
            });
        });
    } catch (error) {
        return {success: false, error: error.message};
    }
}

/**
 * 注册封面相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerCoversIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerCoversIpcHandlers: 缺少 ipcMain');

    // 检查本地封面缓存是否存在
    ipcMain.handle('covers:checkLocalCover', async (event, coverDir, title, artist, album, isAlbum = false) => {
        const {cleanCoverFileName} = require('../utils/string');
        const {generateCoverSearchPatterns, findBestCoverMatch} = require('../utils/file-search');
        try {
            // console.log(`🔍 检查本地封面缓存: ${title} - ${artist} 在目录 ${coverDir} (isAlbum=${!!isAlbum})`);

            if (!fs.existsSync(coverDir)) {
                return {success: false, error: '封面缓存目录不存在'};
            }

            const files = fs.readdirSync(coverDir);
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
            });

            // 专辑精确匹配模式：仅匹配 艺术家_专辑__ALBUM.扩展名
            if (isAlbum) {
                // 使用与渲染器进程一致的文件名清理逻辑
                const cleanArtist = cleanCoverFileName(artist);
                const cleanAlbum = cleanCoverFileName(album);
                const expectedBase = `${cleanArtist}_${cleanAlbum}__ALBUM`.toLowerCase();

                console.log(`🔍 [Album-only] 查找专辑封面: ${expectedBase}`);

                const matched = imageFiles.find(file => {
                    const fileBase = path.parse(file).name.toLowerCase();
                    return fileBase === expectedBase;
                });

                if (matched) {
                    const fullPath = path.join(coverDir, matched);
                    console.log(`✅ [Album-only] 找到匹配的封面文件: ${matched}`);
                    return {success: true, filePath: fullPath, fileName: matched};
                }
                console.log(`❌ [Album-only] 未找到严格匹配的专辑封面，期望: ${expectedBase}`);
                return {success: false, error: '未找到匹配的专辑封面'};
            }

            // 默认单曲/广义匹配逻辑
            const searchPatterns = generateCoverSearchPatterns(title, artist, album);
            const matchedFile = findBestCoverMatch(imageFiles, searchPatterns);
            if (matchedFile) {
                const fullPath = path.join(coverDir, matchedFile);
                // console.log(`✅ 找到匹配的封面文件: ${matchedFile}`);
                return {success: true, filePath: fullPath, fileName: matchedFile};
            } else {
                console.log(`❌ 未找到匹配的封面文件`);
                return {success: false, error: '未找到匹配的封面文件'};
            }
        } catch (error) {
            console.error('❌ 检查本地封面缓存失败:', error);
            return {success: false, error: error.message};
        }
    });

    // 保存封面文件到本地缓存
    ipcMain.handle('covers:saveCoverFile', async (event, coverDir, fileName, imageData, dataType) => {
        try {
            console.log(`💾 保存封面文件: ${fileName} 到目录 ${coverDir} (数据类型: ${dataType})`);

            // 确保封面缓存目录存在
            if (!fs.existsSync(coverDir)) {
                fs.mkdirSync(coverDir, {recursive: true});
                console.log(`📁 创建封面缓存目录: ${coverDir}`);
            }

            const fullPath = path.join(coverDir, fileName);

            // 根据数据类型处理图片数据
            if (dataType === 'arrayBuffer') {
                const buffer = Buffer.from(imageData);
                fs.writeFileSync(fullPath, buffer);
                console.log(`✅ 封面文件保存成功 (arrayBuffer): ${fileName}`);
                return {success: true, filePath: fullPath, fileName};
            } else if (dataType === 'string' || typeof imageData === 'string') {
                if (imageData.startsWith('http')) {
                    const downloadResult = await downloadImageFromUrl(imageData, fullPath);
                    if (downloadResult.success) {
                        console.log(`✅ 封面文件下载并保存成功: ${fileName}`);
                        return {success: true, filePath: fullPath, fileName};
                    } else {
                        return {success: false, error: downloadResult.error};
                    }
                } else {
                    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                    fs.writeFileSync(fullPath, base64Data, 'base64');
                    console.log(`✅ 封面文件保存成功 (base64): ${fileName}`);
                    return {success: true, filePath: fullPath, fileName};
                }
            } else if (imageData instanceof Buffer) {
                fs.writeFileSync(fullPath, imageData);
                console.log(`✅ 封面文件保存成功 (buffer): ${fileName}`);
                return {success: true, filePath: fullPath, fileName};
            } else {
                console.error(`❌ 不支持的图片数据格式: ${typeof imageData}, dataType: ${dataType}`);
                return {success: false, error: `不支持的图片数据格式: ${typeof imageData}`};
            }
        } catch (error) {
            console.error('❌ 保存封面文件失败:', error);
            return {success: false, error: error.message};
        }
    });
}

module.exports = {
    registerCoversIpcHandlers
};
