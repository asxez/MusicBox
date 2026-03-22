// 扩展管理控制器

import {dialog} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {ExtensionInstaller} from '../services/extensions/ExtensionInstaller';
import {WindowManager} from '../core/WindowManager';

@Controller('extensions')
export class ExtensionsController extends BaseController {
    constructor(
        private extensionInstaller: ExtensionInstaller,
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
    getInstalled(): any[] {
        try {
            return this.extensionInstaller.getInstalledExtensions();
        } catch (error) {
            console.error('❌ extensions:getInstalled 错误:', error);
            return [];
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
}
