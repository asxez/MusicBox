// 扩展管理控制器

import {dialog} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {ExtensionInstaller} from '../services/extensions/ExtensionInstaller';
import {ExtensionStorageScope, ExtensionStorageService} from '../services/extensions/ExtensionStorageService';
import {WindowManager} from '../core/WindowManager';

@Controller('extensions')
export class ExtensionsController extends BaseController {
    constructor(
        private extensionInstaller: ExtensionInstaller,
        private extensionStorageService: ExtensionStorageService,
        private windowManager: WindowManager
    ) {
        super();
    }

    @IpcHandle('extensions:selectPackage')
    async selectPackage(): Promise<string | null> {
        try {
            const win = this.windowManager.getMainWindow();
            const result: any = await dialog.showOpenDialog(win as any, {
                title: '选择扩展包',
                filters: [
                    {name: '扩展包', extensions: ['zip']},
                    {name: '所有文件', extensions: ['*']}
                ],
                properties: ['openFile']
            });
            if (result.canceled || result.filePaths.length === 0) return null;
            return result.filePaths[0];
        } catch (error) {
            console.error('❌ extensions:selectPackage 错误:', error);
            throw error;
        }
    }

    @IpcHandle('extensions:installFromFile')
    async installFromFile(filePath: string): Promise<{ success: boolean; extension?: any; error?: string }> {
        try {
            if (!filePath) throw new Error('文件路径参数为空');
            const extensionInfo = await this.extensionInstaller.installFromZip(filePath);
            return {success: true, extension: extensionInfo};
        } catch (error: any) {
            console.error('❌ extensions:installFromFile 错误:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('extensions:uninstall')
    async uninstall(extensionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.extensionInstaller.uninstall(extensionId);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('extensions:enable')
    async enable(extensionId: string): Promise<{ success: boolean; extension?: any; error?: string }> {
        try {
            const info = await this.extensionInstaller.enableExtension(extensionId);
            return {success: true, extension: info};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('extensions:disable')
    async disable(extensionId: string): Promise<{ success: boolean; extension?: any; error?: string }> {
        try {
            const info = await this.extensionInstaller.disableExtension(extensionId);
            return {success: true, extension: info};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('extensions:getInstalled')
    getInstalled(): { success: boolean; extensions: any[]; error?: string } {
        try {
            return {success: true, extensions: this.extensionInstaller.getInstalledExtensions()};
        } catch (error: any) {
            console.error('❌ extensions:getInstalled 错误:', error);
            return {success: false, extensions: [], error: error.message};
        }
    }

    @IpcHandle('extensions:scanUserExtensions')
    scanUserExtensions(): { success: boolean; extensions: any[]; error?: string } {
        try {
            return {success: true, extensions: this.extensionInstaller.scanUserExtensions()};
        } catch (error: any) {
            return {success: false, error: error.message, extensions: []};
        }
    }

    @IpcHandle('extensions:readExtensionFile')
    async readExtensionFile(extensionId: string, filePath: string): Promise<{
        success: boolean;
        content?: string;
        error?: string
    }> {
        try {
            const content = await this.extensionInstaller.readExtensionFile(extensionId, filePath);
            return {success: true, content};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('extensions:storageGetState')
    async storageGetState(
        extensionId: string,
        scope: ExtensionStorageScope
    ): Promise<{ success: boolean; data: Record<string, unknown>; error?: string }> {
        try {
            const data = await this.extensionStorageService.getState(extensionId, scope);
            return {success: true, data};
        } catch (error: any) {
            return {success: false, data: {}, error: error.message};
        }
    }

    @IpcHandle('extensions:storageUpdate')
    async storageUpdate(
        extensionId: string,
        scope: ExtensionStorageScope,
        key: string,
        value: unknown
    ): Promise<{ success: boolean; error?: string }> {
        return await this.extensionStorageService.updateValue(extensionId, scope, key, value);
    }
}
