import {desktopLyricsGateway} from '@/infrastructure/electron/DesktopLyricsGateway';
import {windowGateway} from '@/infrastructure/electron/WindowGateway';
import type {Result} from '@api/types/common';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';

export type DesktopLyricsToggleResult = {
    success: boolean;
    visible?: boolean;
    error?: string;
};

interface DesktopLyricsStateSyncPort {
    syncCurrentStateToDesktopLyrics(): Promise<void>;
}

export class DesktopLyricsWindowOperationsService {
    constructor(private readonly stateSync: DesktopLyricsStateSyncPort) {
    }

    async toggleDesktopLyrics(): Promise<DesktopLyricsToggleResult> {
        try {
            const result = await desktopLyricsGateway.toggle();
            if (result.success && result.visible) {
                await this.stateSync.syncCurrentStateToDesktopLyrics();
                await windowGateway.setBackgroundThrottling(true);
            }
            await windowGateway.setBackgroundThrottling(false);
            return result;
        } catch (error) {
            console.error('❌ 切换桌面歌词失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    async hideDesktopLyrics(): Promise<Result> {
        try {
            return await desktopLyricsGateway.hide();
        } catch (error) {
            console.error('❌ 隐藏桌面歌词失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    async isDesktopLyricsVisible(): Promise<boolean> {
        try {
            return await desktopLyricsGateway.isVisible();
        } catch (error) {
            console.error('❌ 检查桌面歌词状态失败:', error);
            return false;
        }
    }

    async updateDesktopLyricsSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        try {
            return await desktopLyricsGateway.updateSettings(settings);
        } catch (error) {
            console.error('❌ 更新桌面歌词设置失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }
}
