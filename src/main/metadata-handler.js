// 音频元数据处理器

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const METADATA_HANDLERS = {
    '.mp3': 'nodeid3',
    '.flac': 'mutagen',
    '.m4a': 'mutagen',
    '.mp4': 'mutagen',
    '.ogg': 'mutagen',
    '.aac': 'mutagen',
    '.wav': 'unsupported',
    '.wma': 'unsupported'
};

class MetadataHandler {
    constructor() {
        this.pythonPath = null;
        this.scriptPath = path.join(__dirname, 'metadata_editor.py');
        this.initialized = false;
    }


    async initialize() {
        if (this.initialized) {
            return true;
        }

        try {
            this.pythonPath = await this.detectPython();
            if (!this.pythonPath) {
                console.warn('未检测到Python环境，将只支持MP3格式的元数据修改');
                this.initialized = true;
                return false;
            }
            if (!fs.existsSync(this.scriptPath)) {
                console.error('❌ Python元数据编辑脚本不存在:', this.scriptPath);
                this.initialized = true;
                return false;
            }

            // 检查mutagen库是否可用
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

    // 检测Python环境
    async detectPython() {
        const pythonCommands = ['python3', 'python', 'py'];
        for (const cmd of pythonCommands) {
            try {
                const result = await this.runCommand(cmd, ['--version']);
                if (result.success && result.stdout.includes('Python')) {
                    return cmd;
                }
            } catch (error) {}
        }
        
        return null;
    }

    // 检查mutagen库可用性
    async checkMutagenAvailability() {
        if (!this.pythonPath) {
            return false;
        }

        try {
            const result = await this.runCommand(this.pythonPath, ['-c', 'import mutagen; print("mutagen available")']);
            return result.success && result.stdout.includes('mutagen available');
        } catch (error) {
            return false;
        }
    }

    // 获取文件格式对应的处理器类型
    getHandlerType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return METADATA_HANDLERS[ext] || 'unsupported';
    }

    // 检查格式是否支持元数据修改
    isFormatSupported(filePath) {
        const handlerType = this.getHandlerType(filePath);
        return handlerType !== 'unsupported';
    }

    // 更新音频文件元数据
    async updateMetadata(filePath, metadata) {
        if (!this.initialized) {
            await this.initialize();
        }

        const handlerType = this.getHandlerType(filePath);
        switch (handlerType) {
            case 'nodeid3':
                return await this.updateWithNodeID3(filePath, metadata);
            case 'mutagen':
                return await this.updateWithMutagen(filePath, metadata);
            case 'unsupported':
                return {
                    success: false,
                    error: `不支持的音频格式: ${path.extname(filePath)}`,
                    errorType: 'unsupported_format'
                };
            default:
                return {
                    success: false,
                    error: `未知的处理器类型: ${handlerType}`,
                    errorType: 'unknown_handler'
                };
        }
    }

    // 使用NodeID3更新MP3元数据
    async updateWithNodeID3(filePath, metadata) {
        try {
            const NodeID3 = require('node-id3');
            
            // 标签数据
            const tags = {
                title: (metadata.title || '').toString().trim(),
                artist: (metadata.artist || '').toString().trim(),
                album: (metadata.album || '').toString().trim(),
                year: metadata.year ? metadata.year.toString().trim() : '',
                genre: (metadata.genre || '').toString().trim()
            };

            // 处理封面
            if (metadata.cover && Array.isArray(metadata.cover)) {
                tags.image = {
                    mime: 'image/jpeg',
                    type: {
                        id: 3,
                        name: 'front cover'
                    },
                    description: 'Album Cover',
                    imageBuffer: Buffer.from(metadata.cover)
                };
            }

            const writeSuccess = NodeID3.write(tags, filePath);
            if (writeSuccess) {
                return {
                    success: true,
                    message: 'MP3元数据更新成功',
                    method: 'NodeID3'
                };
            } else {
                return {
                    success: false,
                    error: 'NodeID3写入失败',
                    errorType: 'write_failed'
                };
            }
        } catch (error) {
            console.error('❌ NodeID3处理失败:', error);
            return {
                success: false,
                error: `NodeID3处理失败: ${error.message}`,
                errorType: 'nodeid3_error'
            };
        }
    }

    // 使用Mutagen更新元数据
    async updateWithMutagen(filePath, metadata) {
        if (!this.pythonPath) {
            return {
                success: false,
                error: 'Python环境不可用',
                errorType: 'python_unavailable'
            };
        }

        let tempCoverFile = null;
        let tempMetadataFile = null;

        try {
            // 准备元数据
            const metadataJson = {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                year: metadata.year,
                genre: metadata.genre
            };

            // 处理封面数据 - 使用临时文件避免命令行参数过长
            if (metadata.cover && Array.isArray(metadata.cover)) {
                const coverBuffer = Buffer.from(metadata.cover);

                // 检查是否需要使用临时文件（超过1MB或base64后可能超过命令行限制）
                const base64Size = Math.ceil(coverBuffer.length * 4 / 3);
                const useTemporaryFile = coverBuffer.length > 1024 * 1024 || base64Size > 4000;

                if (useTemporaryFile) {
                    tempCoverFile = await this.createTemporaryCoverFile(coverBuffer);
                    metadataJson.cover_file = tempCoverFile;
                } else {
                    metadataJson.cover_data = coverBuffer.toString('base64');
                }
            }

            // 创建临时元数据文件以避免JSON过大的问题
            tempMetadataFile = await this.createTemporaryMetadataFile(metadataJson);
            const result = await this.runCommand(this.pythonPath, [
                this.scriptPath,
                filePath,
                '--metadata-file',
                tempMetadataFile
            ]);
            if (result.success) {
                try {
                    const response = JSON.parse(result.stdout);
                    return {
                        success: response.success,
                        message: response.message || '元数据更新完成',
                        error: response.error,
                        method: 'Python Mutagen'
                    };
                } catch (parseError) {
                    return {
                        success: false,
                        error: `Python脚本返回格式错误: ${parseError.message}`,
                        errorType: 'parse_error'
                    };
                }
            } else {
                return {
                    success: false,
                    error: `Python脚本执行失败: ${result.stderr}`,
                    errorType: 'script_error'
                };
            }
        } catch (error) {
            console.error('❌ Python Mutagen处理失败:', error);
            return {
                success: false,
                error: `Python Mutagen处理失败: ${error.message}`,
                errorType: 'mutagen_error'
            };
        } finally {
            await this.cleanupTemporaryFiles([tempCoverFile, tempMetadataFile]);
        }
    }

    // 创建临时封面文件
    async createTemporaryCoverFile(coverBuffer) {
        try {
            const tempDir = os.tmpdir();
            const fileName = `musicbox_cover_${crypto.randomBytes(8).toString('hex')}.jpg`;
            const tempFilePath = path.join(tempDir, fileName);
            await fs.promises.writeFile(tempFilePath, coverBuffer);
            return tempFilePath;
        } catch (error) {
            console.error('❌ 创建临时封面文件失败:', error);
            throw new Error(`创建临时封面文件失败: ${error.message}`);
        }
    }

    // 创建临时元数据文件
    async createTemporaryMetadataFile(metadataJson) {
        try {
            const tempDir = os.tmpdir();
            const fileName = `musicbox_metadata_${crypto.randomBytes(8).toString('hex')}.json`;
            const tempFilePath = path.join(tempDir, fileName);
            await fs.promises.writeFile(tempFilePath, JSON.stringify(metadataJson, null, 2), 'utf8');
            return tempFilePath;
        } catch (error) {
            console.error('❌ 创建临时元数据文件失败:', error);
            throw new Error(`创建临时元数据文件失败: ${error.message}`);
        }
    }

    // 清理临时文件
    async cleanupTemporaryFiles(filePaths) {
        for (const filePath of filePaths) {
            if (filePath && typeof filePath === 'string') {
                try {
                    if (fs.existsSync(filePath)) {
                        await fs.promises.unlink(filePath);
                    }
                } catch (error) {
                    console.warn(`⚠️ 清理临时文件失败 ${filePath}: ${error.message}`);
                }
            }
        }
    }

    // 执行命令行程序
    runCommand(command, args, options = {}) {
        return new Promise((resolve) => {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            child.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    stdout: '',
                    stderr: error.message
                });
            });
        });
    }
}

const metadataHandler = new MetadataHandler();
module.exports = metadataHandler;
