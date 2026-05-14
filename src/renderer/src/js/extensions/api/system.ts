/**
 * System API - 系统 API
 * 提供系统信息和环境变量访问功能
 */

import {appShellController} from '@js/features/appShell';
import {ErrorUtils} from '@extensions/api/common/errors';
import '@extensions/core/types';
import {ExtensionContext} from "@extensions/core";
import {SystemAPI} from "@extensions/api/types/system";

declare const process: {env?: Record<string, string | undefined>} | undefined;


/**
 * 创建系统 API
 */
export function createSystemAPI(_context: ExtensionContext): SystemAPI {
    return {
        async getVersion(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                return await appShellController.getVersion();
            }, 'system.getVersion');
        },

        async getPlatform(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                return await appShellController.getPlatform();
            }, 'system.getPlatform');
        },

        async getOS(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                const platform = await this.getPlatform();
                const platformLower = platform.toLowerCase();
                if (platformLower.includes('win')) return 'windows';
                if (platformLower.includes('mac') || platformLower.includes('darwin')) return 'macos';
                if (platformLower.includes('linux')) return 'linux';
                return 'unknown';
            }, 'system.getOS');
        },

        async getAppPath(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                return await appShellController.getAppPath();
            }, 'system.getAppPath');
        },

        async getUserDataPath(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                return await appShellController.getUserDataPath();
            }, 'system.getUserDataPath');
        },

        async getTempPath(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                return await appShellController.getTempPath();
            }, 'system.getTempPath');
        },

        getLanguage(): string {
            return ErrorUtils.wrapSync(() => {
                return navigator.language || 'en-US';
            }, 'system.getLanguage');
        },

        getEnv(key: string): string | undefined {
            return ErrorUtils.wrapSync(() => {
                return process?.env?.[key];
            }, 'system.getEnv');
        },

        async showItemInFolder(filePath: string): Promise<void> {
            return ErrorUtils.wrapAsync(async () => {
                await appShellController.openPath(filePath);
            }, 'system.showItemInFolder');
        },

        async getClipboardText(): Promise<string> {
            return ErrorUtils.wrapAsync(async () => {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    return await navigator.clipboard.readText();
                }
                return '';
            }, 'system.getClipboardText');
        },

        async setClipboardText(text: string): Promise<void> {
            return ErrorUtils.wrapAsync(async () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                }
            }, 'system.setClipboardText');
        }
    };
}
