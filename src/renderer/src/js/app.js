class MusicBoxApp extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.currentView = 'library';
        this.library = [];
        this.filteredLibrary = [];
        this.components = {};

        this.init().then((res) => {
            if (res.status) console.log('MusicBox initialized successfully')
            else console.error('Failed to initialize MusicBox:', res.error);
        });
    }

    async init() {
        try {
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize API
            await this.initializeAPI();

            // Initialize components
            this.initializeComponents();

            // Setup event listeners
            await this.setupEventListeners();

            // Load initial data
            await this.loadInitialData();

            // Hide loading screen and show app
            this.showApp();

            this.isInitialized = true;
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

        // Load saved settings
        const savedVolume = window.cacheManager.getLocalCache('volume');
        if (savedVolume !== null) {
            await api.setVolume(savedVolume);
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

        // 初始化歌单详情页面组件
        this.components.playlistDetailPage = new PlaylistDetailPage('#content-area');

        // 将settings组件暴露到全局，供其他组件访问
        window.settings = this.components.settings;

        // 初始化新页面组件
        this.components.homePage = new HomePage('#content-area');
        this.components.recentPage = new RecentPage('#content-area');
        this.components.artistsPage = new ArtistsPage('#content-area');
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

        this.components.navigation.on('playlistSelected', (playlist) => {
            this.handlePlaylistSelected(playlist);
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

        // Settings events
        this.components.settings.on('selectMusicFolder', async () => {
            await this.handleSelectMusicFolder();
        });

        this.components.settings.on('rescanLibrary', async () => {
            await this.handleRescanLibrary();
        });

        // 监听桌面歌词设置变化
        this.components.settings.on('desktopLyricsEnabled', async (enabled) => {
            if (this.components.player) {
                await this.components.player.updateDesktopLyricsButtonVisibility(enabled);
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
                this.components.lyrics.updateProgress(position, api.duration);
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
            console.log('📚 开始加载初始数据...');

            // 首先尝试从缓存加载音乐库
            const hasCachedLibrary = await api.hasCachedLibrary();

            if (hasCachedLibrary) {
                console.log('📚 发现缓存的音乐库，优先加载...');
                this.showCacheLoadingStatus();

                // 从缓存加载音乐库
                this.library = await api.loadCachedTracks();

                if (this.library.length > 0) {
                    console.log(`✅ 从缓存加载 ${this.library.length} 个音乐文件`);
                    this.filteredLibrary = [...this.library];
                    this.updateTrackList();
                    this.hideCacheLoadingStatus();

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
                this.updateTrackList();
            }

            // 确保桌面歌词按钮状态与设置同步
            await this.syncDesktopLyricsButtonState();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('加载音乐库失败');
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
            console.log('🔍 在后台验证缓存...');

            // 设置验证进度监听器
            api.on('cacheValidationProgress', (progress) => {
                console.log(`🔍 缓存验证进度: ${progress.current}/${progress.total}`);
            });

            api.on('cacheValidationCompleted', (result) => {
                console.log('✅ 后台缓存验证完成:', result);

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
                    await this.refreshLibrary();
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
            this.updateTrackList();
        } catch (error) {
            console.error('Failed to refresh library:', error);
        }
    }

    updateTrackList() {
        if (this.components.trackList) {
            this.components.trackList.setTracks(this.filteredLibrary);
        }
    }

    handleSearchResults(results) {
        this.filteredLibrary = results;
        this.updateTrackList();
    }

    handleSearchCleared() {
        this.filteredLibrary = [...this.library];
        this.updateTrackList();
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
    }

    async handlePlayAllTracks(tracks) {
        if (!tracks || tracks.length === 0) return;

        try {
            console.log('🎵 播放全部歌曲:', tracks.length, '首');
            // 设置播放列表
            await api.setPlaylist(tracks, 0);
            await this.handleTrackPlayed(tracks[0], 0);
            if (this.components.playlist && this.components.playlist.setTracks) {
                this.components.playlist.setTracks(tracks, 0);
            }
        } catch (error) {
            console.error('❌ 播放全部歌曲失败:', error);
            if (this.showError) {
                this.showError('播放失败，请重试');
            }
        }
    }

    async handleViewChange(view) {
        console.log('View changed to:', view);

        // 隐藏所有页面
        this.hideAllPages();

        // 显示对应页面
        this.currentView = view;
        switch (view) {
            case 'home-page':
                await this.components.homePage.show();
                break;
            case 'library':
                this.components.trackList.show();
                this.updateTrackList();
                break;
            case 'recent':
                await this.components.recentPage.show();
                break;
            case 'artists':
                await this.components.artistsPage.show();
                break;
            case 'statistics':
                await this.components.statisticsPage.show();
                break;
            case 'playlist-detail':
                // 歌单详情页面由handlePlaylistSelected方法处理
                break;
            default:
                console.warn('Unknown view:', view);
                // 默认显示音乐库
                this.components.trackList.show();
                this.updateTrackList();
                break;
        }
    }

    hideAllPages() {
        // 隐藏所有页面组件
        if (this.components.homePage) this.components.homePage.hide();
        if (this.components.recentPage) this.components.recentPage.hide();
        if (this.components.artistsPage) this.components.artistsPage.hide();
        if (this.components.statisticsPage) this.components.statisticsPage.hide();
        if (this.components.playlistDetailPage) this.components.playlistDetailPage.hide();
        if (this.components.trackList) this.components.trackList.hide();
    }

    async handleTrackPlayed(track, index) {
        console.log('🎵 从音乐库播放歌曲:', track.title);

        if (this.components.playlist) {
            // 如果播放列表为空，将整个音乐库添加到播放列表
            if (this.components.playlist.tracks.length === 0) {
                console.log('🎵 播放列表为空，添加整个音乐库');
                this.components.playlist.setTracks(this.filteredLibrary, index);
                await this.playTrackFromPlaylist(track, index);
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

            // 获取当前启用的快捷键配置
            const shortcuts = this.getEnabledShortcuts();

            // 查找匹配的快捷键
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
            // 如果配置管理器未加载，返回默认快捷键
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
                        const currentTrack = await api.getCurrentTrack();
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
        // 等待快捷键配置管理器加载完成
        if (window.shortcutConfig) {
            await window.shortcutConfig.initializeGlobalShortcuts();
        }

        // 监听全局快捷键触发事件
        window.addEventListener('globalShortcutTriggered', (event) => {
            const {shortcutId} = event.detail;
            console.log(`🎹 处理全局快捷键: ${shortcutId}`);

            // 执行对应的快捷键操作
            this.executeShortcutAction(shortcutId);
        });

        console.log('🎹 全局快捷键监听器已设置');
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
        console.log('🎵 歌单创建成功:', playlist.name);
        // 刷新侧边栏歌单列表
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌曲添加到歌单成功
    async handleTrackAddedToPlaylist(playlist, track) {
        console.log('🎵 歌曲已添加到歌单:', track.title, '->', playlist.name);
        // 刷新侧边栏歌单列表
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌单选择
    handlePlaylistSelected(playlist) {
        console.log('🎵 选择歌单:', playlist.name);

        // 隐藏所有页面
        this.hideAllPages();

        // 显示歌单详情页面
        this.currentView = 'playlist-detail';
        if (this.components.playlistDetailPage) {
            this.components.playlistDetailPage.show(playlist);
        }
    }

    // 处理歌单更新
    async handlePlaylistUpdated(playlist) {
        console.log('🎵 歌单已更新:', playlist.name);
        // 刷新侧边栏歌单列表
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理歌单重命名成功
    async handlePlaylistRenamed(playlist) {
        console.log('🎵 歌单重命名成功:', playlist.name);
        // 刷新侧边栏歌单列表
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
        }
    }

    // 处理显示添加歌曲对话框
    async handleShowAddSongsDialog(playlist) {
        console.log('🎵 显示添加歌曲对话框:', playlist.name);
        await this.components.musicLibrarySelectionDialog.show(playlist);
    }

    // 处理歌曲添加到歌单成功
    async handleTracksAddedToPlaylist(data) {
        console.log('🎵 歌曲添加到歌单成功:', data);

        // 刷新歌单详情页面
        if (this.currentView === 'playlist-detail' && this.components.playlistDetailPage) {
            await this.components.playlistDetailPage.loadPlaylistTracks();
        }
        // 刷新侧边栏歌单列表
        if (this.components.navigation && this.components.navigation.refreshPlaylists) {
            await this.components.navigation.refreshPlaylists();
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

    // File Loading Methods
    setupFileLoading() {
        // Add drag and drop support
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            await this.handleFileDrop(e);
        });

        // Add menu items for file operations (if running in Electron)
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
            console.log(`Dropped ${audioFiles.length} audio files`);

            if (audioFiles.length === 1) {
                // Single file - load and play
                await this.loadAndPlayFile(audioFiles[0].path);
            } else {
                // Multiple files - add to playlist
                await this.addFilesToPlaylist(audioFiles);
            }
        }
    }

    async openFileDialog() {
        try {
            const files = await api.openFileDialog();
            if (files && files.length > 0) {
                console.log(`Selected ${files.length} files`);

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
                console.log(`Selected directory: ${directory}`);
                await this.scanDirectory(directory);
            }
        } catch (error) {
            console.error('Failed to open directory dialog:', error);
            this.showError('无法打开目录选择框');
        }
    }

    async loadAndPlayFile(filePath) {
        try {
            console.log(`Loading and playing file: ${filePath}`);
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
            console.log(`Adding ${files.length} files to playlist`);
            // For now, just load the first file
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
            console.log(`Scanning directory: ${directoryPath}`);
            this.showInfo('扫描音乐文件...');

            const success = await api.scanDirectory(directoryPath);
            if (success) {
                this.showSuccess('音乐目录扫描完成');
                await this.refreshLibrary();
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
        console.log(`✅ ${message}`);
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
        console.log(`ℹ️ ${message}`);
        showToast(message, 'info');
    }

    // Playlist event handlers
    handlePlaylistTrackSelected(track, index) {
        console.log('🎵 播放列表选择歌曲:', track.title);
        // Just select, don't play automatically
    }

    async handlePlaylistTrackPlayed(track, index) {
        console.log('🎵 播放列表双击播放歌曲:', track.title, '索引:', index);

        // 直接播放播放列表中的指定歌曲
        await this.playTrackFromPlaylist(track, index);
    }

    async handlePlaylistTrackRemoved(track, index) {
        console.log('🎵 从播放列表移除歌曲:', track.title, '索引:', index);

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
        console.log('🎵 播放列表已清空');

        // 同步清空API播放列表
        await api.setPlaylist([], -1);
        await api.pause();
        console.log('🔄 API播放列表已清空');
    }

    // Play track from playlist
    async playTrackFromPlaylist(track, index) {
        try {
            console.log('🎵 从播放列表播放歌曲:', track.title, '索引:', index);

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
                        // 开始播放
                        const playResult = await api.play();
                        if (playResult) {
                            console.log('✅ 播放列表播放成功');
                        } else {
                            console.log('❌ 播放列表播放失败');
                        }
                    } else {
                        console.log('❌ 播放列表加载文件失败');
                    }
                } else {
                    console.log('❌ 设置播放列表失败');
                }
            } else {
                console.warn('播放列表为空或不存在');
            }
        } catch (error) {
            console.error('❌ 播放列表播放错误:', error);
        }
    }

    // Handle track index change (for prev/next buttons)
    handleTrackIndexChanged(index) {
        console.log('🎵 播放索引改变:', index);
        console.log('🎵 当前播放列表长度:', this.components.playlist?.tracks?.length || 0);
        console.log('🎵 API播放列表长度:', api.playlist?.length || 0);

        // 更新播放列表组件的当前歌曲
        if (this.components.playlist) {
            if (index >= 0 && index < this.components.playlist.tracks.length) {
                this.components.playlist.setCurrentTrack(index);
                console.log('✅ 播放列表组件已更新到索引:', index);
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
            console.log('✅ 更新音乐库歌曲时长:', libraryTrack.title, duration.toFixed(2) + 's');
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

        // 更新音乐列表显示
        this.updateTrackList();
    }

    // Context menu event handlers
    handleDeleteTrack(track, index) {
        if (confirm(`确定要删除歌曲 "${track.title}" 吗？`)) {
            console.log('🗑️ 删除歌曲:', track.title);
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

    async handleRescanLibrary() {
        try {
            console.log('🔄 重新扫描音乐库');
            await api.scanLibrary();
            this.showInfo('开始重新扫描音乐库');
        } catch (error) {
            console.error('❌ 重新扫描失败:', error);
        }
    }

    // Add track to playlist
    addToPlaylist(track) {
        if (this.components.playlist) {
            this.components.playlist.addTrack(track);
            console.log('🎵 添加歌曲到播放列表:', track.title);
            this.showInfo(`已添加 "${track.title}" 到播放列表`);
        }
    }
}

window.app = new MusicBoxApp();
