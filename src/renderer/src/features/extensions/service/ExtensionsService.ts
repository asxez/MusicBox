import {extensionsGateway, globalShortcutsGateway} from '@/infrastructure/electron';
import type {ExtensionStorageScope} from '@api/types/electron';
import type {ExtensionInfo} from '@extensions/core/types';

export type ExtensionsResult = {
    success: boolean;
    extensions: ExtensionInfo[];
    error?: string;
};

export type ExtensionInstallResult = {
    success: boolean;
    extension?: ExtensionInfo;
    error?: string;
};

export type ExtensionOperationResult = {
    success: boolean;
    error?: string;
};

export type ExtensionFileResult = {
    success: boolean;
    content?: string;
    error?: string;
};

export type ExtensionStorageStateResult = {
    success: boolean;
    data: Record<string, unknown>;
    error?: string;
};

export class ExtensionsService {
    async selectPackage(): Promise<string | null> {
        return await extensionsGateway.selectPackage();
    }

    async installFromFile(filePath: string): Promise<ExtensionInstallResult> {
        return await extensionsGateway.installFromFile(filePath) as ExtensionInstallResult;
    }

    async uninstall(extensionId: string, keepData = false): Promise<ExtensionOperationResult> {
        return await extensionsGateway.uninstall(extensionId, keepData);
    }

    async enable(extensionId: string): Promise<ExtensionOperationResult> {
        return await extensionsGateway.enable(extensionId);
    }

    async disable(extensionId: string): Promise<ExtensionOperationResult> {
        return await extensionsGateway.disable(extensionId);
    }

    async getInstalled(): Promise<ExtensionsResult> {
        return await extensionsGateway.getInstalled() as ExtensionsResult;
    }

    async readExtensionFile(extensionId: string, filePath: string): Promise<ExtensionFileResult> {
        return await extensionsGateway.readExtensionFile(extensionId, filePath) as ExtensionFileResult;
    }

    async getStorageState(extensionId: string, scope: ExtensionStorageScope): Promise<ExtensionStorageStateResult> {
        return await extensionsGateway.storageGetState(extensionId, scope);
    }

    async updateStorage(
        extensionId: string,
        scope: ExtensionStorageScope,
        key: string,
        value: unknown
    ): Promise<ExtensionOperationResult> {
        return await extensionsGateway.storageUpdate(extensionId, scope, key, value);
    }

    async registerGlobalShortcuts(shortcuts: unknown): Promise<void> {
        await globalShortcutsGateway.register(shortcuts);
    }
}

export const extensionsService = new ExtensionsService();
