// 音频元数据处理器

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import {spawn} from 'child_process';
import {app} from 'electron';

const METADATA_HANDLERS: Record<string, string> = {
    '.mp3': 'nodeid3',
    '.flac': 'mutagen',
    '.m4a': 'mutagen',
    '.mp4': 'mutagen',
    '.ogg': 'mutagen',
    '.aac': 'mutagen',
    '.wav': 'unsupported',
    '.wma': 'unsupported'
};

export interface MetadataInput {
    title?: string;
    artist?: string;
    album?: string;
    year?: string | number;
    genre?: string;
    cover?: number[] | null;
}

interface CommandResult {
    success: boolean;
    code?: number | null;
    stdout: string;
    stderr: string;
    error?: string;
}

interface MetadataResult {
    success: boolean;
    message?: string;
    error?: string;
    errorType?: string;
    method?: string;
}

export class MetadataHandler {
    private pythonPath: string | null = null;
    private scriptPath: string;
    private initialized = false;
    private useExecutable = false;
    private executablePath: string;

    constructor() {
        this.scriptPath = path.join(__dirname, '../../metadata_editor.py');
        this.executablePath = this.getExecutablePath();
    }

    private getExecutablePath(): string {
        const executableName = os.platform() === 'win32' ? 'metadata_editor.exe' : 'metadata_editor';
        if (app.isPackaged) {
            const candidates = [
                path.join(process.resourcesPath, executableName),
                path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'main', executableName),
                path.join(path.dirname(process.execPath), 'resources', executableName)
            ];
            for (const p of candidates) {
                if (fs.existsSync(p)) return p;
            }
            return candidates[0];
        }
        return path.join(__dirname, '../../', executableName);
    }

    async initialize(): Promise<boolean> {
        if (this.initialized) return true;
        console.log('🔧 初始化元数据处理器...');

        try {
            let execStats: fs.Stats | null = null;
            try {
                execStats = await fs.promises.stat(this.executablePath);
            } catch {
            }

            if (execStats) {
                console.log(`✅ 找到打包后的可执行文件: ${this.executablePath}`);
                this.useExecutable = true;
                this.initialized = true;
                return true;
            }

            this.pythonPath = await this.detectPython();
            if (!this.pythonPath) {
                console.warn('未检测到Python环境，将只支持MP3格式的元数据修改');
                this.initialized = true;
                return false;
            }

            try {
                await fs.promises.access(this.scriptPath);
            } catch {
                console.error('❌ Python元数据编辑脚本不存在:', this.scriptPath);
                this.initialized = true;
                return false;
            }

            const mutagenAvailable = await this.checkMutagenAvailability();
            if (!mutagenAvailable) {
                console.warn('⚠️ Python mutagen库不可用，将只支持MP3格式的元数据修改');
                this.initialized = true;
                return false;
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ 元数据处理器初始化失败:', error);
            this.initialized = true;
            return false;
        }
    }

    private async detectPython(): Promise<string | null> {
        for (const cmd of ['python3', 'python', 'py']) {
            try {
                const result = await this.runCommand(cmd, ['--version']);
                if (result.success && result.stdout.includes('Python')) return cmd;
            } catch {
            }
        }
        return null;
    }

    private async checkMutagenAvailability(): Promise<boolean> {
        if (!this.pythonPath) return false;
        try {
            const result = await this.runCommand(this.pythonPath, ['-c', 'import mutagen; print("mutagen available")']);
            return result.success && result.stdout.includes('mutagen available');
        } catch {
            return false;
        }
    }

    getHandlerType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        return METADATA_HANDLERS[ext] || 'unsupported';
    }

    isFormatSupported(filePath: string): boolean {
        return this.getHandlerType(filePath) !== 'unsupported';
    }

    async updateMetadata(filePath: string, metadata: MetadataInput): Promise<MetadataResult> {
        if (!this.initialized) await this.initialize();

        switch (this.getHandlerType(filePath)) {
            case 'nodeid3':
                return this.updateWithNodeID3(filePath, metadata);
            case 'mutagen':
                return this.updateWithMutagen(filePath, metadata);
            case 'unsupported':
                return {
                    success: false,
                    error: `不支持的音频格式: ${path.extname(filePath)}`,
                    errorType: 'unsupported_format'
                };
            default:
                return {success: false, error: `未知的处理器类型`, errorType: 'unknown_handler'};
        }
    }

    private async updateWithNodeID3(filePath: string, metadata: MetadataInput): Promise<MetadataResult> {
        try {
            const NodeID3 = require('node-id3');
            const tags: any = {
                title: (metadata.title || '').toString().trim(),
                artist: (metadata.artist || '').toString().trim(),
                album: (metadata.album || '').toString().trim(),
                year: (metadata.year || '').toString().trim(),
                genre: (metadata.genre || '').toString().trim()
            };

            if (metadata.cover && Array.isArray(metadata.cover)) {
                tags.image = {
                    mime: 'image/jpeg',
                    type: {id: 3, name: 'front cover'},
                    description: 'Cover',
                    imageBuffer: Buffer.from(metadata.cover)
                };
            }

            const result = NodeID3.write(tags, filePath);
            if (result === true) {
                return {success: true, message: 'MP3元数据更新成功', method: 'NodeID3'};
            }
            return {success: false, error: 'NodeID3写入失败', errorType: 'write_failed'};
        } catch (error: any) {
            return {success: false, error: `NodeID3处理失败: ${error.message}`, errorType: 'nodeid3_error'};
        }
    }

    private async updateWithMutagen(filePath: string, metadata: MetadataInput): Promise<MetadataResult> {
        if (!this.useExecutable && !this.pythonPath) {
            return {success: false, error: 'Python环境和可执行文件都不可用', errorType: 'no_processor_available'};
        }

        let tempCoverFile: string | null = null;
        let tempMetadataFile: string | null = null;

        try {
            const metadataJson: any = {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                year: metadata.year,
                genre: metadata.genre
            };

            if (metadata.cover && Array.isArray(metadata.cover)) {
                const coverBuffer = Buffer.from(metadata.cover);
                const base64Size = Math.ceil(coverBuffer.length * 4 / 3);
                if (coverBuffer.length > 1024 * 1024 || base64Size > 4000) {
                    tempCoverFile = await this.createTemporaryCoverFile(coverBuffer);
                    metadataJson.cover_file = tempCoverFile;
                } else {
                    metadataJson.cover_data = coverBuffer.toString('base64');
                }
            }

            tempMetadataFile = await this.createTemporaryMetadataFile(metadataJson);

            const args = this.useExecutable
                ? [filePath, '--metadata-file', tempMetadataFile]
                : [this.scriptPath, filePath, '--metadata-file', tempMetadataFile];
            const cmd = this.useExecutable ? this.executablePath : this.pythonPath!;

            const result = await this.runCommand(cmd, args);
            if (result.success) {
                try {
                    const response = JSON.parse(result.stdout);
                    return {
                        success: response.success,
                        message: response.message || '元数据更新完成',
                        error: response.error,
                        method: this.useExecutable ? 'Executable' : 'Python'
                    };
                } catch {
                    return {
                        success: true,
                        message: '元数据更新完成',
                        method: this.useExecutable ? 'Executable' : 'Python'
                    };
                }
            }
            return {success: false, error: `脚本执行失败: ${result.stderr}`, errorType: 'script_error'};
        } catch (error: any) {
            return {success: false, error: `Mutagen处理失败: ${error.message}`, errorType: 'mutagen_error'};
        } finally {
            await this.cleanupTemporaryFiles([tempCoverFile, tempMetadataFile]);
        }
    }

    private async createTemporaryCoverFile(coverBuffer: Buffer): Promise<string> {
        const fileName = `musicbox_cover_${crypto.randomBytes(8).toString('hex')}.jpg`;
        const tempFilePath = path.join(os.tmpdir(), fileName);
        await fs.promises.writeFile(tempFilePath, coverBuffer);
        return tempFilePath;
    }

    private async createTemporaryMetadataFile(metadataJson: any): Promise<string> {
        const fileName = `musicbox_metadata_${crypto.randomBytes(8).toString('hex')}.json`;
        const tempFilePath = path.join(os.tmpdir(), fileName);
        await fs.promises.writeFile(tempFilePath, JSON.stringify(metadataJson, null, 2), 'utf8');
        return tempFilePath;
    }

    private async cleanupTemporaryFiles(filePaths: (string | null)[]): Promise<void> {
        for (const filePath of filePaths) {
            if (!filePath) continue;
            try {
                await fs.promises.unlink(filePath);
            } catch {
            }
        }
    }

    private runCommand(command: string, args: string[], timeout = 30000): Promise<CommandResult> {
        return new Promise(resolve => {
            const child = spawn(command, args);
            let stdout = '';
            let stderr = '';
            let settled = false;

            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    child.kill();
                    resolve({
                        success: false,
                        error: `命令超时 (${timeout}ms)`,
                        stdout: stdout.trim(),
                        stderr: '进程超时被终止'
                    });
                }
            }, timeout);

            child.stdout.on('data', d => {
                stdout += d.toString();
            });
            child.stderr.on('data', d => {
                stderr += d.toString();
            });

            child.on('close', code => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve({success: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim()});
                }
            });

            child.on('error', error => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve({success: false, error: error.message, stdout: '', stderr: error.message});
                }
            });
        });
    }
}

export const metadataHandler = new MetadataHandler();
