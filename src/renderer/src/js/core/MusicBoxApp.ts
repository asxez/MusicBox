import {EventEmitter, showToast} from '@utils/index.js';

import {ComponentRegistry} from './components/ComponentRegistry';
import {ComponentEventBinder} from './components/ComponentEventBinder';
import {DOMEventBinder} from './events/DOMEventBinder';
import {APIEventBinder} from './events/APIEventBinder';
import {ViewRouter} from './navigation/ViewRouter';
import {ShortcutController} from './keyboard/ShortcutController';
import {PluginBootstrap} from './plugins/PluginBootstrap';
import {
    FileImportController,
    LibraryAppController,
    libraryController as libraryFeatureController
} from '@js/features/library';
import {PlaylistController} from '@js/features/playlists';
import {PlaybackAppController} from '@js/features/playback';
import {AppUIFacade} from './ui/AppUIFacade';

import {cacheManager} from "@services/CacheManager";
import {extensionHostService} from "@services/plugins/ExtensionHostService";
import {appInteractionService} from "@services/ui/AppInteractionService";
import {appShellController} from "@js/features/appShell";
import {desktopLyricsController} from "@js/features/desktopLyrics";
import {equalizerController} from "@js/features/equalizer";
import type {AudioEngineManagerBridge} from "@js/features/equalizer/service";
import {mediaController} from "@js/features/media";
import {playbackService} from "@js/features/playback/service";
import {playbackController as playbackFeatureController} from "@js/features/playback";
import type {MusicBoxAPIEvents, ScanProgress} from "@api/types/events";
import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {
    AppView,
    ComponentMap,
    ConfirmOptions,
    ManagedAPIListener,
    ManagedDOMListener
} from "@core/types/app";

interface InitResult {
    status: boolean;
    error?: unknown;
}

interface NetworkDriveLike {
    id: string | number;
    [key: string]: any;
}

type ShortcutDefinitionMap = Record<string, any>;

export class MusicBoxApp extends EventEmitter {
    isInitialized: boolean;
    currentView: AppView;
    library: Track[];
    filteredLibrary: Track[];
    components: ComponentMap;
    coversPreloadedByApp: boolean;
    eventListeners: ManagedDOMListener[];
    apiEventListeners: ManagedAPIListener[];
    private readonly componentRegistry: ComponentRegistry;
    private readonly componentEventBinder: ComponentEventBinder;
    private readonly domEventBinder: DOMEventBinder;
    private readonly apiEventBinder: APIEventBinder;
    private readonly viewRouter: ViewRouter;
    private readonly shortcutController: ShortcutController;
    private readonly fileImportController: FileImportController;
    private readonly pluginBootstrap: PluginBootstrap;
    private readonly libraryController: LibraryAppController;
    private readonly playbackController: PlaybackAppController;
    private readonly playlistController: PlaylistController;
    private readonly ui: AppUIFacade;

    constructor() {
        super();
        this.isInitialized = false;
        this.currentView = 'home-page';
        this.library = [];
        this.filteredLibrary = [];
        this.components = {} as ComponentMap;
        this.ui = new AppUIFacade(this);
        this.componentRegistry = new ComponentRegistry({
            components: this.components,
            setupComponentEvents: (componentName: string) => this.setupComponentEvents(componentName)
        });
        this.coversPreloadedByApp = false; // 防重复标志：封面预加载

        // 事件监听器管理
        this.eventListeners = [];
        this.apiEventListeners = [];
        this.domEventBinder = new DOMEventBinder({eventListeners: this.eventListeners});
        this.apiEventBinder = new APIEventBinder({apiEventListeners: this.apiEventListeners});
        this.componentEventBinder = new ComponentEventBinder({app: this});
        this.viewRouter = new ViewRouter({app: this});
        this.shortcutController = new ShortcutController({
            app: this,
            integrations: {
                toggleCurrentPlayback: () => playbackFeatureController.toggleCurrentPlayback(),
                previousTrack: () => playbackFeatureController.previousTrack(),
                nextTrack: () => playbackFeatureController.nextTrack(),
                adjustVolume: (delta) => playbackFeatureController.adjustVolume(delta),
                seekForward: (seconds) => playbackFeatureController.seekForward(seconds),
                seekBackward: (seconds) => playbackFeatureController.seekBackward(seconds),
                getCurrentTrackSnapshot: () => playbackFeatureController.getCurrentTrackSnapshot()
            },
            ui: this.ui
        });
        this.fileImportController = new FileImportController({
            app: this,
            integrations: {
                openDirectory: () => mediaController.openDirectory(),
                openDirectoryDialog: () => mediaController.openDirectoryDialog(),
                openFiles: () => mediaController.openFiles(),
                loadTrack: (filePath) => playbackFeatureController.loadTrack(filePath),
                play: () => playbackFeatureController.play()
            }
        });
        this.pluginBootstrap = new PluginBootstrap({app: this});
        this.libraryController = new LibraryAppController({
            app: this,
            integrations: {
                getCurrentPlaybackTrack: () => playbackFeatureController.getCurrentTrackSnapshot()
            },
            ui: this.ui
        });
        this.playbackController = new PlaybackAppController({
            app: this,
            integrations: {
                getLibraryTracks: () => libraryFeatureController.getTracks()
            },
            ui: this.ui
        });
        this.playlistController = new PlaylistController({
            app: this,
            playback: {
                setPlaylist: (tracks, startIndex) => playbackFeatureController.setPlaylist(tracks, startIndex),
                getCurrentIndex: () => playbackFeatureController.getCurrentIndex(),
                pause: () => playbackFeatureController.pause()
            },
            ui: this.ui
        });
        desktopLyricsController.configure({
            getPlaybackSnapshot: () => playbackFeatureController.getPlaybackSnapshot()
        });
        equalizerController.configure({
            getEqualizer: <T = unknown>() => playbackService.getEqualizer<T>(),
            setEqualizerEnabled: (enabled) => playbackService.setEqualizerEnabled(enabled),
            getAudioEngine: <T extends AudioEngineManagerBridge>() => playbackService.getAudioEngine() as T | null
        });
        appInteractionService.bindApp(this);
        extensionHostService.bindApp(this);

        this.init().then((res: InitResult) => {
            if (!res.status) console.error('Failed to initialize MusicBox:', res.error);
        });
    }

    async init(): Promise<InitResult> {
        try {
            if (document.readyState === 'loading') {
                await new Promise<void>(resolve => {
                    document.addEventListener('DOMContentLoaded', () => resolve(), {once: true});
                });
            }

            await this.initializeAPI();
            this.initializeComponents(); // 先初始化组件
            await this.setupEventListeners();
            await this.loadInitialData();

            // 恢复音量
            const savedVolume = cacheManager.getLocalCache('volume');
            if (savedVolume !== null) {
                await playbackFeatureController.setVolume(savedVolume);
                await this.ui.updatePlayerUI();
            }

            // 恢复播放状态
            await this.restorePlaybackState();

            this.isInitialized = true;
            this.showApp();
            this.schedulePluginSystemInitialization();

            // 自动检查更新
            setTimeout(() => {
                appShellController.autoCheckForUpdates();
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

    async initializeAPI(): Promise<void> {
        playbackFeatureController.setPlayMode(cacheManager.getLocalCache('playMode') as any);
        const success = await playbackFeatureController.initializeAudio();
        if (!success) {
            throw new Error('Failed to initialize audio engine');
        }
    }

    // 初始化插件系统
    async initializePluginSystem(): Promise<void> {
        await this.pluginBootstrap.initializePluginSystem();
    }

    schedulePluginSystemInitialization(): void {
        this.pluginBootstrap.schedulePluginSystemInitialization();
    }

    // 通知插件系统应用已完全初始化
    notifyPluginSystemReady(): void {
        this.pluginBootstrap.notifyPluginSystemReady();
    }

    initializeComponents(): void {
        this.componentRegistry.initializeComponents();
        this.componentEventBinder.bindInitialComponentEvents();
    }

    initializePageComponentsOnDemand(): void {
        this.componentRegistry.initializePageComponentsOnDemand();
    }

    initializeComponent(componentName: string): void {
        this.componentRegistry.initializeComponent(componentName);
    }

    destroyComponent(componentName: string): void {
        this.componentRegistry.destroyComponent(componentName);
    }

    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        this.domEventBinder.addManagedEventListener(element, event, handler, options);
    }

    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void {
        this.apiEventBinder.addManagedAPIEventListener(event, handler);
    }

    async setupEventListeners(): Promise<void> {
        await this.domEventBinder.bindAppEvents(this);
        this.apiEventBinder.bindAppEvents(this);
    }

    async loadInitialData(): Promise<void> {
        await this.libraryController.loadInitialData();
    }

    // 预加载歌曲封面
    async preloadTrackCovers(): Promise<void> {
        await this.libraryController.preloadTrackCovers();
    }

    // 同步桌面歌词按钮状态
    async syncDesktopLyricsButtonState(): Promise<void> {
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

    showCacheLoadingStatus(): void {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'block';
            statusElement.textContent = '正在从缓存加载音乐库...';
        }
    }

    hideCacheLoadingStatus(): void {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }

    async validateCacheInBackground(): Promise<void> {
        await this.libraryController.validateCacheInBackground();
    }

    showApp(): void {
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

    showWelcomeScreen(): void {
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

    async scanMusicFolder(): Promise<void> {
        await this.fileImportController.scanMusicFolder();
    }

    async addMusicFiles(): Promise<void> {
        await this.fileImportController.addMusicFiles();
    }

    showScanProgress(): void {
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

    updateScanProgress(progress: ScanProgress): void {
        const progressFill = document.getElementById('scan-progress-fill');
        const statusText = document.getElementById('scan-status');

        if (progressFill && statusText) {
            const total = progress.totalFiles ?? progress.total ?? 0;
            const current = progress.processedFiles ?? progress.current ?? 0;
            const percent = total > 0 ? (current / total) * 100 : 0;

            progressFill.style.width = `${percent}%`;
            statusText.textContent = progress.isComplete ?
                'Scan completed!' :
                progress.currentFile ? `Processing: ${progress.currentFile}` : `Processing: ${current}/${total}`;
        }
    }

    async refreshLibrary(): Promise<void> {
        await this.libraryController.refreshLibrary();
    }

    updateTrackList(source = 'unknown'): void {
        this.libraryController.updateTrackList(source);
    }

    handleSearchResults(results: Track[]): void {
        this.libraryController.handleSearchResults(results);
    }

    handleSearchCleared(): void {
        this.libraryController.handleSearchCleared();
    }

    setupComponentEvents(componentName: string | null = null): void {
        this.componentEventBinder.setupComponentEvents(componentName as any);
    }

    setupSingleComponentEvents(componentName: string): void {
        this.componentEventBinder.setupSingleComponentEvents(componentName);
    }

    async handlePlayAllTracks(tracks: Track[]): Promise<void> {
        await this.playbackController.handlePlayAllTracks(tracks);
    }

    async handleViewChange(view: AppView): Promise<void> {
        await this.viewRouter.handleViewChange(view);
    }

    hideAllPages(): void {
        this.viewRouter.hideAllPages();
    }

    async handleTrackPlayed(track: Track, _index: number): Promise<void> {
        await this.playbackController.handleTrackPlayed(track, _index);
    }

    // 统一的快捷键管理器
    initKeyboardShortcuts(): void {
        this.shortcutController.initKeyboardShortcuts();
    }

    // 获取当前活跃的播放器组件
    getActivePlayer(): any | null {
        return this.shortcutController.getActivePlayer();
    }

    // 生成按键字符串
    generateKeyString(event: KeyboardEvent): string {
        return this.shortcutController.generateKeyString(event);
    }

    // 标准化按键名称
    normalizeKey(event: KeyboardEvent): string | null {
        return this.shortcutController.normalizeKey(event);
    }

    // 获取当前启用的快捷键
    getEnabledShortcuts(): ShortcutDefinitionMap {
        return this.shortcutController.getEnabledShortcuts();
    }

    // 查找匹配的快捷键
    findMatchingShortcut(pressedKey: string, shortcuts: ShortcutDefinitionMap): any | null {
        return this.shortcutController.findMatchingShortcut(pressedKey, shortcuts);
    }

    // 执行快捷键对应的操作
    async executeShortcutAction(shortcutId: string): Promise<void> {
        await this.shortcutController.executeShortcutAction(shortcutId);
    }

    // 处理系统快捷键
    async handleSystemShortcuts(e: KeyboardEvent): Promise<void> {
        await this.shortcutController.handleSystemShortcuts(e);
    }

    // 初始化全局快捷键
    async initGlobalShortcuts(): Promise<void> {
        await this.shortcutController.initGlobalShortcuts();
    }

    showCreatePlaylistDialog(): void {
        this.ui.showCreatePlaylistDialog();
    }

    // 处理添加到自定义歌单
    async handleAddToCustomPlaylist(track: Track, _index: number): Promise<void> {
        await this.playlistController.handleAddToCustomPlaylist(track, _index);
    }

    // 处理歌单创建成功
    async handlePlaylistCreated(): Promise<void> {
        await this.playlistController.handlePlaylistCreated();
    }

    // 处理歌曲添加到歌单成功
    async handleTrackAddedToPlaylist(): Promise<void> {
        await this.playlistController.handleTrackAddedToPlaylist();
    }

    // 处理歌单选择
    async handlePlaylistSelected(playlist: Playlist): Promise<void> {
        await this.playlistController.handlePlaylistSelected(playlist);
    }

    // 处理网络磁盘选择
    async handleNetworkDriveSelected(drive: unknown): Promise<void> {
        const networkDrive = drive as NetworkDriveLike;
        this.hideAllPages();
        this.updateSidebarSelection('network-drive', String(networkDrive.id));
        this.currentView = 'network-drive-detail';
        await this.ui.showNetworkDriveDetail(networkDrive);
    }

    // 处理网络磁盘移除
    async handleDriveRemoved(): Promise<void> {
        await this.ui.loadNetworkDrives();
        await this.refreshLibrary();
    }

    // 更新侧边栏选中状态
    updateSidebarSelection(type: string, id: string | null = null): void {
        this.viewRouter.updateSidebarSelection(type, id);
    }

    // 处理歌单更新
    async handlePlaylistUpdated(): Promise<void> {
        await this.playlistController.handlePlaylistUpdated();
    }

    // 处理歌单重命名成功
    async handlePlaylistRenamed(): Promise<void> {
        await this.playlistController.handlePlaylistRenamed();
    }

    // 处理显示添加歌曲对话框
    async handleShowAddSongsDialog(playlist: Playlist): Promise<void> {
        await this.playlistController.handleShowAddSongsDialog(playlist);
    }

    // 处理歌曲添加到歌单成功
    async handleTracksAddedToPlaylist(): Promise<void> {
        await this.playlistController.handleTracksAddedToPlaylist();
    }

    // 处理歌单封面更新
    async handlePlaylistCoverUpdated(playlist: Playlist): Promise<void> {
        await this.playlistController.handlePlaylistCoverUpdated(playlist);
    }

    async cleanup(): Promise<void> {
        // 保存播放状态和音量
        await this.savePlaybackState();
        const volume = this.ui.getPlayerVolume();
        if (volume !== null) {
            await cacheManager.setLocalCache('volume', volume);
        }

        this.domEventBinder.dispose();
        this.apiEventBinder.dispose();

        this.componentRegistry.destroyAllComponents();

        // 清理数据
        this.library = [];
        this.filteredLibrary = [];
    }

    // 文件加载方法
    setupFileLoading(): void {
        this.fileImportController.setupFileLoading();
    }

    async handleFileDrop(e: DragEvent): Promise<void> {
        await this.fileImportController.handleFileDrop(e);
    }

    async openDirectoryDialog(): Promise<void> {
        await this.fileImportController.openDirectoryDialog();
    }

    async loadAndPlayFile(filePath: string): Promise<void> {
        await this.fileImportController.loadAndPlayFile(filePath);
    }

    async addFilesToPlaylist(files: any[]): Promise<void> {
        await this.fileImportController.addFilesToPlaylist(files);
    }

    async scanDirectory(directoryPath: string): Promise<void> {
        await this.fileImportController.scanDirectory(directoryPath);
    }

    addFileMenuItems(): void {
        this.fileImportController.addFileMenuItems();
    }

    showSuccess(message: string): void {
        showToast(message, 'success');
    }

    showError(message: string): void {
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

    showInfo(message: string): void {
        showToast(message, 'info');
    }

    async confirm(options: ConfirmOptions): Promise<boolean> {
        return await this.ui.confirm(options);
    }

    // Playlist event handlers
    handlePlaylistTrackSelected(track: Track, _index: number): void {
        this.playlistController.handlePlaylistTrackSelected(track, _index);
    }

    async handlePlaylistTrackPlayed(track: Track, index: number): Promise<void> {
        await this.playlistController.handlePlaylistTrackPlayed(track, index);
    }

    async handlePlaylistTrackRemoved(track: Track, index: number): Promise<void> {
        await this.playlistController.handlePlaylistTrackRemoved(track, index);
    }

    async handlePlaylistCleared(): Promise<void> {
        await this.playlistController.handlePlaylistCleared();
    }

    // 播放播放列表中的歌曲
    async playTrackFromPlaylist(track: Track, index: number): Promise<void> {
        await this.playbackController.playTrackFromPlaylist(track, index);
    }

    // 处理歌曲索引更改（用于 prev/next 按钮）
    handleTrackIndexChanged(index: number): void {
        this.playbackController.handleTrackIndexChanged(index);
    }

    updateLibraryTrackDuration(filePath: string, duration: number): void {
        this.libraryController.updateLibraryTrackDuration(filePath, duration);
    }

    // 右击菜单事件处理方法
    // 删除音乐
    async handleDeleteTrack(track: Track, index: number): Promise<void> {
        await this.libraryController.handleDeleteTrack(track, index);
    }

    addToPlaylist(track: Track): void {
        this.playlistController.addToPlaylist(track);
    }

    async handleBatchDelete(selectedTracks: Set<number> | null | undefined, track: Track, index: number): Promise<void> {
        await this.libraryController.handleBatchDelete(selectedTracks, track, index);
    }

    // 处理编辑歌曲信息
    async handleEditTrackInfo(track: Track, _index: number): Promise<void> {
        await this.ui.showEditTrackInfoDialog(track);
    }

    // 处理歌曲信息更新
    async handleTrackInfoUpdated(data: unknown): Promise<void> {
        await this.libraryController.handleTrackInfoUpdated(data as any);
    }

    // 恢复播放状态
    async restorePlaybackState(): Promise<void> {
        await this.playbackController.restorePlaybackState();
    }

    // 自动播放第一首歌曲
    async autoplayFirstTrack(): Promise<void> {
        await this.playbackController.autoplayFirstTrack();
    }

    // 保存播放状态
    async savePlaybackState(): Promise<void> {
        await this.playbackController.savePlaybackState();
    }
}
