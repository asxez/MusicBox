class MusicBoxApp extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentView = 'library';
        this.library = [];
        this.filteredLibrary = [];
        this.components = {};

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

            // 在组件完全初始化后再初始化插件系统
            await this.initializePluginSystem();

            this.showApp();

            this.isInitialized = true;

            // 通知插件系统应用已完全初始化
            this.notifyPluginSystemReady();

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
        // 恢复音量
        const savedVolume = window.cacheManager.getLocalCache('volume');
        if (savedVolume !== null) {
            await api.setVolume(savedVolume);
        }
    }

    // 初始化插件系统
    async initializePluginSystem() {
        try {
            console.log('🔌 App: 开始初始化插件系统...');
            console.log('🔌 App: 当前组件状态:', {
                componentsCount: Object.keys(this.components).length,
                availableComponents: Object.keys(this.components),
                appInitialized: this.isInitialized
            });

            // 检查插件系统是否可用
            if (typeof window.initializePluginSystem === 'function') {
                const success = await window.initializePluginSystem();
                if (success) {
                    // 设置应用引用到插件系统
                    if (window.pluginManager) {
                        window.pluginManager.app = this;

                        // 更新插件管理器的上下文，确保包含最新的组件
                        if (window.pluginAPI && typeof window.pluginAPI.createPluginContext === 'function') {
                            window.pluginManager.pluginContext = window.pluginAPI.createPluginContext('system');
                        }
                    }

                    console.log('✅ App: 插件系统初始化成功');
                } else {
                    console.warn('⚠️ App: 插件系统初始化失败，但应用将继续运行');
                }
            } else {
                console.warn('⚠️ App: 插件系统未加载，跳过初始化');
            }

        } catch (error) {
            console.error('❌ App: 插件系统初始化失败:', error);
            // 不抛出错误，让应用继续运行
        }
    }

    // 通知插件系统应用已完全初始化
    notifyPluginSystemReady() {
        try {
            console.log('🔌 App: 通知插件系统应用已完全初始化');
            console.log('🔌 App: 最终组件状态:', {
                componentsCount: Object.keys(this.components).length,
                availableComponents: Object.keys(this.components),
                appInitialized: this.isInitialized
            });

            // 触发应用就绪事件
            document.dispatchEvent(new CustomEvent('appReady', {
                detail: {
                    app: this,
                    components: this.components,
                    isInitialized: this.isInitialized
                }
            }));

            // 如果插件管理器存在，通知它应用已就绪
            if (window.pluginManager && typeof window.pluginManager.onAppReady === 'function') {
                window.pluginManager.onAppReady(this);
            }

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

        // 将settings组件暴露到全局，供其他组件访问
        window.settings = this.components.settings;

        // 初始化插件管理组件
        this.components.pluginManagerModal = new PluginManagerModal();

        // 初始化新页面组件
        this.components.homePage = new HomePage('#content-area');
        this.components.recentPage = new RecentPage('#content-area');
        this.components.artistsPage = new ArtistsPage('#content-area');
        this.components.albumsPage = new AlbumsPage('#content-area');
        this.components.statisticsPage = new StatisticsPage('#content-area');

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

        // 监听桌面歌词设置变化
        this.components.settings.on('desktopLyricsEnabled', async (enabled) => {
            if (this.components.player) {
                await this.components.player.updateDesktopLyricsButtonVisibility(enabled);
            }
        });

        // 监听统计信息设置变化
        this.components.settings.on('statisticsEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateStatisticsButtonVisibility(enabled);
            }
        });

        // 监听最近播放设置变化
        this.components.settings.on('recentPlayEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateRecentPlayButtonVisibility(enabled);
            }
        });

        // 监听艺术家页面设置变化
        this.components.settings.on('artistsPageEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateArtistsPageButtonVisibility(enabled);
            }
        });

        // 监听专辑页面设置变化
        this.components.settings.on('albumsPageEnabled', (enabled) => {
            if (this.components.navigation) {
                this.components.navigation.updateAlbumsPageButtonVisibility(enabled);
            }
        });

        // 监听歌曲封面显示设置变化
        this.components.settings.on('showTrackCoversEnabled', async (enabled) => {
            console.log(`🖼️ App: 歌曲封面显示设置已更新为 ${enabled ? '启用' : '禁用'}`);
            if (enabled) {
                await this.preloadTrackCovers();
            }
        });

        // 监听无间隙播放设置变化
        this.components.settings.on('gaplessPlaybackEnabled', (enabled) => {
            console.log(`🎵 App: 无间隙播放设置已更新为 ${enabled ? '启用' : '禁用'}`);
            if (window.api) {
                window.api.setGaplessPlayback(enabled);
            }
        });

        // 新页面组件事件监听
        this.setupPageComponentEvents();

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

    async setupEventListeners() {
        // Window events
        window.addEventListener('beforeunload', async () => {
            await this.cleanup();
        });

        // 初始化统一的快捷键管理器
        this.initKeyboardShortcuts();

        // 初始化全局快捷键
        await this.initGlobalShortcuts();

        // 添加播放列表按钮
        const addPlaylistBtn = document.getElementById('add-playlist-btn');
        if (addPlaylistBtn) {
            addPlaylistBtn.addEventListener('click', () => {
                this.showCreatePlaylistDialog();
            });
        }

        // 文件加载功能
        this.setupFileLoading();

        // API events
        api.on('libraryUpdated', async () => {
            await this.refreshLibrary();
        });

        api.on('playlistChanged', (tracks) => {
            console.log('🎵 API播放列表改变:', tracks.length, '首歌曲');
            // 确保播放列表组件与API同步
            if (this.components.playlist && tracks.length > 0) {
                this.components.playlist.setTracks(tracks, api.currentIndex);
            }
        });

        api.on('libraryTrackDurationUpdated', ({filePath, duration}) => {
            console.log('🎵 更新音乐库歌曲时长:', filePath, duration.toFixed(2) + 's');
            this.updateLibraryTrackDuration(filePath, duration);
        });

        api.on('playModeChanged', (mode) => {
            console.log('🎵 播放模式改变:', mode);
            this.components.player.updatePlayModeDisplay(mode);
        });

        // Update lyrics page when track changes
        api.on('trackChanged', (track) => {
            if (this.components.lyrics.isVisible) {
                this.components.lyrics.show(track);
            }
        });

        // Update lyrics page progress
        api.on('positionChanged', (position) => {
            if (this.components.lyrics.isVisible) {
                // 使用当前歌曲的时长以避免使用可能过期的全局 api.duration
                const duration = (api.currentTrack && api.currentTrack.duration) ? api.currentTrack.duration : api.duration;
                this.components.lyrics.updateProgress(position, duration);
            }
        });

        // Update lyrics page play button
        api.on('playbackStateChanged', (state) => {
            if (this.components.lyrics.isVisible) {
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
            console.error('Failed to load initial data:', error);
            this.showError('加载音乐库失败');
        }
    }

    // 预加载歌曲封面
    async preloadTrackCovers() {
        try {
            // 检查是否启用了封面显示
            const settings = window.cacheManager.getLocalCache('musicbox-settings') || {};
            const showTrackCovers = settings.hasOwnProperty('showTrackCovers') ? settings.showTrackCovers : true;

            if (!showTrackCovers || !window.localCoverManager) {
                return;
            }
            // 预加载前12首歌曲的封面，避免阻塞UI
            // 为啥是12首？因为全屏状态下，一页最多显示12首歌😋
            const tracksToPreload = this.library.slice(0, 12);
            await window.localCoverManager.preloadCovers(tracksToPreload);
        } catch (error) {
            console.warn('⚠️ App: 封面预加载失败:', error);
        }
    }

    // 同步桌面歌词按钮状态
    async syncDesktopLyricsButtonState() {
        try {
            if (this.components.player && this.components.settings) {
                // 从设置中获取桌面歌词状态
                const settings = window.cacheManager.getLocalCache('musicbox-settings') || {};
                const desktopLyricsEnabled = settings.hasOwnProperty('desktopLyrics') ? settings.desktopLyrics : true;
                console.log('🎵 App: 同步桌面歌词按钮状态:', desktopLyricsEnabled);

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
            // 设置验证进度监听器
            api.on('cacheValidationProgress', (progress) => {
                console.log(`🔍 缓存验证进度: ${progress.current}/${progress.total}`);
            });

            api.on('cacheValidationCompleted', (result) => {
                // 如果有无效文件被清理，更新UI
                if (result.invalid > 0) {
                    this.showInfo(`已清理 ${result.invalid} 个无效的音乐文件`);

                    // 更新音乐库
                    if (result.tracks) {
                        this.library = result.tracks;
                        this.filteredLibrary = [...this.library];
                        this.updateTrackList();
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
            console.error('扫描目录失败：', error);
            showToast('音乐目录扫描失败', 'error');
        }
    }

    async addMusicFiles() {
        try {
            const filePaths = await api.openFiles();
            if (filePaths.length > 0) {
                for (const filePath of filePaths) {
                    const metadata = await api.getTrackMetadata(filePath);
                    if (metadata) {
                        this.library.push(metadata);
                    }
                }
                this.filteredLibrary = [...this.library];
                this.updateTrackList();
                showToast(`添加 ${filePaths.length} 首音乐`, 'success');
            }
        } catch (error) {
            console.error('添加音乐失败', error);
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
            console.error('Failed to refresh library:', error);
        }
    }

    updateTrackList(source = 'unknown') {
        console.log('🔄 updateTrackList 被调用，来源:', source, '当前视图:', this.currentView);

        // 如果是播放时长更新触发的调用，且当前不在音乐库页面，则跳过更新
        if (source === 'duration-update' && this.currentView !== 'library') {
            console.log('📝 跳过播放时长更新触发的音乐列表更新，当前视图:', this.currentView);
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

    setupPageComponentEvents() {
        // HomePage events
        this.components.homePage.on('trackPlayed', async (track, index) => {
            await this.handleTrackPlayed(track, index);
        });

        this.components.homePage.on('viewChange', (view) => {
            this.components.navigation.navigateToView(view);
        });

        this.components.homePage.on('addMusic', async () => {
            await this.handleSelectMusicFolder();
        });

        // RecentPage events
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

        // ArtistsPage events
        this.components.artistsPage.on('trackPlayed', async (track, index) => {
            await this.handleTrackPlayed(track, index);
        });

        this.components.artistsPage.on('playAll', async (tracks) => {
            await this.handlePlayAllTracks(tracks);
        });

        this.components.artistsPage.on('addToPlaylist', (track) => {
            this.addToPlaylist(track);
        });

        // AlbumsPage events
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
            console.error('❌ 播放全部歌曲失败:', error);
            if (this.showError) {
                this.showError('播放失败，请重试');
            }
        }
    }

    async handleViewChange(view) {
        this.hideAllPages();
        this.currentView = view;

        // 更新侧边栏选中状态（除了歌单详情页面，因为它有特殊处理）
        if (view !== 'playlist-detail') {
            this.updateSidebarSelection(view);
        }

        switch (view) {
            case 'home-page':
                await this.components.homePage.show();
                break;
            case 'library':
                console.log('📚 显示音乐库页面');
                this.components.trackList.show();
                this.updateTrackList('navigation');
                break;
            case 'recent':
                await this.components.recentPage.show();
                break;
            case 'artists':
                await this.components.artistsPage.show();
                break;
            case 'albums':
                await this.components.albumsPage.show();
                break;
            case 'statistics':
                await this.components.statisticsPage.show();
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
            exitLyrics: {id: 'exitLyrics', name: '退出歌词页面', key: 'Escape'}
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

            case 'toggleLyrics':
                if (this.components.lyrics) {
                    if (this.components.lyrics.isVisible) {
                        this.components.lyrics.hide();
                    } else {
                        const currentTrack = api.getCurrentTrack();
                        if (currentTrack) {
                            this.components.lyrics.show(currentTrack);
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
                    await this.openFileDialog();
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

    // 更新侧边栏选中状态
    updateSidebarSelection(type, id = null) {
        // 清除所有侧边栏项目的选中状态
        document.querySelectorAll('.sidebar-link, .playlist-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        if (type === 'playlist' && id) {
            // 高亮选中的歌单
            const playlistItem = document.querySelector(`[data-playlist-id="${id}"]`);
            if (playlistItem) {
                playlistItem.classList.add('active');
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
        if (this.components.player) {
            await api.setSetting('volume', this.components.player.volume);
        }
        Object.values(this.components).forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
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
            console.error('Failed to open file dialog:', error);
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
            console.error('Failed to open directory dialog:', error);
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
            console.error('Failed to load and play file:', error);
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
        // This would add menu items to the Electron menu
        // For now, we'll just add some UI hints
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.placeholder = '搜索... (Ctrl+O 添加音乐, Ctrl+Shift+O 添加音乐目录)';
        }
    }

    showSuccess(message) {
        // TODO: Add toast notification system
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

    // Context menu event handlers
    handleDeleteTrack(track, index) {
        if (confirm(`确定要删除歌曲 "${track.title}" 吗？`)) {
            // TODO: 实现删除歌曲的逻辑
            this.showInfo('删除功能将在后续版本中实现');
        }
    }

    // Settings event handlers
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

    // Add track to playlist
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
        const { track, updatedData } = data;

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
                    console.log('✅ 已更新歌单详情页面中的歌曲信息');
                }
            }
            this.showInfo(`歌曲信息已更新：${updatedData.title}`);
        } catch (error) {
            console.error('❌ 更新歌曲信息失败:', error);
            this.showError('更新歌曲信息失败，请重试');
        }
    }
}

window.app = new MusicBoxApp();
