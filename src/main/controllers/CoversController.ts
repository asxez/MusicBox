// 封面控制器

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {cleanCoverFileName} from '../utils/string';
import {generateCoverSearchPatterns, findBestCoverMatch} from '../utils/FileSearch';

async function downloadImageFromUrl(url: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise(resolve => {
        const client = url.startsWith('https') ? https : http;
        const req = (client as any).get(url, (response: any) => {
            if (response.statusCode === 200) {
                const stream = fs.createWriteStream(filePath);
                response.pipe(stream);
                stream.on('finish', () => {
                    stream.close();
                    resolve({success: true});
                });
                stream.on('error', (e: any) => {
                    fs.unlink(filePath, () => {
                    });
                    resolve({success: false, error: e.message});
                });
            } else {
                resolve({success: false, error: `HTTP ${response.statusCode}`});
            }
        });
        req.on('error', (e: any) => resolve({success: false, error: e.message}));
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({success: false, error: '下载超时'});
        });
    });
}

@Controller('covers')
export class CoversController extends BaseController {
    constructor() {
        super();
    }

    @IpcHandle('covers:checkLocalCover')
    async checkLocalCover(
        coverDir: string,
        title: string,
        artist: string,
        album: string,
        isAlbum = false
    ): Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }> {
        try {
            try {
                await fs.promises.access(coverDir);
            } catch {
                return {success: false, error: '封面缓存目录不存在'};
            }

            const files = await fs.promises.readdir(coverDir);
            const imageFiles = files.filter(f => ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(path.extname(f).toLowerCase()));

            if (isAlbum) {
                const cleanArtist = cleanCoverFileName(artist);
                const cleanAlbum = cleanCoverFileName(album);
                const expectedBase = album
                    ? `${cleanArtist}_${cleanAlbum}__ALBUM`.toLowerCase()
                    : `${cleanArtist}__ARTIST`.toLowerCase();

                const matched = imageFiles.find(f => path.parse(f).name.toLowerCase() === expectedBase);
                if (matched) {
                    return {success: true, filePath: path.join(coverDir, matched), fileName: matched};
                }
                return {success: false, error: '未找到匹配的封面文件'};
            } else {
                const searchPatterns = generateCoverSearchPatterns(title, artist, album);
                const matched = findBestCoverMatch(imageFiles, searchPatterns);
                if (matched) {
                    return {success: true, filePath: path.join(coverDir, matched), fileName: matched};
                }
                return {success: false, error: '未找到匹配的封面文件'};
            }
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('covers:saveCoverFile')
    async saveCoverFile(
        coverDir: string,
        fileName: string,
        imageData: any,
        dataType: string
    ): Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }> {
        try {
            await fs.promises.mkdir(coverDir, {recursive: true});
            const fullPath = path.join(coverDir, fileName);

            if (dataType === 'arrayBuffer') {
                await fs.promises.writeFile(fullPath, Buffer.from(imageData));
                return {success: true, filePath: fullPath, fileName};
            } else if (dataType === 'string' || typeof imageData === 'string') {
                if (imageData.startsWith('http')) {
                    const result = await downloadImageFromUrl(imageData, fullPath);
                    return result.success ? {success: true, filePath: fullPath, fileName} : {
                        success: false,
                        error: result.error
                    };
                } else {
                    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                    await fs.promises.writeFile(fullPath, base64Data, 'base64');
                    return {success: true, filePath: fullPath, fileName};
                }
            } else if (imageData instanceof Buffer) {
                await fs.promises.writeFile(fullPath, imageData);
                return {success: true, filePath: fullPath, fileName};
            }
            return {success: false, error: `不支持的图片数据格式: ${typeof imageData}`};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }
}
