/**
 * 设置组件
 */

import {showToast} from '@utils';
import {cacheManager} from "@services/CacheManager";
import {localLyricsManager} from "@services/lyrics/LocalLyricsManager";
import {localCoverManager} from "@services/cover/LocalCoverManager";
import {embeddedLyricsManager} from "@services/lyrics/EmbeddedLyricsManager";
import {Component} from "@components/base/Component";
import {api} from "@api/api";
import {app} from "@core/app";
import {shortcutConfig} from "@utils/shortcuts/ShortcutConfig";
import {shortcutRecorder} from "@utils/shortcuts/ShortcutRecorder";
import {libraryAPI} from "@api/LibraryAPI";

class Settings extends Component {
    constructor(element) {
        super(element);
        this.element = element;
        this.isVisible = false;
        this.settings = this.loadSettings();

        this.setupElements();
        this.setupEventListeners();
        this.initializeSettings();
        this.initializeSectionDisplay();
        this.updateVersionInfo();
    }

    async show() {
        this.isVisible = true;
        this.page.style.display = 'block';

        // 隐藏其他页面元素
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';

        // 使用 requestAnimationFrame 确保动画正常播放
        requestAnimationFrame(() => {
            this.page.classList.add('show');
        });

        // 加载缓存统计信息
        await this.showCacheStatistics();
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');
        this.page.classList.add('hiding');

        // 等待动画完成后隐藏页面
        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
                this.page.classList.remove('hiding');

                // 恢复其他页面元素
                document.getElementById('sidebar').style.display = 'block';
                document.getElementById('main-content').style.display = 'block';
            }
        }, 300);
    }

    destroy() {
        // 重置状态
        this.isVisible = false;
        this.settings = null;
        super.destroy();
    }

    setupElements() {
        this.page = this.element;

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

        // 歌词高亮透明度控制元素
        this.lyricsHighlightOpacitySlider = this.element.querySelector('#lyrics-highlight-opacity-slider');
        this.lyricsHighlightOpacityValue = this.element.querySelector('#lyrics-highlight-opacity-value');

        // 插件管理元素
        this.openPluginManagerBtn = this.element.querySelector('#open-plugin-manager-btn');
    }

    setupEventListeners() {
        // 侧边栏导航事件
        this.navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchToSection(section);
            });
        });

        // 关闭按钮事件
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // 语言设置
        this.languageSelect.addEventListener('change', (e) => {
            this.updateSetting('language', e.target.value);
            this.emit('languageChanged', e.target.value);
        });

        // 各种开关设置
        this.autoplayToggle.addEventListener('change', (e) => {
            this.updateSetting('autoplay', e.target.checked);
        });

        this.rememberPositionToggle.addEventListener('change', (e) => {
            this.updateSetting('rememberPosition', e.target.checked);
        });

        // 桌面歌词设置 - 控制按钮显示/隐藏
        this.desktopLyricsToggle.addEventListener('change', async (e) => {
            this.updateSetting('desktopLyrics', e.target.checked);
            this.emit('desktopLyricsEnabled', e.target.checked);

            // 如果禁用功能，同时隐藏已打开的桌面歌词窗口
            if (!e.target.checked) {
                try {
                    await api.hideDesktopLyrics();
                } catch (error) {
                    console.error('❌ Settings: 隐藏桌面歌词失败:', error);
                }
            }
        });

        // 艺术家页设置 - 控制侧边栏艺术家按钮显示/隐藏
        this.statisticsToggle.addEventListener('change', (e) => {
            this.updateSetting('statistics', e.target.checked);
            this.emit('statisticsEnabled', e.target.checked);
        });

        // 统计信息设置 - 控制侧边栏统计按钮显示/隐藏
        this.statisticsToggle.addEventListener('change', (e) => {
            this.updateSetting('statistics', e.target.checked);
            this.emit('statisticsEnabled', e.target.checked);
        });

        // 最近播放设置 - 控制侧边栏最近播放按钮显示/隐藏
        this.recentPlayToggle.addEventListener('change', (e) => {
            this.updateSetting('recentPlay', e.target.checked);
            this.emit('recentPlayEnabled', e.target.checked);
        });

        // 艺术家页面设置 - 控制侧边栏艺术家按钮显示/隐藏
        this.artistsPageToggle.addEventListener('change', (e) => {
            this.updateSetting('artistsPage', e.target.checked);
            this.emit('artistsPageEnabled', e.target.checked);
        });

        // 专辑页面设置
        this.albumsPageToggle.addEventListener('change', (e) => {
            this.updateSetting('albumsPage', e.target.checked);
            this.emit('albumsPageEnabled', e.target.checked);
        });

        // 歌曲封面显示设置 - 控制歌曲列表中封面的显示/隐藏
        this.showTrackCoversToggle.addEventListener('change', (e) => {
            this.updateSetting('showTrackCovers', e.target.checked);
            this.emit('showTrackCoversEnabled', e.target.checked);
        });

        // 音频独占模式设置
        this.exclusiveModeToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            this.updateSetting('exclusiveMode', enabled);

            console.log(`🎵 Settings: 音频独占模式${enabled ? '启用' : '禁用'}`);

            // 切换音频引擎
            try {
                const engineType = enabled ? 'wasapi' : 'webaudio';
                const result = await api.switchAudioEngine(engineType);
                if (result) {
                    this.showNotification(`已切换到${enabled ? 'WASAPI独占模式' : 'WebAudio模式'}，当前歌曲将重新加载`);
                } else {
                    console.error('❌ Settings: 音频引擎切换失败');
                    // 切换失败，恢复开关状态
                    e.target.checked = !enabled;
                    this.updateSetting('exclusiveMode', !enabled);
                    this.showNotification('音频引擎切换失败，请查看控制台日志', 'error');
                }
            } catch (error) {
                console.error('❌ Settings: 音频引擎切换异常:', error);
                // 切换失败，恢复开关状态
                e.target.checked = !enabled;
                this.updateSetting('exclusiveMode', !enabled);
                this.showNotification('音频引擎切换失败: ' + error.message, 'error');
            }
        });

        // 无间隙播放设置
        this.gaplessPlaybackToggle.addEventListener('change', (e) => {
            this.updateSetting('gaplessPlayback', e.target.checked);
            this.emit('gaplessPlaybackEnabled', e.target.checked);
        });

        this.autoScanToggle.addEventListener('change', async (e) => {
            await this.handleAutoScanToggle(e.target.checked);
        });

        // 按钮事件
        this.selectFolderBtn.addEventListener('click', async () => {
            await this.handleAddMusicFolder();
        });

        // 扫描频率更改
        this.scanFrequencySelect.addEventListener('change', async (e) => {
            await this.handleScanFrequencyChange(e.target.value);
        });

        // 系统托盘设置
        this.systemTrayToggle.addEventListener('change', async (e) => {
            this.updateSetting('systemTray', e.target.checked);
            this.toggleTraySettings(e.target.checked);
            await window.electronAPI.tray.updateSettings({
                enabled: e.target.checked
            });
        });

        this.trayCloseBehaviorSelect.addEventListener('change', async (e) => {
            this.updateSetting('trayCloseBehavior', e.target.value);
            await window.electronAPI.tray.updateSettings({
                closeToTray: e.target.value === 'minimize'
            });
        });

        this.trayStartMinimizedToggle.addEventListener('change', async (e) => {
            this.updateSetting('trayStartMinimized', e.target.checked);
            await window.electronAPI.tray.updateSettings({
                startMinimized: e.target.checked
            });
        });

        this.selectLyricsFolderBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectFolder();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const selectedPath = result.filePaths[0];
                    this.updateSetting('lyricsDirectory', selectedPath);
                    this.lyricsFolderPath.textContent = selectedPath;
                    this.lyricsFolderPath.classList.add('selected');

                    // 更新本地歌词管理器
                    localLyricsManager.setLyricsDirectory(selectedPath);
                }
            } catch (error) {
                console.error('❌ Settings: 选择歌词目录失败:', error);
            }
        });

        this.selectCoverCacheFolderBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectFolder();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const selectedPath = result.filePaths[0];
                    this.updateSetting('coverCacheDirectory', selectedPath);
                    this.coverCacheFolderPath.textContent = selectedPath;
                    this.coverCacheFolderPath.classList.add('selected');

                    // 更新本地封面管理器
                    localCoverManager.setCoverDirectory(selectedPath);
                }
            } catch (error) {
                console.error('❌ Settings: 选择封面缓存目录失败:', error);
            }
        });

        this.checkUpdatesBtn.addEventListener('click', () => {
            this.emit('checkUpdates');
        });

        // 前往仓库按钮事件
        this.goToRepositoryBtn.addEventListener('click', () => {
            this.openRepository();
        });

        // 缓存管理按钮事件
        this.viewCacheStatsBtn.addEventListener('click', async () => {
            await this.showCacheStatistics();
        });

        this.validateCacheBtn.addEventListener('click', async () => {
            await this.validateCache();
        });

        this.clearCacheBtn.addEventListener('click', async () => {
            await this.clearCache();
        });

        this.clearIgnoreListBtn.addEventListener('click', async () => {
            await this.handleClearIgnoreList();
        });

        // 内嵌歌词测试事件监听器
        this.testEmbeddedLyricsBtn.addEventListener('click', async () => {
            await this.testEmbeddedLyrics();
        });

        // 快捷键配置事件监听器
        this.setupShortcutEventListeners();

        // 网络磁盘功能开关
        this.networkDriveToggle.addEventListener('change', (e) => {
            this.updateSetting('networkDriveEnabled', e.target.checked);
            this.toggleNetworkDriveConfig(e.target.checked);
            this.emit('networkDriveEnabled', e.target.checked);
        });

        // 硬件加速功能开关
        this.hardwareAccelerationToggle.addEventListener('change', async (e) => {
            await this.handleHardwareAccelerationChange(e.target.checked);
        });

        // 打开应用数据文件夹按钮
        if (this.openSoftDirBtn) {
            this.openSoftDirBtn.addEventListener('click', async () => {
                await this.handleOpenUserDataFolder();
            });
        }

        // 开发者工具按钮
        if (this.developerToolsBtn) {
            this.developerToolsBtn.addEventListener('click', async () => {
                await this.handleOpenDevTools();
            });
        }

        // 歌词高亮透明度设置
        this.lyricsHighlightOpacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.lyricsHighlightOpacityValue.textContent = value.toFixed(1);
            this.updateSetting('lyricsHighlightOpacity', value);
            this.updateLyricsHighlightOpacity(value);
        });

        // 添加网络磁盘按钮
        if (this.addNetworkDriveBtn) {
            this.addNetworkDriveBtn.addEventListener('click', () => {
                this.showNetworkDriveModal();
            });
        }

        // 插件管理事件监听器
        if (this.openPluginManagerBtn) {
            this.openPluginManagerBtn.addEventListener('click', async () => {
                await this.openPluginManager();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show();
        }
    }

    // 初始化设置值
    initializeSettings() {
        this.languageSelect.value = this.settings.language || 'zh-CN';
        this.autoplayToggle.checked = this.settings.autoplay || false;
        this.rememberPositionToggle.checked = this.settings.hasOwnProperty('rememberPosition') ? this.settings.rememberPosition : false;
        this.desktopLyricsToggle.checked = this.settings.hasOwnProperty('desktopLyrics') ? this.settings.desktopLyrics : true;
        this.statisticsToggle.checked = this.settings.hasOwnProperty('statistics') ? this.settings.statistics : true;
        this.recentPlayToggle.checked = this.settings.hasOwnProperty('recentPlay') ? this.settings.recentPlay : true;
        this.artistsPageToggle.checked = this.settings.hasOwnProperty('artistsPage') ? this.settings.artistsPage : true;
        this.albumsPageToggle.checked = this.settings.hasOwnProperty('albumsPage') ? this.settings.albumsPage : true;
        this.showTrackCoversToggle.checked = this.settings.hasOwnProperty('showTrackCovers') ? this.settings.showTrackCovers : true;
        this.gaplessPlaybackToggle.checked = this.settings.hasOwnProperty('gaplessPlayback') ? this.settings.gaplessPlayback : false;

        // 初始化音乐文件夹和自动扫描设置
        this.initializeMusicFoldersAndAutoScan();

        // 初始化音频独占模式设置（仅Windows平台）
        this.initializeExclusiveModeSettings();

        // 初始化系统托盘设置
        this.systemTrayToggle.checked = this.settings.hasOwnProperty('systemTray') ? this.settings.systemTray : true;
        this.trayCloseBehaviorSelect.value = this.settings.hasOwnProperty('trayCloseBehavior') ? this.settings.trayCloseBehavior : 'exit';
        this.trayStartMinimizedToggle.checked = this.settings.hasOwnProperty('trayStartMinimized') ? this.settings.trayStartMinimized : false;
        this.toggleTraySettings(this.systemTrayToggle.checked);

        // 初始化本地歌词目录
        const lyricsDirectory = this.settings.lyricsDirectory;
        if (lyricsDirectory) {
            this.lyricsFolderPath.textContent = lyricsDirectory;
            this.lyricsFolderPath.classList.add('selected');

            // 设置本地歌词管理器
            localLyricsManager.setLyricsDirectory(lyricsDirectory);
        } else {
            this.lyricsFolderPath.textContent = '未选择';
            this.lyricsFolderPath.classList.remove('selected');
        }

        // 初始化封面缓存目录
        this.initializeCoverCacheDirectory();

        // 初始化网络磁盘设置
        this.networkDriveToggle.checked = this.settings.hasOwnProperty('networkDriveEnabled') ? this.settings.networkDriveEnabled : false;
        this.toggleNetworkDriveConfig(this.networkDriveToggle.checked);

        // 初始化硬件加速设置
        this.initializeHardwareAccelerationSettings();

        // 初始化歌词高亮透明度设置
        const lyricsOpacity = this.settings.hasOwnProperty('lyricsHighlightOpacity') ? this.settings.lyricsHighlightOpacity : 1.0;
        this.lyricsHighlightOpacitySlider.value = lyricsOpacity;
        this.lyricsHighlightOpacityValue.textContent = lyricsOpacity.toFixed(1);
        this.updateLyricsHighlightOpacity(lyricsOpacity);

        console.log('🎵 Settings: 设置值初始化完成', this.settings);

        // 初始化完成后，发出设置状态事件，确保相关组件同步
        setTimeout(() => {
            this.emit('desktopLyricsEnabled', this.desktopLyricsToggle.checked);
            this.emit('statisticsEnabled', this.statisticsToggle.checked);
            this.emit('recentPlayEnabled', this.recentPlayToggle.checked);
            this.emit('artistsPageEnabled', this.artistsPageToggle.checked);
            this.emit('albumsPageEnabled', this.albumsPageToggle.checked);
            this.emit('gaplessPlaybackEnabled', this.gaplessPlaybackToggle.checked);
            this.emit('networkDriveEnabled', this.networkDriveToggle.checked);
        }, 100);
    }

    // 加载设置
    loadSettings() {
        let settings = cacheManager.getLocalCache('musicbox-settings');
        if (settings === null)
            settings = {};
        return settings;
    }

    // 更新设置
    updateSetting(key, value) {
        this.settings[key] = value;
        cacheManager.setLocalCache('musicbox-settings', this.settings);
    }

    // 获取设置值
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    // 切换托盘设置显示
    toggleTraySettings(enabled) {
        if (this.trayCloseBehaviorItem && this.trayStartMinimizedItem) {
            this.trayCloseBehaviorItem.style.display = enabled ? 'flex' : 'none';
            this.trayStartMinimizedItem.style.display = enabled ? 'flex' : 'none';
        }
    }

    // 初始化音频独占模式设置
    initializeExclusiveModeSettings() {
        // 检查是否为Windows平台
        const isWindows = navigator.platform.toLowerCase().includes('win');

        if (!isWindows) {
            // 非Windows平台，隐藏音频独占模式选项
            if (this.exclusiveModeItem) {
                this.exclusiveModeItem.style.display = 'none';
            }
            console.log('ℹ️ Settings: 非Windows平台，音频独占模式不可用');
            return;
        }

        // Windows平台，显示选项并初始化状态
        if (this.exclusiveModeItem) {
            this.exclusiveModeItem.style.display = 'flex';
        }

        // 初始化开关状态
        this.exclusiveModeToggle.checked = this.settings.hasOwnProperty('exclusiveMode') ? this.settings.exclusiveMode : false;
        console.log(`🎵 Settings: 音频独占模式初始化完成，当前状态: ${this.exclusiveModeToggle.checked ? '启用' : '禁用'}`);
    }

    // 初始化硬件加速设置
    async initializeHardwareAccelerationSettings() {
        try {
            const result = await window.electronAPI.hardwareAcceleration.getSettings();
            if (result.success) {
                this.hardwareAccelerationToggle.checked = result.settings.enabled !== false;
            } else {
                this.hardwareAccelerationToggle.checked = true; // 默认启用
            }
        } catch (error) {
            console.error('❌ Settings: 初始化硬件加速设置失败:', error);
            this.hardwareAccelerationToggle.checked = true; // 默认启用
        }
    }

    // 初始化封面缓存目录
    async initializeCoverCacheDirectory() {
        try {
            let coverCacheDirectory = this.settings.hasOwnProperty('coverCacheDirectory') ? this.settings.coverCacheDirectory : null;

            // 如果用户未设置封面缓存目录，使用默认路径
            if (!coverCacheDirectory) {
                const defaultPathResult = await window.electronAPI.getDefaultCoverCachePath();
                if (defaultPathResult.success) {
                    coverCacheDirectory = defaultPathResult.path;

                    // 确保默认目录存在
                    const ensureResult = await window.electronAPI.ensureDirectoryExists(coverCacheDirectory);
                    if (ensureResult.success) {
                        // 保存默认路径到设置
                        this.updateSetting('coverCacheDirectory', coverCacheDirectory);
                        console.log(`✅ Settings: 使用默认封面缓存目录: ${coverCacheDirectory}`);
                    } else {
                        console.error('❌ Settings: 创建默认封面缓存目录失败:', ensureResult.error);
                        coverCacheDirectory = null;
                    }
                } else {
                    console.error('❌ Settings: 获取默认封面缓存路径失败:', defaultPathResult.error);
                }
            }

            // 设置封面缓存目录
            if (coverCacheDirectory) {
                this.coverCacheFolderPath.textContent = coverCacheDirectory;
                this.coverCacheFolderPath.classList.add('selected');
                localCoverManager.setCoverDirectory(coverCacheDirectory);
            } else {
                this.coverCacheFolderPath.textContent = '未选择';
                this.coverCacheFolderPath.classList.remove('selected');
            }
        } catch (error) {
            console.error('❌ Settings: 初始化封面缓存目录失败:', error);
            this.coverCacheFolderPath.textContent = '未选择';
            this.coverCacheFolderPath.classList.remove('selected');
        }
    }

    // 处理硬件加速设置变更
    async handleHardwareAccelerationChange(enabled) {
        try {
            if (!enabled) {
                const shouldRestart = await this.showHardwareAccelerationConfirmDialog();
                if (!shouldRestart) {
                    this.hardwareAccelerationToggle.checked = true;
                    return;
                }
            }

            // 更新设置
            const result = await window.electronAPI.hardwareAcceleration.updateSettings({
                enabled: enabled
            });

            if (result.success) {
                if (!enabled) {
                    await this.restartApplication();
                } else {
                    this.showHardwareAccelerationEnabledNotification();
                }
            } else {
                showToast('更新硬件加速设置失败', 'error');
                this.hardwareAccelerationToggle.checked = !enabled;
            }
        } catch (error) {
            showToast('处理硬件加速设置失败', 'error');
            this.hardwareAccelerationToggle.checked = !enabled;
        }
    }

    // 显示硬件加速确认对话框
    async showHardwareAccelerationConfirmDialog() {
        const message = '关闭硬件加速可能会降低应用性能，但可以解决某些显卡兼容性问题。\n\n更改此设置需要重启应用才能生效。\n\n是否要关闭硬件加速并立即重启应用？';
        return await app.confirm({
            title: '硬件加速设置',
            message: message,
            confirmText: '重启应用',
            type: 'warning'
        });
    }

    // 重启应用
    async restartApplication() {
        try {
            showToast('正在重启应用...', 'info');
            setTimeout(async () => {
                try {
                    await window.electronAPI.app.restart();
                } catch (error) {
                    showToast('重启应用失败，请手动重启', 'error');
                }
            }, 1000);
        } catch (error) {
            showToast('重启应用失败，请手动重启', 'error');
        }
    }

    // 显示硬件加速启用通知
    showHardwareAccelerationEnabledNotification() {
        showToast('硬件加速已启用，建议重启应用以获得最佳性能', 'success');
    }

    // 打开应用数据文件夹
    async handleOpenUserDataFolder() {
        const result = await window.electronAPI.openUserDataFolder();
        if (result.success) {
            showToast('已打开应用数据文件夹', 'success');
        } else {
            showToast('打开文件夹失败', 'error');
            console.error('❌ Settings: 打开应用数据文件夹失败:', result.error);
        }
    }

    // 打开开发者工具
    async handleOpenDevTools() {
        const result = await window.electronAPI.openDevTools();
        if (result.success) {
            showToast('开发者工具已打开', 'success');
        } else {
            showToast('打开开发者工具失败', 'error');
            console.error('❌ Settings: 打开开发者工具失败:', result.error);
        }
    }

    // 更新歌词高亮透明度
    updateLyricsHighlightOpacity(opacity) {
        document.documentElement.style.setProperty('--lyrics-highlight-opacity', opacity);
        this.emit('lyricsHighlightOpacityChanged', opacity);
    }

    // 缓存管理方法
    async showCacheStatistics() {
        try {
            this.viewCacheStatsBtn.disabled = true;
            this.viewCacheStatsBtn.textContent = '获取中...';

            const stats = await libraryAPI.getCacheStatistics();
            if (stats) {
                const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
                const cacheAgeDays = Math.floor(stats.cacheAge / (1000 * 60 * 60 * 24));

                this.cacheStatsDescription.textContent =
                    `缓存了 ${stats.totalTracks} 个音乐文件，总大小 ${totalSizeMB} MB，已扫描 ${stats.scannedDirectories} 个目录，缓存时间 ${cacheAgeDays} 天`;

                showToast(`缓存统计: ${stats.totalTracks} 个文件，${totalSizeMB} MB`, 'info');
            } else {
                showToast('获取缓存统计失败', 'error');
            }
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error);
            showToast('获取缓存统计失败', 'error');
        } finally {
            this.viewCacheStatsBtn.disabled = false;
            this.viewCacheStatsBtn.textContent = '查看统计';
        }
    }

    async validateCache() {
        try {
            this.validateCacheBtn.disabled = true;
            this.validateCacheBtn.textContent = '验证中...';
            showToast('开始验证缓存，请稍候...', 'info');

            const result = await api.validateCache();
            if (result) {
                const message = `缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`;
                showToast(message, 'success');
            } else {
                showToast('缓存验证失败', 'error');
            }
        } catch (error) {
            console.error('缓存验证失败:', error);
            showToast('缓存验证失败', 'error');
        } finally {
            this.validateCacheBtn.disabled = false;
            this.validateCacheBtn.textContent = '验证缓存';
        }
    }

    async clearCache() {
        const confirmed = await app.confirm({
            title: '清空缓存',
            message: '确定要清空所有缓存吗？这将删除所有已缓存的音乐文件信息，下次启动时需要重新扫描。',
            type: 'warning',
            confirmText: '清空'
        });

        if (!confirmed) {
            return;
        }

        try {
            this.clearCacheBtn.disabled = true;
            this.clearCacheBtn.textContent = '清空中...';

            const success = await api.clearCache();
            if (success) {
                showToast('缓存已清空', 'success');
                this.cacheStatsDescription.textContent = '缓存已清空';
            } else {
                showToast('清空缓存失败', 'error');
            }
        } catch (error) {
            console.error('清空缓存失败:', error);
            showToast('清空缓存失败', 'error');
        } finally {
            this.clearCacheBtn.disabled = false;
            this.clearCacheBtn.textContent = '清空缓存';
        }
    }

    // 内嵌歌词测试方法
    async testEmbeddedLyrics() {
        try {
            this.testEmbeddedLyricsBtn.disabled = true;
            this.testEmbeddedLyricsBtn.textContent = '选择文件...';

            const filePaths = await window.electronAPI.openFiles();
            if (!filePaths || filePaths.length === 0) {
                showToast('未选择文件', 'info');
                return;
            }

            const filePath = filePaths[0];
            this.testEmbeddedLyricsBtn.textContent = '检测中...';
            console.log(`🎵 测试内嵌歌词: ${filePath}`);

            const debugResult = await embeddedLyricsManager.debugEmbeddedLyrics(filePath);
            let reportLines = [
                `文件: ${filePath}`,
                `时间: ${new Date().toLocaleString()}`,
                ``,
                `=== 检测结果 ===`,
                `成功: ${debugResult.success ? '是' : '否'}`
            ];

            if (debugResult.success && debugResult.lyricsAnalysis) {
                const analysis = debugResult.lyricsAnalysis;
                reportLines.push(
                    ``,
                    `=== 歌词信息 ===`,
                    `类型: ${analysis.type}`,
                    `格式: ${analysis.format}`,
                    `语言: ${analysis.language || '未知'}`,
                    `描述: ${analysis.description || '无'}`,
                    `同步歌词: ${analysis.synchronized ? '是' : '否'}`,
                    `文本长度: ${analysis.textLength} 字符`,
                    `时间戳数量: ${analysis.timestampCount}`,
                    ``
                );

                if (analysis.textSample) {
                    reportLines.push(`=== 歌词预览 ===`, analysis.textSample, ``);
                }

                if (debugResult.conversionResult) {
                    const conv = debugResult.conversionResult;
                    reportLines.push(
                        `=== LRC转换 ===`,
                        `转换成功: ${conv.success ? '是' : '否'}`,
                        `LRC长度: ${conv.lrcLength} 字符`
                    );

                    if (conv.error) {
                        reportLines.push(`转换错误: ${conv.error}`);
                    }
                    if (conv.lrcSample) {
                        reportLines.push(``, `=== LRC预览 ===`, conv.lrcSample);
                    }
                }
                showToast('检测到内嵌歌词！', 'success');
            } else {
                reportLines.push(`错误: ${debugResult.error || '未知错误'}`);
                showToast('未检测到内嵌歌词', 'info');
            }

            // 显示详细报告
            const report = reportLines.join('\n');
            console.log('🔧 内嵌歌词测试报告:\n', report);
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: white; border: 1px solid #ccc; border-radius: 8px;
                padding: 20px; max-width: 80%; max-height: 80%; overflow: auto;
                z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-family: monospace; font-size: 12px; line-height: 1.4;
            `;

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '关闭';
            closeBtn.style.cssText = 'float: right; margin-bottom: 10px; padding: 5px 10px; color: red';
            closeBtn.onclick = () => document.body.removeChild(dialog);

            const content = document.createElement('pre');
            content.textContent = report;
            content.style.cssText = 'margin: 0; white-space: pre-wrap; word-wrap: break-word;';

            dialog.appendChild(closeBtn);
            dialog.appendChild(content);
            document.body.appendChild(dialog);
        } catch (error) {
            console.error('❌ 内嵌歌词测试失败:', error);
            showToast('内嵌歌词测试失败', 'error');
        } finally {
            this.testEmbeddedLyricsBtn.disabled = false;
            this.testEmbeddedLyricsBtn.textContent = '测试内嵌歌词';
        }
    }

    // 快捷键配置相关方法
    setupShortcutEventListeners() {
        // 全局快捷键开关
        this.globalShortcutsToggle.addEventListener('change', async (e) => {
            await this.toggleGlobalShortcuts(e.target.checked);
        });

        // 重置快捷键按钮
        this.resetShortcutsBtn.addEventListener('click', async () => {
            await this.showResetShortcutsDialog();
        });

        // 初始化快捷键配置
        this.initializeShortcuts();
    }

    initializeShortcuts() {
        const config = shortcutConfig.getConfig();

        // 设置全局快捷键开关状态
        this.globalShortcutsToggle.checked = config.enableGlobalShortcuts;
        this.updateGlobalShortcutsVisibility(config.enableGlobalShortcuts);

        // 渲染快捷键列表
        this.renderShortcutsList('local', config.localShortcuts);
        this.renderShortcutsList('global', config.globalShortcuts);

        // 延迟初始化折叠功能，确保DOM完全渲染
        setTimeout(() => {
            shortcutConfig.initializeCollapsibleShortcuts();
        }, 100);
    }

    renderShortcutsList(type, shortcuts) {
        const container = type === 'local' ? this.localShortcutsList : this.globalShortcutsList;
        if (!container) return;

        container.innerHTML = '';

        Object.entries(shortcuts).forEach(([id, shortcut]) => {
            const item = this.createShortcutItem(type, id, shortcut);
            container.appendChild(item);
        });
    }

    createShortcutItem(type, id, shortcut) {
        const item = document.createElement('div');
        item.className = 'shortcut-item';
        item.innerHTML = `
            <div class="shortcut-info">
                <div class="shortcut-name">${shortcut.name}</div>
                <div class="shortcut-description">${shortcut.description}</div>
            </div>
            <div class="shortcut-controls">
                <div class="shortcut-key ${shortcut.enabled ? '' : 'disabled'}"
                     data-type="${type}"
                     data-id="${id}"
                     title="点击修改快捷键">
                    ${this.formatShortcutKey(shortcut.key)}
                </div>
                <div class="shortcut-toggle">
                    <div class="toggle-switch">
                        <input type="checkbox"
                               id="shortcut-${type}-${id}"
                               class="toggle-input"
                               ${shortcut.enabled ? 'checked' : ''}
                               data-type="${type}"
                               data-id="${id}">
                        <label for="shortcut-${type}-${id}" class="toggle-label"></label>
                    </div>
                </div>
            </div>
        `;

        // 添加事件监听器
        const keyElement = item.querySelector('.shortcut-key');
        const toggleElement = item.querySelector('.toggle-input');

        keyElement.addEventListener('click', () => {
            if (shortcut.enabled) {
                this.startRecordingShortcut(type, id, keyElement);
            }
        });

        toggleElement.addEventListener('change', (e) => {
            this.toggleShortcut(type, id, e.target.checked);
        });

        return item;
    }

    formatShortcutKey(key) {
        if (!key) return '未设置';
        return key
            .replace(/Ctrl/g, 'Ctrl')
            .replace(/Alt/g, 'Alt')
            .replace(/Shift/g, 'Shift')
            .replace(/Cmd/g, '⌘')
            .replace(/ArrowUp/g, '↑')
            .replace(/ArrowDown/g, '↓')
            .replace(/ArrowLeft/g, '←')
            .replace(/ArrowRight/g, '→')
            .replace(/Space/g, '空格');
    }

    startRecordingShortcut(type, id, element) {
        // 开始录制
        shortcutRecorder.startRecording(element);

        // 监听录制结果
        const handleRecorded = async (shortcutString) => {
            await this.handleShortcutRecorded(type, id, shortcutString, element);
            shortcutRecorder.off('shortcutRecorded', handleRecorded);
        };

        shortcutRecorder.on('shortcutRecorded', handleRecorded);
    }

    async handleShortcutRecorded(type, id, shortcutString, element) {
        // 检查冲突
        const conflicts = shortcutConfig.checkConflicts(type, id, shortcutString);
        if (conflicts.length > 0) {
            await this.showShortcutConflict(conflicts, shortcutString, async () => {
                // 用户确认覆盖
                await this.updateShortcut(type, id, shortcutString, element);
            });
        } else {
            await this.updateShortcut(type, id, shortcutString, element);
        }
    }

    async updateShortcut(type, id, shortcutString, element) {
        try {
            const success = await shortcutConfig.updateShortcut(type, id, shortcutString);
            if (success) {
                element.textContent = this.formatShortcutKey(shortcutString);
                showToast('快捷键已更新', 'success');

                // 通知应用更新快捷键
                this.emit('shortcutsUpdated');
            } else {
                showToast('快捷键更新失败', 'error');
            }
        } catch (error) {
            console.error('❌ 更新快捷键失败:', error);
            showToast('快捷键更新失败', 'error');
        }
    }

    toggleShortcut(type, id, enabled) {
        const success = shortcutConfig.setShortcutEnabled(type, id, enabled);

        if (success) {
            // 更新UI
            const keyElement = document.querySelector(`[data-type="${type}"][data-id="${id}"].shortcut-key`);
            if (keyElement) {
                if (enabled) {
                    keyElement.classList.remove('disabled');
                } else {
                    keyElement.classList.add('disabled');
                }
            }

            showToast(enabled ? '快捷键已启用' : '快捷键已禁用', 'success');
            this.emit('shortcutsUpdated');
        } else {
            showToast('快捷键状态更新失败', 'error');
        }
    }

    async toggleGlobalShortcuts(enabled) {
        try {
            const success = await shortcutConfig.setGlobalShortcutsEnabled(enabled);
            if (success) {
                this.updateGlobalShortcutsVisibility(enabled);
                // 刷新快捷键摘要
                shortcutConfig.refreshSummary();
                showToast(enabled ? '全局快捷键已启用' : '全局快捷键已禁用', 'success');
                this.emit('shortcutsUpdated');
            } else {
                showToast('全局快捷键设置失败', 'error');
                // 恢复开关状态
                this.globalShortcutsToggle.checked = !enabled;
            }
        } catch (error) {
            showToast('全局快捷键设置失败', 'error');
            // 恢复开关状态
            this.globalShortcutsToggle.checked = !enabled;
        }
    }

    updateGlobalShortcutsVisibility(visible) {
        if (this.globalShortcutsGroup) {
            if (visible) {
                this.globalShortcutsGroup.classList.remove('hidden');
            } else {
                this.globalShortcutsGroup.classList.add('hidden');
            }
        }
    }

    async showShortcutConflict(conflicts, newShortcut, onConfirm) {
        const conflictNames = conflicts.map(c => `${c.name} (${c.type === 'local' ? '应用内' : '全局'})`).join('、');
        const message = `快捷键 "${this.formatShortcutKey(newShortcut)}" 与以下快捷键冲突：\n${conflictNames}\n\n是否要覆盖现有快捷键？`;
        const confirmed = await app.confirm({
            title: '快捷键冲突',
            message: message,
            confirmText: '覆盖',
            type: 'warning'
        });

        if (confirmed) {
            onConfirm();
        }
    }

    async showResetShortcutsDialog() {
        const message = '确定要将所有快捷键重置为默认设置吗？\n\n此操作将清除您的所有自定义快捷键配置。';
        const confirmed = await app.confirm({
            title: '重置快捷键',
            message: message,
            confirmText: '重置',
            type: 'warning'
        });

        if (confirmed) {
            this.resetShortcuts();
        }
    }

    resetShortcuts() {
        const success = shortcutConfig.resetToDefaults();
        if (success) {
            // 重新初始化快捷键配置
            this.initializeShortcuts();
            // 刷新摘要
            shortcutConfig.refreshSummary();
            showToast('快捷键已重置为默认设置', 'success');
            this.emit('shortcutsUpdated');
        } else {
            showToast('重置快捷键失败', 'error');
        }
    }

    // 网络磁盘相关方法

    // 切换网络磁盘配置区域显示
    toggleNetworkDriveConfig(enabled) {
        if (enabled) {
            this.networkDriveConfig.style.display = 'block';
        } else {
            this.networkDriveConfig.style.display = 'none';
        }
    }

    // 显示网络磁盘配置模态框
    showNetworkDriveModal() {
        if (app.components.networkDiskModal) {
            app.components.networkDiskModal.show();
        } else {
            this.showNotification('网络磁盘功能不可用', 'error');
        }
    }

    // 显示通知消息
    showNotification(message, type = 'info') {
        showToast(message, type);
    }

    // 切换到指定的设置区域
    switchToSection(sectionName) {
        // 更新当前区域
        this.currentSection = sectionName;

        // 修改为实时性取元素，防止扩展动态添加的无法被正常监听

        // 更新导航按钮状态
        // 更改为实时性的全部按钮
        document.querySelectorAll('.settings-nav-btn').forEach(button => {
            if (button.dataset.section === sectionName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // 显示/隐藏设置区域
        // 更改为实时性的全部区域
        document.querySelectorAll('.settings-section').forEach(section => {
            if (section.dataset.section === sectionName) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    }

    // 初始化设置区域显示
    initializeSectionDisplay() {
        // 默认显示第一个区域（外观设置）
        this.switchToSection(this.currentSection);
    }

    // 更新版本信息显示
    async updateVersionInfo() {
        try {
            const versionElement = document.getElementById('app-version-info');
            if (versionElement) {
                const response = await fetch('../../../package.json');
                const packageInfo = await response.json();
                versionElement.textContent = `MusicBox v${packageInfo.version}`;
            }
        } catch (error) {
            console.error('❌ Settings: 更新版本信息失败:', error);
        }
    }

    openRepository() {
        const repositoryUrl = 'https://github.com/asxez/MusicBox';
        window.open(repositoryUrl, '_blank');
    }

    async openPluginManager() {
        if (app.components.pluginManagerModal) {
            await app.components.pluginManagerModal.show();
        } else {
            this.showNotification('插件管理器不可用', 'error');
        }
    }

    // 音乐文件夹和自动扫描相关方法
    async initializeMusicFoldersAndAutoScan() {
        try {
            // 加载音乐文件夹列表
            const folders = await window.electronAPI.settings.getMusicFolders();
            this.renderMusicFolders(folders);

            // 加载自动扫描设置
            const autoScanSettings = await window.electronAPI.settings.getAutoScanSettings();
            this.autoScanToggle.checked = autoScanSettings.enabled || false;
            this.scanFrequencySelect.value = autoScanSettings.frequency || 'on_startup';

            // 根据自动扫描状态显示/隐藏扫描频率设置
            this.toggleScanFrequencyVisibility(autoScanSettings.enabled);
        } catch (error) {
            console.error('❌ Settings: 初始化音乐文件夹和自动扫描设置失败:', error);
        }
    }

    async handleAddMusicFolder() {
        try {
            const result = await window.electronAPI.selectFolder();
            if (result && result.filePaths && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];

                const addResult = await window.electronAPI.settings.addMusicFolder(selectedPath);
                if (addResult.success) {
                    this.renderMusicFolders(addResult.folders);
                    showToast('文件夹已添加', 'success');

                    // 询问是否立即扫描
                    const shouldScan = await app.confirm({
                        title: '扫描文件夹',
                        message: '是否立即扫描该文件夹？',
                        confirmText: '扫描'
                    });

                    if (shouldScan) {
                        showToast('正在扫描...', 'info');
                        await window.electronAPI.library.scanDirectory(selectedPath);
                        showToast('扫描完成', 'success');
                    }
                } else {
                    showToast(addResult.error || '添加文件夹失败', 'error');
                }
            }
        } catch (error) {
            console.error('❌ Settings: 添加音乐文件夹失败:', error);
            showToast('添加文件夹失败', 'error');
        }
    }

    async handleRemoveMusicFolder(folderPath) {
        const confirmed = await app.confirm({
            title: '移除文件夹',
            message: `确定要移除文件夹吗？\n\n${folderPath}\n\n移除后该文件夹中的音乐将不会被自动扫描。`,
            confirmText: '移除',
            type: 'warning'
        });

        if (!confirmed) {
            return;
        }

        try {
            const result = await window.electronAPI.settings.removeMusicFolder(folderPath);
            if (result.success) {
                this.renderMusicFolders(result.folders);
                showToast('文件夹已移除', 'success');
            } else {
                showToast(result.error || '移除文件夹失败', 'error');
            }
        } catch (error) {
            console.error('❌ Settings: 移除音乐文件夹失败:', error);
            showToast('移除文件夹失败', 'error');
        }
    }

    renderMusicFolders(folders) {
        if (!folders || folders.length === 0) {
            this.musicFoldersContainer.style.display = 'none';
            return;
        }

        this.musicFoldersContainer.style.display = 'flex';
        this.musicFoldersList.innerHTML = '';

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.className = 'folder-item';

            const pathSpan = document.createElement('span');
            pathSpan.className = 'folder-path-text';
            pathSpan.textContent = folder;
            pathSpan.title = folder;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'folder-remove-btn';
            removeBtn.textContent = '移除';
            removeBtn.addEventListener('click', () => this.handleRemoveMusicFolder(folder));

            li.appendChild(pathSpan);
            li.appendChild(removeBtn);
            this.musicFoldersList.appendChild(li);
        });
    }

    async handleAutoScanToggle(enabled) {
        try {
            const result = await window.electronAPI.settings.updateAutoScanSettings({enabled});
            if (result.success) {
                this.toggleScanFrequencyVisibility(enabled);
                showToast(enabled ? '自动扫描已启用' : '自动扫描已禁用', 'success');
            } else {
                showToast('更新自动扫描设置失败', 'error');
                this.autoScanToggle.checked = !enabled;
            }
        } catch (error) {
            console.error('❌ Settings: 更新自动扫描设置失败:', error);
            showToast('更新自动扫描设置失败', 'error');
            this.autoScanToggle.checked = !enabled;
        }
    }

    async handleScanFrequencyChange(frequency) {
        try {
            const result = await window.electronAPI.settings.updateAutoScanSettings({frequency});
            if (result.success) {
                showToast('扫描频率已更新', 'success');
            } else {
                showToast('更新扫描频率失败', 'error');
            }
        } catch (error) {
            console.error('❌ Settings: 更新扫描频率失败:', error);
            showToast('更新扫描频率失败', 'error');
        }
    }

    toggleScanFrequencyVisibility(visible) {
        this.scanFrequencyContainer.style.display = visible ? 'flex' : 'none';
    }

    async handleClearIgnoreList() {
        const confirmed = await app.confirm({
            title: '清空忽略列表',
            message: '确定要清空忽略列表吗？\n\n清空后，之前手动删除的歌曲在下次自动扫描时会被重新添加到音乐库。',
            confirmText: '清空',
            type: 'warning'
        });

        if (!confirmed) {
            return;
        }

        try {
            const result = await window.electronAPI.library.clearIgnoreList();
            if (result.success) {
                showToast('忽略列表已清空', 'success');
            } else {
                showToast('清空忽略列表失败', 'error');
            }
        } catch (error) {
            console.error('❌ Settings: 清空忽略列表失败:', error);
            showToast('清空忽略列表失败', 'error');
        }
    }
}

export {Settings};
