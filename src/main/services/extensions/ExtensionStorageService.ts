import {app} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type ExtensionStorageScope = 'global' | 'workspace';

export interface ExtensionStorageUpdateResult {
    success: boolean;
    error?: string;
}

export class ExtensionStorageService {
    private readonly storageRoot = path.join(app.getPath('userData'), 'extension-storage');

    constructor() {
        this.ensureRoot();
    }

    async getState(extensionId: string, scope: ExtensionStorageScope): Promise<Record<string, unknown>> {
        const filePath = this.getStorageFilePath(extensionId, scope);

        if (!fs.existsSync(filePath)) {
            return this.createEmptyState();
        }

        const content = await fs.promises.readFile(filePath, 'utf8');
        return this.normalizeState(JSON.parse(content));
    }

    async updateValue(
        extensionId: string,
        scope: ExtensionStorageScope,
        key: string,
        value: unknown
    ): Promise<ExtensionStorageUpdateResult> {
        try {
            this.validateKey(key);

            const state = await this.getState(extensionId, scope);
            if (typeof value === 'undefined') {
                delete state[key];
            } else {
                state[key] = value;
            }

            await this.writeState(extensionId, scope, state);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    private ensureRoot(): void {
        if (!fs.existsSync(this.storageRoot)) {
            fs.mkdirSync(this.storageRoot, {recursive: true});
        }
    }

    private getStorageFilePath(extensionId: string, scope: ExtensionStorageScope): string {
        const safeExtensionId = this.validateExtensionId(extensionId);
        const safeScope = this.validateScope(scope);
        return path.join(this.storageRoot, safeExtensionId, `${safeScope}.json`);
    }

    private async writeState(
        extensionId: string,
        scope: ExtensionStorageScope,
        state: Record<string, unknown>
    ): Promise<void> {
        const filePath = this.getStorageFilePath(extensionId, scope);
        const dirPath = path.dirname(filePath);
        await fs.promises.mkdir(dirPath, {recursive: true});

        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await fs.promises.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
        await fs.promises.rename(tempPath, filePath);
    }

    private validateExtensionId(extensionId: string): string {
        if (typeof extensionId !== 'string' || !/^[a-z0-9-_]+$/i.test(extensionId)) {
            throw new Error(`非法的扩展 ID: ${extensionId}`);
        }
        return extensionId;
    }

    private validateScope(scope: ExtensionStorageScope): ExtensionStorageScope {
        if (scope !== 'global' && scope !== 'workspace') {
            throw new Error(`非法的扩展存储作用域: ${scope}`);
        }
        return scope;
    }

    private validateKey(key: string): void {
        if (typeof key !== 'string' || key.trim() === '') {
            throw new Error('扩展存储 key 不能为空');
        }

        if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
            throw new Error(`非法的扩展存储 key: ${key}`);
        }
    }

    private normalizeState(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return this.createEmptyState();
        }

        const state = this.createEmptyState();
        for (const [key, entryValue] of Object.entries(value)) {
            if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
                continue;
            }

            state[key] = entryValue;
        }

        return state;
    }

    private createEmptyState(): Record<string, unknown> {
        return Object.create(null) as Record<string, unknown>;
    }
}
