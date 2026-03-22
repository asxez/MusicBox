// 桌面歌词控制器

import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

@Controller('desktopLyrics')
export class DesktopLyricsController extends BaseController {
    constructor(private windowManager: WindowManager) {
        super();
    }

    @IpcHandle('desktopLyrics:create')
    async create(): Promise<{ success: boolean; error?: string }> {
        try {
            this.windowManager.createDesktopLyricsWindow();
            return {success: true};
        } catch (error: any) {
            console.error('❌ 创建桌面歌词窗口失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('desktopLyrics:show')
    show(): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.show();
            return {success: true};
        }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:hide')
    hide(): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.hide();
            return {success: true};
        }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:close')
    closeWindow(): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.close();
            return {success: true};
        }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:isVisible')
    isVisible(): boolean {
        const win = this.windowManager.getDesktopLyricsWindow();
        return !!(win && !win.isDestroyed() && win.isVisible());
    }

    @IpcHandle('desktopLyrics:toggle')
    async toggle(): Promise<{ success: boolean; visible: boolean; error?: string }> {
        try {
            const win = this.windowManager.getDesktopLyricsWindow();
            if (!win || win.isDestroyed()) {
                this.windowManager.createDesktopLyricsWindow();
                return {success: true, visible: true};
            } else if (win.isVisible()) {
                win.hide();
                return {success: true, visible: false};
            } else {
                win.show();
                return {success: true, visible: true};
            }
        } catch (error: any) {
            console.error('❌ 切换桌面歌词窗口失败:', error);
            return {success: false, visible: false, error: error.message};
        }
    }

    @IpcHandle('desktopLyrics:updatePlaybackState')
    updatePlaybackState(state: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('playback:stateChanged', state);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:updateLyrics')
    updateLyrics(lyrics: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('lyrics:updated', lyrics);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:updateProgress')
    updateProgress(progress: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('playback:positionChanged', progress);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:updateTrackInfo')
    updateTrackInfo(trackInfo: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('track:changed', trackInfo);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:setAlwaysOnTop')
    setAlwaysOnTop(flag: boolean): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.setAlwaysOnTop(flag, 'screen-saver');
            return {success: true};
        }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:setIgnoreMouseEvents')
    setIgnoreMouseEvents(ignore: boolean): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.setIgnoreMouseEvents(ignore, {forward: true});
            return {success: true};
        }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:setPosition')
    setPosition(x: number, y: number): { success: boolean; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                win.setPosition(Math.round(x), Math.round(y));
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:getPosition')
    getPosition(): { success: boolean; position?: number[]; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            return {success: true, position: win.getPosition()};
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:updatePosition')
    updatePosition(position: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('playback:positionChanged', position);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:updateTrack')
    updateTrack(trackInfo: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('track:changed', trackInfo);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:setSize')
    setSize(width: number, height: number): { success: boolean; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const w = parseInt(String(width));
                const h = parseInt(String(height));
                if (isNaN(w) || isNaN(h) || w < 10 || h < 10 || w > 2000 || h > 1500) {
                    return {success: false, error: `窗口尺寸超出限制范围 (10-2000 x 10-1500)`};
                }
                win.setSize(w, h);
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:setOpacity')
    setOpacity(opacity: number): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            win.setOpacity(opacity);
            return {success: true};
        }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:updateSettings')
    updateSettings(settings: any): { success: boolean; error?: string } {
        try {
            this.windowManager.sendToDesktopLyrics('settings:changed', settings);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('desktopLyrics:getSize')
    getSize(): { success: boolean; size?: number[]; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            return {success: true, size: win.getSize()};
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:centerOnScreen')
    centerOnScreen(): { success: boolean; position?: number[]; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const {screen} = require('electron');
                const {width: sw, height: sh} = screen.getPrimaryDisplay().workAreaSize;
                const [ww, wh] = win.getSize();
                const x = Math.round((sw - ww) / 2);
                const y = Math.round((sh - wh) / 2);
                win.setPosition(x, y);
                console.log(`✅ 桌面歌词窗口已居中: 屏幕(${sw}x${sh}), 窗口(${ww}x${wh}), 位置(${x}, ${y})`);
                return {success: true, position: [x, y]};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }
}
