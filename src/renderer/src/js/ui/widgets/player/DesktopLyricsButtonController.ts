import {cacheManager} from "@js/shared/cache";
import {desktopLyricsController} from "@js/features/desktopLyrics";
import {showToast} from "@js/utils";
import type {AddManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";

interface MusicBoxSettingsCache {
    desktopLyrics?: boolean;
}

interface DesktopLyricsButtonControllerOptions {
    button: HTMLButtonElement | null;
    addDomListener: AddManagedDomListener;
}

class DesktopLyricsButtonController {
    private readonly button: HTMLButtonElement | null;
    private readonly addDomListener: AddManagedDomListener;
    private bound = false;

    constructor(options: DesktopLyricsButtonControllerOptions) {
        this.button = options.button;
        this.addDomListener = options.addDomListener;
    }

    bind(): void {
        if (this.bound || !this.button) {
            return;
        }

        this.addDomListener(this.button, 'click', () => {
            void this.toggle();
        });
        this.bound = true;
    }

    async initialize(): Promise<void> {
        if (!this.button) return;

        try {
            const settings = cacheManager.getLocalCache<MusicBoxSettingsCache>('musicbox-settings') || {};
            const enabled = Object.prototype.hasOwnProperty.call(settings, 'desktopLyrics')
                ? settings.desktopLyrics === true
                : true;

            console.log('🎵 DesktopLyricsButtonController: 初始化桌面歌词按钮，设置状态:', enabled, '(来源: CacheManager)');

            await this.updateVisibility(enabled);

            if (enabled) {
                const isVisible = await desktopLyricsController.isVisible();
                this.updateButton(isVisible);
            }
        } catch (error) {
            console.error('❌ DesktopLyricsButtonController: 初始化桌面歌词按钮状态失败:', error);
        }
    }

    async updateVisibility(enabled: boolean): Promise<void> {
        if (!this.button) {
            return;
        }

        if (enabled) {
            this.button.style.display = '';
            this.button.disabled = false;
            await this.checkWindowState();
            return;
        }

        this.button.style.display = 'none';
        this.button.disabled = true;
    }

    private async toggle(): Promise<void> {
        try {
            const result = await desktopLyricsController.toggle();

            if (result.success) {
                this.updateButton(result.visible);
                showToast(result.visible ? '桌面歌词已显示' : '桌面歌词已隐藏', result.visible ? 'success' : 'info');
                return;
            }

            showToast('桌面歌词操作失败', 'error');
        } catch (error) {
            showToast('桌面歌词操作异常', 'error');
        }
    }

    private updateButton(isVisible: boolean | undefined): void {
        if (!this.button) return;

        if (isVisible) {
            this.button.classList.add('active');
            return;
        }

        this.button.classList.remove('active');
    }

    private async checkWindowState(): Promise<void> {
        try {
            const isVisible = await desktopLyricsController.isVisible();
            this.updateButton(isVisible);
        } catch (error) {
            console.error('❌ DesktopLyricsButtonController: 检查桌面歌词窗口状态失败:', error);
        }
    }
}

export {DesktopLyricsButtonController};
