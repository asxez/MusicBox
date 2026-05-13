/**
 * 扩展安装器 - 处理扩展的安装、卸载等文件操作
 */

import * as fs from 'fs';
import * as path from 'path';
import {app} from 'electron';

const BUILTIN_EXTENSION_IDS = ['theme-enhancer'];

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

export class ExtensionInstaller {
    private extensionsDir: string;
    private registryFile: string;

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
        const all = Object.values(registry.extensions);
        return all.filter(ext => {
            if (ext.isBuiltin) return false;
            if (BUILTIN_EXTENSION_IDS.includes(ext.id)) return false;
            return true;
        });
    }

    scanUserExtensions(): Partial<ExtensionManifest>[] {
        const extensions: Partial<ExtensionManifest>[] = [];
        if (!fs.existsSync(this.extensionsDir)) return extensions;

        const entries = fs.readdirSync(this.extensionsDir, {withFileTypes: true});
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const manifestPath = path.join(this.extensionsDir, entry.name, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
        const normalizedPath = path.normalize(fullPath);
        const normalizedInstallPath = path.normalize(info.installPath);
        if (!normalizedPath.startsWith(normalizedInstallPath)) throw new Error(`非法的文件路径: ${filePath}`);
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
            let cleaned = 0;
            for (const ext of Object.values(registry.extensions)) {
                if (BUILTIN_EXTENSION_IDS.includes(ext.id)) {
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
