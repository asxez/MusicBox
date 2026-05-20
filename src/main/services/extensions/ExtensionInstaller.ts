/**
 * 扩展安装器 - 处理扩展的安装、卸载等文件操作
 */

import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';
import {isSafePath} from '../../utils/pathSecurity';

export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    main: string;
    activationEvents?: string[];
    contributes?: Record<string, any>;
}

export interface ExtensionInfo extends ExtensionManifest {
    extensionLocation: string;
    enabled: boolean;
    isBuiltin: boolean;
    installPath: string;
    installedAt: string;
}

interface ExtensionRegistry {
    extensions: Record<string, ExtensionInfo>;
}

type BuiltinExtensionIndexEntry = string | { path?: string };

interface BuiltinExtensionIndex {
    extensions?: BuiltinExtensionIndexEntry[];
}

export class ExtensionInstaller {
    private extensionsDir: string;
    private registryFile: string;
    private builtinExtensionIds: Set<string> | null = null;

    constructor() {
        this.extensionsDir = path.join(app.getPath('userData'), 'extensions');
        this.registryFile = path.join(app.getPath('userData'), 'extensions.json');
        console.log(`📁 ExtensionInstaller: 注册表文件路径: ${this.registryFile}`);
        this._ensureDirectories();
        this._cleanupBuiltinExtensionsFromRegistry();
    }

    private _ensureDirectories(): void {
        if (!fs.existsSync(this.extensionsDir)) {
            fs.mkdirSync(this.extensionsDir, {recursive: true});
            console.log('✅ ExtensionInstaller: 创建扩展目录', this.extensionsDir);
        }
    }

    async installFromZip(zipFilePath: string): Promise<ExtensionInfo> {
        const AdmZip = require('adm-zip');
        console.log('📦 ExtensionInstaller: 开始安装扩展', zipFilePath);

        try {
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();

            const manifestEntry = zipEntries.find((e: any) =>
                e.entryName === 'manifest.json' || e.entryName.endsWith('/manifest.json')
            );
            if (!manifestEntry) throw new Error('ZIP 文件中未找到 manifest.json');

            const manifest: ExtensionManifest = JSON.parse(manifestEntry.getData().toString('utf8'));
            this._validateManifest(manifest);

            if (this._isBuiltinExtensionId(manifest.id)) {
                throw new Error(`扩展 ${manifest.id} 是内置扩展，不能作为外部扩展安装`);
            }

            const registry = this._loadRegistry();
            if (registry.extensions[manifest.id]) {
                await this.uninstall(manifest.id);
            }

            const extensionDir = path.join(this.extensionsDir, manifest.id);
            if (!fs.existsSync(extensionDir)) fs.mkdirSync(extensionDir, {recursive: true});

            const prefix = manifestEntry.entryName === 'manifest.json' ? '' : manifestEntry.entryName.replace('manifest.json', '');

            for (const entry of zipEntries) {
                const relativeName = prefix ? entry.entryName.replace(prefix, '') : entry.entryName;
                if (!relativeName) continue;
                const targetPath = path.join(extensionDir, relativeName);
                if (!isSafePath(targetPath, [extensionDir])) {
                    throw new Error(`ZIP 条目路径非法: ${relativeName}`);
                }

                if (entry.isDirectory) {
                    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, {recursive: true});
                } else {
                    const parentDir = path.dirname(targetPath);
                    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, {recursive: true});
                    fs.writeFileSync(targetPath, entry.getData());
                }
            }

            const extensionInfo: ExtensionInfo = {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                author: manifest.author,
                main: this._normalizeManifestMain(manifest.main, manifest.id, prefix),
                extensionLocation: `userData://extensions/${manifest.id}`,
                activationEvents: manifest.activationEvents || [],
                contributes: manifest.contributes || {},
                enabled: true,
                isBuiltin: false,
                installPath: extensionDir,
                installedAt: new Date().toISOString()
            };

            const updatedRegistry = this._loadRegistry();
            updatedRegistry.extensions[manifest.id] = extensionInfo;
            this._saveRegistry(updatedRegistry);

            console.log('✅ ExtensionInstaller: 扩展安装成功', manifest.id);
            return extensionInfo;
        } catch (error) {
            console.error('❌ ExtensionInstaller: 安装失败', error);
            throw error;
        }
    }

    async uninstall(extensionId: string, _keepData = false): Promise<boolean> {
        console.log('🗑️ ExtensionInstaller: 开始卸载扩展', extensionId);
        try {
            const registry = this._loadRegistry();
            const extensionInfo = registry.extensions[extensionId];
            if (!extensionInfo) throw new Error(`扩展 ${extensionId} 未安装`);
            if (extensionInfo.isBuiltin) throw new Error(`内置扩展 ${extensionId} 不能卸载`);

            const extensionDir = path.join(this.extensionsDir, extensionId);
            if (fs.existsSync(extensionDir)) {
                this._removeDirectory(extensionDir);
                console.log('✅ ExtensionInstaller: 已删除扩展文件', extensionDir);
            }

            delete registry.extensions[extensionId];
            this._saveRegistry(registry);
            console.log('✅ ExtensionInstaller: 扩展卸载成功', extensionId);
            return true;
        } catch (error) {
            console.error('❌ ExtensionInstaller: 卸载失败', error);
            throw error;
        }
    }

    async enableExtension(extensionId: string): Promise<ExtensionInfo> {
        const registry = this._loadRegistry();
        const info = registry.extensions[extensionId];
        if (!info) throw new Error(`扩展 ${extensionId} 未安装`);
        info.enabled = true;
        this._saveRegistry(registry);
        console.log('✅ ExtensionInstaller: 扩展已启用', extensionId);
        return info;
    }

    async disableExtension(extensionId: string): Promise<ExtensionInfo> {
        const registry = this._loadRegistry();
        const info = registry.extensions[extensionId];
        if (!info) throw new Error(`扩展 ${extensionId} 未安装`);
        info.enabled = false;
        this._saveRegistry(registry);
        console.log('✅ ExtensionInstaller: 扩展已禁用', extensionId);
        return info;
    }

    getInstalledExtensions(): ExtensionInfo[] {
        const registry = this._loadRegistry();
        const builtinExtensionIds = this._getBuiltinExtensionIds();
        const all = Object.values(registry.extensions);
        return all.filter(ext => {
            if (ext.isBuiltin) return false;
            if (builtinExtensionIds.has(ext.id)) return false;
            return true;
        });
    }

    scanUserExtensions(): Partial<ExtensionManifest>[] {
        const extensions: Partial<ExtensionManifest>[] = [];
        if (!fs.existsSync(this.extensionsDir)) return extensions;

        const builtinExtensionIds = this._getBuiltinExtensionIds();
        const entries = fs.readdirSync(this.extensionsDir, {withFileTypes: true});
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const manifestPath = path.join(this.extensionsDir, entry.name, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (builtinExtensionIds.has(manifest.id)) {
                        continue;
                    }

                    extensions.push({
                        ...manifest,
                        installPath: path.join(this.extensionsDir, entry.name),
                        isBuiltin: false
                    } as any);
                } catch (error) {
                    console.error(`❌ ExtensionInstaller: 读取扩展清单失败 ${entry.name}:`, error);
                }
            }
        }
        return extensions;
    }

    async readExtensionFile(extensionId: string, filePath: string): Promise<string> {
        const registry = this._loadRegistry();
        const info = registry.extensions[extensionId];
        if (!info) throw new Error(`扩展 ${extensionId} 未安装`);

        const normalizedFilePath = this._normalizeManifestMain(filePath, extensionId);
        const fullPath = path.join(info.installPath, normalizedFilePath);
        if (!isSafePath(fullPath, [info.installPath])) throw new Error(`非法的文件路径: ${filePath}`);
        if (!fs.existsSync(fullPath)) throw new Error(`文件不存在: ${filePath}`);

        return fs.readFileSync(fullPath, 'utf-8');
    }

    private _normalizeManifestMain(main: string, extensionId: string, zipPrefix = ''): string {
        let normalized = main.replace(/\\/g, '/').replace(/^\/+/, '');
        const normalizedPrefix = zipPrefix.replace(/\\/g, '/').replace(/^\/+/, '');

        if (normalizedPrefix && normalized.startsWith(normalizedPrefix)) {
            normalized = normalized.slice(normalizedPrefix.length);
        }

        const idPrefix = `${extensionId}/`;
        if (normalized.startsWith(idPrefix)) {
            normalized = normalized.slice(idPrefix.length);
        }

        return normalized || main;
    }

    private _validateManifest(manifest: any): void {
        for (const field of ['id', 'name', 'version', 'main']) {
            if (!manifest[field]) throw new Error(`manifest.json 缺少必需字段: ${field}`);
        }
        if (!/^[a-z0-9-_]+$/i.test(manifest.id)) throw new Error('扩展 ID 格式无效，只允许字母、数字、连字符和下划线');
    }

    private _isBuiltinExtensionId(extensionId: string): boolean {
        return this._getBuiltinExtensionIds().has(extensionId);
    }

    private _getBuiltinExtensionIds(): Set<string> {
        if (!this.builtinExtensionIds) {
            this.builtinExtensionIds = this._loadBuiltinExtensionIds();
        }

        return this.builtinExtensionIds;
    }

    private _loadBuiltinExtensionIds(): Set<string> {
        for (const builtinRoot of this._getBuiltinExtensionRoots()) {
            const indexPath = path.join(builtinRoot, 'extensions.json');
            if (!fs.existsSync(indexPath)) {
                continue;
            }

            try {
                const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as BuiltinExtensionIndex;
                if (!index || !Array.isArray(index.extensions)) {
                    throw new Error('内置扩展索引格式无效');
                }

                const ids = new Set<string>();
                for (const [entryIndex, entry] of index.extensions.entries()) {
                    const dirName = this._normalizeBuiltinExtensionDir(entry, entryIndex);
                    if (!dirName) {
                        continue;
                    }

                    const manifestPath = path.join(builtinRoot, dirName, 'manifest.json');
                    if (!isSafePath(manifestPath, [builtinRoot])) {
                        console.warn(`⚠️ ExtensionInstaller: 内置扩展 manifest 路径非法: ${manifestPath}`);
                        continue;
                    }

                    if (!fs.existsSync(manifestPath)) {
                        console.warn(`⚠️ ExtensionInstaller: 内置扩展 manifest 不存在: ${manifestPath}`);
                        continue;
                    }

                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Partial<ExtensionManifest>;
                    if (typeof manifest.id === 'string' && /^[a-z0-9-_]+$/i.test(manifest.id)) {
                        ids.add(manifest.id);
                    } else {
                        console.warn(`⚠️ ExtensionInstaller: 内置扩展 manifest 缺少有效 id: ${manifestPath}`);
                    }
                }

                console.log(`📦 ExtensionInstaller: 已加载 ${ids.size} 个内置扩展 ID`);
                return ids;
            } catch (error) {
                console.error(`❌ ExtensionInstaller: 读取内置扩展索引失败 (${indexPath}):`, error);
            }
        }

        console.warn('⚠️ ExtensionInstaller: 未找到内置扩展索引，跳过内置扩展 ID 过滤');
        return new Set();
    }

    private _getBuiltinExtensionRoots(): string[] {
        const appRoot = app.getAppPath();
        const candidates = [
            path.join(appRoot, 'src/renderer/public/js/extensions/builtin'),
            path.join(appRoot, 'src/renderer/src/js/extensions/builtin'),
            path.join(__dirname, '../../../renderer/public/js/extensions/builtin'),
            path.join(__dirname, '../../../../src/renderer/public/js/extensions/builtin'),
            path.join(__dirname, '../../../../src/renderer/src/js/extensions/builtin')
        ];

        return Array.from(new Set(candidates.map(candidate => path.resolve(candidate))));
    }

    private _normalizeBuiltinExtensionDir(entry: BuiltinExtensionIndexEntry, index: number): string | null {
        const rawPath = typeof entry === 'string' ? entry : entry?.path;
        if (typeof rawPath !== 'string') {
            console.warn(`⚠️ ExtensionInstaller: 内置扩展索引项 ${index} 缺少 path`);
            return null;
        }

        const normalized = rawPath.trim().replace(/\\/g, '/');
        if (!this._isSafeBuiltinExtensionDir(normalized)) {
            console.warn(`⚠️ ExtensionInstaller: 内置扩展索引项 ${index} 路径无效: ${rawPath}`);
            return null;
        }

        return normalized;
    }

    private _isSafeBuiltinExtensionDir(dirName: string): boolean {
        if (!dirName || dirName.startsWith('/') || dirName.includes('..')) {
            return false;
        }

        return dirName
            .split('/')
            .every(part => /^[a-zA-Z0-9._-]+$/.test(part));
    }

    private _loadRegistry(): ExtensionRegistry {
        if (!fs.existsSync(this.registryFile)) return {extensions: {}};
        try {
            return JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
        } catch (error) {
            console.error('❌ ExtensionInstaller: 读取注册表失败', error);
            return {extensions: {}};
        }
    }

    private _saveRegistry(registry: ExtensionRegistry): void {
        try {
            fs.writeFileSync(this.registryFile, JSON.stringify(registry, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ ExtensionInstaller: 保存注册表失败', error);
            throw error;
        }
    }

    private _removeDirectory(dirPath: string): void {
        if (!fs.existsSync(dirPath)) return;
        for (const file of fs.readdirSync(dirPath)) {
            const cur = path.join(dirPath, file);
            if (fs.lstatSync(cur).isDirectory()) this._removeDirectory(cur);
            else fs.unlinkSync(cur);
        }
        fs.rmdirSync(dirPath);
    }

    private _cleanupBuiltinExtensionsFromRegistry(): void {
        try {
            const registry = this._loadRegistry();
            const builtinExtensionIds = this._getBuiltinExtensionIds();
            let cleaned = 0;
            for (const ext of Object.values(registry.extensions)) {
                if (ext.isBuiltin || builtinExtensionIds.has(ext.id)) {
                    delete registry.extensions[ext.id];
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                this._saveRegistry(registry);
                console.log(`✅ ExtensionInstaller: 已清理 ${cleaned} 个内置插件记录`);
            }
        } catch (error) {
            console.error('❌ ExtensionInstaller: 清理内置插件记录失败', error);
        }
    }
}
