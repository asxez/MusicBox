import {extensionsService} from './service';
import type {
    ExtensionFileResult,
    ExtensionInstallResult,
    ExtensionOperationResult,
    ExtensionStorageStateResult,
    ExtensionsResult
} from './service';
import type {ExtensionStorageScope} from '@api/types/electron';

class ExtensionsController {
    async selectPackage(): Promise<string | null> {
        return await extensionsService.selectPackage();
    }

    async installFromFile(filePath: string): Promise<ExtensionInstallResult> {
        return await extensionsService.installFromFile(filePath);
    }

    async uninstall(extensionId: string, keepData = false): Promise<ExtensionOperationResult> {
        return await extensionsService.uninstall(extensionId, keepData);
    }

    async enable(extensionId: string): Promise<ExtensionOperationResult> {
        return await extensionsService.enable(extensionId);
    }

    async disable(extensionId: string): Promise<ExtensionOperationResult> {
        return await extensionsService.disable(extensionId);
    }

    async getInstalled(): Promise<ExtensionsResult> {
        return await extensionsService.getInstalled();
    }

    async readExtensionFile(extensionId: string, filePath: string): Promise<ExtensionFileResult> {
        return await extensionsService.readExtensionFile(extensionId, filePath);
    }

    async getStorageState(extensionId: string, scope: ExtensionStorageScope): Promise<ExtensionStorageStateResult> {
        return await extensionsService.getStorageState(extensionId, scope);
    }

    async updateStorage(
        extensionId: string,
        scope: ExtensionStorageScope,
        key: string,
        value: unknown
    ): Promise<ExtensionOperationResult> {
        return await extensionsService.updateStorage(extensionId, scope, key, value);
    }

    async registerGlobalShortcuts(shortcuts: unknown): Promise<void> {
        await extensionsService.registerGlobalShortcuts(shortcuts);
    }
}

export const extensionsController = new ExtensionsController();
export {ExtensionsController};
export type {
    ExtensionFileResult,
    ExtensionInstallResult,
    ExtensionOperationResult,
    ExtensionStorageStateResult,
    ExtensionsResult
};
