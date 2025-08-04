/**
 * 侧边导航栏组件
 */

class Navigation extends Component {
    constructor() {
        super('#navbar');
        this.currentView = 'library';
        this.sidebarCollapsed = false;
        this.userPlaylists = [];
        this.setupElements();
        this.setupEventListeners();
        this.restoreSidebarState();
        this.loadUserPlaylists();
        this.initializeSidebarButtonsState();
        this.initializeWindowState().then(r => {
            if (!r.status) console.error('❌ Navigation: 初始化窗口状态失败', r.error);
        });
    }

    setupElements() {
        this.backBtn = this.element.querySelector('#back-btn');
        this.forwardBtn = this.element.querySelector('#forward-btn');
        this.settingsBtn = this.element.querySelector('#settings-btn');
        this.themeToggle = this.element.querySelector('#theme-toggle');
        this.lightIcon = this.themeToggle.querySelector('.light-icon');
        this.darkIcon = this.themeToggle.querySelector('.dark-icon');

        // 窗口控制按钮
        this.minimizeBtn = this.element.querySelector('#minimize-btn');
        this.maximizeBtn = this.element.querySelector('#maximize-btn');
        this.closeBtn = this.element.querySelector('#close-btn');
        this.maximizeIcon = this.maximizeBtn.querySelector('.maximize-icon');
        this.restoreIcon = this.maximizeBtn.querySelector('.restore-icon');

        // 侧边栏相关元素
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        this.app = document.getElementById('app');

        // 全屏状态
        this.isFullscreen = false;

        // 窗口最大化状态
        this.isMaximized = false;

        // 拖拽相关状态
        this.isKeyDown = false;
        this.dinatesX = 0;
        this.dinatesY = 0;

        // 主动尺寸保护机制 - 记录拖拽开始时的窗口尺寸
        this.originalWindowWidth = 0;
        this.originalWindowHeight = 0;

        // 歌单相关元素
        this.userPlaylistsSection = document.getElementById('user-playlists-section');
        this.userPlaylistsList = document.getElementById('user-playlists-list');

        // 侧边栏功能按钮
        this.statisticsLink = document.querySelector('[data-view="statistics"]');
        this.recentLink = document.querySelector('[data-view="recent"]');
        this.artistsLink = document.querySelector('[data-view="artists"]');
    }

    setupEventListeners() {
        this.themeToggle.addEventListener('click', () => {
            theme.toggle();
            this.updateThemeIcon();
        });

        this.settingsBtn.addEventListener('click', () => {
            this.emit('showSettings');
        });

        theme.on('change', () => {
            this.updateThemeIcon();
        });
        this.updateThemeIcon();

        // 窗口控制按钮事件监听器
        this.minimizeBtn.addEventListener('click', async () => {
            await this.minimizeWindow();
        });

        this.maximizeBtn.addEventListener('click', async () => {
            await this.toggleMaximizeWindow();
        });

        this.closeBtn.addEventListener('click', async () => {
            await this.closeWindow();
        });

        // 监听窗口最大化状态变化
        if (window.electronAPI && window.electronAPI.window) {
            window.electronAPI.window.onMaximizedChanged((isMaximized) => {
                this.updateMaximizeButton(isMaximized);
            });
        }

        // 窗口拖拽事件监听器
        this.setupWindowDrag();

        // 侧边栏切换按钮
        this.sidebarToggleBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // 侧边栏导航
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (view) {
                    this.navigateToView(view);
                }
            });
        });
    }

    updateThemeIcon() {
        const currentTheme = theme.current;
        if (currentTheme === 'dark') {
            this.lightIcon.style.display = 'none';
            this.darkIcon.style.display = 'block';
        } else {
            this.lightIcon.style.display = 'block';
            this.darkIcon.style.display = 'none';
        }
    }

    navigateToView(view) {
        // 更新为当前页面
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        this.currentView = view;
        this.emit('viewChanged', view);
    }

    // 切换侧边栏收缩状态
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;

        if (this.sidebarCollapsed) {
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        } else {
            this.sidebar.classList.remove('collapsed');
            this.app.classList.remove('sidebar-collapsed');
        }

        this.renderUserPlaylists();
        window.cacheManager.setLocalCache('sidebarCollapsed', this.sidebarCollapsed);
        console.log('🎵 Navigation: 侧边栏状态切换', this.sidebarCollapsed ? '收缩' : '展开');
    }

    // 窗口控制方法
    async minimizeWindow() {
        try {
            if (window.electronAPI && window.electronAPI.window) {
                await window.electronAPI.window.minimize();
                console.log('🎵 Navigation: 窗口最小化');
            }
        } catch (error) {
            console.error('❌ Navigation: 窗口最小化失败', error);
        }
    }

    async toggleMaximizeWindow() {
        try {
            if (window.electronAPI && window.electronAPI.window) {
                await window.electronAPI.window.maximize();
                console.log('🎵 Navigation: 窗口最大化/还原切换');
            }
        } catch (error) {
            console.error('❌ Navigation: 窗口最大化/还原失败', error);
        }
    }

    async closeWindow() {
        try {
            if (window.electronAPI && window.electronAPI.window) {
                await window.electronAPI.window.close();
                console.log('🎵 Navigation: 窗口关闭');
            }
        } catch (error) {
            console.error('❌ Navigation: 窗口关闭失败', error);
        }
    }

    updateMaximizeButton(isMaximized) {
        this.isMaximized = isMaximized;
        if (isMaximized) {
            this.maximizeIcon.style.display = 'none';
            this.restoreIcon.style.display = 'block';
        } else {
            this.maximizeIcon.style.display = 'block';
            this.restoreIcon.style.display = 'none';
        }
        console.log('🎵 Navigation: 窗口状态更新', isMaximized ? '最大化' : '还原');
    }

    async initializeWindowState() {
        try {
            if (window.electronAPI && window.electronAPI.window) {
                const isMaximized = await window.electronAPI.window.isMaximized();
                this.updateMaximizeButton(isMaximized);
                return {
                    status: true,
                }
            }
        } catch (error) {
            return {
                status: false,
                error: error
            }
        }
    }

    setupWindowDrag() {
        const navbar = this.element;
        const navbarContent = navbar.querySelector('.navbar-content');

        // 获取不可拖拽的元素
        const nonDraggableElements = [
            ...navbar.querySelectorAll('button'),
            ...navbar.querySelectorAll('input'),
            ...navbar.querySelectorAll('.search-container')
        ];

        const mousedown = (e) => {
            // 只处理左键点击
            if (e.button !== 0) return;
            // 检查是否点击在不可拖拽的元素上
            const isNonDraggable = nonDraggableElements.some(element =>
                element.contains(e.target) || element === e.target
            );
            if (isNonDraggable || this.isMaximized) {
                return;
            }

            this.isKeyDown = true;
            this.dinatesX = e.x;
            this.dinatesY = e.y;

            // 主动尺寸保护机制 - 记录拖拽开始时的窗口尺寸
            try {
                if (window.electronAPI && window.electronAPI.window) {
                    window.electronAPI.window.getSize().then(([width, height]) => {
                        this.originalWindowWidth = width;
                        this.originalWindowHeight = height;
                        console.log('🎵 Navigation: 记录原始窗口尺寸', {
                            width: this.originalWindowWidth,
                            height: this.originalWindowHeight
                        });
                    }).catch(error => {
                        console.error('❌ Navigation: 获取窗口尺寸失败', error);
                    });
                }
            } catch (error) {
                console.error('❌ Navigation: 尺寸记录失败', error);
            }

            console.log('🎵 Navigation: 开始拖拽窗口', {dinatesX: this.dinatesX, dinatesY: this.dinatesY});

            document.onmousemove = async (ev) => {
                if (this.isKeyDown) {
                    const x = ev.screenX - this.dinatesX;
                    const y = ev.screenY - this.dinatesY;

                    // 给主进程传入坐标和原始尺寸信息
                    let data = {
                        appX: x,
                        appY: y,
                        // 主动尺寸保护机制 - 传递原始窗口尺寸
                        originalWidth: this.originalWindowWidth,
                        originalHeight: this.originalWindowHeight
                    };
                    if (window.electronAPI && window.electronAPI.window) {
                        await window.electronAPI.window.sendPosition(data);
                    }
                }
            };
            document.onmouseup = async (ev) => {
                this.isKeyDown = false;

                // 主动尺寸保护机制 - 清理缓存的尺寸信息
                if (window.electronAPI && window.electronAPI.window) {
                    await window.electronAPI.window.clearSizeCache();
                }

                // 重置本地尺寸记录
                this.originalWindowWidth = 0;
                this.originalWindowHeight = 0;

                console.log('🎵 Navigation: 结束拖拽窗口，已清理尺寸缓存');
            };
        };
        navbarContent.addEventListener('mousedown', mousedown);
    }

    // 恢复侧边栏状态
    restoreSidebarState() {
        const savedState = window.cacheManager.getLocalCache('sidebarCollapsed')
        if (savedState === 'true') {
            this.sidebarCollapsed = true;
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        }
    }

    // 控制统计信息按钮显示/隐藏
    updateStatisticsButtonVisibility(enabled) {
        if (!this.statisticsLink) {
            console.warn('🎵 Navigation: 统计信息按钮元素不存在');
            return;
        }

        const listItem = this.statisticsLink.parentElement;
        if (enabled) {
            listItem.style.display = 'block';
            console.log('📊 Navigation: 统计信息按钮已显示');
        } else {
            listItem.style.display = 'none';
            console.log('📊 Navigation: 统计信息按钮已隐藏');
        }
    }

    // 控制最近播放按钮显示/隐藏
    updateRecentPlayButtonVisibility(enabled) {
        if (!this.recentLink) {
            console.warn('🎵 Navigation: 最近播放按钮元素不存在');
            return;
        }

        const listItem = this.recentLink.parentElement;
        if (enabled) {
            listItem.style.display = 'block';
            console.log('🕒 Navigation: 最近播放按钮已显示');
        } else {
            listItem.style.display = 'none';
            console.log('🕒 Navigation: 最近播放按钮已隐藏');
        }
    }

    // 控制艺术家页面按钮显示/隐藏
    updateArtistsPageButtonVisibility(enabled) {
        if (!this.artistsLink) {
            console.warn('🎵 Navigation: 艺术家页面按钮元素不存在');
            return;
        }

        const listItem = this.artistsLink.parentElement;
        if (enabled) {
            listItem.style.display = 'block';
            console.log('🎨 Navigation: 艺术家页面按钮已显示');
        } else {
            listItem.style.display = 'none';
            console.log('🎨 Navigation: 艺术家页面按钮已隐藏');
        }
    }

    // 初始化侧边栏按钮状态
    initializeSidebarButtonsState() {
        try {
            const settings = window.cacheManager.getLocalCache('musicbox-settings') || {};

            // 统计信息按钮状态
            const statisticsEnabled = settings.hasOwnProperty('statistics') ? settings.statistics : true;
            this.updateStatisticsButtonVisibility(statisticsEnabled);

            // 最近播放按钮状态
            const recentPlayEnabled = settings.hasOwnProperty('recentPlay') ? settings.recentPlay : true;
            this.updateRecentPlayButtonVisibility(recentPlayEnabled);

            // 艺术家页面按钮状态
            const artistsPageEnabled = settings.hasOwnProperty('artistsPage') ? settings.artistsPage : true;
            this.updateArtistsPageButtonVisibility(artistsPageEnabled);

            console.log('🎵 Navigation: 侧边栏按钮状态初始化完成 - 统计信息:', statisticsEnabled, '最近播放:', recentPlayEnabled, '艺术家页面:', artistsPageEnabled);
        } catch (error) {
            console.error('❌ Navigation: 初始化侧边栏按钮状态失败:', error);
        }
    }

    // 歌单管理方法
    // 加载用户歌单
    async loadUserPlaylists() {
        try {
            this.userPlaylists = await window.electronAPI.library.getPlaylists();
            this.renderUserPlaylists();
            console.log(`🎵 Navigation: 加载了 ${this.userPlaylists.length} 个用户歌单`);
        } catch (error) {
            console.error('❌ Navigation: 加载用户歌单失败', error);
            this.userPlaylists = [];
            this.renderUserPlaylists();
        }
    }

    // 渲染用户歌单列表
    renderUserPlaylists() {
        if (!this.userPlaylistsList || !this.userPlaylistsSection) {
            return;
        }

        if (this.userPlaylists.length === 0) {
            this.userPlaylistsSection.style.display = 'none';
            return;
        }

        this.userPlaylistsSection.style.display = 'block';

        // 根据侧边栏状态渲染不同的内容
        this.userPlaylistsList.innerHTML = this.userPlaylists.map(playlist =>
            this.renderPlaylistItem(playlist)
        ).join('');

        // 添加事件监听
        this.setupPlaylistItemEvents();
    }

    // 渲染单个歌单项
    renderPlaylistItem(playlist) {
        if (this.sidebarCollapsed) {
            // 收缩状态：只显示封面或图标
            return `
                <li>
                    <div class="playlist-sidebar-item collapsed-item" data-playlist-id="${playlist.id}" title="${this.escapeHtml(playlist.name)} (${playlist.trackIds ? playlist.trackIds.length : 0} 首歌曲)">
                        ${playlist.coverImage ? `
                            <img class="sidebar-playlist-cover" src="file://${playlist.coverImage}" alt="歌单封面" />
                        ` : `
                            <svg class="sidebar-icon" viewBox="0 0 24 24">
                                <path d="M13,2V8H21V2M13,9V15H21V9M13,16V22H21V16M3,2V8H11V2M3,9V15H11V9M3,16V22H11V16Z"/>
                            </svg>
                        `}
                    </div>
                </li>
            `;
        } else {
            // 展开状态：显示完整信息
            return `
                <li>
                    <div class="playlist-sidebar-item" data-playlist-id="${playlist.id}">
                        ${playlist.coverImage ? `
                            <img class="sidebar-playlist-cover" src="file://${playlist.coverImage}" alt="歌单封面" />
                        ` : `
                            <svg class="sidebar-icon" viewBox="0 0 24 24">
                                <path d="M13,2V8H21V2M13,9V15H21V9M13,16V22H21V16M3,2V8H11V2M3,9V15H11V9M3,16V22H11V16Z"/>
                            </svg>
                        `}
                        <span class="playlist-name">${this.escapeHtml(playlist.name)}</span>
                        <span class="playlist-count">${playlist.trackIds ? playlist.trackIds.length : 0}</span>
                        <div class="sidebar-playlist-actions">
                            <button class="sidebar-playlist-action-btn" data-action="rename">
                                <svg class="icon" viewBox="0 0 24 24">
                                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                                </svg>
                            </button>
                            <button class="sidebar-playlist-action-btn" data-action="delete">
                                <svg class="icon" viewBox="0 0 24 24">
                                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </li>
            `;
        }
    }

    // 设置歌单项事件监听器
    setupPlaylistItemEvents() {
        this.userPlaylistsList.querySelectorAll('.playlist-sidebar-item').forEach(item => {
            const playlistId = item.dataset.playlistId;

            // 点击歌单项
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.sidebar-playlist-action-btn')) {
                    this.openPlaylist(playlistId);
                }
            });

            // 操作按钮（仅在展开状态下存在）
            item.querySelectorAll('.sidebar-playlist-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    await this.handlePlaylistAction(playlistId, action);
                });
            });
        });
    }

    // 打开歌单详情
    openPlaylist(playlistId) {
        const playlist = this.userPlaylists.find(p => p.id === playlistId);
        if (playlist) {
            console.log('🎵 Navigation: 打开歌单', playlist.name);
            this.emit('playlistSelected', playlist);
        }
    }

    // 处理歌单操作
    async handlePlaylistAction(playlistId, action) {
        const playlist = this.userPlaylists.find(p => p.id === playlistId);
        if (!playlist) return;

        switch (action) {
            case 'rename':
                await this.renamePlaylist(playlist);
                break;
            case 'delete':
                await this.deletePlaylist(playlist);
                break;
        }
    }

    // 重命名歌单
    async renamePlaylist(playlist) {
        // 触发重命名对话框显示事件
        this.emit('showRenameDialog', playlist);
    }

    // 删除歌单
    async deletePlaylist(playlist) {
        if (!confirm(`确定要删除歌单 "${playlist.name}" 吗？此操作不可撤销。`)) {
            return;
        }

        try {
            const result = await window.electronAPI.library.deletePlaylist(playlist.id);
            if (result.success) {
                console.log('✅ Navigation: 歌单删除成功');
                await this.refreshPlaylists();
                if (window.app && window.app.showInfo) {
                    window.app.showInfo(`歌单 "${playlist.name}" 已删除`);
                }
            } else {
                console.error('❌ Navigation: 歌单删除失败', result.error);
                if (window.app && window.app.showError) {
                    window.app.showError(result.error || '删除失败');
                }
            }
        } catch (error) {
            console.error('❌ Navigation: 歌单删除失败', error);
            if (window.app && window.app.showError) {
                window.app.showError('删除失败，请重试');
            }
        }
    }

    // 刷新歌单列表
    async refreshPlaylists() {
        await this.loadUserPlaylists();
    }

    // 更新特定歌单信息（用于封面更新等）
    updatePlaylistInfo(updatedPlaylist) {
        const index = this.userPlaylists.findIndex(p => p.id === updatedPlaylist.id);
        if (index !== -1) {
            this.userPlaylists[index] = { ...this.userPlaylists[index], ...updatedPlaylist };
            this.renderUserPlaylists();
            console.log('✅ Navigation: 歌单信息已更新', updatedPlaylist.name);
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
