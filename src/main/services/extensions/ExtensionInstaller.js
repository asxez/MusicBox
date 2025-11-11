/**
 * 扩展安装器 - 处理扩展的安装、卸载等文件操作
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const {app} = require('electron');

/**
 * 内置插件ID列表
 * 这些插件不应该出现在主进程的 extensions.json 注册表中
 * 它们由渲染进程通过扫描 builtin 目录动态注册
 */
const BUILTIN_EXTENSION_IDS = [
    'theme-enhancer',
];

class ExtensionInstaller {
    constructor() {
        // 扩展安装目录
        this.extensionsDir = path.join(app.getPath('userData'), 'extensions');
        // 扩展注册表文件
        this.registryFile = path.join(app.getPath('userData'), 'extensions.json');

        console.log(`📁 ExtensionInstaller: 注册表文件路径: ${this.registryFile}`);

        // 确保目录存在
        this._ensureDirectories();

        // 🔧 清理注册表中错误的内置插件记录
        this._cleanupBuiltinExtensionsFromRegistry();
    }

    /**
     * 确保必要的目录存在
     */
    _ensureDirectories() {
        if (!fs.existsSync(this.extensionsDir)) {
            fs.mkdirSync(this.extensionsDir, {recursive: true});
            console.log('✅ ExtensionInstaller: 创建扩展目录', this.extensionsDir);
        }
    }

    /**
     * 从 ZIP 文件安装扩展
     * @param {string} zipFilePath - ZIP 文件路径
     * @returns {Promise<Object>} 安装的扩展信息
     */
    async installFromZip(zipFilePath) {
        console.log('📦 ExtensionInstaller: 开始安装扩展', zipFilePath);

        try {
            // 1. 读取 ZIP 文件
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();

            // 2. 查找并读取 manifest.json
            const manifestEntry = zipEntries.find(entry =>
                entry.entryName === 'manifest.json' ||
                entry.entryName.endsWith('/manifest.json')
            );

            if (!manifestEntry) {
                throw new Error('ZIP 文件中未找到 manifest.json');
            }

            const manifestContent = manifestEntry.getData().toString('utf8');
            const manifest = JSON.parse(manifestContent);

            // 3. 验证 manifest
            this._validateManifest(manifest);

            // 4. 检查是否已安装
            const registry = this._loadRegistry();
            if (registry.extensions[manifest.id]) {
                throw new Error(`扩展 ${manifest.id} 已安装，请先卸载旧版本`);
            }

            // 5. 创建扩展目录
            const extensionDir = path.join(this.extensionsDir, manifest.id);
            if (fs.existsSync(extensionDir)) {
                // 清理旧文件
                this._removeDirectory(extensionDir);
            }
            fs.mkdirSync(extensionDir, {recursive: true});

            // 6. 解压文件（防止路径遍历攻击）
            for (const entry of zipEntries) {
                const entryPath = entry.entryName;

                // 安全检查：防止路径遍历
                if (entryPath.includes('..') || path.isAbsolute(entryPath)) {
                    console.warn('⚠️ ExtensionInstaller: 跳过不安全的路径', entryPath);
                    continue;
                }

                const targetPath = path.join(extensionDir, entryPath);

                if (entry.isDirectory) {
                    if (!fs.existsSync(targetPath)) {
                        fs.mkdirSync(targetPath, {recursive: true});
                    }
                } else {
                    // 确保父目录存在
                    const parentDir = path.dirname(targetPath);
                    if (!fs.existsSync(parentDir)) {
                        fs.mkdirSync(parentDir, {recursive: true});
                    }

                    // 写入文件
                    fs.writeFileSync(targetPath, entry.getData());
                }
            }

            // 7. 更新注册表
            // 计算相对于 public 目录的扩展位置（用于前端加载）
            // extensionDir 是绝对路径，需要转换为相对于 userData 的路径
            const userDataPath = app.getPath('userData');
            const relativePath = path.relative(userDataPath, extensionDir).replace(/\\/g, '/');

            const extensionInfo = {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                author: manifest.author,
                main: manifest.main,
                extensionLocation: `userData://extensions/${manifest.id}`,  // 使用自定义协议标识
                activationEvents: manifest.activationEvents || [],
                contributes: manifest.contributes || {},
                enabled: true,
                isBuiltin: false,
                installPath: extensionDir,
                installedAt: new Date().toISOString()
            };

            registry.extensions[manifest.id] = extensionInfo;
            this._saveRegistry(registry);

            console.log('✅ ExtensionInstaller: 扩展安装成功', manifest.id);
            return extensionInfo;

        } catch (error) {
            console.error('❌ ExtensionInstaller: 安装失败', error);
            throw error;
        }
    }

    /**
     * 卸载扩展
     * @param {string} extensionId - 扩展 ID
     * @param {boolean} keepData - 是否保留数据
     * @returns {Promise<boolean>}
     */
    async uninstall(extensionId, keepData = false) {
        console.log('🗑️ ExtensionInstaller: 开始卸载扩展', extensionId);

        try {
            const registry = this._loadRegistry();
            const extensionInfo = registry.extensions[extensionId];

            if (!extensionInfo) {
                throw new Error(`扩展 ${extensionId} 未安装`);
            }

            if (extensionInfo.isBuiltin) {
                throw new Error(`内置扩展 ${extensionId} 不能卸载`);
            }

            // 1. 删除扩展文件
            const extensionDir = path.join(this.extensionsDir, extensionId);
            if (fs.existsSync(extensionDir)) {
                this._removeDirectory(extensionDir);
                console.log('✅ ExtensionInstaller: 已删除扩展文件', extensionDir);
            }

            // 2. 从注册表中移除
            delete registry.extensions[extensionId];
            this._saveRegistry(registry);

            console.log('✅ ExtensionInstaller: 扩展卸载成功', extensionId);
            return true;

        } catch (error) {
            console.error('❌ ExtensionInstaller: 卸载失败', error);
            throw error;
        }
    }

    /**
     * 启用扩展
     * @param {string} extensionId
     */
    async enableExtension(extensionId) {
        console.log('📝 ExtensionInstaller: 启用扩展', extensionId);

        const registry = this._loadRegistry();
        const extensionInfo = registry.extensions[extensionId];

        if (!extensionInfo) {
            throw new Error(`扩展 ${extensionId} 未安装`);
        }

        console.log(`   修改前: enabled=${extensionInfo.enabled}`);
        extensionInfo.enabled = true;
        this._saveRegistry(registry);
        console.log(`   修改后: enabled=${extensionInfo.enabled}`);
        console.log(`   注册表已保存到: ${this.registryFile}`);

        console.log('✅ ExtensionInstaller: 扩展已启用', extensionId);
        return true;
    }

    /**
     * 禁用扩展
     * @param {string} extensionId
     */
    async disableExtension(extensionId) {
        console.log('📝 ExtensionInstaller: 禁用扩展', extensionId);

        const registry = this._loadRegistry();
        const extensionInfo = registry.extensions[extensionId];

        if (!extensionInfo) {
            throw new Error(`扩展 ${extensionId} 未安装`);
        }

        console.log(`   修改前: enabled=${extensionInfo.enabled}, canDisable=${extensionInfo.canDisable}`);

        // 检查是否允许禁用：内置扩展需要检查 canDisable 属性
        if (extensionInfo.isBuiltin && !extensionInfo.canDisable) {
            throw new Error(`该内置扩展 ${extensionId} 不允许被禁用`);
        }

        extensionInfo.enabled = false;
        this._saveRegistry(registry);
        console.log(`   修改后: enabled=${extensionInfo.enabled}`);
        console.log(`   注册表已保存到: ${this.registryFile}`);

        console.log('✅ ExtensionInstaller: 扩展已禁用', extensionId);
        return true;
    }

    /**
     * 获取所有已安装的扩展
     * 注意：只返回外部插件，不返回内置插件
     */
    getInstalledExtensions() {
        const registry = this._loadRegistry();
        const allExtensions = Object.values(registry.extensions);

        // 🔑 关键修复：双重过滤确保内置插件不被返回
        // 1. 检查 isBuiltin 字段
        // 2. 检查 ID 是否在内置插件列表中（防御性检查）
        const externalExtensions = allExtensions.filter(ext => {
            const isBuiltinByFlag = ext.isBuiltin === true;
            const isBuiltinById = BUILTIN_EXTENSION_IDS.includes(ext.id);

            if (isBuiltinByFlag || isBuiltinById) {
                if (isBuiltinById && !isBuiltinByFlag) {
                    console.warn(`⚠️ ExtensionInstaller: 检测到内置插件 ${ext.id} 被错误标记为 isBuiltin=${ext.isBuiltin}`);
                }
                return false;  // 过滤掉内置插件
            }

            return true;  // 保留外部插件
        });

        console.log(`📋 ExtensionInstaller.getInstalledExtensions: 总数=${allExtensions.length}, 外部插件=${externalExtensions.length}`);
        allExtensions.forEach(ext => {
            const isBuiltinById = BUILTIN_EXTENSION_IDS.includes(ext.id);
            console.log(`   - ${ext.id}: isBuiltin=${ext.isBuiltin || false}, 在内置列表=${isBuiltinById}`);
        });

        return externalExtensions;
    }

    /**
     * 扫描用户扩展目录
     */
    scanUserExtensions() {
        const extensions = [];

        if (!fs.existsSync(this.extensionsDir)) {
            return extensions;
        }

        const entries = fs.readdirSync(this.extensionsDir, {withFileTypes: true});

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const extensionDir = path.join(this.extensionsDir, entry.name);
            const manifestPath = path.join(extensionDir, 'manifest.json');

            if (fs.existsSync(manifestPath)) {
                try {
                    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
                    const manifest = JSON.parse(manifestContent);

                    extensions.push({
                        ...manifest,
                        installPath: extensionDir,
                        isBuiltin: false
                    });
                } catch (error) {
                    console.error(`❌ ExtensionInstaller: 读取扩展清单失败 ${entry.name}:`, error);
                }
            }
        }

        return extensions;
    }

    /**
     * 验证 manifest.json
     */
    _validateManifest(manifest) {
        const requiredFields = ['id', 'name', 'version', 'main'];

        for (const field of requiredFields) {
            if (!manifest[field]) {
                throw new Error(`manifest.json 缺少必需字段: ${field}`);
            }
        }

        // 验证 ID 格式（只允许字母、数字、连字符、下划线）
        if (!/^[a-z0-9-_]+$/i.test(manifest.id)) {
            throw new Error('扩展 ID 格式无效，只允许字母、数字、连字符和下划线');
        }

        return true;
    }

    /**
     * 加载注册表
     */
    _loadRegistry() {
        if (!fs.existsSync(this.registryFile)) {
            return {extensions: {}};
        }

        try {
            const content = fs.readFileSync(this.registryFile, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('❌ ExtensionInstaller: 读取注册表失败', error);
            return {extensions: {}};
        }
    }

    /**
     * 保存注册表
     */
    _saveRegistry(registry) {
        try {
            fs.writeFileSync(this.registryFile, JSON.stringify(registry, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ ExtensionInstaller: 保存注册表失败', error);
            throw error;
        }
    }

    /**
     * 递归删除目录
     */
    _removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this._removeDirectory(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * 清理注册表中错误的内置插件记录
     * 在启动时自动执行，修复历史遗留的错误数据
     */
    _cleanupBuiltinExtensionsFromRegistry() {
        try {
            console.log('🧹 ExtensionInstaller: 检查并清理注册表中的内置插件记录');

            const registry = this._loadRegistry();
            const allExtensions = Object.values(registry.extensions);
            let cleanedCount = 0;

            // 检查每个扩展
            allExtensions.forEach(ext => {
                if (BUILTIN_EXTENSION_IDS.includes(ext.id)) {
                    console.warn(`⚠️ ExtensionInstaller: 发现内置插件 ${ext.id} 在注册表中 (isBuiltin=${ext.isBuiltin})`);
                    console.warn(`   正在从注册表中删除...`);
                    delete registry.extensions[ext.id];
                    cleanedCount++;
                }
            });

            if (cleanedCount > 0) {
                this._saveRegistry(registry);
                console.log(`✅ ExtensionInstaller: 已清理 ${cleanedCount} 个内置插件记录`);
            } else {
                console.log(`✅ ExtensionInstaller: 注册表中没有内置插件记录，无需清理`);
            }

            // 输出清理后的注册表状态
            const remainingExtensions = Object.values(registry.extensions);
            console.log(`📋 ExtensionInstaller: 清理后的注册表状态:`);
            console.log(`   总扩展数: ${remainingExtensions.length}`);
            remainingExtensions.forEach(ext => {
                console.log(`   - ${ext.id}: isBuiltin=${ext.isBuiltin || false}`);
            });

        } catch (error) {
            console.error('❌ ExtensionInstaller: 清理注册表失败:', error);
        }
    }

    /**
     * 读取扩展文件内容
     * @param {string} extensionId - 扩展ID
     * @param {string} filePath - 文件相对路径（相对于扩展目录）
     * @returns {Promise<string>} 文件内容
     */
    async readExtensionFile(extensionId, filePath) {
        const registry = this._loadRegistry();
        const extensionInfo = registry.extensions[extensionId];

        if (!extensionInfo) {
            throw new Error(`扩展 ${extensionId} 未安装`);
        }

        const fullPath = path.join(extensionInfo.installPath, filePath);

        // 安全检查：确保文件路径在扩展目录内
        const normalizedPath = path.normalize(fullPath);
        const normalizedInstallPath = path.normalize(extensionInfo.installPath);
        if (!normalizedPath.startsWith(normalizedInstallPath)) {
            throw new Error(`非法的文件路径: ${filePath}`);
        }

        if (!fs.existsSync(fullPath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        console.log(`✅ ExtensionInstaller: 读取扩展文件 ${extensionId}/${filePath}, 大小: ${content.length} 字节`);

        return content;
    }
}

module.exports = ExtensionInstaller;
