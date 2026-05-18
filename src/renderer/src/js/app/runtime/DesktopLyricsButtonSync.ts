import {cacheManager} from '@services/CacheManager';

import type {AppUIFacade} from './AppUIFacade';

export class DesktopLyricsButtonSync {
    constructor(private readonly ui: AppUIFacade) {}

    async syncButtonState(): Promise<void> {
        try {
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as Record<string, unknown>;
            const desktopLyricsEnabled = Object.prototype.hasOwnProperty.call(settings, 'desktopLyrics')
                ? settings.desktopLyrics
                : true;

            await this.ui.updateDesktopLyricsButtonVisibility(Boolean(desktopLyricsEnabled));
        } catch (error) {
            console.error('❌ App: 同步桌面歌词按钮状态失败:', error);
        }
    }
}
