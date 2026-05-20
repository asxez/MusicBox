import {getElectronAPI} from './ElectronBridge';
import type {ExtensionStorageScope} from '@api/types/electron';

class ExtensionsGateway {
    selectPackage(): Promise<string | null> {
        return getElectronAPI().extensions.selectPackage();
    }

    installFromFile(filePath: string): Promise<{success: boolean; extension: any; error?: string}> {
        return getElectronAPI().extensions.installFromFile(filePath);
    }

    uninstall(extensionId: string, keepData: boolean): Promise<{success: boolean; error?: string}> {
        return getElectronAPI().extensions.uninstall(extensionId, keepData);
    }

    enable(extensionId: string): Promise<{success: boolean; error?: string}> {
        return getElectronAPI().extensions.enable(extensionId);
    }

    disable(extensionId: string): Promise<{success: boolean; error?: string}> {
        return getElectronAPI().extensions.disable(extensionId);
    }

    getInstalled(): Promise<{success: boolean; extensions: any[]; error?: string}> {
        return getElectronAPI().extensions.getInstalled();
    }

    scanUserExtensions(): Promise<{success: boolean; extensions: any[]; error?: string}> {
        return getElectronAPI().extensions.scanUserExtensions();
    }

    readExtensionFile(extensionId: string, filePath: string): Promise<{success: boolean; content: string; error?: string}> {
        return getElectronAPI().extensions.readExtensionFile(extensionId, filePath);
    }

    storageGetState(
        extensionId: string,
        scope: ExtensionStorageScope
    ): Promise<{success: boolean; data: Record<string, unknown>; error?: string}> {
        return getElectronAPI().extensions.storageGetState(extensionId, scope);
    }

    storageUpdate(
        extensionId: string,
        scope: ExtensionStorageScope,
        key: string,
        value: unknown
    ): Promise<{success: boolean; error?: string}> {
        return getElectronAPI().extensions.storageUpdate(extensionId, scope, key, value);
    }
}

export const extensionsGateway = new ExtensionsGateway();
