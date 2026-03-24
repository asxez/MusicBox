// 歌词控制器

import * as fs from 'fs';
import * as path from 'path';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {extractEmbeddedLyrics, getMimeTypeFromExtension} from '../utils/metadata';
import {generateLyricsSearchPatterns, findBestLyricsMatch} from '../utils/FileSearch';
import {NetworkFileAdapter} from '../services/network/NetworkFileAdapter';

interface DirCache {
    files: string[];
    expiresAt: number;
}

const DIR_CACHE_TTL = 60_000; // 60 秒

@Controller('lyrics')
export class LyricsController extends BaseController {
    private dirCache = new Map<string, DirCache>();

    constructor(private networkFileAdapter: NetworkFileAdapter) {
        super();
    }

    private async getCachedDir(lyricsDir: string): Promise<string[]> {
        const now = Date.now();
        const cached = this.dirCache.get(lyricsDir);
        if (cached && cached.expiresAt > now) return cached.files;
        const files = await fs.promises.readdir(lyricsDir);
        this.dirCache.set(lyricsDir, {files, expiresAt: now + DIR_CACHE_TTL});
        return files;
    }

    @IpcHandle('lyrics:readLocalFile')
    async readLocalFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
        const chardet = require('chardet');
        const iconv = require('iconv-lite');
        try {
            const buffer = await fs.promises.readFile(filePath);
            const detectedEncoding = chardet.detect(buffer) || 'utf8';
            const content = iconv.decode(buffer, detectedEncoding);
            return {success: true, content};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('lyrics:getEmbedded')
    async getEmbedded(filePath: string): Promise<{ success: boolean; lyrics?: any; source?: string; error?: string }> {
        const mm = require('music-metadata');
        try {
            if (!filePath) {
                return {success: false, error: '无效的文件路径参数'};
            }

            const isNetwork = this.networkFileAdapter.isNetworkPath(filePath);
            if (!isNetwork) {
                try {
                    await fs.promises.access(filePath);
                } catch {
                    return {success: false, error: '指定的音频文件不存在'};
                }
            }

            let metadata;
            if (isNetwork) {
                const buffer = await this.networkFileAdapter.readFile(filePath);
                const mimeType = getMimeTypeFromExtension(path.extname(filePath));
                metadata = await mm.parseBuffer(buffer, {mimeType, size: buffer.length});
            } else {
                metadata = await mm.parseFile(filePath);
            }

            if (!metadata) return {success: false, error: '无法解析音频文件元数据'};

            const embeddedLyrics = extractEmbeddedLyrics(metadata);
            if (embeddedLyrics) {
                return {success: true, lyrics: embeddedLyrics, source: 'embedded'};
            }
            return {success: false, error: '文件中未包含内嵌歌词'};
        } catch (error: any) {
            let msg = error.message;
            if (error.code === 'ENOENT') msg = '音频文件不存在或无法访问';
            else if (error.code === 'EACCES') msg = '没有权限访问音频文件';
            return {success: false, error: msg};
        }
    }

    @IpcHandle('lyrics:searchLocalFiles')
    async searchLocalFiles(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        extension = '.lrc'
    ): Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }> {
        try {
            try {
                await fs.promises.access(lyricsDir);
            } catch {
                return {success: false, error: '歌词目录不存在'};
            }

            const files = await this.getCachedDir(lyricsDir);
            const lyricsFiles = files.filter(f => path.extname(f).toLowerCase() === extension.toLowerCase());

            const searchPatterns = generateLyricsSearchPatterns(title, artist, album, extension);
            const matched = findBestLyricsMatch(lyricsFiles, searchPatterns);
            if (matched) {
                return {success: true, filePath: path.join(lyricsDir, matched), fileName: matched};
            }
            return {success: false, error: '未找到匹配的歌词文件'};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('lyrics:saveToLocal')
    async saveToLocal(
        lyricsDir: string,
        title: string,
        artist: string,
        _album: string,
        content: string,
        format = 'lrc'
    ): Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }> {
        try {
            if (!lyricsDir) return {success: false, error: '歌词目录未设置'};
            await fs.promises.mkdir(lyricsDir, {recursive: true});

            let fileName = artist?.trim()
                ? `${artist.trim()} - ${title.trim()}.${format}`
                : `${title.trim()}.${format}`;
            fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
            const filePath = path.join(lyricsDir, fileName);
            await fs.promises.writeFile(filePath, content, 'utf-8');
            this.dirCache.delete(lyricsDir);
            return {success: true, filePath, fileName};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }
}
