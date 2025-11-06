import {EventEmitter, showToast} from '@utils';

import {AlbumsPage} from "@components/component/AlbumsPage";
import {ArtistsPage} from "@components/component/ArtistsPage";
import {ContextMenu} from "@components/component/ContextMenu";
import {EqualizerComponent} from "@components/component/EqualizerComponent";
import {HomePage} from "@components/component/HomePage";
import {Lyrics} from "@components/component/Lyrics";
import {Navigation} from "@components/component/Navigation";
import {NetworkDiskModal} from "@components/component/NetworkDiskModal";
import {NetworkDriveDetailPage} from "@components/component/NetworkDriveDetailPage";
import {Player} from '@components/component/Player';
import {Playlist} from "@components/component/Playlist";
import {PlaylistDetailPage} from "@components/component/PlaylistDetailPage";
import {PluginManagerModal} from "@components/component/PluginManagerModal";
import {RecentPage} from "@components/component/RecentPage";
import {Search} from "@components/component/Search";
import {Settings} from "@components/component/Settings";
import {StatisticsPage} from "@components/component/StatisticsPage";
import {TrackList} from "@components/component/TrackList";
import {UpdateModal} from "@components/component/UpdateModal";

import {AddToPlaylistDialog} from "@components/dialogs/AddToPlaylistDialog";
import {CreatePlaylistDialog} from "@components/dialogs/CreatePlaylistDialog";
import {EditTrackInfoDialog} from "@components/dialogs/EditTrackInfoDialog";
import {MusicLibrarySelectionDialog} from "@components/dialogs/MusicLibrarySelectionDialog";
import {RenamePlaylistDialog} from "@components/dialogs/RenamePlaylistDialog";

import {cacheManager} from "@services/CacheManager";
import {localCoverManager} from "@services/cover/LocalCoverManager";
import {api} from "@api/api";

import {ExtensionService} from "@extensions/core/ExtensionService";
import {InstantiationService, ServiceCollection} from "@extensions/core/Instantiation";
import {ActivationEvents} from "@extensions/core/ExtensionsRegistry";

class MusicBoxApp extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentView = 'library';
        this.library = [];
        this.filteredLibrary = [];
        this.components = {};
        this.coversPreloadedByApp = false; // 防重复标志：封面预加载

        // 事件监听器管理
        this.eventListeners = [];
        this.apiEventListeners = [];

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

            // 在组件完全初始化后再初始化插件系统
            this.isInitialized = true;
            await this.initializePluginSystem();

            this.showApp();

            // 通知插件系统应用已完全初始化
            this.notifyPluginSystemReady();

            // 自动检查更新
            setTimeout(() => {
                this.autoCheckForUpdates();
            }, 3000);
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
        const success = await api.initializeAudio();
        if (!success) {
            throw new Error('Failed to initialize audio engine');
        }
    }

    // 初始化插件系统
    async initializePluginSystem() {
        try {
            console.log('🔌 App: 开始初始化插件系统');

            // 检查扩展服务是否可用
            if (typeof ExtensionService === 'undefined') {
                console.error('❌ App: ExtensionService 未定义，插件系统核心模块可能未加载');
                return;
            }

            // 创建服务集合
            const services = new ServiceCollection();

            // 创建实例化服务
            const instantiationService = new InstantiationService(services);

            // 创建扩展服务
            const extensionService = instantiationService.createInstance(ExtensionService);

            // 初始化扩展服务
            await extensionService.initialize();

            // 保存到全局和应用实例
            window.extensionService = extensionService;
            window.instantiationService = instantiationService;
            this.extensionService = extensionService;
            this.instantiationService = instantiationService;

            console.log('✅ App: 扩展服务初始化成功');

            // 触发启动扩展激活事件
            await extensionService.activateByEvent(ActivationEvents.ON_START_UP);

            console.log('✅ App: 插件系统初始化完成');

        } catch (error) {
            console.error('❌ App: 插件系统初始化失败:', error);
            // 不抛出错误，让应用继续运行
        }
    }

    // 通知插件系统应用已完全初始化
    notifyPluginSystemReady() {
        try {
            // 触发应用就绪事件
            document.dispatchEvent(new CustomEvent('appReady', {
                detail: {
                    app: this,
                    components: this.components,
                    isInitialized: this.isInitialized
                }
            }));

            console.log('✅ App: 应用就绪事件已触发');
        } catch (error) {
            console.error('❌ App: 通知插件系统失败:', error);
        }
    }

    initializeComponents() {
        this.components.player = new Player();
        this.components.search = new Search();
        this.components.navigation = new Navigation();
        this.components.trackList = new TrackList('#content-area');
        this.components.playlist = new Playlist(document.getElementById('playlist-panel'));
        this.components.contextMenu = new ContextMenu(document.getElementById('context-menu'));
        this.components.settings = new Settings(document.getElementById('settings-page'));
        this.components.lyrics = new Lyrics(document.getElementById('lyrics-page'));
        this.components.equalizer = new EqualizerComponent();

        // 初始化歌单对话框组件
        this.components.createPlaylistDialog = new CreatePlaylistDialog();
        this.components.addToPlaylistDialog = new AddToPlaylistDialog();
        this.components.renamePlaylistDialog = new RenamePlaylistDialog();
        this.components.musicLibrarySelectionDialog = new MusicLibrarySelectionDialog();
        this.components.editTrackInfoDialog = new EditTrackInfoDialog();

        // 初始化歌单详情页面组件
        this.components.playlistDetailPage = new PlaylistDetailPage('#content-area');

        // 初始化网络磁盘详情页面组件
        this.components.networkDriveDetailPage = new NetworkDriveDetailPage('#content-area');

        // 将settings组件暴露到全局，供其他组件访问
        window.settings = this.components.settings;

        // 初始化更新检查模态窗口
        this.components.updateModal = new UpdateModal();

        // 网络磁盘模态框组件
        this.components.networkDiskModal = null;

        // 插件管理模态框组件
        this.components.pluginManagerModal = new PluginManagerModal();

        // 初始化首页
        this.components.homePage = new HomePage('#content-area');

        // 按需初始化页面组件
        this.initializePageComponentsOnDemand();

        // 设置组件事件监听
        this.components.search.on('searchResults', (results) => {
            this.handleSearchResults(results);
        });

        this.components.search.on('searchCleared', () => {
            this.handleSearchCleared();
        });

        this.components.navigation.on('viewChanged', async (view) => {
            await this.handleViewChange(view);
        });

        this.components.navigation.on('showSettings', async () => {
            await this.components.settings.toggle();
        });

        this.components.navigation.on('playlistSelected', async (playlist) => {
            await this.handlePlaylistSelected(playlist);
        });

        this.components.navigation.on('networkDriveSelected', async (drive) => {
            await this.handleNetworkDriveSelected(drive);
        });

        this.components.navigation.on('showRenameDialog', (playlist) => {
            this.components.renamePlaylistDialog.show(playlist);
        });

        // 监听快捷键配置更新
        this.components.settings.on('shortcutsUpdated', () => {
            console.log('🎹 快捷键配置已更新');
            // 快捷键配置更新后，统一快捷键管理器会自动从配置中读取新的快捷键
        });

        this.components.trackList.on('trackPlayed', async (track, index) => {
            await this.handleTrackPlayed(track, index);
        });

        this.components.trackList.on('trackRightClick', (track, index, x, y) => {
            this.components.contextMenu.show(x, y, track, index);
        });

        // Player events
        this.components.player.on('togglePlaylist', () => {
            this.components.playlist.toggle();
        });

        this.components.player.on('toggleLyrics', () => {
            this.components.lyrics.toggle(api.currentTrack);
        });

        this.components.player.on('trackIndexChanged', (index) => {
            this.handleTrackIndexChanged(index);
        });

        // Playlist events
        this.components.playlist.on('trackSelected', ({track, index}) => {
            this.handlePlaylistTrackSelected(track, index);
        });

        this.components.playlist.on('trackPlayed', async ({track, index}) => {
            await this.handlePlaylistTrackPlayed(track, index);
        });

        this.components.playlist.on('trackRemoved', async ({track, index}) => {
            await this.handlePlaylistTrackRemoved(track, index);
        });

        this.components.playlist.on('playlistCleared', async () => {
            await this.handlePlaylistCleared();
        });

        // Context menu events
        this.components.contextMenu.on('play', async ({track, index}) => {
            await this.handleTrackPlayed(track, index);
        });

        this.components.contextMenu.on('addToPlaylist', ({track, index}) => {
            this.addToPlaylist(track);
        });

        this.components.contextMenu.on('addToCustomPlaylist', async ({track, index}) => {
            await this.handleAddToCustomPlaylist(track, index);
        });

        this.components.contextMenu.on('delete', ({track, index}) => {
            this.handleDeleteTrack(track, index);
        });

        this.components.contextMenu.on('editInfo', async ({track, index}) => {
            await this.handleEditTrackInfo(track, index);
        });

        // 歌单对话框事件监听
        this.components.createPlaylistDialog.on('playlistCreated', async (playlist) => {
            await this.handlePlaylistCreated(playlist);
        });

        this.components.addToPlaylistDialog.on('createNewPlaylist', (track) => {
            this.components.createPlaylistDialog.show(track);
        });

        this.components.addToPlaylistDialog.on('trackAdded', async ({playlist, track}) => {
            await this.handleTrackAddedToPlaylist(playlist, track);
        });

        // 重命名歌单对话框事件监听
        this.components.renamePlaylistDialog.on('playlistRenamed', async (playlist) => {
            await this.handlePlaylistRenamed(playlist);
        });

        // 音乐库选择对话框事件监听
        this.components.musicLibrarySelectionDialog.on('tracksAdded', async (data) => {
            await this.handleTracksAddedToPlaylist(data);
        });

        // 编辑歌曲信息对话框事件监听
        this.components.editTrackInfoDialog.on('trackUpdated', async (data) => {
            await this.handleTrackInfoUpdated(data);
        });

        // 歌单详情页面事件监听
        this.components.playlistDetailPage.on('trackPlayed', async (track, index) => {
            await this.handleTrackPlayed(track, index);
        });

        this.components.playlistDetailPage.on('playAllTracks', async (tracks) => {
            await this.handlePlayAllTracks(tracks);
        });

        this.components.playlistDetailPage.on('playlistUpdated', async (playlist) => {
            await this.handlePlaylistUpdated(playlist);
        });

        this.components.playlistDetailPage.on('showAddSongsDialog', async (playlist) => {
            await this.handleShowAddSongsDialog(playlist);
        });

        this.components.playlistDetailPage.on('playlistCoverUpdated', async (playlist) => {
            await this.handlePlaylistCoverUpdated(playlist);
        });

        // Settings events
        this.components.settings.on('selectMusicFolder', async () => {
            await this.handleSelectMusicFolder();
        });

        // 监听检查更新事件
        this.components.settings.on('checkUpdates', () => {
            this.components.updateModal.show();
        });

        // 监听桌面歌词设置变化
        this.components.settings.on('desktopLyricsEnabled', async (enabled) => {
            if (this.components.player) {
                await this.components.player.updateDesktopLyricsButtonVisibility(enabled);
            }
        });

        // 监听网络磁盘设置变化
        this.components.settings.on('networkDriveEnabled', (enabled) => {
            if (enabled) {
                this.initializeComponent('networkDiskModal');
            } else {
                this.destroyComponent('networkDiskModal');
            }
        });

        // 监听统计信息设置变化
        this.components.settings.on('statisticsEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateStatisticsButtonVisibility(enabled);
            }

            if (enabled) {
                this.initializeComponent('statisticsPage');
            } else {
                this.destroyComponent('statisticsPage');
            }
        });

        // 监听最近播放设置变化
        this.components.settings.on('recentPlayEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateRecentPlayButtonVisibility(enabled);
            }

            if (enabled) {
                this.initializeComponent('recentPage');
            } else {
                this.destroyComponent('recentPage');
            }
        });

        // 监听艺术家页面设置变化
        this.components.settings.on('artistsPageEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateArtistsPageButtonVisibility(enabled);
            }

            if (enabled) {
                this.initializeComponent('artistsPage');
            } else {
                this.destroyComponent('artistsPage');
            }
        });

        // 监听专辑页面设置变化
        this.components.settings.on('albumsPageEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateAlbumsPageButtonVisibility(enabled);
            }

            if (enabled) {
                this.initializeComponent('albumsPage');
            } else {
                this.destroyComponent('albumsPage');
            }
        });

        // 监听歌曲封面显示设置变化
        this.components.settings.on('showTrackCoversEnabled', async (enabled) => {
            if (enabled && this.isInitialized) {
                // 只有在应用完全初始化后才预加载封面，避免启动时重复加载
                await this.preloadTrackCovers();
            }
        });

        // 监听无间隙播放设置变化
        this.components.settings.on('gaplessPlaybackEnabled', (enabled) => {
            api.setGaplessPlayback(enabled);
        });

        // 新组件事件监听
        this.setupComponentEvents();

        // Lyrics events
        this.components.lyrics.on('togglePlay', () => {
            this.components.player.togglePlayPause();
        });

        this.components.lyrics.on('previousTrack', () => {
            this.components.player.previousTrack();
        });

        this.components.lyrics.on('nextTrack', () => {
            this.components.player.nextTrack();
        });
    }

    // 按需初始化页面组件
    initializePageComponentsOnDemand() {
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};

        // 最近播放页面
        const recentPlayEnabled = settings.hasOwnProperty('recentPlay') ? settings.recentPlay : true;
        if (recentPlayEnabled) {
            this.components.recentPage = new RecentPage('#content-area');
        } else {
            this.components.recentPage = null;
        }

        // 艺术家页面
        const artistsPageEnabled = settings.hasOwnProperty('artistsPage') ? settings.artistsPage : true;
        if (artistsPageEnabled) {
            this.components.artistsPage = new ArtistsPage('#content-area');
        } else {
            this.components.artistsPage = null;
        }

        // 专辑页面
        const albumsPageEnabled = settings.hasOwnProperty('albumsPage') ? settings.albumsPage : true;
        if (albumsPageEnabled) {
            this.components.albumsPage = new AlbumsPage('#content-area');
        } else {
            this.components.albumsPage = null;
        }

        // 统计页面
        const statisticsEnabled = settings.hasOwnProperty('statistics') ? settings.statistics : true;
        if (statisticsEnabled) {
            this.components.statisticsPage = new StatisticsPage('#content-area');
        } else {
            this.components.statisticsPage = null;
        }

        // 网络磁盘模态框
        const networkDriveEnabled = settings.hasOwnProperty('networkDriveEnabled') ? settings.networkDriveEnabled : false;
        if (networkDriveEnabled) {
            this.initializeComponent('networkDiskModal');
        } else {
            this.components.networkDiskModal = null;
        }
    }

    // 动态初始化组件（页面组件和模态框组件）
    initializeComponent(componentName) {
        switch (componentName) {
            case 'recentPage':
                if (!this.components.recentPage) {
                    this.components.recentPage = new RecentPage('#content-area');
                    this.setupComponentEvents('recentPage');
                }
                break;
            case 'artistsPage':
                if (!this.components.artistsPage) {
                    this.components.artistsPage = new ArtistsPage('#content-area');
                    this.setupComponentEvents('artistsPage');
                }
                break;
            case 'albumsPage':
                if (!this.components.albumsPage) {
                    this.components.albumsPage = new AlbumsPage('#content-area');
                    this.setupComponentEvents('albumsPage');
                }
                break;
            case 'statisticsPage':
                if (!this.components.statisticsPage) {
                    this.components.statisticsPage = new StatisticsPage('#content-area');
                    this.setupComponentEvents('statisticsPage');
                }
                break;
            case 'networkDiskModal':
                if (!this.components.networkDiskModal) {
                    this.components.networkDiskModal = new NetworkDiskModal();
                    this.setupComponentEvents('networkDiskModal');
                }
                break;
            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }

    // 销毁组件（页面组件和模态框组件）
    destroyComponent(componentName) {
        switch (componentName) {
            case 'recentPage':
                if (this.components.recentPage) {
                    this.components.recentPage.destroy();
                    this.components.recentPage = null;
                }
                break;
            case 'artistsPage':
                if (this.components.artistsPage) {
                    this.components.artistsPage.destroy();
                    this.components.artistsPage = null;
                }
                break;
            case 'albumsPage':
                if (this.components.albumsPage) {
                    this.components.albumsPage.destroy();
                    this.components.albumsPage = null;
                }
                break;
            case 'statisticsPage':
                if (this.components.statisticsPage) {
                    this.components.statisticsPage.destroy();
                    this.components.statisticsPage = null;
                }
                break;
            case 'networkDiskModal':
                if (this.components.networkDiskModal) {
                    this.components.networkDiskModal.hide();
                    this.components.networkDiskModal.destroy();
                    this.components.networkDiskModal = null;
                }
                break;
            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }

    // 添加管理的事件监听器
    addManagedEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        this.eventListeners.push({element, event, handler, options});
    }

    // 添加管理的API事件监听器
    addManagedAPIEventListener(event, handler) {
        api.on(event, handler);
        this.apiEventListeners.push({event, handler});
    }

    async setupEventListeners() {
        // Window events
        this.addManagedEventListener(window, 'beforeunload', async () => {
            await this.cleanup();
        });

        // 初始化窗口状态管理
        this.initWindowStateManagement();

        // 初始化系统托盘
        await this.initSystemTray();

        // 初始化统一的快捷键管理器
        this.initKeyboardShortcuts();

        // 初始化全局快捷键
        await this.initGlobalShortcuts();

        // 添加播放列表按钮
        const addPlaylistBtn = document.getElementById('add-playlist-btn');
        if (addPlaylistBtn) {
            this.addManagedEventListener(addPlaylistBtn, 'click', () => {
                this.showCreatePlaylistDialog();
            });
        }

        // 文件加载功能
        this.setupFileLoading();

        // API events - 使用管理的API事件监听器
        this.addManagedAPIEventListener('libraryUpdated', async (data) => {
            await this.refreshLibrary();
        });

        this.addManagedAPIEventListener('playlistChanged', (tracks) => {
            console.log('🎵 API播放列表改变:', tracks.length, '首歌曲');
            // 确保播放列表组件与API同步
            if (this.components.playlist && tracks.length > 0) {
                this.components.playlist.setTracks(tracks, api.currentIndex);
            }
        });

        this.addManagedAPIEventListener('libraryTrackDurationUpdated', ({filePath, duration}) => {
            console.log('🎵 更新音乐库歌曲时长:', filePath, duration.toFixed(2) + 's');
            this.updateLibraryTrackDuration(filePath, duration);
        });

        this.addManagedAPIEventListener('playModeChanged', (mode) => {
            this.components.player.updatePlayModeDisplay(mode);
        });

        // Update lyrics page when track changes
        this.addManagedAPIEventListener('trackChanged', async (track) => {
            if (this.components.lyrics && this.components.lyrics.isVisible) {
                await this.components.lyrics.show(track);
            }
        });

        // Update lyrics page progress
        this.addManagedAPIEventListener('positionChanged', (position) => {
            if (this.components.lyrics && this.components.lyrics.isVisible) {
                // 使用当前歌曲的时长以避免使用可能过期的全局 api.duration
                const duration = (api.currentTrack && api.currentTrack.duration) ? api.currentTrack.duration : api.duration;
                this.components.lyrics.updateProgress(position, duration);
            }
        });

        // Update lyrics page play button
        this.addManagedAPIEventListener('playbackStateChanged', (state) => {
            if (this.components.lyrics && this.components.lyrics.isVisible) {
                this.components.lyrics.updatePlayButton(state === 'playing');
            }
        });

        api.on('scanProgress', (progress) => {
            this.updateScanProgress(progress);
        });
    }

    async loadInitialData() {
        try {
            // 首先尝试从缓存加载音乐库
            const hasCachedLibrary = await api.hasCachedLibrary();

            if (hasCachedLibrary) {
                this.showCacheLoadingStatus();

                // 从缓存加载音乐库
                this.library = await api.loadCachedTracks();
                if (this.library.length > 0) {
                    this.filteredLibrary = [...this.library];
                    this.updateTrackList('cache-load');
                    this.hideCacheLoadingStatus();

                    // 预加载封面数据
                    await this.preloadTrackCovers();

                    // 在后台验证缓存
                    await this.validateCacheInBackground();
                    return;
                }
            }

            // 如果没有缓存或缓存为空，检查内存中的音乐库
            this.library = await api.getTracks();
            if (this.library.length === 0) {
                this.showWelcomeScreen();
            } else {
                // 加载库视图
                this.filteredLibrary = [...this.library];
                this.updateTrackList('initial-load');

                // 预加载封面数据
                await this.preloadTrackCovers();
            }

            // 确保桌面歌词按钮状态与设置同步
            await this.syncDesktopLyricsButtonState();
        } catch (error) {
            this.showError('加载音乐库失败');
        }
    }

    // 预加载歌曲封面
    async preloadTrackCovers() {
        try {
            // 检查是否启用了封面显示
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            const showTrackCovers = settings.hasOwnProperty('showTrackCovers') ? settings.showTrackCovers : true;
            if (!showTrackCovers) {
                return;
            }

            // 防重复
            // 检查是否已经预加载过
            if (this.coversPreloadedByApp) {
                return;
            }

            // 预加载前12首歌曲的封面，避免阻塞UI
            // 为啥是12首？因为全屏状态下，一页最多显示12首歌😋
            // 坏了兄弟们，预加载12首似乎有点占内存，砍一半吧🥵
            const tracksToPreload = this.library.slice(0, 6);
            await localCoverManager.preloadCovers(tracksToPreload);
            this.coversPreloadedByApp = true;
        } catch (error) {
            console.warn('⚠️ App: 封面预加载失败:', error);
        }
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
        try {
            api.on('cacheValidationCompleted', (result) => {
                // 如果有无效文件被清理，更新UI
                if (result.invalid > 0) {
                    this.showInfo(`已清理 ${result.invalid} 个无效的音乐文件`);

                    // 更新音乐库
                    if (result.tracks) {
                        this.library = result.tracks;
                        this.filteredLibrary = [...this.library];
                        this.updateTrackList('cache-validation');
                    }
                }
            });

            api.on('cacheValidationError', (error) => {
                console.warn('⚠️ 后台缓存验证失败:', error);
            });

            // 启动验证
            await api.validateCache();
        } catch (error) {
            console.warn('⚠️ 后台缓存验证失败:', error);
        }
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
        try {
            const folderPath = await api.openDirectory();
            if (folderPath) {
                this.showScanProgress();
                const success = await api.scanDirectory(folderPath);
                if (success) {
                    showToast('音乐目录扫描成功', 'success');
                    // API层会自动触发音乐库更新事件，无需手动刷新
                } else {
                    showToast('音乐目录扫描失败', 'error');
                }
            }
        } catch (error) {
            showToast('音乐目录扫描失败', 'error');
        }
    }

    async addMusicFiles() {
        try {
            const filePaths = await api.openFiles();
            if (filePaths.length > 0) {
                let successCount = 0;
                for (const filePath of filePaths) {
                    // 获取文件元数据
                    const metadata = await api.getTrackMetadata(filePath);
                    if (metadata) {
                        // 添加到音乐库缓存
                        const result = await api.addTrackToLibrary(metadata);
                        if (result && result.success) {
                            successCount++;
                            console.log('🎉 [App] 文件添加成功:', metadata.title);
                        }
                    }
                }

                // 显示结果提示
                if (successCount > 0) {
                    showToast(`成功添加 ${successCount} 首音乐`, 'success');
                } else {
                    showToast('添加音乐失败', 'error');
                }
            }
        } catch (error) {
            showToast('添加音乐失败', 'error');
        }
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
        try {
            this.library = await api.getTracks();
            this.filteredLibrary = [...this.library];
            this.updateTrackList('refresh');
        } catch (error) {
            console.error('❌ [App] refreshLibrary 失败:', error);
        }
    }

    updateTrackList(source = 'unknown') {
        console.log('🔄 [App] updateTrackList 被调用，来源:', source, '当前视图:', this.currentView);

        // 如果是播放时长更新触发的调用，且当前不在音乐库页面，则跳过更新
        if (source === 'duration-update' && this.currentView !== 'library') {
            console.log('📝 [App] 跳过播放时长更新触发的音乐列表更新，当前视图:', this.currentView);
            return;
        }

        if (this.components.trackList) {
            this.components.trackList.setTracks(this.filteredLibrary);
        }
    }

    handleSearchResults(results) {
        this.filteredLibrary = results;
        this.updateTrackList('search-results');
    }

    handleSearchCleared() {
        this.filteredLibrary = [...this.library];
        this.updateTrackList('search-cleared');
    }

    setupComponentEvents(componentName = null) {
        // 如果指定了组件名，只设置该组件的事件
        if (componentName) {
            this.setupSingleComponentEvents(componentName);
            return;
        }

        // 设置所有页面组件的事件
        // HomePage events (始终存在)
        this.components.homePage.on('trackPlayed', async (track, index) => {
            await this.handleTrackPlayed(track, index);
        });

        this.components.homePage.on('viewChange', (view) => {
            this.components.navigation.navigateToView(view);
        });

        this.components.homePage.on('addMusic', async () => {
            await this.handleSelectMusicFolder();
        });

        // 按需设置其他组件的事件
        if (this.components.recentPage) {
            this.setupSingleComponentEvents('recentPage');
        }

        if (this.components.artistsPage) {
            this.setupSingleComponentEvents('artistsPage');
        }

        if (this.components.albumsPage) {
            this.setupSingleComponentEvents('albumsPage');
        }

        if (this.components.statisticsPage) {
            this.setupSingleComponentEvents('statisticsPage');
        }

        if (this.components.networkDiskModal) {
            this.setupSingleComponentEvents('networkDiskModal');
        }

        if (this.components.networkDriveDetailPage) {
            this.setupSingleComponentEvents('networkDriveDetailPage');
        }
    }

    // 设置单个组件的事件监听
    setupSingleComponentEvents(componentName) {
        switch (componentName) {
            case 'recentPage':
                if (this.components.recentPage) {
                    this.components.recentPage.on('trackPlayed', async (track, index) => {
                        await this.handleTrackPlayed(track, index);
                    });

                    this.components.recentPage.on('playAll', async (tracks) => {
                        await this.handlePlayAllTracks(tracks);
                    });

                    this.components.recentPage.on('addToPlaylist', (track) => {
                        this.addToPlaylist(track);
                    });

                    this.components.recentPage.on('viewChange', (view) => {
                        this.components.navigation.navigateToView(view);
                    });
                }
                break;

            case 'artistsPage':
                if (this.components.artistsPage) {
                    this.components.artistsPage.on('trackPlayed', async (track, index) => {
                        await this.handleTrackPlayed(track, index);
                    });

                    this.components.artistsPage.on('playAll', async (tracks) => {
                        await this.handlePlayAllTracks(tracks);
                    });

                    this.components.artistsPage.on('addToPlaylist', (track) => {
                        this.addToPlaylist(track);
                    });
                }
                break;

            case 'albumsPage':
                if (this.components.albumsPage) {
                    this.components.albumsPage.on('trackPlayed', async (track, index) => {
                        await this.handleTrackPlayed(track, index);
                    });

                    this.components.albumsPage.on('playAll', async (tracks) => {
                        await this.handlePlayAllTracks(tracks);
                    });

                    this.components.albumsPage.on('addToPlaylist', (track) => {
                        this.addToPlaylist(track);
                    });
                }
                break;

            case 'statisticsPage':
                // StatisticsPage 目前不需要特殊的事件监听
                break;

            case 'networkDiskModal':
                if (this.components.networkDiskModal) {
                    // 监听通知事件
                    this.components.networkDiskModal.on('notification', (data) => {
                        this.showSuccess(data.message);
                    });
                }
                break;

            case 'networkDriveDetailPage':
                if (this.components.networkDriveDetailPage) {
                    this.components.networkDriveDetailPage.on('driveRemoved', async (drive) => {
                        await this.handleDriveRemoved(drive);
                    });

                    this.components.networkDriveDetailPage.on('playTrack', async (track, index) => {
                        await this.handleTrackPlayed(track, index);
                    });

                    this.components.networkDriveDetailPage.on('playTracks', async (tracks, startIndex) => {
                        await this.handlePlayAllTracks(tracks);
                    });
                }
                break;

            default:
                console.warn('🎵 App: 未知的组件名称:', componentName);
        }
    }

    async handlePlayAllTracks(tracks) {
        if (!tracks || tracks.length === 0) return;

        try {
            await api.setPlaylist(tracks, 0);
            // 直接播放第一首，不调用handleTrackPlayed避免页面跳转
            if (this.components.playlist && this.components.playlist.setTracks) {
                this.components.playlist.setTracks(tracks, 0);
            }
            await this.playTrackFromPlaylist(tracks[0], 0);
        } catch (error) {
            this.showError('播放失败，请重试');
        }
    }

    async handleViewChange(view) {
        this.hideAllPages();
        this.currentView = view;

        // 更新侧边栏选中状态
        // 除了歌单详情页面和网络磁盘详情页面，因为它们有特殊处理
        if (view !== 'playlist-detail' && view !== 'network-drive-detail') {
            this.updateSidebarSelection(view);
        }

        switch (view) {
            case 'home-page':
                await this.components.homePage.show();
                break;
            case 'library':
                this.components.trackList.show();
                this.updateTrackList('navigation');
                break;
            case 'recent':
                if (this.components.recentPage) {
                    await this.components.recentPage.show();
                }
                break;
            case 'artists':
                if (this.components.artistsPage) {
                    await this.components.artistsPage.show();
                }
                break;
            case 'albums':
                if (this.components.albumsPage) {
                    await this.components.albumsPage.show();
                }
                break;
            case 'statistics':
                if (this.components.statisticsPage) {
                    await this.components.statisticsPage.show();
                }
                break;
            case 'playlist-detail':
                // 歌单详情页面由handlePlaylistSelected方法处理
                break;
            default:
                console.warn('Unknown view:', view);
                // 只有在当前不是歌单详情页面时才跳转到音乐库
                if (this.currentView !== 'playlist-detail') {
                    this.components.trackList.show();
                    this.updateTrackList('default-fallback');
                }
                break;
        }
    }

    hideAllPages() {
        // 隐藏所有页面组件
        if (this.components.homePage) this.components.homePage.hide();
        if (this.components.recentPage) this.components.recentPage.hide();
        if (this.components.artistsPage) this.components.artistsPage.hide();
        if (this.components.albumsPage) this.components.albumsPage.hide();
        if (this.components.statisticsPage) this.components.statisticsPage.hide();
        if (this.components.playlistDetailPage) this.components.playlistDetailPage.hide();
        if (this.components.networkDriveDetailPage) this.components.networkDriveDetailPage.hide();
        if (this.components.trackList) this.components.trackList.hide();
    }

    async handleTrackPlayed(track, index) {
        console.log('🎵 从音乐库播放歌曲:', track.title, '当前视图:', this.currentView);

        if (this.components.playlist) {
            // 如果当前在音乐库页面，将整个音乐库添加到播放列表
            if (this.currentView === 'library') {
                // 获取当前显示的音乐列表
                const currentLibrary = this.filteredLibrary && this.filteredLibrary.length > 0
                    ? this.filteredLibrary
                    : this.library;

                if (currentLibrary.length > 0) {
                    // 找到被双击歌曲在当前列表中的索引
                    const trackIndex = currentLibrary.findIndex(t => t.filePath === track.filePath);
                    const startIndex = trackIndex !== -1 ? trackIndex : 0;

                    console.log(`🎵 设置播放列表: ${currentLibrary.length} 首歌曲，从第 ${startIndex + 1} 首开始播放`);

                    // 将整个音乐库设置为播放列表，并从被双击的歌曲开始播放
                    this.components.playlist.setTracks(currentLibrary, startIndex);
                    await this.playTrackFromPlaylist(track, startIndex);
                } else {
                    console.warn('⚠️ 音乐库为空，无法播放');
                }
            } else {
                // 在其他页面的播放逻辑保持不变
                if (this.components.playlist.tracks.length === 0) {
                    console.log('🎵 播放列表为空，添加当前歌曲，当前视图:', this.currentView);
                    // 只添加当前歌曲，而不是整个音乐库，避免触发页面跳转
                    this.components.playlist.setTracks([track], 0);
                    console.log('🔍 setTracks 完成，当前视图:', this.currentView);
                    await this.playTrackFromPlaylist(track, 0);
                } else {
                    // 播放列表不为空，检查歌曲是否已在播放列表中
                    const existingIndex = this.components.playlist.tracks.findIndex(t =>
                        t.filePath === track.filePath
                    );
                    if (existingIndex === -1) {
                        // 歌曲不在播放列表中，添加到末尾并播放
                        const newIndex = this.components.playlist.addTrack(track);
                        await this.playTrackFromPlaylist(track, newIndex);
                    } else {
                        // 歌曲已在播放列表中，直接播放
                        await this.playTrackFromPlaylist(track, existingIndex);
                    }
                }
            }
        } else {
            // 如果播放列表组件不存在，使用传统播放方式
            console.warn('播放列表组件不存在，使用传统播放方式');
            await api.setPlaylist([track], 0);
        }
    }

    // 统一的快捷键管理器
    initKeyboardShortcuts() {
        // 防抖机制，防止快速重复按键
        let lastKeyTime = 0;
        const DEBOUNCE_DELAY = 200; // 200ms防抖延迟

        document.addEventListener('keydown', async (e) => {
            // 如果焦点在输入框中，不处理快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // 如果快捷键录制器正在录制，不处理应用快捷键
            if (window.shortcutRecorder && window.shortcutRecorder.isRecording) {
                return;
            }

            const currentTime = Date.now();
            const pressedKey = this.generateKeyString(e);

            const shortcuts = this.getEnabledShortcuts();
            const matchedShortcut = this.findMatchingShortcut(pressedKey, shortcuts);

            if (matchedShortcut) {
                // 对于播放/暂停快捷键，添加防抖机制
                if (matchedShortcut.id === 'playPause') {
                    if (currentTime - lastKeyTime < DEBOUNCE_DELAY) {
                        console.log('🚫 快捷键防抖：忽略重复的播放/暂停快捷键');
                        return;
                    }
                    lastKeyTime = currentTime;
                }

                e.preventDefault();
                e.stopPropagation(); // 阻止事件冒泡
                console.log(`⌨️ 统一快捷键管理器：处理快捷键 ${matchedShortcut.name} (${pressedKey})`);

                // 执行快捷键对应的操作
                await this.executeShortcutAction(matchedShortcut.id);
                return;
            }
            // 处理文件操作快捷键（不在配置中的系统快捷键）
            await this.handleSystemShortcuts(e);
        });
    }

    // 获取当前活跃的播放器组件
    getActivePlayer() {
        // 检查是否有歌词页面组件且可见
        if (this.components.lyrics && this.components.lyrics.isVisible) {
            // 如果歌词页面有播放器功能，返回歌词页面
            return this.components.lyrics;
        }
        // 否则返回主播放器
        if (this.components.player) {
            return this.components.player;
        }

        console.warn('⚠️ 未找到任何播放器组件');
        return null;
    }

    // 生成按键字符串
    generateKeyString(event) {
        const keys = [];

        // 添加修饰键（按固定顺序）
        if (event.ctrlKey) keys.push('Ctrl');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        if (event.metaKey) keys.push('Cmd');

        // 添加主键
        const mainKey = this.normalizeKey(event);
        if (mainKey) keys.push(mainKey);
        return keys.join('+');
    }

    // 标准化按键名称
    normalizeKey(event) {
        const key = event.key;

        // 特殊键
        if (key === ' ') return 'Space';
        if (key === 'Escape') return 'Escape';
        if (key === 'Enter') return 'Enter';
        if (key === 'Tab') return 'Tab';
        if (key === 'Backspace') return 'Backspace';
        if (key === 'Delete') return 'Delete';

        // 方向键
        if (key === 'ArrowUp') return 'ArrowUp';
        if (key === 'ArrowDown') return 'ArrowDown';
        if (key === 'ArrowLeft') return 'ArrowLeft';
        if (key === 'ArrowRight') return 'ArrowRight';

        // 功能键
        if (key.startsWith('F') && key.length <= 3) return key;

        // 字母和数字
        if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
            return key.toUpperCase();
        }

        return null;
    }

    // 获取当前启用的快捷键
    getEnabledShortcuts() {
        if (!window.shortcutConfig) {
            return this.getDefaultShortcuts();
        }
        return window.shortcutConfig.getEnabledLocalShortcuts();
    }

    // 获取默认快捷键（兼容性）
    getDefaultShortcuts() {
        return {
            playPause: {id: 'playPause', name: '播放/暂停', key: 'Space'},
            previousTrack: {id: 'previousTrack', name: '上一首', key: 'Ctrl+ArrowLeft'},
            nextTrack: {id: 'nextTrack', name: '下一首', key: 'Ctrl+ArrowRight'},
            volumeUp: {id: 'volumeUp', name: '音量增加', key: 'Ctrl+ArrowUp'},
            volumeDown: {id: 'volumeDown', name: '音量减少', key: 'Ctrl+ArrowDown'},
            search: {id: 'search', name: '搜索', key: 'Ctrl+F'},
            toggleLyrics: {id: 'toggleLyrics', name: '显示/隐藏歌词', key: 'Ctrl+L'},
            toggleFullscreen: {id: 'toggleFullscreen', name: '全屏切换', key: 'F11'},
            exitLyrics: {id: 'exitLyrics', name: '退出歌词页面', key: 'Escape'},
            seekForward: {id: 'seekForward', name: '快进', key: 'ArrowRight'},
            seekBackward: {id: 'seekBackward', name: '回退', key: 'ArrowLeft'}
        };
    }

    // 查找匹配的快捷键
    findMatchingShortcut(pressedKey, shortcuts) {
        for (const [id, shortcut] of Object.entries(shortcuts)) {
            if (shortcut.key === pressedKey) {
                return shortcut;
            }
        }
        return null;
    }

    // 执行快捷键对应的操作
    async executeShortcutAction(shortcutId) {
        switch (shortcutId) {
            case 'playPause':
                const player = this.getActivePlayer();
                if (player && typeof player.togglePlayPause === 'function') {
                    await player.togglePlayPause();
                } else {
                    console.warn('⚠️ 未找到活跃的播放器组件');
                }
                break;

            case 'previousTrack':
                await api.previousTrack();
                break;

            case 'nextTrack':
                await api.nextTrack();
                break;

            case 'volumeUp':
                const currentVolume = await api.getVolume();
                await api.setVolume(Math.min(1, currentVolume + 0.01));
                break;

            case 'volumeDown':
                const volume = await api.getVolume();
                await api.setVolume(Math.max(0, volume - 0.01));
                break;

            case 'search':
                document.getElementById('search-input')?.focus();
                break;

            case 'seekForward':
                await api.seekForward(3);
                break;

            case 'seekBackward':
                await api.seekBackward(3);
                break;

            case 'toggleLyrics':
                if (this.components.lyrics) {
                    if (this.components.lyrics.isVisible) {
                        this.components.lyrics.hide();
                    } else {
                        const currentTrack = api.getCurrentTrack();
                        if (currentTrack) {
                            await this.components.lyrics.show(currentTrack);
                        }
                    }
                }
                break;

            case 'exitLyrics':
                if (this.components.lyrics && this.components.lyrics.isVisible) {
                    if (this.components.lyrics.isFullscreen) {
                        this.components.lyrics.exitFullscreen();
                    } else {
                        this.components.lyrics.hide();
                    }
                }
                break;

            case 'toggleFullscreen':
                if (this.components.lyrics && this.components.lyrics.isVisible) {
                    this.components.lyrics.toggleFullscreen();
                }
                break;

            default:
                console.warn(`未知的快捷键操作: ${shortcutId}`);
        }
    }

    // 处理系统快捷键
    async handleSystemShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'o':
                    e.preventDefault();
                    await this.addMusicFiles();
                    break;
                case 'O':
                    e.preventDefault();
                    await this.openDirectoryDialog();
                    break;
            }
        }
    }

    // 初始化全局快捷键
    async initGlobalShortcuts() {
        if (window.shortcutConfig) {
            await window.shortcutConfig.initializeGlobalShortcuts();
        }

        // 监听全局快捷键触发事件
        window.addEventListener('globalShortcutTriggered', (event) => {
            const {shortcutId} = event.detail;
            // 执行对应的快捷键操作
            this.executeShortcutAction(shortcutId);
        });

    }

    showCreatePlaylistDialog() {
        if (this.components.createPlaylistDialog) {
            this.components.createPlaylistDialog.show();
        }
    }

    // 处理添加到自定义歌单
    async handleAddToCustomPlaylist(track, index) {
        if (this.components.addToPlaylistDialog) {
            await this.components.addToPlaylistDialog.show(track);
        }
    }

    // 处理歌单创建成功
    async handlePlaylistCreated(playlist) {
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌曲添加到歌单成功
    async handleTrackAddedToPlaylist(playlist, track) {
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌单选择
    async handlePlaylistSelected(playlist) {
        this.hideAllPages();
        this.updateSidebarSelection('playlist', playlist.id);
        this.currentView = 'playlist-detail';
        if (this.components.playlistDetailPage) {
            await this.components.playlistDetailPage.show(playlist);
        }
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
    async handleDriveRemoved(drive) {
        await this.components.navigation.loadNetworkDrives();
        await this.refreshLibrary();
    }

    // 更新侧边栏选中状态
    updateSidebarSelection(type, id = null) {
        // 清除所有侧边栏项目的选中状态
        document.querySelectorAll('.sidebar-link, .playlist-sidebar-item, .network-drive-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        if (type === 'playlist' && id) {
            // 高亮选中的歌单
            const playlistItem = document.querySelector(`[data-playlist-id="${id}"]`);
            if (playlistItem) {
                playlistItem.classList.add('active');
            }
        } else if (type === 'network-drive' && id) {
            // 高亮选中的网络磁盘
            const driveItem = document.querySelector(`[data-drive-id="${id}"]`);
            if (driveItem) {
                driveItem.classList.add('active');
            }
        } else {
            // 高亮选中的导航项
            const navItem = document.querySelector(`[data-view="${type}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
        }
    }

    // 处理歌单更新
    async handlePlaylistUpdated(playlist) {
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌单重命名成功
    async handlePlaylistRenamed(playlist) {
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理显示添加歌曲对话框
    async handleShowAddSongsDialog(playlist) {
        await this.components.musicLibrarySelectionDialog.show(playlist);
    }

    // 处理歌曲添加到歌单成功
    async handleTracksAddedToPlaylist(data) {
        if (this.currentView === 'playlist-detail' && this.components.playlistDetailPage) {
            // loadPlaylistTracks() 方法内部已经调用了 render()，不需要重复调用
            await this.components.playlistDetailPage.loadPlaylistTracks();
        }
        // 刷新侧边栏歌单列表
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌单封面更新
    async handlePlaylistCoverUpdated(playlist) {
        if (this.components.navigation && this.components.navigation.updatePlaylistInfo) {
            this.components.navigation.updatePlaylistInfo(playlist);
        }
    }

    async cleanup() {
        // 保存播放状态和音量
        await this.savePlaybackState();
        if (this.components.player) {
            await api.setSetting('volume', this.components.player.volume);
        }

        // 清理DOM事件监听器
        this.eventListeners.forEach(({element, event, handler}) => {
            try {
                element.removeEventListener(event, handler);
            } catch (error) {
                console.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];

        // 清理API事件监听器
        this.apiEventListeners.forEach(({event, handler}) => {
            try {
                api.off(event, handler);
            } catch (error) {
                console.warn('Failed to remove API event listener:', error);
            }
        });
        this.apiEventListeners = [];

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

        // 清理组件引用
        this.components = {};

        // 清理数据
        this.library = [];
        this.filteredLibrary = [];
    }

    // 文件加载方法
    setupFileLoading() {
        // 添加拖放支持
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            await this.handleFileDrop(e);
        });

        if (window.electronAPI) {
            this.addFileMenuItems();
        }
    }

    async handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        const audioFiles = files.filter(file =>
            file.type.startsWith('audio/') ||
            /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)
        );

        if (audioFiles.length > 0) {
            if (audioFiles.length === 1) {
                // 单个文件 - 加载和播放
                await this.loadAndPlayFile(audioFiles[0].path);
            } else {
                // 多个文件 - 添加到播放列表
                await this.addFilesToPlaylist(audioFiles);
            }
        }
    }

    async openFileDialog() {
        try {
            const files = await api.openFileDialog();
            if (files && files.length > 0) {
                if (files.length === 1) {
                    await this.loadAndPlayFile(files[0]);
                } else {
                    await this.addFilesToPlaylist(files);
                }
            }
        } catch (error) {
            this.showError('无法打开文件选择框');
        }
    }

    async openDirectoryDialog() {
        try {
            const directory = await api.openDirectoryDialog();
            if (directory) {
                await this.scanDirectory(directory);
            }
        } catch (error) {
            this.showError('无法打开目录选择框');
        }
    }

    async loadAndPlayFile(filePath) {
        try {
            const success = await api.loadTrack(filePath);
            if (success) {
                await api.play();
                this.showSuccess(`正常播放: ${filePath.split(/[/\\]/).pop()}`);
            } else {
                this.showError(`无法加载文件: ${filePath}`);
            }
        } catch (error) {
            this.showError('无法加载音乐文件');
        }
    }

    async addFilesToPlaylist(files) {
        try {
            // 只需加载第一个文件
            if (files.length > 0) {
                await this.loadAndPlayFile(files[0].path || files[0]);
            }
            this.showSuccess(`Added ${files.length} files to playlist`);
        } catch (error) {
            console.error('Failed to add files to playlist:', error);
            this.showError('Failed to add files to playlist');
        }
    }

    async scanDirectory(directoryPath) {
        try {
            this.showInfo('扫描音乐文件...');
            const success = await api.scanDirectory(directoryPath);
            if (success) {
                this.showSuccess('音乐目录扫描完成');
                // API层会自动触发音乐库更新事件，无需手动刷新
            } else {
                this.showError('扫描失败');
            }
        } catch (error) {
            console.error('扫描失败：', error);
            this.showError('扫描失败');
        }
    }

    addFileMenuItems() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.placeholder = '搜索... (Ctrl+O 添加音乐, Ctrl+Shift+O 添加音乐目录)';
        }
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

    // Playlist event handlers
    handlePlaylistTrackSelected(track, index) {
        console.log('🎵 播放列表选择歌曲:', track.title);
        // Just select, don't play automatically
    }

    async handlePlaylistTrackPlayed(track, index) {
        // 直接播放播放列表中的指定歌曲
        await this.playTrackFromPlaylist(track, index);
    }

    async handlePlaylistTrackRemoved(track, index) {
        // 同步更新API播放列表
        if (this.components.playlist && this.components.playlist.tracks.length >= 0) {
            console.log('🔄 同步删除操作到API，剩余歌曲:', this.components.playlist.tracks.length);

            // 获取当前播放索引
            const currentIndex = this.components.playlist.currentTrackIndex;

            // 更新API播放列表
            await api.setPlaylist(this.components.playlist.tracks, currentIndex);

            // 如果删除的是当前播放的歌曲，需要特殊处理
            if (index === api.currentIndex) {
                console.log('⚠️ 删除的是当前播放歌曲，停止播放');
                await api.pause();
            }
        }
    }

    async handlePlaylistCleared() {
        // 同步清空API播放列表
        await api.setPlaylist([], -1);
        await api.pause();
    }

    // 播放播放列表中的歌曲
    async playTrackFromPlaylist(track, index) {
        try {
            // 确保API的播放列表与组件播放列表同步
            if (this.components.playlist && this.components.playlist.tracks.length > 0) {
                console.log('🔄 同步播放列表到API:', this.components.playlist.tracks.length, '首歌曲');

                // 先设置API的播放列表为组件的播放列表
                const setPlaylistResult = await api.setPlaylist(this.components.playlist.tracks, index);

                if (setPlaylistResult) {
                    // 更新播放列表组件的当前歌曲
                    this.components.playlist.setCurrentTrack(index);

                    // 加载并播放指定的歌曲
                    const loadResult = await api.loadTrack(track.filePath);
                    if (loadResult) {
                        const playResult = await api.play();
                    }
                }
            }
        } catch (error) {
            console.error('❌ 播放列表播放错误:', error);
        }
    }

    // 处理歌曲索引更改（用于 prev/next 按钮）
    handleTrackIndexChanged(index) {
        // 更新播放列表组件的当前歌曲
        if (this.components.playlist) {
            if (index >= 0 && index < this.components.playlist.tracks.length) {
                this.components.playlist.setCurrentTrack(index);
            } else {
                console.warn('⚠️ 索引超出播放列表范围:', index, '/', this.components.playlist.tracks.length);
            }
        }
    }

    updateLibraryTrackDuration(filePath, duration) {
        // 更新音乐库中的时长
        const libraryTrack = this.library.find(track => track.filePath === filePath);
        if (libraryTrack) {
            libraryTrack.duration = duration;
        }

        // 更新过滤后的音乐库
        const filteredTrack = this.filteredLibrary.find(track => track.filePath === filePath);
        if (filteredTrack) {
            filteredTrack.duration = duration;
        }

        // 更新播放列表组件中的时长（如果存在）
        if (this.components.playlist) {
            const playlistTrack = this.components.playlist.tracks.find(track => track.filePath === filePath);
            if (playlistTrack) {
                playlistTrack.duration = duration;
                this.components.playlist.render(); // 重新渲染播放列表
            }
        }

        // 更新音乐列表显示 - 使用特殊标识表明这是播放时长更新
        this.updateTrackList('duration-update');
    }

    // 右击菜单事件处理方法
    // 删除音乐
    async handleDeleteTrack(track, index) {
        // 根据当前视图决定删除行为
        if (this.currentView === 'playlist-detail' && this.components.playlistDetailPage) {
            // 在歌单页，仅从当前歌单中移除
            await this.components.playlistDetailPage.removeTrackFromPlaylist(track, index);
            return;
        }

        if (this.currentView === 'network-drive-detail') {
            // 在网络磁盘详情页，不允许删除（网络磁盘歌曲应该通过移除整个磁盘来删除）
            this.showError('网络磁盘中的歌曲无法单独删除，请通过移除整个网络磁盘来删除');
            return;
        }

        // 在音乐库或其他页面，从音乐库中删除，同时从所有歌单中移除
        if (!confirm(`确定要从音乐库中删除 "${track.title}" 吗？\n\n此操作将从音乐库和所有歌单中移除该歌曲，但不会删除本地文件。`)) {
            return;
        }

        try {
            const result = await window.electronAPI.library.removeTrack(track.fileId);
            if (result.success) {
                // 从本地音乐库数组中移除
                const libraryIndex = this.library.findIndex(t => t.fileId === track.fileId);
                if (libraryIndex !== -1) {
                    this.library.splice(libraryIndex, 1);
                }

                const filteredIndex = this.filteredLibrary.findIndex(t => t.fileId === track.fileId);
                if (filteredIndex !== -1) {
                    this.filteredLibrary.splice(filteredIndex, 1);
                }

                // 从播放列表中移除
                if (this.components.playlist) {
                    const playlistIndex = this.components.playlist.tracks.findIndex(t => t.fileId === track.fileId);
                    if (playlistIndex !== -1) {
                        this.components.playlist.removeTrack(playlistIndex);
                    }
                }

                // 更新界面
                this.updateTrackList('track-deleted');

                // 触发库更新事件
                api.emit('libraryUpdated');
                this.showInfo(`已从音乐库删除 "${track.title}"`);
            } else {
                this.showError(result.error || '删除失败');
            }
        } catch (error) {
            console.error('❌ 删除歌曲失败:', error);
            this.showError('删除失败，请重试');
        }
    }

    async handleSelectMusicFolder() {
        try {
            const result = await api.selectMusicFolder();
            if (result && result.path) {
                this.components.settings.updateMusicFolderPath(result.path);
                console.log('📁 选择音乐文件夹:', result.path);
            }
        } catch (error) {
            console.error('❌ 选择音乐文件夹失败:', error);
        }
    }

    addToPlaylist(track) {
        if (this.components.playlist) {
            this.components.playlist.addTrack(track);
            this.showInfo(`已添加 "${track.title}" 到播放列表`);
        }
    }

    // 处理编辑歌曲信息
    async handleEditTrackInfo(track, index) {
        await this.components.editTrackInfoDialog.show(track);
    }

    // 处理歌曲信息更新
    async handleTrackInfoUpdated(data) {
        const {track, updatedData} = data;

        // 确保cover字段是URL字符串
        if (updatedData.cover && typeof updatedData.cover !== 'string') {
            updatedData.cover = null;
        }

        try {
            // 更新音乐库中的歌曲信息
            const libraryTrack = this.library.find(t => t.filePath === track.filePath);
            if (libraryTrack) {
                Object.assign(libraryTrack, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre,
                    cover: updatedData.cover
                });
            }

            // 更新过滤后的音乐库
            const filteredTrack = this.filteredLibrary.find(t => t.filePath === track.filePath);
            if (filteredTrack) {
                Object.assign(filteredTrack, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre,
                    cover: updatedData.cover
                });
            }

            // 更新播放列表中的歌曲信息（如果存在）
            if (this.components.playlist) {
                const playlistTrack = this.components.playlist.tracks.find(t => t.filePath === track.filePath);
                if (playlistTrack) {
                    Object.assign(playlistTrack, {
                        title: updatedData.title,
                        artist: updatedData.artist,
                        album: updatedData.album,
                        year: updatedData.year,
                        genre: updatedData.genre,
                        cover: updatedData.cover
                    });
                    this.components.playlist.render();
                }
            }

            // 更新当前播放的歌曲信息（如果是当前播放的歌曲）
            if (api.currentTrack && api.currentTrack.filePath === track.filePath) {
                Object.assign(api.currentTrack, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre,
                    cover: updatedData.cover
                });
                // 更新播放器显示
                if (this.components.player) {
                    await this.components.player.updateTrackInfo(api.currentTrack);
                }
            }

            // 重新渲染歌曲列表
            this.updateTrackList('track-info-updated');

            // 如果当前在歌单详情页面，也需要更新
            if (this.currentView === 'playlist-detail' && this.components.playlistDetailPage.isVisible) {
                const playlistTrack = this.components.playlistDetailPage.tracks.find(t => t.filePath === track.filePath);
                if (playlistTrack) {
                    Object.assign(playlistTrack, {
                        title: updatedData.title,
                        artist: updatedData.artist,
                        album: updatedData.album,
                        year: updatedData.year,
                        genre: updatedData.genre
                    });
                    this.components.playlistDetailPage.render();
                }
            }
            this.showInfo(`歌曲信息已更新：${updatedData.title}`);
        } catch (error) {
            console.error('❌ 更新歌曲信息失败:', error);
            this.showError('更新歌曲信息失败，请重试');
        }
    }

    // 初始化窗口状态管理
    initWindowStateManagement() {
        try {
            // 窗口尺寸变化监听
            let resizeTimeout = null;
            window.addEventListener('resize', () => {
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }

                resizeTimeout = setTimeout(async () => {
                    await this.saveWindowSize();
                }, 1500);
            });

            // 窗口最大化状态变化监听
            window.electronAPI.window.onMaximizedChanged((isMaximized) => {
                if (!isMaximized) {
                    setTimeout(async () => {
                        await this.restoreWindowSize();
                    }, 100);
                }
            });
        } catch (error) {
            console.error('❌ 窗口状态管理初始化失败:', error);
        }
    }

    // 保存窗口尺寸
    async saveWindowSize() {
        try {
            const isMaximized = await window.electronAPI.window.isMaximized();
            if (isMaximized) {
                return;
            }

            const size = await window.electronAPI.window.getSize();
            if (size && size.length === 2) {
                const [width, height] = size;
                if (this.isValidWindowSize(width, height)) {
                    const sizeData = {
                        width,
                        height,
                        timestamp: Date.now()
                    };
                    cacheManager.setLocalCache('mainWindow-size', sizeData);
                }
            }
        } catch (error) {
            console.error('❌ 保存窗口尺寸失败:', error);
        }
    }

    // 恢复窗口尺寸
    async restoreWindowSize() {
        try {
            const savedSize = cacheManager.getLocalCache('mainWindow-size');
            if (!savedSize) {
                return;
            }

            const {width, height} = savedSize;
            if (this.isValidWindowSize(width, height)) {
                const result = await window.electronAPI.window.setSize(width, height);
                if (!result || !result.success) {
                    cacheManager.removeLocalCache('mainWindow-size');
                }
            } else {
                cacheManager.removeLocalCache('mainWindow-size');
            }
        } catch (error) {
            console.error('❌ 恢复窗口尺寸失败:', error);
        }
    }

    // 验证窗口尺寸有效性
    isValidWindowSize(width, height) {
        const minWidth = 1080;
        const minHeight = 720;
        const maxWidth = 3840;
        const maxHeight = 2160;

        return (
            typeof width === 'number' &&
            typeof height === 'number' &&
            width >= minWidth && width <= maxWidth &&
            height >= minHeight && height <= maxHeight
        );
    }

    // 恢复播放状态
    async restorePlaybackState() {
        try {
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            const playbackState = cacheManager.getLocalCache('playback-state');

            // 如果启用了记住播放位置且有保存的状态
            if (settings.rememberPosition && playbackState) {
                const {currentTrack, position, isPlaying, playlist, currentIndex, playMode} = playbackState;

                // 恢复播放模式
                if (playMode) {
                    api.setPlayMode(playMode);
                }

                // 恢复播放列表
                if (playlist && playlist.length > 0) {
                    // 验证播放列表中的文件是否存在
                    const validTracks = [];
                    let validCurrentIndex = -1;

                    for (let i = 0; i < playlist.length; i++) {
                        const track = playlist[i];
                        if (track && track.filePath) {
                            validTracks.push(track);
                            // 如果这是当前播放的歌曲，记录新的索引
                            if (i === currentIndex) {
                                validCurrentIndex = validTracks.length - 1;
                            }
                        }
                    }

                    if (validTracks.length > 0) {
                        // 设置播放列表到API和UI组件
                        await api.setPlaylist(validTracks, validCurrentIndex);

                        if (this.components.playlist) {
                            this.components.playlist.setTracks(validTracks, validCurrentIndex);
                        }

                        // 如果有当前播放的歌曲，加载它
                        if (validCurrentIndex >= 0 && validTracks[validCurrentIndex]) {
                            const trackToLoad = validTracks[validCurrentIndex];
                            const loadResult = await api.loadTrack(trackToLoad.filePath);
                            if (loadResult) {
                                // 恢复播放位置
                                if (position > 0) {
                                    const setPositionResult = await api.setPosition(position);
                                    console.log('App: setPosition 结果:', setPositionResult);
                                }

                                // 如果启用了自动播放且上次是播放状态
                                if (settings.autoplay && isPlaying) {
                                    setTimeout(async () => {
                                        await api.play();
                                    }, 1000);
                                }
                            }
                        }
                    } else {
                        console.warn('⚠️ App: 播放列表中没有有效歌曲');
                        if (settings.autoplay) {
                            await this.autoplayFirstTrack();
                        }
                    }
                } else if (currentTrack) {
                    // 兼容旧版本
                    console.log('💾 App: 恢复单个歌曲（兼容模式）:', currentTrack.title);
                    const loadResult = await api.loadTrack(currentTrack.filePath);
                    if (loadResult) {
                        if (position > 0) {
                            await api.setPosition(position);
                        }
                        if (settings.autoplay && isPlaying) {
                            setTimeout(async () => {
                                await api.play();
                            }, 1000);
                        }
                    }
                } else {
                    console.warn('⚠️ App: 没有保存的播放信息');
                    if (settings.autoplay) {
                        await this.autoplayFirstTrack();
                    }
                }
            } else if (settings.autoplay) {
                // 仅启用自动播放，播放第一首可用歌曲
                console.log('▶️ App: 仅启用自动播放，播放第一首歌曲');
                await this.autoplayFirstTrack();
            } else {
                console.log('ℹ️ App: 未启用自动播放或记住播放位置');
            }
        } catch (error) {
            console.error('❌ App: 恢复播放状态失败:', error);
        }
    }

    // 自动播放第一首歌曲
    async autoplayFirstTrack() {
        try {
            setTimeout(async () => {
                const tracks = await api.getTracks();
                if (tracks && tracks.length > 0) {
                    console.log('🎵 App: 加载第一首歌曲:', tracks[0].title);
                    const loadResult = await api.loadTrack(tracks[0].filePath);
                    console.log('📂 App: 加载结果:', loadResult);
                    if (loadResult) {
                        await api.play();
                    }
                } else {
                    console.warn('⚠️ App: 音乐库为空，无法自动播放');
                }
            }, 1000);
        } catch (error) {
            console.error('❌ App: 自动播放第一首歌曲失败:', error);
        }
    }

    // 保存播放状态
    async savePlaybackState() {
        try {
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};

            // 只有启用记住播放位置时才保存
            if (settings.rememberPosition) {
                const currentTrack = api.currentTrack;
                const position = api.position;
                const isPlaying = api.isPlaying;
                const playlist = api.playlist;
                const currentIndex = api.currentIndex;
                const playMode = api.playMode;

                const playbackState = {
                    currentTrack,
                    position,
                    isPlaying,
                    playlist,
                    currentIndex,
                    playMode,
                    timestamp: Date.now()
                };
                cacheManager.setLocalCache('playback-state', playbackState);
            }
        } catch (error) {
            console.error('❌ App: 保存播放状态失败:', error);
        }
    }

    // 初始化系统托盘
    async initSystemTray() {
        try {
            // 获取托盘设置
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
            const trayEnabled = settings.hasOwnProperty('systemTray') ? settings.systemTray : true;

            if (trayEnabled) {
                // 创建托盘
                await window.electronAPI.tray.create();

                // 更新托盘设置
                await window.electronAPI.tray.updateSettings({
                    enabled: true,
                    closeToTray: settings.trayCloseBehavior === 'minimize',
                    startMinimized: settings.trayStartMinimized || false
                });
            }
            this.setupTrayEventListeners();
        } catch (error) {
            console.error('❌ 系统托盘初始化失败:', error);
        }
    }

    // 设置托盘事件监听器
    setupTrayEventListeners() {
        // 退出应用
        window.electronAPI.tray.onQuit(() => {
            this.forceQuit = true;
            window.close();
        });
    }

    // 自动检查更新
    async autoCheckForUpdates() {
        try {
            // 获取版本信息
            const currentVersion = await this.getCurrentVersion();
            const releaseInfo = await this.getLatestRelease();
            const latestVersion = releaseInfo.tag_name.replace(/^v/, ''); // 移除v前缀

            // 比较版本
            if (this.isNewerVersion(latestVersion, currentVersion)) {
                this.showUpdateNotification(currentVersion, latestVersion, releaseInfo);
            }
        } catch (error) {
            this.showError('检查更新失败，请检查网络连接')
        }
    }

    async getCurrentVersion() {
        try {
            const response = await fetch('../../../package.json');
            const packageInfo = await response.json();
            return packageInfo.version;
        } catch (error) {
            return '';
        }
    }

    async getLatestRelease() {
        const response = await fetch('https://api.github.com/repos/asxez/MusicBox/releases/latest');
        if (!response.ok) {
            throw new Error(`GitHub API请求失败: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }

    isNewerVersion(latest, current) {
        const parseVersion = (version) => {
            const parts = version.replace(/-(alpha|beta|rc).*$/, '').split('.');
            return parts.map(part => parseInt(part, 10));
        };

        const latestParts = parseVersion(latest);
        const currentParts = parseVersion(current);

        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const latestPart = latestParts[i] || 0;
            const currentPart = currentParts[i] || 0;

            if (latestPart > currentPart) return true;
            if (latestPart < currentPart) return false;
        }

        return false;
    }

    showUpdateNotification(currentVersion, latestVersion, releaseInfo) {
        const message = `发现新版本 v${latestVersion}（当前版本：v${currentVersion}）`;

        // 创建现代化的更新通知Toast
        const toastElement = document.createElement('div');
        toastElement.className = 'update-notification-toast';
        toastElement.innerHTML = `
            <div class="update-toast-content">
                <div class="update-toast-header">
                    <div class="update-toast-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.41,10.09L6,11.5L11,16.5Z"/>
                        </svg>
                    </div>
                    <div class="update-toast-text">
                        <div class="update-toast-title">发现新版本</div>
                        <div class="update-toast-message">${message}</div>
                    </div>
                    <button class="update-toast-close" onclick="this.closest('.update-notification-toast').remove()">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="update-toast-actions">
                    <button class="update-toast-btn update-toast-btn-primary" onclick="app.components.updateModal.show(); this.closest('.update-notification-toast').remove();">查看详情</button>
                    <button class="update-toast-btn update-toast-btn-secondary" onclick="this.closest('.update-notification-toast').remove()">稍后提醒</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(toastElement);

        // 显示动画
        requestAnimationFrame(() => {
            toastElement.classList.add('show');
        });

        // 8秒后自动隐藏
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.classList.remove('show');
                setTimeout(() => {
                    if (toastElement.parentNode) {
                        toastElement.remove();
                    }
                }, 300);
            }
        }, 8000);
    }
}

let app = new MusicBoxApp();
export {app};
