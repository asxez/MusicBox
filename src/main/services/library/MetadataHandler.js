// 音频元数据处理器

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const {spawn} = require('child_process');
const {app} = require('electron');

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
        this.useExecutable = false; // 标记是否使用打包后的可执行文件

        // 根据环境确定可执行文件路径
        this.executablePath = this.getExecutablePath();
    }

    // 获取可执行文件路径 - 适配开发和生产环境
    getExecutablePath() {
        const executableName = os.platform() === 'win32' ? 'metadata_editor.exe' : 'metadata_editor';

        // 检查是否在打包环境中
        if (app && app.isPackaged) {
            // 生产环境：尝试多个可能的路径
            const possiblePaths = [
                // extraResources目录（推荐）
                path.join(process.resourcesPath, executableName),
                // app.asar.unpacked目录（备用）
                path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'main', executableName),
                // 应用目录（备用）
                path.join(path.dirname(process.execPath), 'resources', executableName),
            ];

            for (const executablePath of possiblePaths) {
                console.log(`🔧 检查生产环境路径: ${executablePath}`);
                if (fs.existsSync(executablePath)) {
                    console.log(`✅ 找到可执行文件: ${executablePath}`);
                    return executablePath;
                }
            }

            // 如果都没找到，返回第一个路径
            console.log(`⚠️ 未找到可执行文件，使用默认路径: ${possiblePaths[0]}`);
            return possiblePaths[0];
        } else {
            // 开发环境：可执行文件在src/main目录中
            const executablePath = path.join(__dirname, executableName);
            console.log(`🔧 开发环境可执行文件路径: ${executablePath}`);
            return executablePath;
        }
    }


    async initialize() {
        if (this.initialized) {
            return true;
        }

        console.log('🔧 初始化元数据处理器...');
        console.log(`🔧 运行环境: ${app && app.isPackaged ? '生产环境' : '开发环境'}`);
        console.log(`🔧 可执行文件路径: ${this.executablePath}`);

        try {
            // 首先检查是否存在打包后的可执行文件
            if (fs.existsSync(this.executablePath)) {
                console.log(`✅ 找到打包后的可执行文件: ${this.executablePath}`);

                // 检查文件权限和大小
                const stats = fs.statSync(this.executablePath);
                console.log(`📊 可执行文件信息: 大小=${(stats.size / 1024 / 1024).toFixed(2)}MB, 可执行=${!!(stats.mode & parseInt('111', 8))}`);

                // 测试可执行文件是否正常工作
                const testResult = await this.testExecutable();
                if (testResult) {
                    this.useExecutable = true;
                    console.log('✅ 将使用打包后的可执行文件处理元数据');
                    this.initialized = true;
                    return true;
                } else {
                    console.log('⚠️ 可执行文件测试失败，回退到Python脚本模式');
                }
            } else {
                console.log(`❌ 可执行文件不存在: ${this.executablePath}`);

                // 在生产环境中，如果可执行文件不存在，这是一个严重问题
                if (app && app.isPackaged) {
                    console.error('❌ 生产环境中缺少可执行文件，这可能导致功能不可用');
                    // 列出资源目录内容以便调试
                    try {
                        const resourcesPath = process.resourcesPath;
                        console.log(`📁 资源目录: ${resourcesPath}`);
                        const resourceFiles = fs.readdirSync(resourcesPath);
                        console.log(`📁 资源目录内容: ${resourceFiles.join(', ')}`);
                    } catch (error) {
                        console.error('❌ 无法读取资源目录:', error.message);
                    }
                }
            }

            // 如果没有可执行文件或测试失败，检测Python环境
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
            } catch (error) {
            }
        }

        return null;
    }

    // 测试打包后的可执行文件
    async testExecutable() {
        console.log(`🧪 测试可执行文件: ${this.executablePath}`);

        try {
            const result = await this.runCommand(this.executablePath, ['--help']);
            if (result.success) {
                // 检查输出是否包含预期内容
                const hasExpectedContent = result.stdout.includes('音频元数据编辑器') ||
                    result.stdout.includes('metadata_editor') ||
                    result.stdout.includes('file_path');

                if (hasExpectedContent) {
                    return true;
                } else {
                    console.log('⚠️ 可执行文件输出格式不符合预期');
                    console.log(`📝 实际输出: ${result.stdout.substring(0, 200)}...`);
                    return false;
                }
            } else {
                console.error(`❌ 可执行文件执行失败: ${result.stderr}`);
                return false;
            }
        } catch (error) {
            console.error('❌ 测试可执行文件异常:', error.message);
            return false;
        }
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
        // 检查是否有可用的处理方式
        if (!this.useExecutable && !this.pythonPath) {
            return {
                success: false,
                error: 'Python环境和可执行文件都不可用',
                errorType: 'no_processor_available'
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

            // 根据可用的处理方式选择执行命令
            let result;
            if (this.useExecutable) {
                // 使用打包后的可执行文件
                result = await this.runCommand(this.executablePath, [
                    filePath,
                    '--metadata-file',
                    tempMetadataFile
                ]);
            } else {
                // 使用Python脚本
                result = await this.runCommand(this.pythonPath, [
                    this.scriptPath,
                    filePath,
                    '--metadata-file',
                    tempMetadataFile
                ]);
            }
            if (result.success) {
                try {
                    const response = JSON.parse(result.stdout);
                    return {
                        success: response.success,
                        message: response.message || '元数据更新完成',
                        error: response.error,
                        method: this.useExecutable ? 'Executable Mutagen' : 'Python Mutagen'
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
                    error: `${this.useExecutable ? '可执行文件' : 'Python脚本'}执行失败: ${result.stderr}`,
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
