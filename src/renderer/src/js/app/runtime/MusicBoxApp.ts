import {EventEmitter} from '@utils/index.js';

import {APIEventBinder} from './APIEventBinder';
import {AppNotifier} from './AppNotifier';
import {AppRuntimeState} from './AppRuntimeState';
import {ComponentEventBinder} from './components/ComponentEventBinder';
import {ComponentRegistry} from './components/ComponentRegistry';
import {DesktopLyricsButtonSync} from './DesktopLyricsButtonSync';
import {DOMEventBinder} from './DOMEventBinder';
import {NetworkDriveRouteController} from './NetworkDriveRouteController';
import {PlaybackQueueSyncService} from './PlaybackQueueSyncService';
import {PluginBootstrap} from './PluginBootstrap';
import {ShortcutController} from './ShortcutController';
import {ViewRouter} from './ViewRouter';
import {AppLifecycleController, type InitResult} from '@js/app/lifecycle';
import {AppShellView} from '@js/app/shell';
import {createAppComposition} from '@js/app/composition';
import {FileImportController, LibraryAppController} from '@js/features/library/ui-bindings';
import {PlaylistController} from '@js/features/playlists/PlaylistController';
import {PlaybackAppController} from '@js/features/playback/ui-bindings/PlaybackAppController';

import {cacheManager} from "@js/shared/cache";
import {playbackController as playbackFeatureController} from "@js/features/playback/PlaybackController";
import type {MusicBoxAPIEvents, ScanProgress} from "@api/types/events";
import type {PlayMode} from "@api/types/playback";
import type {Playlist} from "@api/types/playlist";
import type {Track} from "@api/types/track";
import type {ComponentMap} from "./components/ComponentTypes";
import type {ComponentEventName} from './components/bindings/ComponentBindingTypes';
import type {AppUIPorts} from './ui/AppUIPorts';
import type {
    AppView,
    ConfirmOptions,
    ManagedAPIListener,
    ManagedDOMListener
} from "@js/shared/types/AppContracts";

type ShortcutDefinitionMap = Record<string, any>;
const PLAY_MODES: readonly PlayMode[] = ['sequence', 'shuffle', 'repeat-one'];

function isPlayMode(value: unknown): value is PlayMode {
    return typeof value === 'string' && PLAY_MODES.includes(value as PlayMode);
}

export class MusicBoxApp extends EventEmitter {
    private readonly state: AppRuntimeState;
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
    private readonly ui: AppUIPorts;
    private readonly desktopLyricsButtonSync: DesktopLyricsButtonSync;
    private readonly playbackQueueSyncService: PlaybackQueueSyncService;
    private readonly lifecycleController: AppLifecycleController;
    private readonly networkDriveRouteController: NetworkDriveRouteController;
    private readonly notifier: AppNotifier;
    private readonly shellView: AppShellView;

    constructor() {
        super();
        this.state = new AppRuntimeState();

        const composition = createAppComposition({
            app: this,
            components: this.components,
            eventListeners: this.eventListeners,
            apiEventListeners: this.apiEventListeners
        });
        this.ui = composition.ui;
        this.componentRegistry = composition.componentRegistry;
        this.domEventBinder = composition.domEventBinder;
        this.apiEventBinder = composition.apiEventBinder;
        this.shellView = composition.shellView;
        this.componentEventBinder = composition.componentEventBinder;
        this.viewRouter = composition.viewRouter;
        this.shortcutController = composition.shortcutController;
        this.fileImportController = composition.fileImportController;
        this.pluginBootstrap = composition.pluginBootstrap;
        this.libraryController = composition.libraryController;
        this.desktopLyricsButtonSync = composition.desktopLyricsButtonSync;
        this.playbackQueueSyncService = composition.playbackQueueSyncService;
        this.playbackController = composition.playbackController;
        this.playlistController = composition.playlistController;
        this.networkDriveRouteController = composition.networkDriveRouteController;
        this.notifier = composition.notifier;
        this.lifecycleController = composition.lifecycleController;

        this.init().then((res: InitResult) => {
            if (!res.status) console.error('Failed to initialize MusicBox:', res.error);
        });
    }

    get isInitialized(): boolean {
        return this.state.isInitialized;
    }

    set isInitialized(value: boolean) {
        this.state.isInitialized = value;
    }

    get currentView(): AppView {
        return this.state.currentView;
    }

    set currentView(value: AppView) {
        this.state.currentView = value;
    }

    get library(): Track[] {
        return this.state.library;
    }

    set library(value: Track[]) {
        this.state.library = value;
    }

    get filteredLibrary(): Track[] {
        return this.state.filteredLibrary;
    }

    set filteredLibrary(value: Track[]) {
        this.state.filteredLibrary = value;
    }

    get components(): ComponentMap {
        return this.state.components;
    }

    get coversPreloadedByApp(): boolean {
        return this.state.coversPreloadedByApp;
    }

    set coversPreloadedByApp(value: boolean) {
        this.state.coversPreloadedByApp = value;
    }

    get eventListeners(): ManagedDOMListener[] {
        return this.state.eventListeners;
    }

    get apiEventListeners(): ManagedAPIListener[] {
        return this.state.apiEventListeners;
    }

    async init(): Promise<InitResult> {
        return this.lifecycleController.init();
    }

    async initializeAPI(): Promise<void> {
        const cachedPlayMode = cacheManager.getLocalCache('playMode');
        if (isPlayMode(cachedPlayMode)) {
            playbackFeatureController.setPlayMode(cachedPlayMode);
        }
        const success = await playbackFeatureController.initializeAudio();
        if (!success) throw new Error('Failed to initialize audio engine');
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
        await this.domEventBinder.bindAppEvents();
        this.apiEventBinder.bindAppEvents();
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
        await this.desktopLyricsButtonSync.syncButtonState();
    }

    showCacheLoadingStatus(): void {
        this.shellView.showCacheLoadingStatus();
    }

    hideCacheLoadingStatus(): void {
        this.shellView.hideCacheLoadingStatus();
    }

    async validateCacheInBackground(): Promise<void> {
        await this.libraryController.validateCacheInBackground();
    }

    showApp(): void {
        this.shellView.showApp();
    }

    showWelcomeScreen(): void {
        this.shellView.showWelcomeScreen();
    }

    async scanMusicFolder(): Promise<void> {
        await this.fileImportController.scanMusicFolder();
    }

    async addMusicFiles(): Promise<void> {
        await this.fileImportController.addMusicFiles();
    }

    showScanProgress(): void {
        this.shellView.showScanProgress();
    }

    updateScanProgress(progress: ScanProgress): void {
        this.shellView.updateScanProgress(progress);
    }

    async refreshLibrary(tracks?: Track[]): Promise<void> {
        await this.libraryController.refreshLibrary(tracks);
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
        this.componentEventBinder.setupComponentEvents(componentName as ComponentEventName | null);
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
        this.ui.dialogs.showCreatePlaylistDialog();
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
        await this.networkDriveRouteController.handleNetworkDriveSelected(drive);
    }

    // 处理网络磁盘移除
    async handleDriveRemoved(): Promise<void> {
        await this.networkDriveRouteController.handleDriveRemoved();
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
        await this.lifecycleController.cleanup();
        this.domEventBinder.dispose();
        this.apiEventBinder.dispose();
        this.playbackQueueSyncService.dispose();

        this.componentRegistry.destroyAllComponents();
    }

    clearRuntimeData(): void {
        this.state.clearLibraryData();
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
        this.notifier.showSuccess(message);
    }

    showError(message: string): void {
        this.notifier.showError(message);
    }

    showFatalError(message: string): void {
        this.notifier.showFatalError(message);
    }

    showInfo(message: string): void {
        this.notifier.showInfo(message);
    }

    async confirm(options: ConfirmOptions): Promise<boolean> {
        return await this.ui.dialogs.confirm(options);
    }

    showNetworkDriveModal(): boolean {
        return this.ui.dialogs.showNetworkDriveModal();
    }

    async showPluginManager(): Promise<boolean> {
        return await this.ui.dialogs.showPluginManager();
    }

    navigateToView(viewId: string): void {
        this.ui.content.navigateToView(viewId);
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
    async playTrackFromPlaylist(track: Track, index: number, tracks?: Track[]): Promise<void> {
        await this.playbackController.playTrackFromPlaylist(track, index, tracks);
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

    async addToPlaylist(track: Track): Promise<void> {
        await this.playlistController.addToPlaylist(track);
    }

    async handleBatchDelete(selectedTracks: Set<number> | null | undefined, track: Track, index: number): Promise<void> {
        await this.libraryController.handleBatchDelete(selectedTracks, track, index);
    }

    // 处理编辑歌曲信息
    async handleEditTrackInfo(track: Track, _index: number): Promise<void> {
        await this.ui.dialogs.showEditTrackInfoDialog(track);
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
