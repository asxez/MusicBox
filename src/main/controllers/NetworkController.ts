// 网络磁盘控制器

import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {NetworkDriveManager, SMBConfig, WebDAVConfig} from '../services/network/NetworkDriveManager';
import {NetworkFileAdapter} from '../services/network/NetworkFileAdapter';
import {WindowManager} from '../core/WindowManager';

@Controller('network-drive')
export class NetworkController extends BaseController {
    constructor(
        private networkDriveManager: NetworkDriveManager,
        private networkFileAdapter: NetworkFileAdapter,
        private windowManager: WindowManager
    ) {
        super();
    }

    override register(): void {
        super.register();
        // Forward NetworkDriveManager events to renderer
        this.networkDriveManager.on('driveConnected', (driveId: string, config: any) => {
            this.windowManager.sendToMainWindow('network-drive:connected', {driveId, config});
        });
        this.networkDriveManager.on('driveDisconnected', (driveId: string, config: any) => {
            this.windowManager.sendToMainWindow('network-drive:disconnected', {driveId, config});
        });
        this.networkDriveManager.on('driveError', (driveId: string, error: string) => {
            this.windowManager.sendToMainWindow('network-drive:error', {driveId, error});
        });
    }

    @IpcHandle('network-drive:mountSMB')
    async mountSMB(config: SMBConfig): Promise<boolean> {
        try {
            return await this.networkDriveManager.mountSMB(config);
        } catch (error) {
            console.error('❌ 挂载SMB磁盘失败:', error);
            return false;
        }
    }

    @IpcHandle('network-drive:mountWebDAV')
    async mountWebDAV(config: WebDAVConfig): Promise<boolean> {
        try {
            return await this.networkDriveManager.mountWebDAV(config);
        } catch (error) {
            console.error('❌ 挂载WebDAV磁盘失败:', error);
            return false;
        }
    }

    @IpcHandle('network-drive:unmount')
    async unmount(driveId: string): Promise<boolean> {
        try {
            return await this.networkDriveManager.unmountDrive(driveId);
        } catch (error) {
            console.error('❌ 卸载网络磁盘失败:', error);
            return false;
        }
    }

    @IpcHandle('network-drive:getMountedDrives')
    async getMountedDrives(): Promise<any[]> {
        try {
            const drives = this.networkDriveManager.getMountedDrives();
            return Array.from(drives.entries()).map(([id, info]) => ({
                id,
                type: info.type,
                config: info.config,
                mountTime: info.mountTime
            }));
        } catch (error) {
            console.error('❌ 获取挂载磁盘列表失败:', error);
            return [];
        }
    }

    @IpcHandle('network-drive:getStatus')
    async getStatus(driveId: string): Promise<any> {
        try {
            return this.networkDriveManager.getDriveStatus(driveId) ?? null;
        } catch (error) {
            console.error('❌ 获取磁盘状态失败:', error);
            return null;
        }
    }

    @IpcHandle('network-drive:testConnection')
    async testConnection(config: any): Promise<boolean> {
        try {
            if (config.type === 'smb') {
                const SMB2 = require('node-smb2');
                const smbClient = new SMB2({
                    share: `\\\\${config.host}\\${config.share}`,
                    domain: config.domain || 'WORKGROUP',
                    username: config.username,
                    password: config.password,
                    autoCloseTimeout: 0
                });
                await (this.networkDriveManager as any).testSMBConnection(smbClient);
                return true;
            } else if (config.type === 'webdav') {
                const {createClient} = require('webdav');
                const opts: any = {};
                if (config.username) opts.username = config.username;
                if (config.password) opts.password = config.password;
                const client = createClient(config.url, opts);
                await (this.networkDriveManager as any).testWebDAVConnection(client);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ 测试网络连接失败:', error);
            return false;
        }
    }

    @IpcHandle('network-drive:refreshConnections')
    async refreshConnections(): Promise<boolean> {
        try {
            await this.networkDriveManager.refreshAllConnections();
            return true;
        } catch (error) {
            console.error('❌ 刷新网络磁盘连接状态失败:', error);
            return false;
        }
    }

    @IpcHandle('network-drive:refreshConnection')
    async refreshConnection(driveId: string): Promise<boolean> {
        try {
            await this.networkDriveManager.refreshConnection(driveId);
            return true;
        } catch (error) {
            console.error('❌ 刷新网络磁盘连接状态失败:', error);
            return false;
        }
    }

    @IpcHandle('network-drive:getDirectoryStructure')
    async getDirectoryStructure(driveId: string, dirPath = '/'): Promise<{
        success: boolean;
        structure?: any[];
        error?: string
    }> {
        try {
            const driveInfo = this.networkDriveManager.getDriveInfo(driveId);
            if (!driveInfo) return {success: false, error: '网络磁盘未挂载'};

            const status = this.networkDriveManager.getDriveStatus(driveId);
            if (!status?.connected) return {success: false, error: '网络磁盘未连接'};

            const networkPath = `network://${driveId}${dirPath}`;
            const items = await this.networkFileAdapter.readdir(networkPath);

            const structure: any[] = [];
            for (const itemName of items) {
                try {
                    const itemPath = this.networkFileAdapter.joinNetworkPath(networkPath, itemName);
                    const stats = await this.networkFileAdapter.stat(itemPath);
                    const isDir = typeof stats.isDirectory === 'function'
                        ? stats.isDirectory()
                        : Boolean((stats as any).isDirectory);

                    structure.push({
                        name: itemName,
                        path: dirPath === '/' ? `/${itemName}` : `${dirPath}/${itemName}`,
                        isDirectory: isDir,
                        size: isDir ? 0 : stats.size
                    });
                } catch (error) {
                    structure.push({name: itemName, path: `${dirPath}/${itemName}`, isDirectory: false, size: 0});
                }
            }

            structure.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

            return {success: true, structure};
        } catch (error: any) {
            console.error('❌ 获取网络磁盘目录结构失败:', error);
            return {success: false, error: error.message};
        }
    }
}
