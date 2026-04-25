import {EventEmitter, showToast} from '@utils';

import {ComponentRegistry} from './components/ComponentRegistry.js';
import {ComponentEventBinder} from './components/ComponentEventBinder.js';
import {DOMEventBinder} from './events/DOMEventBinder';
import {APIEventBinder} from './events/APIEventBinder';
import {ViewRouter} from './navigation/ViewRouter';
import {ShortcutController} from './keyboard/ShortcutController';
import {FileImportController} from './files/FileImportController';
import {PluginBootstrap} from './plugins/PluginBootstrap.js';
import {LibraryController} from './library/LibraryController.js';
import {PlaybackController} from './playback/PlaybackController.js';
import {PlaylistController} from './playlists/PlaylistController.js';

import {cacheManager} from "@services/CacheManager";
import {api} from "@api/api";

import {updateAPI} from "@js/api";

export class MusicBoxApp extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentView = 'home-page';
        this.library = [];
        this.filteredLibrary = [];
        this.components = {};
        this.componentRegistry = new ComponentRegistry({
            components: this.components,
            setupComponentEvents: (componentName) => this.setupComponentEvents(componentName)
        });
        this.coversPreloadedByApp = false; // 防重复标志：封面预加载

        // 事件监听器管理
        this.eventListeners = [];
        this.apiEventListeners = [];
        this.domEventBinder = new DOMEventBinder({eventListeners: this.eventListeners});
        this.apiEventBinder = new APIEventBinder({apiEventListeners: this.apiEventListeners});
        this.componentEventBinder = new ComponentEventBinder({app: this});
        this.viewRouter = new ViewRouter({app: this});
        this.shortcutController = new ShortcutController({app: this});
        this.fileImportController = new FileImportController({app: this});
        this.pluginBootstrap = new PluginBootstrap({app: this});
        this.libraryController = new LibraryController({app: this});
        this.playbackController = new PlaybackController({app: this});
        this.playlistController = new PlaylistController({app: this});

        this.init().then((res) => {
            if (!res.status) console.error('Failed to initialize MusicBox:', res.error);
        });
    }

    async init() {
        try {
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            await this.initializeAPI();
            this.initializeComponents(); // 先初始化组件
            await this.setupEventListeners();
            await this.loadInitialData();

            // 恢复音量
            const savedVolume = cacheManager.getLocalCache('volume');
            if (savedVolume !== null) {
                await api.setVolume(savedVolume);
                await this.components.player.updateUI();
            }

            // 恢复播放状态
            await this.restorePlaybackState();

            this.isInitialized = true;
            this.showApp();
            this.schedulePluginSystemInitialization();

            // 自动检查更新
            setTimeout(() => {
                updateAPI.autoCheckForUpdates();
            }, 2000);
            return {
                status: true
            };
        } catch (error) {
            this.showError('应用初始化失败');
            return {
                status: false,
                error: error
            };
        }
    }

    async initializeAPI() {
        api.setPlayMode(cacheManager.getLocalCache('playMode'));
        const success = await api.initializeAudio();
        if (!success) {
            throw new Error('Failed to initialize audio engine');
        }
    }

    // 初始化插件系统
    async initializePluginSystem() {
        await this.pluginBootstrap.initializePluginSystem();
    }

    schedulePluginSystemInitialization() {
        this.pluginBootstrap.schedulePluginSystemInitialization();
    }

    // 通知插件系统应用已完全初始化
    notifyPluginSystemReady() {
        this.pluginBootstrap.notifyPluginSystemReady();
    }

    initializeComponents() {
        this.componentRegistry.initializeComponents();
        this.componentEventBinder.bindInitialComponentEvents();
    }

    initializePageComponentsOnDemand() {
        this.componentRegistry.initializePageComponentsOnDemand();
    }

    initializeComponent(componentName) {
        this.componentRegistry.initializeComponent(componentName);
    }

    destroyComponent(componentName) {
        this.componentRegistry.destroyComponent(componentName);
    }

    addManagedEventListener(element, event, handler, options) {
        this.domEventBinder.addManagedEventListener(element, event, handler, options);
    }

    addManagedAPIEventListener(event, handler) {
        this.apiEventBinder.addManagedAPIEventListener(event, handler);
    }

    async setupEventListeners() {
        await this.domEventBinder.bindAppEvents(this);
        this.apiEventBinder.bindAppEvents(this);
    }

    async loadInitialData() {
        await this.libraryController.loadInitialData();
    }

    // 预加载歌曲封面
    async preloadTrackCovers() {
        await this.libraryController.preloadTrackCovers();
    }

    // 同步桌面歌词按钮状态
    async syncDesktopLyricsButtonState() {
        try {
            if (this.components.player && this.components.settings) {
                // 从设置中获取桌面歌词状态
                const settings = cacheManager.getLocalCache('musicbox-settings') || {};
                const desktopLyricsEnabled = settings.hasOwnProperty('desktopLyrics') ? settings.desktopLyrics : true;

                // 更新Player组件的按钮状态
                await this.components.player.updateDesktopLyricsButtonVisibility(desktopLyricsEnabled);
            }
        } catch (error) {
            console.error('❌ App: 同步桌面歌词按钮状态失败:', error);
        }
    }

    showCacheLoadingStatus() {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'block';
            statusElement.textContent = '正在从缓存加载音乐库...';
        }
    }

    hideCacheLoadingStatus() {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }

    async validateCacheInBackground() {
        await this.libraryController.validateCacheInBackground();
    }

    showApp() {
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');

        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 300);
        }

        if (app) {
            app.style.display = 'grid';
            setTimeout(async () => {
                app.style.opacity = '1';
                // 初始化显示首页
                await this.handleViewChange('home-page');
            }, 100);
        }
    }

    showWelcomeScreen() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-content">
                    <h1>欢迎！</h1>
                    <p>添加喜欢的音乐吧！</p>
                    <div class="welcome-actions">
                        <button class="primary-button" id="scan-folder-btn">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                            </svg>
                            添加音乐目录
                        </button>
                        <button class="secondary-button" id="add-files-btn">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            添加音乐
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 为主页按钮添加事件监听
        document.getElementById('scan-folder-btn')?.addEventListener('click', async () => {
            await this.scanMusicFolder();
        });
        document.getElementById('add-files-btn')?.addEventListener('click', async () => {
            await this.addMusicFiles();
        });
    }

    async scanMusicFolder() {
        await this.fileImportController.scanMusicFolder();
    }

    async addMusicFiles() {
        await this.fileImportController.addMusicFiles();
    }

    showScanProgress() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="scan-progress">
                <div class="scan-content">
                    <h2>扫描音乐库</h2>
                    <div class="progress-bar">
                        <div class="progress-fill" id="scan-progress-fill"></div>
                    </div>
                    <p id="scan-status">加载中...</p>
                </div>
            </div>
        `;
    }

    updateScanProgress(progress) {
        const progressFill = document.getElementById('scan-progress-fill');
        const statusText = document.getElementById('scan-status');

        if (progressFill && statusText) {
            const percent = progress.totalFiles > 0 ?
                (progress.processedFiles / progress.totalFiles) * 100 : 0;

            progressFill.style.width = `${percent}%`;
            statusText.textContent = progress.isComplete ?
                'Scan completed!' :
                `Processing: ${progress.currentFile}`;
        }
    }

    async refreshLibrary() {
        await this.libraryController.refreshLibrary();
    }

    updateTrackList(source = 'unknown') {
        this.libraryController.updateTrackList(source);
    }

    handleSearchResults(results) {
        this.libraryController.handleSearchResults(results);
    }

    handleSearchCleared() {
        this.libraryController.handleSearchCleared();
    }

    setupComponentEvents(componentName = null) {
        this.componentEventBinder.setupComponentEvents(componentName);
    }

    setupSingleComponentEvents(componentName) {
        this.componentEventBinder.setupSingleComponentEvents(componentName);
    }

    async handlePlayAllTracks(tracks) {
        await this.playbackController.handlePlayAllTracks(tracks);
    }

    async handleViewChange(view) {
        await this.viewRouter.handleViewChange(view);
    }

    hideAllPages() {
        this.viewRouter.hideAllPages();
    }

    async handleTrackPlayed(track, _index) {
        await this.playbackController.handleTrackPlayed(track, _index);
    }

    // 统一的快捷键管理器
    initKeyboardShortcuts() {
        this.shortcutController.initKeyboardShortcuts();
    }

    // 获取当前活跃的播放器组件
    getActivePlayer() {
        return this.shortcutController.getActivePlayer();
    }

    // 生成按键字符串
    generateKeyString(event) {
        return this.shortcutController.generateKeyString(event);
    }

    // 标准化按键名称
    normalizeKey(event) {
        return this.shortcutController.normalizeKey(event);
    }

    // 获取当前启用的快捷键
    getEnabledShortcuts() {
        return this.shortcutController.getEnabledShortcuts();
    }

    // 查找匹配的快捷键
    findMatchingShortcut(pressedKey, shortcuts) {
        return this.shortcutController.findMatchingShortcut(pressedKey, shortcuts);
    }

    // 执行快捷键对应的操作
    async executeShortcutAction(shortcutId) {
        await this.shortcutController.executeShortcutAction(shortcutId);
    }

    // 处理系统快捷键
    async handleSystemShortcuts(e) {
        await this.shortcutController.handleSystemShortcuts(e);
    }

    // 初始化全局快捷键
    async initGlobalShortcuts() {
        await this.shortcutController.initGlobalShortcuts();
    }

    showCreatePlaylistDialog() {
        if (this.components.createPlaylistDialog) {
            this.components.createPlaylistDialog.show();
        }
    }

    // 处理添加到自定义歌单
    async handleAddToCustomPlaylist(track, _index) {
        await this.playlistController.handleAddToCustomPlaylist(track, _index);
    }

    // 处理歌单创建成功
    async handlePlaylistCreated() {
        await this.playlistController.handlePlaylistCreated();
    }

    // 处理歌曲添加到歌单成功
    async handleTrackAddedToPlaylist() {
        await this.playlistController.handleTrackAddedToPlaylist();
    }

    // 处理歌单选择
    async handlePlaylistSelected(playlist) {
        await this.playlistController.handlePlaylistSelected(playlist);
    }

    // 处理网络磁盘选择
    async handleNetworkDriveSelected(drive) {
        this.hideAllPages();
        this.updateSidebarSelection('network-drive', drive.id);
        this.currentView = 'network-drive-detail';
        if (this.components.networkDriveDetailPage) {
            await this.components.networkDriveDetailPage.show(drive);
        }
    }

    // 处理网络磁盘移除
    async handleDriveRemoved() {
        await this.components.navigation.loadNetworkDrives();
        await this.refreshLibrary();
    }

    // 更新侧边栏选中状态
    updateSidebarSelection(type, id = null) {
        this.viewRouter.updateSidebarSelection(type, id);
    }

    // 处理歌单更新
    async handlePlaylistUpdated() {
        await this.playlistController.handlePlaylistUpdated();
    }

    // 处理歌单重命名成功
    async handlePlaylistRenamed() {
        await this.playlistController.handlePlaylistRenamed();
    }

    // 处理显示添加歌曲对话框
    async handleShowAddSongsDialog(playlist) {
        await this.playlistController.handleShowAddSongsDialog(playlist);
    }

    // 处理歌曲添加到歌单成功
    async handleTracksAddedToPlaylist() {
        await this.playlistController.handleTracksAddedToPlaylist();
    }

    // 处理歌单封面更新
    async handlePlaylistCoverUpdated(playlist) {
        await this.playlistController.handlePlaylistCoverUpdated(playlist);
    }

    async cleanup() {
        // 保存播放状态和音量
        await this.savePlaybackState();
        if (this.components.player) {
            await cacheManager.setLocalCache('volume', this.components.player.volume);
        }

        this.domEventBinder.dispose();
        this.apiEventBinder.dispose();

        // 销毁组件
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                try {
                    component.destroy();
                } catch (error) {
                    console.warn('Failed to destroy component:', error);
                }
            }
        });

        // 清理组件引用，保持 registry/binder 持有同一个 components 对象
        Object.keys(this.components).forEach((key) => {
            delete this.components[key];
        });

        // 清理数据
        this.library = [];
        this.filteredLibrary = [];
    }

    // 文件加载方法
    setupFileLoading() {
        this.fileImportController.setupFileLoading();
    }

    async handleFileDrop(e) {
        await this.fileImportController.handleFileDrop(e);
    }

    async openDirectoryDialog() {
        await this.fileImportController.openDirectoryDialog();
    }

    async loadAndPlayFile(filePath) {
        await this.fileImportController.loadAndPlayFile(filePath);
    }

    async addFilesToPlaylist(files) {
        await this.fileImportController.addFilesToPlaylist(files);
    }

    async scanDirectory(directoryPath) {
        await this.fileImportController.scanDirectory(directoryPath);
    }

    addFileMenuItems() {
        this.fileImportController.addFileMenuItems();
    }

    showSuccess(message) {
        showToast(message, 'success');
    }

    showError(message) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div class="error-message">
                    <h2>错误</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()">重试</button>
                </div>
            `;
        }
        showToast(message, 'error');
    }

    showInfo(message) {
        showToast(message, 'info');
    }

    async confirm(options) {
        return await this.components.confirmDialog.show(options);
    }

    // Playlist event handlers
    handlePlaylistTrackSelected(track, _index) {
        this.playlistController.handlePlaylistTrackSelected(track, _index);
    }

    async handlePlaylistTrackPlayed(track, index) {
        await this.playlistController.handlePlaylistTrackPlayed(track, index);
    }

    async handlePlaylistTrackRemoved(track, index) {
        await this.playlistController.handlePlaylistTrackRemoved(track, index);
    }

    async handlePlaylistCleared() {
        await this.playlistController.handlePlaylistCleared();
    }

    // 播放播放列表中的歌曲
    async playTrackFromPlaylist(track, index) {
        await this.playbackController.playTrackFromPlaylist(track, index);
    }

    // 处理歌曲索引更改（用于 prev/next 按钮）
    handleTrackIndexChanged(index) {
        this.playbackController.handleTrackIndexChanged(index);
    }

    updateLibraryTrackDuration(filePath, duration) {
        this.libraryController.updateLibraryTrackDuration(filePath, duration);
    }

    // 右击菜单事件处理方法
    // 删除音乐
    async handleDeleteTrack(track, index) {
        await this.libraryController.handleDeleteTrack(track, index);
    }

    addToPlaylist(track) {
        this.playlistController.addToPlaylist(track);
    }

    async handleBatchDelete(selectedTracks, track, index) {
        await this.libraryController.handleBatchDelete(selectedTracks, track, index);
    }

    // 处理编辑歌曲信息
    async handleEditTrackInfo(track, _index) {
        await this.components.editTrackInfoDialog.show(track);
    }

    // 处理歌曲信息更新
    async handleTrackInfoUpdated(data) {
        await this.libraryController.handleTrackInfoUpdated(data);
    }

    // 恢复播放状态
    async restorePlaybackState() {
        await this.playbackController.restorePlaybackState();
    }

    // 自动播放第一首歌曲
    async autoplayFirstTrack() {
        await this.playbackController.autoplayFirstTrack();
    }

    // 保存播放状态
    async savePlaybackState() {
        await this.playbackController.savePlaybackState();
    }
}
