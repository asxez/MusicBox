import {systemGateway} from '@js/infrastructure/electron';

export type ShellActionResult = {
    success: boolean;
    error?: string;
};

export class SystemShellService {
    async getVersion(): Promise<string> {
        return await systemGateway.getVersion();
    }

    async getPlatform(): Promise<string> {
        return await systemGateway.getPlatform();
    }

    async getAppPath(): Promise<string> {
        return await systemGateway.getAppPath();
    }

    async getUserDataPath(): Promise<string> {
        return await systemGateway.getUserDataPath();
    }

    async getTempPath(): Promise<string> {
        return await systemGateway.getTempPath();
    }

    async openPath(path: string): Promise<ShellActionResult> {
        return await systemGateway.openPath(path);
    }

    async openExternal(url: string): Promise<ShellActionResult> {
        return await systemGateway.openExternal(url);
    }
}

export const systemShellService = new SystemShellService();
