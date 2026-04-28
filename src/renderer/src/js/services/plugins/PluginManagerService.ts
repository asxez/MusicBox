import {extensionsGateway} from "@js/infrastructure/electron";
import type {ExtensionDescriptor} from "@extensions/core/ExtensionsRegistry";

export type PluginExtension = ExtensionDescriptor & {
    isActive?: boolean;
};

interface PluginExtensionServiceBridge {
    getExtensions(): PluginExtension[];
    installExtensionFromFile(filePath: string): Promise<unknown>;
    enableExtension(extensionId: string): Promise<void>;
    disableExtension(extensionId: string): Promise<void>;
    uninstallExtensionFromDisk(extensionId: string): Promise<void>;
}

class PluginManagerService {
    getExtensions(): PluginExtension[] {
        return this.getExtensionService()?.getExtensions() || [];
    }

    isAvailable(): boolean {
        return Boolean(this.getExtensionService());
    }

    async selectAndInstallExtension(): Promise<void> {
        const extensionService = this.requireExtensionService();
        const filePath = await extensionsGateway.selectPackage();
        if (!filePath) {
            return;
        }

        await extensionService.installExtensionFromFile(filePath);
    }

    async enableExtension(extensionId: string): Promise<void> {
        await this.requireExtensionService().enableExtension(extensionId);
    }

    async disableExtension(extensionId: string): Promise<void> {
        await this.requireExtensionService().disableExtension(extensionId);
    }

    async uninstallExtension(extensionId: string): Promise<void> {
        await this.requireExtensionService().uninstallExtensionFromDisk(extensionId);
    }

    private requireExtensionService(): PluginExtensionServiceBridge {
        const extensionService = this.getExtensionService();
        if (!extensionService) {
            throw new Error('扩展服务未初始化');
        }

        return extensionService;
    }

    private getExtensionService(): PluginExtensionServiceBridge | null {
        return window.extensionService as PluginExtensionServiceBridge | null | undefined || null;
    }
}

export const pluginManagerService = new PluginManagerService();
