/**
 * 网络文件系统适配器
 * 提供统一的网络文件访问接口，支持SMB和WebDAV协议
 */

const path = require('path');
const fs = require('fs');

class NetworkFileAdapter {
    constructor(networkDriveManager) {
        this.networkDriveManager = networkDriveManager;
        // 存储文件路径映射，处理编码不一致问题
        this.filePathMappings = new Map(); // finalName -> { originalPath, baseName }
        console.log('📁 NetworkFileAdapter: 网络文件适配器初始化完成');
    }

    /**
     * 判断路径是否为网络路径
     * @param {string} filePath - 文件路径
     * @returns {boolean} 是否为网络路径
     */
    isNetworkPath(filePath) {
        // 网络路径格式: network://driveId/path/to/file
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        // 严格检查格式：必须以 network:// 开头，且后面有内容
        const isValid = filePath.startsWith('network://') && filePath.length > 10;

        if (!isValid && filePath.startsWith('network:')) {
            console.warn(`⚠️ NetworkFileAdapter: 检测到可能的路径格式错误: ${filePath}`);
            console.warn(`⚠️ NetworkFileAdapter: 正确格式应为: network://driveId/path`);
        }

        return isValid;
    }

    /**
     * 解析网络路径
     * @param {string} networkPath - 网络路径
     * @returns {Object} 解析结果 {driveId, relativePath}
     */
    parseNetworkPath(networkPath) {
        if (!this.isNetworkPath(networkPath)) {
            console.error(`❌ NetworkFileAdapter: 无效的网络路径格式: ${networkPath}`);
            console.error(`❌ NetworkFileAdapter: 期望格式: network://driveId/path`);
            throw new Error(`不是有效的网络路径: ${networkPath}`);
        }

        // 移除 network:// 前缀
        const pathWithoutProtocol = networkPath.substring(10);
        const parts = pathWithoutProtocol.split('/');
        const driveId = parts[0];
        const relativePath = parts.slice(1).join('/');

        console.log(`🔍 NetworkFileAdapter: 解析网络路径 ${networkPath} -> driveId: ${driveId}, relativePath: ${relativePath}`);
        return { driveId, relativePath };
    }

    /**
     * 构建网络路径
     * @param {string} driveId - 磁盘ID
     * @param {string} relativePath - 相对路径
     * @returns {string} 网络路径
     */
    buildNetworkPath(driveId, relativePath) {
        // 确保相对路径以 / 开头
        if (!relativePath.startsWith('/')) {
            relativePath = '/' + relativePath;
        }
        const networkPath = `network://${driveId}${relativePath}`;
        console.log(`🔧 NetworkFileAdapter: 构建网络路径 driveId: ${driveId}, relativePath: ${relativePath} -> ${networkPath}`);
        return networkPath;
    }

    /**
     * 编码WebDAV路径，正确处理中文字符和特殊字符
     * @param {string} filePath - 原始文件路径
     * @returns {string} 编码后的路径
     */
    encodeWebDAVPath(filePath) {
        if (!filePath) {
            return filePath;
        }

        // 分割路径为各个部分，分别编码每个部分
        const pathParts = filePath.split('/');
        const encodedParts = pathParts.map(part => {
            if (part === '') {
                return part; // 保留空字符串（用于开头的斜杠）
            }
            // 使用encodeURIComponent编码每个路径部分
            // 这会正确处理中文字符、空格和其他特殊字符
            return encodeURIComponent(part);
        });

        const encodedPath = encodedParts.join('/');

        // 记录编码过程以便调试
        if (filePath !== encodedPath) {
            console.log(`🔧 NetworkFileAdapter: 路径编码 "${filePath}" -> "${encodedPath}"`);
        }

        return encodedPath;
    }

    /**
     * 解码WebDAV路径
     * @param {string} encodedPath - 编码后的路径
     * @returns {string} 解码后的路径
     */
    decodeWebDAVPath(encodedPath) {
        if (!encodedPath) {
            return encodedPath;
        }

        try {
            // 分割路径为各个部分，分别解码每个部分
            const pathParts = encodedPath.split('/');
            const decodedParts = pathParts.map(part => {
                if (part === '') {
                    return part;
                }
                return decodeURIComponent(part);
            });

            return decodedParts.join('/');
        } catch (error) {
            console.warn(`⚠️ NetworkFileAdapter: 路径解码失败 "${encodedPath}":`, error.message);
            return encodedPath; // 解码失败时返回原路径
        }
    }

    /**
     * 检查路径是否已经被URL编码
     * @param {string} path - 要检查的路径
     * @returns {boolean} 是否已编码
     */
    isPathEncoded(path) {
        if (!path) return false;

        try {
            // 如果路径包含%编码字符，且解码后与原路径不同，则认为已编码
            const decoded = decodeURIComponent(path);
            const hasEncodedChars = path.includes('%') && path !== decoded;

            // 额外检查：如果解码后再编码能得到原路径，则确认已编码
            if (hasEncodedChars) {
                const reencoded = encodeURIComponent(decoded);
                return reencoded === path;
            }

            return false;
        } catch (error) {
            // 解码失败，可能不是有效的编码
            return false;
        }
    }

    /**
     * 存储文件路径映射
     * @param {string} finalName - 最终使用的文件名
     * @param {string} originalPath - WebDAV返回的原始路径
     * @param {string} baseName - 基础文件名
     */
    storeFilePathMapping(finalName, originalPath, baseName) {
        this.filePathMappings.set(finalName, {
            originalPath: originalPath,
            baseName: baseName,
            timestamp: Date.now()
        });

        console.log(`💾 存储路径映射: "${finalName}" -> "${originalPath}"`);
    }

    /**
     * 获取文件的实际WebDAV路径
     * @param {string} fileName - 文件名
     * @returns {string} 实际的WebDAV路径
     */
    getActualWebDAVPath(fileName) {
        const mapping = this.filePathMappings.get(fileName);
        if (mapping) {
            console.log(`🔍 找到路径映射: "${fileName}" -> "${mapping.baseName}"`);
            return mapping.baseName;
        }

        // 如果没有映射，尝试编码
        console.log(`⚠️ 未找到路径映射，使用编码: "${fileName}"`);
        return this.encodeWebDAVPath(fileName);
    }

    /**
     * 为网络文件重新建立路径映射
     * @param {string} networkPath - 网络文件路径
     * @returns {Promise<boolean>} 是否成功建立映射
     */
    async rebuildPathMapping(networkPath) {
        try {
            console.log(`🔄 NetworkFileAdapter: 尝试重建路径映射 "${networkPath}"`);

            const { driveId, relativePath } = this.parseNetworkPath(networkPath);
            const fileName = require('path').basename(relativePath);

            // 获取文件所在目录
            const dirPath = require('path').dirname(relativePath);
            const networkDirPath = this.buildNetworkPath(driveId, dirPath === '.' ? '/' : dirPath);

            console.log(`📁 NetworkFileAdapter: 扫描目录以重建映射 "${networkDirPath}"`);

            // 读取目录内容
            const items = await this.readdir(networkDirPath);

            // 查找目标文件
            for (const item of items) {
                if (item === fileName) {
                    console.log(`✅ NetworkFileAdapter: 找到目标文件，重建映射成功 "${fileName}"`);
                    return true;
                }
            }

            console.log(`❌ NetworkFileAdapter: 在目录中未找到目标文件 "${fileName}"`);
            return false;
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 重建路径映射失败 "${networkPath}":`, error.message);
            return false;
        }
    }

    /**
     * 安全地连接网络路径
     * @param {string} basePath - 基础网络路径
     * @param {string} childPath - 子路径
     * @returns {string} 连接后的网络路径
     */
    joinNetworkPath(basePath, childPath) {
        if (!this.isNetworkPath(basePath)) {
            throw new Error(`基础路径不是有效的网络路径: ${basePath}`);
        }

        // 解析基础路径
        const { driveId, relativePath } = this.parseNetworkPath(basePath);

        // 构建新的相对路径
        let newRelativePath;
        if (relativePath === '' || relativePath === '/') {
            newRelativePath = `/${childPath}`;
        } else {
            newRelativePath = `${relativePath}/${childPath}`;
        }

        // 清理路径中的多余斜杠（但保留协议前缀）
        newRelativePath = newRelativePath.replace(/\/+/g, '/');

        return this.buildNetworkPath(driveId, newRelativePath);
    }

    /**
     * 读取网络文件
     * @param {string} networkPath - 网络文件路径
     * @returns {Promise<Buffer>} 文件内容
     */
    async readFile(networkPath) {
        const { driveId, relativePath } = this.parseNetworkPath(networkPath);
        const driveInfo = this.networkDriveManager.getDriveInfo(driveId);
        
        if (!driveInfo) {
            throw new Error(`网络磁盘 ${driveId} 未挂载`);
        }

        const status = this.networkDriveManager.getDriveStatus(driveId);
        if (!status || !status.connected) {
            throw new Error(`网络磁盘 ${driveId} 未连接`);
        }

        try {
            if (driveInfo.type === 'smb') {
                return await this.readSMBFile(driveInfo.client, relativePath);
            } else if (driveInfo.type === 'webdav') {
                return await this.readWebDAVFile(driveInfo.client, relativePath);
            } else {
                throw new Error(`不支持的网络磁盘类型: ${driveInfo.type}`);
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 读取网络文件失败 ${networkPath}:`, error);
            throw error;
        }
    }

    /**
     * 读取SMB文件
     * @param {SMB2} smbClient - SMB客户端
     * @param {string} filePath - 文件路径
     * @returns {Promise<Buffer>} 文件内容
     */
    async readSMBFile(smbClient, filePath) {
        return new Promise((resolve, reject) => {
            smbClient.readFile(filePath, (err, data) => {
                if (err) {
                    reject(new Error(`SMB文件读取失败: ${err.message}`));
                } else {
                    resolve(data);
                }
            });
        });
    }

    /**
     * 读取WebDAV文件
     * @param {WebDAVClient} webdavClient - WebDAV客户端
     * @param {string} filePath - 文件路径
     * @returns {Promise<Buffer>} 文件内容
     */
    async readWebDAVFile(webdavClient, filePath) {
        try {
            // 使用智能路径解析，避免双重编码
            const actualPath = this.getActualWebDAVPath(filePath);
            console.log(`🌐 NetworkFileAdapter: WebDAV读取文件`);
            console.log(`    请求文件: ${filePath}`);
            console.log(`    实际路径: ${actualPath}`);

            const arrayBuffer = await webdavClient.getFileContents(actualPath, { format: 'binary' });
            console.log(`✅ NetworkFileAdapter: WebDAV文件读取成功，大小: ${arrayBuffer.byteLength} 字节`);
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: WebDAV文件读取失败`);
            console.error(`    文件路径: ${filePath}`);
            console.error(`    错误详情: ${error.message}`);
            console.error(`    错误状态: ${error.status || 'unknown'}`);

            // 如果使用映射路径失败，尝试使用编码路径作为备选方案
            if (this.filePathMappings.has(filePath)) {
                console.log(`🔄 尝试备选方案：使用编码路径`);
                try {
                    const encodedPath = this.encodeWebDAVPath(filePath);
                    console.log(`    备选路径: "${encodedPath}"`);
                    const arrayBuffer = await webdavClient.getFileContents(encodedPath, { format: 'binary' });
                    console.log(`✅ 备选方案成功，大小: ${arrayBuffer.byteLength} 字节`);
                    return Buffer.from(arrayBuffer);
                } catch (fallbackError) {
                    console.error(`❌ 备选方案也失败:`, fallbackError.message);
                }
            }

            throw new Error(`WebDAV文件读取失败: ${error.message}`);
        }
    }

    /**
     * 获取网络文件统计信息
     * @param {string} networkPath - 网络文件路径
     * @returns {Promise<Object>} 文件统计信息
     */
    async stat(networkPath) {
        const { driveId, relativePath } = this.parseNetworkPath(networkPath);
        const driveInfo = this.networkDriveManager.getDriveInfo(driveId);
        
        if (!driveInfo) {
            throw new Error(`网络磁盘 ${driveId} 未挂载`);
        }

        const status = this.networkDriveManager.getDriveStatus(driveId);
        if (!status || !status.connected) {
            throw new Error(`网络磁盘 ${driveId} 未连接`);
        }

        try {
            if (driveInfo.type === 'smb') {
                return await this.statSMBFile(driveInfo.client, relativePath);
            } else if (driveInfo.type === 'webdav') {
                return await this.statWebDAVFile(driveInfo.client, relativePath);
            } else {
                throw new Error(`不支持的网络磁盘类型: ${driveInfo.type}`);
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 获取网络文件信息失败 ${networkPath}:`, error);
            throw error;
        }
    }

    /**
     * 获取SMB文件统计信息
     * @param {SMB2} smbClient - SMB客户端
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 文件统计信息
     */
    async statSMBFile(smbClient, filePath) {
        return new Promise((resolve, reject) => {
            smbClient.stat(filePath, (err, stats) => {
                if (err) {
                    reject(new Error(`SMB文件信息获取失败: ${err.message}`));
                } else {
                    // 转换为类似fs.Stats的格式
                    resolve({
                        size: stats.size || 0,
                        mtime: stats.mtime || new Date(),
                        isDirectory: () => stats.isDirectory || false,
                        isFile: () => !stats.isDirectory
                    });
                }
            });
        });
    }

    /**
     * 获取WebDAV文件统计信息
     * @param {WebDAVClient} webdavClient - WebDAV客户端
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 文件统计信息
     */
    async statWebDAVFile(webdavClient, filePath) {
        try {
            // 使用智能路径解析，避免双重编码
            const actualPath = this.getActualWebDAVPath(filePath);
            console.log(`🔍 NetworkFileAdapter: WebDAV获取文件信息`);
            console.log(`    请求文件: "${filePath}"`);
            console.log(`    实际路径: "${actualPath}"`);

            const stat = await webdavClient.stat(actualPath);
            console.log(`✅ NetworkFileAdapter: WebDAV文件信息获取成功，类型: ${stat.type}, 大小: ${stat.size || 0}`);

            return {
                size: stat.size || 0,
                mtime: stat.lastmod ? new Date(stat.lastmod) : new Date(),
                isDirectory: () => stat.type === 'directory',
                isFile: () => stat.type === 'file'
            };
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: WebDAV文件信息获取失败 "${filePath}":`, error.message);

            // 如果使用映射路径失败，尝试使用编码路径作为备选方案
            if (this.filePathMappings.has(filePath)) {
                console.log(`🔄 尝试备选方案：使用编码路径`);
                try {
                    const encodedPath = this.encodeWebDAVPath(filePath);
                    console.log(`    备选路径: "${encodedPath}"`);
                    const stat = await webdavClient.stat(encodedPath);
                    console.log(`✅ 备选方案成功`);
                    return {
                        size: stat.size || 0,
                        mtime: stat.lastmod ? new Date(stat.lastmod) : new Date(),
                        isDirectory: () => stat.type === 'directory',
                        isFile: () => stat.type === 'file'
                    };
                } catch (fallbackError) {
                    console.error(`❌ 备选方案也失败:`, fallbackError.message);
                }
            }

            throw new Error(`WebDAV文件信息获取失败: ${error.message}`);
        }
    }

    /**
     * 列出网络目录内容
     * @param {string} networkPath - 网络目录路径
     * @returns {Promise<Array>} 目录内容列表
     */
    async readdir(networkPath) {
        const { driveId, relativePath } = this.parseNetworkPath(networkPath);
        const driveInfo = this.networkDriveManager.getDriveInfo(driveId);
        
        if (!driveInfo) {
            throw new Error(`网络磁盘 ${driveId} 未挂载`);
        }

        const status = this.networkDriveManager.getDriveStatus(driveId);
        if (!status || !status.connected) {
            throw new Error(`网络磁盘 ${driveId} 未连接`);
        }

        try {
            if (driveInfo.type === 'smb') {
                return await this.readdirSMB(driveInfo.client, relativePath);
            } else if (driveInfo.type === 'webdav') {
                return await this.readdirWebDAV(driveInfo.client, relativePath);
            } else {
                throw new Error(`不支持的网络磁盘类型: ${driveInfo.type}`);
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 读取网络目录失败 ${networkPath}:`, error);
            throw error;
        }
    }

    /**
     * 列出SMB目录内容
     * @param {SMB2} smbClient - SMB客户端
     * @param {string} dirPath - 目录路径
     * @returns {Promise<Array>} 目录内容列表
     */
    async readdirSMB(smbClient, dirPath) {
        return new Promise((resolve, reject) => {
            smbClient.readdir(dirPath, (err, files) => {
                if (err) {
                    reject(new Error(`SMB目录读取失败: ${err.message}`));
                } else {
                    resolve(files.map(file => file.name || file));
                }
            });
        });
    }

    /**
     * 列出WebDAV目录内容
     * @param {WebDAVClient} webdavClient - WebDAV客户端
     * @param {string} dirPath - 目录路径
     * @returns {Promise<Array>} 目录内容列表
     */
    async readdirWebDAV(webdavClient, dirPath) {
        try {
            const encodedPath = this.encodeWebDAVPath(dirPath);
            console.log(`📁 NetworkFileAdapter: WebDAV读取目录 "${dirPath}"`);
            console.log(`📁 NetworkFileAdapter: 编码后的目录路径 "${encodedPath}"`);

            const contents = await webdavClient.getDirectoryContents(encodedPath);
            console.log(`✅ NetworkFileAdapter: WebDAV目录读取成功，找到 ${contents.length} 个项目`);

            // 详细分析每个文件的编码情况
            const fileNames = contents.map(item => {
                const originalFilename = item.filename;
                const baseName = path.basename(originalFilename);

                console.log(`🔍 分析文件编码:`);
                console.log(`    原始filename: "${originalFilename}"`);
                console.log(`    basename: "${baseName}"`);

                // 检查文件名是否已经被编码
                const isAlreadyEncoded = this.isPathEncoded(baseName);
                console.log(`    是否已编码: ${isAlreadyEncoded}`);

                let finalName;
                if (isAlreadyEncoded) {
                    // 如果已经编码，直接解码
                    finalName = this.decodeWebDAVPath(baseName);
                    console.log(`    解码结果: "${finalName}"`);
                } else {
                    // 如果未编码，直接使用
                    finalName = baseName;
                    console.log(`    直接使用: "${finalName}"`);
                }

                console.log(`📄 最终文件名: "${finalName}" (类型: ${item.type || 'unknown'})`);

                // 存储原始路径信息以供后续使用
                this.storeFilePathMapping(finalName, originalFilename, baseName);

                return finalName;
            });

            return fileNames;
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: WebDAV目录读取失败 "${dirPath}":`, error.message);
            throw new Error(`WebDAV目录读取失败: ${error.message}`);
        }
    }

    /**
     * 检查网络文件是否存在
     * @param {string} networkPath - 网络文件路径
     * @returns {Promise<boolean>} 文件是否存在
     */
    async exists(networkPath) {
        try {
            console.log(`🔍 NetworkFileAdapter: 检查网络文件是否存在 "${networkPath}"`);

            if (!this.isNetworkPath(networkPath)) {
                console.error(`❌ NetworkFileAdapter: 不是有效的网络路径 "${networkPath}"`);
                return false;
            }

            const { driveId, relativePath } = this.parseNetworkPath(networkPath);
            console.log(`🔍 NetworkFileAdapter: 解析路径 driveId="${driveId}", relativePath="${relativePath}"`);

            let driveInfo = this.networkDriveManager.getDriveInfo(driveId);
            if (!driveInfo) {
                console.error(`❌ NetworkFileAdapter: 网络磁盘 ${driveId} 未找到`);

                // 尝试按需重新挂载驱动器
                console.log(`🔄 NetworkFileAdapter: 尝试按需重新挂载驱动器 ${driveId}`);
                const remountSuccess = await this.networkDriveManager.ensureDriveMounted(driveId);

                if (remountSuccess) {
                    driveInfo = this.networkDriveManager.getDriveInfo(driveId);
                    console.log(`✅ NetworkFileAdapter: 驱动器重新挂载成功 ${driveId}`);
                } else {
                    console.error(`❌ NetworkFileAdapter: 驱动器重新挂载失败 ${driveId}`);
                    return false;
                }
            }

            const status = this.networkDriveManager.getDriveStatus(driveId);
            if (!status || !status.connected) {
                console.error(`❌ NetworkFileAdapter: 网络磁盘 ${driveId} 未连接`);
                return false;
            }

            console.log(`🔍 NetworkFileAdapter: 磁盘状态正常，开始检查文件存在性`);

            // 首先尝试使用stat方法检查文件是否存在
            try {
                const stats = await this.stat(networkPath);
                console.log(`✅ NetworkFileAdapter: 网络文件存在 "${networkPath}" (大小: ${stats.size})`);
                return true;
            } catch (statError) {
                console.log(`⚠️ NetworkFileAdapter: stat方法失败，尝试重建路径映射...`);

                // 如果stat失败，可能是路径映射问题，尝试重建
                const rebuildSuccess = await this.rebuildPathMapping(networkPath);
                if (rebuildSuccess) {
                    // 重建成功后再次尝试stat
                    try {
                        const stats = await this.stat(networkPath);
                        console.log(`✅ NetworkFileAdapter: 重建映射后文件存在 "${networkPath}" (大小: ${stats.size})`);
                        return true;
                    } catch (retryError) {
                        console.error(`❌ NetworkFileAdapter: 重建映射后仍然失败:`, retryError.message);
                    }
                }

                // 如果重建也失败，抛出原始错误
                throw statError;
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 网络文件不存在或访问失败 "${networkPath}":`, error.message);

            // 提供更详细的错误信息
            if (error.message.includes('404')) {
                console.error(`    -> 文件未找到 (404错误)`);
            } else if (error.message.includes('网络磁盘') && error.message.includes('未连接')) {
                console.error(`    -> 网络磁盘连接问题`);
            } else if (error.message.includes('不是有效的网络路径')) {
                console.error(`    -> 路径格式错误`);
            } else {
                console.error(`    -> 其他错误: ${error.message}`);
            }

            return false;
        }
    }
}

module.exports = NetworkFileAdapter;
