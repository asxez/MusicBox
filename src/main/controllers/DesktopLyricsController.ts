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
            await this.windowManager.createDesktopLyricsWindow();
            return {success: true};
        } catch (error: any) {
            console.error('❌ 创建桌面歌词窗口失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('desktopLyrics:show')
    show(): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) { win.show(); return {success: true}; }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:hide')
    hide(): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) { win.hide(); return {success: true}; }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:close')
    closeWindow(): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) { win.close(); return {success: true}; }
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
                await this.windowManager.createDesktopLyricsWindow();
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
    updateLyrics(lyricsData: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('lyrics:updated', lyricsData);
        return {success: true};
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

    @IpcHandle('desktopLyrics:updateSettings')
    updateSettings(settings: any): { success: boolean } {
        this.windowManager.sendToDesktopLyrics('settings:changed', settings);
        return {success: true};
    }

    @IpcHandle('desktopLyrics:setPosition')
    setPosition(x: number, y: number): { success: boolean; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const posX = parseInt(String(x));
                const posY = parseInt(String(y));
                if (isNaN(posX) || isNaN(posY)) return {success: false, error: '无效的窗口位置参数'};
                win.setPosition(posX, posY);
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
        if (win && !win.isDestroyed()) return {success: true, position: win.getPosition()};
        return {success: false};
    }

    @IpcHandle('desktopLyrics:setSize')
    setSize(width: number, height: number): { success: boolean; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const w = parseInt(String(width));
                const h = parseInt(String(height));
                if (isNaN(w) || isNaN(h) || w < 10 || h < 10 || w > 2000 || h > 1500) {
                    return {success: false, error: '窗口尺寸超出限制范围 (10-2000 x 10-1500)'};
                }
                win.setSize(w, h);
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:getSize')
    getSize(): { success: boolean; size?: number[]; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) return {success: true, size: win.getSize()};
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:setOpacity')
    setOpacity(opacity: number): { success: boolean } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) { win.setOpacity(opacity); return {success: true}; }
        return {success: false};
    }

    @IpcHandle('desktopLyrics:setAlwaysOnTop')
    setAlwaysOnTop(flag: boolean): { success: boolean; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                win.setAlwaysOnTop(flag);
                console.log(`✅ 桌面歌词窗口置顶状态已设置: ${flag}`);
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:setIgnoreMouseEvents')
    setIgnoreMouseEvents(ignore: boolean, options?: any): { success: boolean; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                win.setIgnoreMouseEvents(ignore, options || {});
                console.log(`✅ 桌面歌词窗口鼠标穿透状态已设置: ${ignore}`);
                return {success: true};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }

    @IpcHandle('desktopLyrics:centerOnScreen')
    centerOnScreen(): { success: boolean; position?: number[]; error?: string } {
        const win = this.windowManager.getDesktopLyricsWindow();
        if (win && !win.isDestroyed()) {
            try {
                const {screen} = require('electron');
                const {width: screenWidth, height: screenHeight} = screen.getPrimaryDisplay().workAreaSize;
                const [winWidth, winHeight] = win.getSize();
                const x = Math.round((screenWidth - winWidth) / 2);
                const y = Math.round((screenHeight - winHeight) / 2);
                win.setPosition(x, y);
                console.log(`✅ 桌面歌词窗口已居中: 屏幕(${screenWidth}x${screenHeight}), 窗口(${winWidth}x${winHeight}), 位置(${x}, ${y})`);
                return {success: true, position: [x, y]};
            } catch (error: any) {
                return {success: false, error: error.message};
            }
        }
        return {success: false, error: '桌面歌词窗口不存在'};
    }
}
