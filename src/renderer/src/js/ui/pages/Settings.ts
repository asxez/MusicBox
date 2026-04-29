/**
 * 设置组件
 */

import {showToast} from '@utils/index.js';
import {appInfoSettingsService} from "@services/settings/AppInfoSettingsService";
import {
    audioEngineSettingsController,
    type AudioEngineSettingsElements
} from "@services/settings/AudioEngineSettingsController";
import {displayModeSettingsController} from "@services/settings/DisplayModeSettingsController";
import {
    displayModeSettingsRenderer,
    type DesktopLyricsSettingsElements,
    type MiniModeSettingsElements
} from "@services/settings/DisplayModeSettingsRenderer";
import {
    generalSettingsController,
    type GeneralSettingsElements
} from "@services/settings/GeneralSettingsController";
import {hardwareAccelerationSettingsController} from "@services/settings/HardwareAccelerationSettingsController";
import {musicFolderListRenderer} from "@services/settings/MusicFolderListRenderer";
import {musicFolderSettingsController} from "@services/settings/MusicFolderSettingsController";
import {musicFolderSettingsService} from "@services/settings/MusicFolderSettingsService";
import {appInteractionService} from "@services/ui/AppInteractionService";
import {settingsPanelVisibilityService} from "@services/settings/SettingsPanelVisibilityService";
import {settingsPageVisibilityService} from "@services/settings/SettingsPageVisibilityService";
import {settingsSectionNavigationService} from "@services/settings/SettingsSectionNavigationService";
import {settingsStore, type SettingValue} from "@services/settings/SettingsStore";
import {
    settingsToolsController,
    type SettingsToolsElements
} from "@services/settings/SettingsToolsController";
import {
    shortcutSettingsController,
    type ShortcutSettingsElements
} from "@services/settings/ShortcutSettingsController";
import {
    traySettingsController,
    type TraySettingsElements
} from "@services/settings/TraySettingsController";
import {Component} from "@components/base/Component";
import type {MusicBoxSettings} from "@api/types/settings";

const getInputTarget = (event: Event): HTMLInputElement => event.target as HTMLInputElement;
const getSelectTarget = (event: Event): HTMLSelectElement => event.target as HTMLSelectElement;
class Settings extends Component {
    [key: string]: any;

    declare element: HTMLElement;
    isVisible: boolean;
    settings: MusicBoxSettings;
    currentSection: string = 'appearance';
    page!: HTMLElement;

    constructor(element: HTMLElement | null) {
        super(element);
        if (!this.element) {
            throw new Error('Settings element not found');
        }

        this.element = this.element as HTMLElement;
        this.isVisible = false;
        this.settings = this.loadSettings();

        this.setupElements();
        this.setupEventListeners();
        this.initializeSettings();
        this.initializeSectionDisplay();
        this.updateVersionInfo();
    }

    async show(): Promise<void> {
        this.isVisible = true;
        settingsPageVisibilityService.show(this.page);
        await settingsToolsController.showCacheStatistics(this.getSettingsToolsElements());
    }

    hide(): void {
        this.isVisible = false;
        settingsPageVisibilityService.hide(this.page, () => this.isVisible);
    }

    destroy(): void {
        // 重置状态
        this.isVisible = false;
        this.settings = {};
        super.destroy();
    }

    setupElements(): void {
        this.page = this.element as HTMLElement;

        // 关闭按钮
        this.closeBtn = this.element.querySelector('#settings-close-btn');

        // 侧边栏导航元素
        this.navButtons = this.element.querySelectorAll('.settings-nav-btn');
        this.currentSection = 'appearance'; // 默认显示外观设置

        // 设置控件元素
        this.languageSelect = this.element.querySelector('#language-select');
        this.autoplayToggle = this.element.querySelector('#autoplay-toggle');
        this.rememberPositionToggle = this.element.querySelector('#remember-position-toggle');
        this.desktopLyricsToggle = this.element.querySelector('#desktop-lyrics-toggle');
        this.statisticsToggle = this.element.querySelector('#statistics-toggle');
        this.recentPlayToggle = this.element.querySelector('#recent-play-toggle');
        this.artistsPageToggle = this.element.querySelector('#artists-page-toggle');
        this.albumsPageToggle = this.element.querySelector('#albums-page-toggle');
        this.showTrackCoversToggle = this.element.querySelector('#show-track-covers-toggle');
        this.gaplessPlaybackToggle = this.element.querySelector('#gapless-playback-toggle');
        this.exclusiveModeToggle = this.element.querySelector('#exclusive-mode-toggle');
        this.exclusiveModeItem = this.element.querySelector('#exclusive-mode-item');
        this.wasapiShareModeSelect = this.element.querySelector('#wasapi-share-mode-select');
        this.wasapiShareModeItem = this.element.querySelector('#wasapi-share-mode-item');

        // 系统托盘相关元素
        this.systemTrayToggle = this.element.querySelector('#system-tray-toggle');
        this.trayCloseBehaviorSelect = this.element.querySelector('#tray-close-behavior-select');
        this.trayStartMinimizedToggle = this.element.querySelector('#tray-start-minimized-toggle');
        this.trayCloseBehaviorItem = this.element.querySelector('#tray-close-behavior-item');
        this.trayStartMinimizedItem = this.element.querySelector('#tray-start-minimized-item');
        this.autoScanToggle = this.element.querySelector('#auto-scan-toggle');
        this.selectFolderBtn = this.element.querySelector('#select-folder-btn');
        this.musicFoldersContainer = this.element.querySelector('#music-folders-container');
        this.musicFoldersList = this.element.querySelector('#music-folders-list');
        this.scanFrequencyContainer = this.element.querySelector('#scan-frequency-container');
        this.scanFrequencySelect = this.element.querySelector('#scan-frequency-select');
        this.selectLyricsFolderBtn = this.element.querySelector('#select-lyrics-folder-btn');
        this.lyricsFolderPath = this.element.querySelector('#lyrics-folder-path');
        this.selectCoverCacheFolderBtn = this.element.querySelector('#select-cover-cache-folder-btn');
        this.coverCacheFolderPath = this.element.querySelector('#cover-cache-folder-path');
        this.checkUpdatesBtn = this.element.querySelector('#check-updates-btn');
        this.goToRepositoryBtn = this.element.querySelector('#MADE-BY');

        // 缓存管理元素
        this.viewCacheStatsBtn = this.element.querySelector('#view-cache-stats-btn');
        this.validateCacheBtn = this.element.querySelector('#validate-cache-btn');
        this.clearCacheBtn = this.element.querySelector('#clear-cache-btn');
        this.clearIgnoreListBtn = this.element.querySelector('#clear-ignore-list-btn');
        this.cacheStatsDescription = this.element.querySelector('#cache-stats-description');

        // 内嵌歌词测试元素
        this.testEmbeddedLyricsBtn = this.element.querySelector('#test-embedded-lyrics-btn');

        // 快捷键配置元素
        this.globalShortcutsToggle = this.element.querySelector('#global-shortcuts-toggle');
        this.shortcutsContainer = this.element.querySelector('#shortcuts-container');
        this.localShortcutsList = this.element.querySelector('#local-shortcuts-list');
        this.globalShortcutsList = this.element.querySelector('#global-shortcuts-list');
        this.globalShortcutsGroup = this.element.querySelector('#global-shortcuts-group');
        this.resetShortcutsBtn = this.element.querySelector('#reset-shortcuts-btn');

        // 网络磁盘配置元素
        this.networkDriveToggle = this.element.querySelector('#network-drive-toggle');
        this.networkDriveConfig = this.element.querySelector('#network-drive-config');
        this.addNetworkDriveBtn = this.element.querySelector('#add-network-drive-btn');

        // 硬件加速配置元素
        this.hardwareAccelerationToggle = this.element.querySelector('#hardware-acceleration-toggle');

        // 打开应用数据文件夹按钮
        this.openSoftDirBtn = this.element.querySelector('#open-soft-dir');

        // 开发者工具按钮
        this.developerToolsBtn = this.element.querySelector('#developer-tools');

        // 歌词高亮透明度设置
        this.lyricsHighlightOpacitySlider = this.element.querySelector('#lyrics-highlight-opacity-slider');
        this.lyricsHighlightOpacityValue = this.element.querySelector('#lyrics-highlight-opacity-value');

        // 歌词高亮颜色设置
        this.lyricsHighlightColor = this.element.querySelector('#lyrics-highlight-color');
        this.lyricsHighlightColorValue = this.element.querySelector('#lyrics-highlight-color-value');

        // 桌面歌词设置元素
        this.dlDisplayModeSelect = this.element.querySelector('#dl-display-mode-select');
        this.dlLayoutModeSelect = this.element.querySelector('#dl-layout-mode-select');
        this.dlThemeColor = this.element.querySelector('#dl-theme-color');
        this.dlThemeColorValue = this.element.querySelector('#dl-theme-color-value');
        this.dlFontColor = this.element.querySelector('#dl-font-color');
        this.dlFontColorValue = this.element.querySelector('#dl-font-color-value');
        this.dlOpacitySlider = this.element.querySelector('#dl-opacity-slider');
        this.dlOpacityValue = this.element.querySelector('#dl-opacity-value');
        this.dlFontSizeSlider = this.element.querySelector('#dl-font-size-slider');
        this.dlFontSizeValue = this.element.querySelector('#dl-font-size-value');

        // 迷你模式设置元素
        this.miniModeFontColor = this.element.querySelector('#mini-mode-font-color');
        this.miniModeFontColorValue = this.element.querySelector('#mini-mode-font-color-value');
        this.miniModeHighlightColor = this.element.querySelector('#mini-mode-highlight-color');
        this.miniModeHighlightColorValue = this.element.querySelector('#mini-mode-highlight-color-value');
        this.miniModeFontSizeSlider = this.element.querySelector('#mini-mode-font-size-slider');
        this.miniModeFontSizeValue = this.element.querySelector('#mini-mode-font-size-value');

        // 插件管理元素
        this.openPluginManagerBtn = this.element.querySelector('#open-plugin-manager-btn');
    }

    setupEventListeners(): void {
        generalSettingsController.initialize(this.getGeneralSettingsElements(), {
            hide: () => this.hide(),
            switchToSection: (sectionName) => this.switchToSection(sectionName),
            updateSetting: (key, value) => this.updateSetting(key, value),
            emit: (eventName, ...args) => this.emit(eventName, ...args)
        });

        audioEngineSettingsController.initialize(this.getAudioEngineSettingsElements(), {
            updateSetting: (key, value) => this.updateSetting(key, value)
        });

        this.addEventListenerManaged(this.autoScanToggle, 'change', async (e: Event) => {
            await this.handleAutoScanToggle(getInputTarget(e).checked);
        });

        // 按钮事件
        this.addEventListenerManaged(this.selectFolderBtn, 'click', async () => {
            await this.handleAddMusicFolder();
        });

        // 扫描频率更改
        this.addEventListenerManaged(this.scanFrequencySelect, 'change', async (e: Event) => {
            await this.handleScanFrequencyChange(getSelectTarget(e).value);
        });

        traySettingsController.initialize(this.getTraySettingsElements(), {
            updateSetting: (key, value) => this.updateSetting(key, value)
        });

        settingsToolsController.initialize(this.getSettingsToolsElements(), {
            updateSetting: (key, value) => this.updateSetting(key, value),
            emit: (eventName, ...args) => this.emit(eventName, ...args)
        });

        // 前往仓库按钮事件
        this.addEventListenerManaged(this.goToRepositoryBtn, 'click', async () => {
            await this.openRepository();
        });

        this.addEventListenerManaged(this.clearIgnoreListBtn, 'click', async () => {
            await this.handleClearIgnoreList();
        });

        // 快捷键配置事件监听器
        shortcutSettingsController.initialize(
            this.getShortcutSettingsElements(),
            () => this.emit('shortcutsUpdated')
        );

        // 硬件加速功能开关
        this.addEventListenerManaged(this.hardwareAccelerationToggle, 'change', async (e: Event) => {
            const result = await hardwareAccelerationSettingsController.handleChange(getInputTarget(e).checked);
            this.hardwareAccelerationToggle.checked = result.checked;
        });

        // 打开应用数据文件夹按钮
        if (this.openSoftDirBtn) {
            this.addEventListenerManaged(this.openSoftDirBtn, 'click', async () => {
                await hardwareAccelerationSettingsController.openUserDataFolder();
            });
        }

        // 开发者工具按钮
        if (this.developerToolsBtn) {
            this.addEventListenerManaged(this.developerToolsBtn, 'click', async () => {
                await hardwareAccelerationSettingsController.openDevTools();
            });
        }

        // 插件管理事件监听器
        if (this.openPluginManagerBtn) {
            this.addEventListenerManaged(this.openPluginManagerBtn, 'click', async () => {
                await this.openPluginManager();
            });
        }

        // 桌面歌词设置事件监听器
        if (this.dlDisplayModeSelect) {
            this.addEventListenerManaged(this.dlDisplayModeSelect, 'change', (e: Event) => {
                this.updateDesktopLyricsSetting('displayMode', getSelectTarget(e).value);
            });
        }

        if (this.dlLayoutModeSelect) {
            this.addEventListenerManaged(this.dlLayoutModeSelect, 'change', (e: Event) => {
                this.updateDesktopLyricsSetting('layoutMode', getSelectTarget(e).value);
            });
        }

        if (this.dlThemeColor) {
            this.addEventListenerManaged(this.dlThemeColor, 'input', (e: Event) => {
                const color = getInputTarget(e).value;
                displayModeSettingsRenderer.updateDesktopLyricsValue(this.getDesktopLyricsElements(), 'themeColor', color);
                this.updateDesktopLyricsSetting('themeColor', color);
            });
        }

        if (this.dlFontColor) {
            this.addEventListenerManaged(this.dlFontColor, 'input', (e: Event) => {
                const color = getInputTarget(e).value;
                displayModeSettingsRenderer.updateDesktopLyricsValue(this.getDesktopLyricsElements(), 'fontColor', color);
                this.updateDesktopLyricsSetting('fontColor', color);
            });
        }

        if (this.dlOpacitySlider) {
            this.addEventListenerManaged(this.dlOpacitySlider, 'input', (e: Event) => {
                const opacity = parseFloat(getInputTarget(e).value);
                displayModeSettingsRenderer.updateDesktopLyricsValue(this.getDesktopLyricsElements(), 'opacity', opacity);
                this.updateDesktopLyricsSetting('opacity', opacity);
            });
        }

        if (this.dlFontSizeSlider) {
            this.addEventListenerManaged(this.dlFontSizeSlider, 'input', (e: Event) => {
                const fontSize = parseInt(getInputTarget(e).value);
                displayModeSettingsRenderer.updateDesktopLyricsValue(this.getDesktopLyricsElements(), 'fontSize', fontSize);
                this.updateDesktopLyricsSetting('fontSize', fontSize);
            });
        }

        // 迷你模式设置事件监听器
        if (this.miniModeFontColor) {
            this.addEventListenerManaged(this.miniModeFontColor, 'input', (e: Event) => {
                const color = getInputTarget(e).value;
                displayModeSettingsRenderer.updateMiniModeValue(this.getMiniModeElements(), 'fontColor', color);
                this.updateMiniModeSetting('fontColor', color);
            });
        }

        if (this.miniModeHighlightColor) {
            this.addEventListenerManaged(this.miniModeHighlightColor, 'input', (e: Event) => {
                const color = getInputTarget(e).value;
                displayModeSettingsRenderer.updateMiniModeValue(this.getMiniModeElements(), 'highlightColor', color);
                this.updateMiniModeSetting('highlightColor', color);
            });
        }

        if (this.miniModeFontSizeSlider) {
            this.addEventListenerManaged(this.miniModeFontSizeSlider, 'input', (e: Event) => {
                const fontSize = parseInt(getInputTarget(e).value);
                displayModeSettingsRenderer.updateMiniModeValue(this.getMiniModeElements(), 'fontSize', fontSize);
                this.updateMiniModeSetting('fontSize', fontSize);
            });
        }

        this.addEventListenerManaged(document, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async toggle(): Promise<void> {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show();
        }
    }

    // 初始化设置值
    initializeSettings(): void {
        const initialValues = settingsStore.getInitialValues(this.settings);

        this.languageSelect.value = initialValues.language;
        this.autoplayToggle.checked = initialValues.autoplay;
        this.rememberPositionToggle.checked = initialValues.rememberPosition;
        this.desktopLyricsToggle.checked = initialValues.desktopLyrics;
        this.statisticsToggle.checked = initialValues.statistics;
        this.recentPlayToggle.checked = initialValues.recentPlay;
        this.artistsPageToggle.checked = initialValues.artistsPage;
        this.albumsPageToggle.checked = initialValues.albumsPage;
        this.showTrackCoversToggle.checked = initialValues.showTrackCovers;
        this.gaplessPlaybackToggle.checked = initialValues.gaplessPlayback;

        // 初始化音乐文件夹和自动扫描设置
        this.initializeMusicFoldersAndAutoScan();

        // 初始化音频独占模式设置（仅Windows平台）
        this.initializeExclusiveModeSettings();

        // 初始化系统托盘设置
        this.systemTrayToggle.checked = initialValues.systemTray;
        this.trayCloseBehaviorSelect.value = initialValues.trayCloseBehavior;
        this.trayStartMinimizedToggle.checked = initialValues.trayStartMinimized;
        traySettingsController.toggleSettings(this.getTraySettingsElements(), this.systemTrayToggle.checked);

        // 初始化媒体目录
        settingsToolsController.initializeLyricsDirectory(this.settings, this.getSettingsToolsElements());
        void settingsToolsController.initializeCoverCacheDirectory(
            this.settings,
            this.getSettingsToolsElements(),
            {
                updateSetting: (key, value) => this.updateSetting(key, value),
                emit: (eventName, ...args) => this.emit(eventName, ...args)
            }
        );

        // 初始化网络磁盘设置
        this.networkDriveToggle.checked = initialValues.networkDriveEnabled;
        this.toggleNetworkDriveConfig(this.networkDriveToggle.checked);

        // 初始化硬件加速设置
        this.initializeHardwareAccelerationSettings();

        // 初始化歌词高亮透明度设置
        settingsToolsController.initializeLyricsAppearance(
            this.settings,
            this.getSettingsToolsElements(),
            {
                updateSetting: (key, value) => this.updateSetting(key, value),
                emit: (eventName, ...args) => this.emit(eventName, ...args)
            }
        );

        // 初始化桌面歌词设置
        this.initializeDesktopLyricsSettings();

        // 初始化迷你模式设置
        this.initializeMiniModeSettings();

        console.log('🎵 Settings: 设置值初始化完成', this.settings);

        // 初始化完成后，发出设置状态事件，确保相关组件同步
        this.emitInitialSettingEvents(initialValues);
    }

    private emitInitialSettingEvents(initialValues: ReturnType<typeof settingsStore.getInitialValues>): void {
        const events = settingsStore.getSyncEvents(initialValues);

        setTimeout(() => {
            Object.entries(events).forEach(([eventName, enabled]) => {
                this.emit(eventName, enabled);
            });
        }, 100);
    }

    // 加载设置
    loadSettings(): MusicBoxSettings {
        return settingsStore.load();
    }

    // 更新设置
    updateSetting(key: string, value: SettingValue): void {
        this.settings = settingsStore.update(this.settings, key, value);
    }

    // 获取设置值
    getSetting<T = unknown>(key: string, defaultValue: T | null = null): T | null {
        return settingsStore.get(this.settings, key, defaultValue);
    }

    // 初始化音频独占模式设置
    initializeExclusiveModeSettings(): void {
        audioEngineSettingsController.initializeExclusiveModeSettings(this.settings, this.getAudioEngineSettingsElements());
    }

    // 初始化硬件加速设置
    async initializeHardwareAccelerationSettings(): Promise<void> {
        this.hardwareAccelerationToggle.checked = await hardwareAccelerationSettingsController.getInitialEnabled();
    }

    // 网络磁盘相关方法

    // 切换网络磁盘配置区域显示
    toggleNetworkDriveConfig(enabled: boolean): void {
        settingsPanelVisibilityService.toggleNetworkDriveConfig(this.networkDriveConfig, enabled);
    }

    // 显示网络磁盘配置模态框
    showNetworkDriveModal(): void {
        if (!appInteractionService.showNetworkDriveModal()) {
            this.showNotification('网络磁盘功能不可用', 'error');
        }
    }

    // 显示通知消息
    showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' | string = 'info'): void {
        showToast(message, type as any);
    }

    // 切换到指定的设置区域
    switchToSection(sectionName: string): void {
        this.currentSection = sectionName;
        settingsSectionNavigationService.switchToSection(sectionName);
    }

    // 初始化设置区域显示
    initializeSectionDisplay(): void {
        // 默认显示第一个区域（外观设置）
        this.switchToSection(this.currentSection);
    }

    // 更新版本信息显示
    async updateVersionInfo(): Promise<void> {
        try {
            await appInfoSettingsService.updateVersionInfo();
        } catch (error) {
            console.error('❌ Settings: 更新版本信息失败:', error);
        }
    }

    async openRepository(): Promise<void> {
        const result = await appInfoSettingsService.openRepository();
        if (!result.success) {
            this.showNotification(result.error || '打开仓库失败', 'error');
        }
    }

    async openPluginManager(): Promise<void> {
        const opened = await appInteractionService.showPluginManager();
        if (!opened) {
            this.showNotification('插件管理器不可用', 'error');
        }
    }

    // 音乐文件夹和自动扫描相关方法
    async initializeMusicFoldersAndAutoScan(): Promise<void> {
        try {
            // 加载音乐文件夹列表
            const folders = await musicFolderSettingsService.getMusicFolders();
            this.renderMusicFolders(folders);

            // 加载自动扫描设置
            const autoScanSettings = await musicFolderSettingsService.getAutoScanSettings();
            this.autoScanToggle.checked = autoScanSettings.enabled || false;
            this.scanFrequencySelect.value = autoScanSettings.frequency || 'on_startup';

            // 根据自动扫描状态显示/隐藏扫描频率设置
            this.toggleScanFrequencyVisibility(autoScanSettings.enabled);
        } catch (error) {
            console.error('❌ Settings: 初始化音乐文件夹和自动扫描设置失败:', error);
        }
    }

    async handleAddMusicFolder(): Promise<void> {
        const folders = await musicFolderSettingsController.addMusicFolder();
        if (folders) {
            this.renderMusicFolders(folders);
        }
    }

    async handleRemoveMusicFolder(folderPath: string): Promise<void> {
        const folders = await musicFolderSettingsController.removeMusicFolder(folderPath);
        if (folders) {
            this.renderMusicFolders(folders);
        }
    }

    renderMusicFolders(folders: string[] | null | undefined): void {
        musicFolderListRenderer.render({
            container: this.musicFoldersContainer,
            list: this.musicFoldersList,
            folders,
            onRemove: (folderPath) => this.handleRemoveMusicFolder(folderPath)
        });
    }

    async handleAutoScanToggle(enabled: boolean): Promise<void> {
        const result = await musicFolderSettingsController.toggleAutoScan(enabled);
        this.autoScanToggle.checked = result.checked;
        this.toggleScanFrequencyVisibility(result.checked);
    }

    async handleScanFrequencyChange(frequency: string): Promise<void> {
        await musicFolderSettingsController.updateScanFrequency(frequency);
    }

    toggleScanFrequencyVisibility(visible: boolean): void {
        settingsPanelVisibilityService.toggleScanFrequency(this.scanFrequencyContainer, visible);
    }

    async handleClearIgnoreList(): Promise<void> {
        await musicFolderSettingsController.clearIgnoreList();
    }

    // 桌面歌词设置相关方法
    async updateDesktopLyricsSetting(key: string, value: string | number): Promise<void> {
        // 更新本地设置缓存
        const desktopLyricsSettings = displayModeSettingsController.updateDesktopLyricsSetting(this.settings, key, value);
        this.updateSetting('desktopLyricsSettings', desktopLyricsSettings);
    }

    initializeDesktopLyricsSettings(): void {
        const dlSettings = displayModeSettingsController.getDesktopLyricsSettings(this.settings);
        displayModeSettingsRenderer.initializeDesktopLyricsSettings(this.getDesktopLyricsElements(), dlSettings);
        displayModeSettingsController.scheduleDesktopLyricsSync(dlSettings);
    }

    // 迷你模式设置相关方法
    async updateMiniModeSetting(key: string, value: string | number): Promise<void> {
        // 更新本地设置缓存
        const miniModeSettings = displayModeSettingsController.updateMiniModeSetting(this.settings, key, value);
        this.updateSetting('miniModeSettings', miniModeSettings);
        this.emit('miniModeSettingsChanged', {key, value});
    }

    applyMiniModeSetting(key: string, value: string | number): void {
        displayModeSettingsController.applyMiniModeSetting(key, value);

        // 通知Player组件设置已更新
        this.emit('miniModeSettingsChanged', {key, value});
    }

    initializeMiniModeSettings(): void {
        const mmSettings = displayModeSettingsController.getMiniModeSettings(this.settings);
        displayModeSettingsRenderer.initializeMiniModeSettings(this.getMiniModeElements(), mmSettings);

        this.applyMiniModeSetting('fontColor', mmSettings.fontColor);
        this.applyMiniModeSetting('highlightColor', mmSettings.highlightColor);
        this.applyMiniModeSetting('fontSize', mmSettings.fontSize);
    }

    private getDesktopLyricsElements(): DesktopLyricsSettingsElements {
        return {
            displayModeSelect: this.dlDisplayModeSelect,
            layoutModeSelect: this.dlLayoutModeSelect,
            themeColorInput: this.dlThemeColor,
            themeColorValue: this.dlThemeColorValue,
            opacitySlider: this.dlOpacitySlider,
            opacityValue: this.dlOpacityValue,
            fontSizeSlider: this.dlFontSizeSlider,
            fontSizeValue: this.dlFontSizeValue,
            fontColorInput: this.dlFontColor,
            fontColorValue: this.dlFontColorValue
        };
    }

    private getMiniModeElements(): MiniModeSettingsElements {
        return {
            fontColorInput: this.miniModeFontColor,
            fontColorValue: this.miniModeFontColorValue,
            highlightColorInput: this.miniModeHighlightColor,
            highlightColorValue: this.miniModeHighlightColorValue,
            fontSizeSlider: this.miniModeFontSizeSlider,
            fontSizeValue: this.miniModeFontSizeValue
        };
    }

    private getShortcutSettingsElements(): ShortcutSettingsElements {
        return {
            globalShortcutsToggle: this.globalShortcutsToggle,
            resetShortcutsButton: this.resetShortcutsBtn,
            localShortcutsList: this.localShortcutsList,
            globalShortcutsList: this.globalShortcutsList,
            globalShortcutsGroup: this.globalShortcutsGroup
        };
    }

    private getGeneralSettingsElements(): GeneralSettingsElements {
        return {
            navButtons: this.navButtons,
            closeButton: this.closeBtn,
            languageSelect: this.languageSelect,
            autoplayToggle: this.autoplayToggle,
            rememberPositionToggle: this.rememberPositionToggle,
            desktopLyricsToggle: this.desktopLyricsToggle,
            statisticsToggle: this.statisticsToggle,
            recentPlayToggle: this.recentPlayToggle,
            artistsPageToggle: this.artistsPageToggle,
            albumsPageToggle: this.albumsPageToggle,
            showTrackCoversToggle: this.showTrackCoversToggle,
            gaplessPlaybackToggle: this.gaplessPlaybackToggle,
            networkDriveToggle: this.networkDriveToggle,
            networkDriveConfig: this.networkDriveConfig,
            checkUpdatesButton: this.checkUpdatesBtn,
            addNetworkDriveButton: this.addNetworkDriveBtn
        };
    }

    private getSettingsToolsElements(): SettingsToolsElements {
        return {
            selectLyricsFolderButton: this.selectLyricsFolderBtn,
            lyricsFolderPath: this.lyricsFolderPath,
            selectCoverCacheFolderButton: this.selectCoverCacheFolderBtn,
            coverCacheFolderPath: this.coverCacheFolderPath,
            viewCacheStatsButton: this.viewCacheStatsBtn,
            validateCacheButton: this.validateCacheBtn,
            clearCacheButton: this.clearCacheBtn,
            cacheStatsDescription: this.cacheStatsDescription,
            testEmbeddedLyricsButton: this.testEmbeddedLyricsBtn,
            lyricsHighlightOpacitySlider: this.lyricsHighlightOpacitySlider,
            lyricsHighlightOpacityValue: this.lyricsHighlightOpacityValue,
            lyricsHighlightColorInput: this.lyricsHighlightColor,
            lyricsHighlightColorValue: this.lyricsHighlightColorValue
        };
    }

    private getAudioEngineSettingsElements(): AudioEngineSettingsElements {
        return {
            exclusiveModeToggle: this.exclusiveModeToggle,
            exclusiveModeItem: this.exclusiveModeItem,
            wasapiShareModeSelect: this.wasapiShareModeSelect,
            wasapiShareModeItem: this.wasapiShareModeItem
        };
    }

    private getTraySettingsElements(): TraySettingsElements {
        return {
            systemTrayToggle: this.systemTrayToggle,
            trayCloseBehaviorSelect: this.trayCloseBehaviorSelect,
            trayStartMinimizedToggle: this.trayStartMinimizedToggle,
            trayCloseBehaviorItem: this.trayCloseBehaviorItem,
            trayStartMinimizedItem: this.trayStartMinimizedItem
        };
    }
}

export {Settings};
