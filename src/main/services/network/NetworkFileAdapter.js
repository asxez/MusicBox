// 网络文件系统适配器

class NetworkFileAdapter {
    constructor(networkDriveManager) {
        this.networkDriveManager = networkDriveManager;
        this.filePathMappings = new Map();
    }

    isNetworkPath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        const isValid = filePath.startsWith('network://') && filePath.length > 10;
        if (!isValid && filePath.startsWith('network:')) {
            console.warn(`路径格式错误: ${filePath}, 正确格式: network://driveId/path`);
        }

        return isValid;
    }

    // 解析网络路径
    parseNetworkPath(networkPath) {
        if (!this.isNetworkPath(networkPath)) {
            console.error(`❌ NetworkFileAdapter: 无效的网络路径格式: ${networkPath}`);
            console.error(`❌ NetworkFileAdapter: 期望格式: network://driveId/path`);
            throw new Error(`不是有效的网络路径: ${networkPath}`);
        }

        // 移除 network:// 前缀
        const pathWithoutProtocol = networkPath.substring(10);
        const firstSlashIndex = pathWithoutProtocol.indexOf('/');

        if (firstSlashIndex === -1) {
            return {driveId: pathWithoutProtocol, relativePath: '/'};
        }

        const driveId = pathWithoutProtocol.substring(0, firstSlashIndex);
        const relativePath = pathWithoutProtocol.substring(firstSlashIndex);
        return {driveId, relativePath};
    }

    // 构建网络路径
    buildNetworkPath(driveId, relativePath) {
        // 确保相对路径以 / 开头
        if (!relativePath.startsWith('/')) {
            relativePath = '/' + relativePath;
        }
        return `network://${driveId}${relativePath}`;
    }

    // 编码WebDAV路径
    encodeWebDAVPath(filePath) {
        if (!filePath) {
            return filePath;
        }

        // 分割路径为各个部分，分别编码每个部分
        const pathParts = filePath.split('/');
        const encodedParts = pathParts.map(part => {
            if (part === '') {
                return part; // 保留空字符串
            }
            return encodeURIComponent(part);
        });
        return encodedParts.join('/');
    }

    // 解码WebDAV路径
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

    // 检查路径是否已经被URL编码
    isPathEncoded(path) {
        if (!path) return false;

        try {
            // 如果路径包含%编码字符，且解码后与原路径不同，则认为已编码
            const decoded = decodeURIComponent(path);
            const hasEncodedChars = path.includes('%') && path !== decoded;

            // 如果解码后再编码能得到原路径，则确认已编码
            if (hasEncodedChars) {
                const reencoded = encodeURIComponent(decoded);
                return reencoded === path;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    // 存储文件路径映射
    storeFilePathMapping(finalName, originalPath, baseName) {
        this.filePathMappings.set(finalName, {
            originalPath: originalPath,
            baseName: baseName,
            timestamp: Date.now()
        });
    }

    // 获取文件的实际WebDAV路径
    getActualWebDAVPath(filePath) {
        const path = require('path');
        const fileName = path.basename(filePath);
        const mapping = this.filePathMappings.get(fileName);
        if (mapping) {
            const dirPath = path.dirname(filePath);
            if (dirPath === '.' || dirPath === '/') {
                return mapping.baseName;
            }
            const encodedDir = this.encodeWebDAVPath(dirPath);
            return `${encodedDir}/${mapping.baseName}`;
        }
        return this.encodeWebDAVPath(filePath);
    }

    // 为网络文件重新建立路径映射
    async rebuildPathMapping(networkPath) {
        try {
            const {driveId, relativePath} = this.parseNetworkPath(networkPath);
            const fileName = require('path').basename(relativePath);
            const dirPath = require('path').dirname(relativePath);
            const networkDirPath = this.buildNetworkPath(driveId, dirPath === '.' ? '/' : dirPath);
            const items = await this.readdir(networkDirPath);
            for (const item of items) {
                if (item === fileName) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 重建路径映射失败 "${networkPath}":`, error.message);
            return false;
        }
    }

    // 安全地连接网络路径
    joinNetworkPath(basePath, childPath) {
        if (!this.isNetworkPath(basePath)) {
            throw new Error(`基础路径不是有效的网络路径: ${basePath}`);
        }

        // 解析基础路径
        const {driveId, relativePath} = this.parseNetworkPath(basePath);

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

    async readFile(networkPath) {
        const {driveId, relativePath} = this.parseNetworkPath(networkPath);
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
            const actualPath = this.getActualWebDAVPath(filePath);
            try {
                const arrayBuffer = await webdavClient.getFileContents(actualPath, {format: 'binary'});
                // console.log(`✅ NetworkFileAdapter: WebDAV文件读取成功（使用actualPath），大小: ${arrayBuffer.byteLength} 字节`);
                return Buffer.from(arrayBuffer);
            } catch (actualPathError) {
                const arrayBuffer = await webdavClient.getFileContents(filePath, {format: 'binary'});
                // console.log(`✅ NetworkFileAdapter: WebDAV文件读取成功（使用原始路径），大小: ${arrayBuffer.byteLength} 字节`);
                return Buffer.from(arrayBuffer);
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: WebDAV文件读取失败`);
            console.error(`    文件路径: ${filePath}`);
            console.error(`    错误详情: ${error.message}`);
            console.error(`    错误状态: ${error.status || 'unknown'}`);
            throw new Error(`WebDAV文件读取失败: ${error.message}`);
        }
    }

    // 获取网络文件统计信息
    async stat(networkPath) {
        const {driveId, relativePath} = this.parseNetworkPath(networkPath);
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
            const actualPath = this.getActualWebDAVPath(filePath);
            try {
                const stat = await webdavClient.stat(actualPath);
                // console.log(`✅ NetworkFileAdapter: WebDAV文件信息获取成功（使用actualPath），类型: ${stat.type}, 大小: ${stat.size || 0}`);
                return {
                    size: stat.size || 0,
                    mtime: stat.lastmod ? new Date(stat.lastmod) : new Date(),
                    isDirectory: () => stat.type === 'directory',
                    isFile: () => stat.type === 'file'
                };
            } catch (actualPathError) {
                const stat = await webdavClient.stat(filePath);
                // console.log(`✅ NetworkFileAdapter: WebDAV文件信息获取成功（使用原始路径），类型: ${stat.type}, 大小: ${stat.size || 0}`);
                return {
                    size: stat.size || 0,
                    mtime: stat.lastmod ? new Date(stat.lastmod) : new Date(),
                    isDirectory: () => stat.type === 'directory',
                    isFile: () => stat.type === 'file'
                };
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: WebDAV文件信息获取失败 "${filePath}":`, error.message);
            throw new Error(`WebDAV文件信息获取失败: ${error.message}`);
        }
    }

    // 列出网络目录内容
    async readdir(networkPath) {
        const {driveId, relativePath} = this.parseNetworkPath(networkPath);
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
        const path = require('path');
        let contents;
        let usedPath;

        try {
            const encodedPath = this.encodeWebDAVPath(dirPath);
            console.log(`    编码后路径: "${encodedPath}"`);

            try {
                contents = await webdavClient.getDirectoryContents(encodedPath);
                usedPath = encodedPath;
                console.log(`    ✅ 使用编码路径成功，共 ${contents.length} 项`);
            } catch (encodedError) {
                console.log(`    ⚠️ 编码路径失败: ${encodedError.message}`);
                console.log(`    🔄 尝试使用原始路径...`);
                contents = await webdavClient.getDirectoryContents(dirPath);
                usedPath = dirPath;
                console.log(`    ✅ 使用原始路径成功，共 ${contents.length} 项`);
            }

            // 详细分析每个文件的编码情况
            const fileNames = contents.map(item => {
                const originalFilename = item.filename;
                const baseName = path.basename(originalFilename);

                // 检查文件名是否已经被编码
                const isAlreadyEncoded = this.isPathEncoded(baseName);

                let finalName;
                if (isAlreadyEncoded) {
                    // 如果已经编码，直接解码
                    finalName = this.decodeWebDAVPath(baseName);
                } else {
                    // 如果未编码，直接使用
                    finalName = baseName;
                }

                // 存储原始路径信息以供后续使用
                this.storeFilePathMapping(finalName, originalFilename, baseName);
                return finalName;
            });
            return fileNames;
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: WebDAV目录读取失败 "${dirPath}":`, error.message);
            console.error(`    错误详情:`, error);
            throw new Error(`WebDAV目录读取失败: ${error.message}`);
        }
    }

    // 检查网络文件是否存在
    async exists(networkPath) {
        try {
            if (!this.isNetworkPath(networkPath)) {
                console.error(`❌ NetworkFileAdapter: 不是有效的网络路径 "${networkPath}"`);
                return false;
            }

            const {driveId, relativePath} = this.parseNetworkPath(networkPath);
            // console.log(`🔍 NetworkFileAdapter: 解析路径 driveId="${driveId}", relativePath="${relativePath}"`);

            let driveInfo = this.networkDriveManager.getDriveInfo(driveId);
            if (!driveInfo) {
                console.error(`❌ NetworkFileAdapter: 网络磁盘 ${driveId} 未找到`);

                // 尝试按需重新挂载驱动器
                console.log(`🔄 NetworkFileAdapter: 尝试按需重新挂载驱动器 ${driveId}`);
                const remountSuccess = await this.networkDriveManager.ensureDriveMounted(driveId);
                if (remountSuccess) {
                    driveInfo = this.networkDriveManager.getDriveInfo(driveId);
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

            // 首先尝试使用stat方法检查文件是否存在
            try {
                const stats = await this.stat(networkPath);
                return true;
            } catch (statError) {
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

    // 写入网络文件
    async writeFile(networkPath, buffer) {
        if (!networkPath || typeof networkPath !== 'string') {
            throw new Error('网络文件路径无效');
        }

        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error('文件内容必须是Buffer类型');
        }

        const {driveId, relativePath} = this.parseNetworkPath(networkPath);
        const driveInfo = this.networkDriveManager.getDriveInfo(driveId);

        if (!driveInfo) {
            throw new Error(`网络磁盘 ${driveId} 未挂载`);
        }

        const status = this.networkDriveManager.getDriveStatus(driveId);
        if (!status || !status.connected) {
            throw new Error(`网络磁盘 ${driveId} 未连接`);
        }

        // 检查文件是否存在
        const fileExists = await this.exists(networkPath);
        if (!fileExists) {
            console.warn(`⚠️ NetworkFileAdapter: 目标文件不存在，将创建新文件: ${networkPath}`);
        }

        try {
            if (driveInfo.type === 'smb') {
                return await this.writeSMBFile(driveInfo.client, relativePath, buffer);
            } else if (driveInfo.type === 'webdav') {
                return await this.writeWebDAVFile(driveInfo.client, relativePath, buffer);
            } else {
                throw new Error(`不支持的网络磁盘类型: ${driveInfo.type}`);
            }
        } catch (error) {
            console.error(`❌ NetworkFileAdapter: 写入网络文件失败 ${networkPath}:`, error);
            throw error;
        }
    }

    /**
     * 写入SMB文件
     * @param {SMB2} smbClient - SMB客户端
     * @param {string} filePath - 文件路径
     * @param {Buffer} buffer - 文件内容
     * @returns {Promise<boolean>} 写入是否成功
     */
    async writeSMBFile(smbClient, filePath, buffer) {
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await new Promise((resolve, reject) => {
                    smbClient.writeFile(filePath, buffer, (err) => {
                        if (err) {
                            console.error(`❌ NetworkFileAdapter: SMB文件写入失败 "${filePath}" (尝试 ${attempt}):`, err.message);
                            reject(new Error(`SMB文件写入失败: ${err.message}`));
                        } else {
                            console.log(`✅ NetworkFileAdapter: SMB文件写入成功 "${filePath}" (尝试 ${attempt})`);
                            resolve(true);
                        }
                    });
                });
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    console.log(`🔄 SMB写入失败，等待重试... (${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
                }
            }
        }

        throw new Error(`SMB文件写入失败，已重试${maxRetries}次: ${lastError.message}`);
    }

    /**
     * 写入WebDAV文件
     * @param {WebDAVClient} webdavClient - WebDAV客户端
     * @param {string} filePath - 文件路径
     * @param {Buffer} buffer - 文件内容
     * @returns {Promise<boolean>} 写入是否成功
     */
    async writeWebDAVFile(webdavClient, filePath, buffer) {
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const actualPath = this.getActualWebDAVPath(filePath);
                await webdavClient.putFileContents(actualPath, buffer, {overwrite: true});
                console.log(`✅ NetworkFileAdapter: WebDAV文件写入成功 (尝试 ${attempt})`);
                return true;
            } catch (error) {
                lastError = error;
                console.error(`❌ NetworkFileAdapter: WebDAV文件写入失败 (尝试 ${attempt})`);
                console.error(`    文件路径: ${filePath}`);
                console.error(`    错误详情: ${error.message}`);
                console.error(`    错误状态: ${error.status || 'unknown'}`);

                if (this.filePathMappings.has(filePath) && attempt === 1) {
                    try {
                        const encodedPath = this.encodeWebDAVPath(filePath);
                        await webdavClient.putFileContents(encodedPath, buffer, {overwrite: true});
                        return true;
                    } catch (fallbackError) {
                        console.error(`❌ 备选方案也失败:`, fallbackError.message);
                        lastError = fallbackError;
                    }
                }
                if (attempt < maxRetries) {
                    console.log(`🔄 WebDAV写入失败，等待重试... (${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
                }
            }
        }

        throw new Error(`WebDAV文件写入失败，已重试${maxRetries}次: ${lastError.message}`);
    }
}

module.exports = NetworkFileAdapter;
