import {getElectronAPI} from './ElectronBridge';

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
}

export const extensionsGateway = new ExtensionsGateway();
