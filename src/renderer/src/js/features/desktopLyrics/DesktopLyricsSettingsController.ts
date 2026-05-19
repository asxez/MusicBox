import {desktopLyricsWindowService} from './service';
import type {DesktopLyricsLockController} from './DesktopLyricsLockController';
import type {DesktopLyricsElements, DesktopLyricsSettings} from './DesktopLyricsTypes';

type DesktopLyricsWindowService = typeof desktopLyricsWindowService;

const DESKTOP_LYRICS_SETTINGS_KEY = 'desktop-lyrics-settings';

const DEFAULT_DESKTOP_LYRICS_SETTINGS: DesktopLyricsSettings = {
    layoutMode: 'default',
    themeColor: '#64b5f6',
    fontColor: '#000',
    opacity: 0.9,
    fontSize: 48
};

export class DesktopLyricsSettingsController {
    private settings: DesktopLyricsSettings = {...DEFAULT_DESKTOP_LYRICS_SETTINGS};

    constructor(
        private readonly elements: Pick<DesktopLyricsElements, 'container'>,
        private readonly lockController: DesktopLyricsLockController,
        private readonly windowService: DesktopLyricsWindowService = desktopLyricsWindowService
    ) {
    }

    loadSettings(): void {
        try {
            const savedSettings = localStorage.getItem(DESKTOP_LYRICS_SETTINGS_KEY);
            if (savedSettings) {
                this.settings = {
                    ...this.settings,
                    ...JSON.parse(savedSettings) as Partial<DesktopLyricsSettings>
                };
            }
        } catch (error) {
            console.error('❌ 桌面歌词: 加载设置失败', error);
        }
    }

    async updateSettings(newSettings?: Partial<DesktopLyricsSettings>): Promise<void> {
        if (!newSettings) return;

        this.settings = {...this.settings, ...newSettings};
        this.saveSettings();
        await this.applySettings();
    }

    async applySettings(): Promise<void> {
        const {layoutMode, themeColor, fontColor, opacity, fontSize} = this.settings;

        document.documentElement.style.setProperty('--theme-color', themeColor);

        if (fontColor) {
            document.documentElement.style.setProperty('--dl-font-color', fontColor);
        }

        document.documentElement.style.setProperty('--lyric-font-size', `${fontSize}px`);

        await this.applyWindowOperation(
            () => this.windowService.setOpacity(opacity),
            '设置透明度失败'
        );

        if (layoutMode === 'center') {
            await this.applyCenterLayout();
        } else {
            await this.applyDefaultLayout();
        }

        console.log('🎵 桌面歌词: 设置已应用', this.settings);
    }

    private saveSettings(): void {
        try {
            localStorage.setItem(DESKTOP_LYRICS_SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error('❌ 桌面歌词: 保存设置失败', error);
        }
    }

    private async applyCenterLayout(): Promise<void> {
        this.elements.container.classList.add('center-mode');

        await this.applyWindowOperation(
            () => this.windowService.setAlwaysOnTop(false),
            '设置置顶状态失败'
        );
        await this.applyWindowOperation(
            () => this.windowService.setIgnoreMouseEvents(true, {forward: true}),
            '设置鼠标穿透失败'
        );
        await this.applyWindowOperation(
            () => this.windowService.centerOnScreen(),
            '居中窗口失败'
        );

        this.lockController.forceUnlocked();
    }

    private async applyDefaultLayout(): Promise<void> {
        this.elements.container.classList.remove('center-mode');

        await this.applyWindowOperation(
            () => this.windowService.setAlwaysOnTop(true),
            '设置置顶状态失败'
        );
        await this.applyWindowOperation(
            () => this.lockController.applyMousePassthrough(),
            '设置鼠标穿透失败'
        );
    }

    private async applyWindowOperation(operation: () => Promise<unknown>, errorMessage: string): Promise<void> {
        try {
            await operation();
        } catch (error) {
            console.error(`❌ 桌面歌词: ${errorMessage}`, error);
        }
    }
}
