/**
 * 侧边导航栏组件
 */

import {theme} from "@js/utils";
import {cacheManager} from "@js/shared/cache";
import {Component} from "@ui/base/Component";
import {navigationDataService} from "@js/ui/widgets/navigation/NavigationDataService";
import {appConfirmationService, appNotificationService} from "@js/features/appShell/service";
import type {Playlist} from "@api/types/playlist";
import type {AppView, ConfirmOptions} from "@js/shared/types/AppContracts";
import type {Unsubscribe} from "@api/types/common";
import type {MountedNetworkDrive} from "@api/types/electron";

type SidebarView = AppView;

interface SidebarPlaylist extends Playlist {
    coverImage?: string;
    trackIds?: string[];
}

type NetworkDrive = MountedNetworkDrive;

interface WindowStateResult {
    status: boolean;
    error?: unknown;
}

class Navigation extends Component {
    currentView: SidebarView | null;
    sidebarCollapsed: boolean;
    userPlaylists: SidebarPlaylist[];
    networkDrives: NetworkDrive[];
    removeLibraryUpdatedListener: Unsubscribe | null = null;
    removeWindowMaximizedListener: Unsubscribe | null = null;
    removeNetworkDriveConnectedListener: Unsubscribe | null = null;
    removeNetworkDriveDisconnectedListener: Unsubscribe | null = null;
    isMaximized = false;

    backBtn!: HTMLElement | null;
    forwardBtn!: HTMLElement | null;
    settingsBtn!: HTMLElement;
    themeToggle!: HTMLElement;
    lightIcon!: HTMLElement;
    darkIcon!: HTMLElement;
    minimizeBtn!: HTMLElement;
    maximizeBtn!: HTMLElement;
    closeBtn!: HTMLElement;
    maximizeIcon!: HTMLElement;
    restoreIcon!: HTMLElement;
    navbarContent!: HTMLElement;
    sidebar!: HTMLElement;
    sidebarToggleBtn!: HTMLElement;
    app!: HTMLElement;
    userPlaylistsSection!: HTMLElement | null;
    userPlaylistsList!: HTMLElement | null;
    networkDrivesSection!: HTMLElement | null;
    networkDrivesList!: HTMLElement | null;
    statisticsLink!: HTMLElement | null;
    recentLink!: HTMLElement | null;
    artistsLink!: HTMLElement | null;
    albumsLink!: HTMLElement | null;

    constructor() {
        super('#navbar');
        this.currentView = 'library';
        this.sidebarCollapsed = false;
        this.userPlaylists = [];
        this.networkDrives = [];

        this.setupElements();
        this.setupEventListeners();
        this.restoreSidebarState();
        this.loadUserPlaylists();
        this.setupLibraryUpdateListener();
        this.loadNetworkDrives();
        this.initializeSidebarButtonsState();
        this.initializeWindowState().then(r => {
            if (!r.status) console.error('❌ Navigation: 初始化窗口状态失败', r.error);
        });
    }

    setupLibraryUpdateListener(): void {
        this.removeLibraryUpdatedListener = navigationDataService.onLibraryUpdated(async () => {
            await this.refreshPlaylists();
        });
    }

    setupElements(): void {
        const navbar = this.element as HTMLElement;

        this.backBtn = navbar.querySelector('#back-btn');
        this.forwardBtn = navbar.querySelector('#forward-btn');
        this.settingsBtn = navbar.querySelector('#settings-btn') as HTMLElement;
        this.themeToggle = navbar.querySelector('#theme-toggle') as HTMLElement;
        this.lightIcon = this.themeToggle.querySelector('.light-icon') as HTMLElement;
        this.darkIcon = this.themeToggle.querySelector('.dark-icon') as HTMLElement;

        // 窗口控制按钮
        this.minimizeBtn = navbar.querySelector('#minimize-btn') as HTMLElement;
        this.maximizeBtn = navbar.querySelector('#maximize-btn') as HTMLElement;
        this.closeBtn = navbar.querySelector('#close-btn') as HTMLElement;
        this.maximizeIcon = this.maximizeBtn.querySelector('.maximize-icon') as HTMLElement;
        this.restoreIcon = this.maximizeBtn.querySelector('.restore-icon') as HTMLElement;
        this.navbarContent = navbar.querySelector('.navbar-content') as HTMLElement;

        // 侧边栏相关元素
        this.sidebar = document.getElementById('sidebar') as HTMLElement;
        this.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn') as HTMLElement;
        this.app = document.getElementById('app') as HTMLElement;

        // 窗口最大化状态
        this.isMaximized = false;

        // 歌单相关元素
        this.userPlaylistsSection = document.getElementById('user-playlists-section');
        this.userPlaylistsList = document.getElementById('user-playlists-list');

        // 网络磁盘相关元素
        this.networkDrivesSection = document.getElementById('network-drives-section');
        this.networkDrivesList = document.getElementById('network-drives-list');

        // 侧边栏功能按钮
        this.statisticsLink = document.querySelector('[data-view="statistics"]');
        this.recentLink = document.querySelector('[data-view="recent"]');
        this.artistsLink = document.querySelector('[data-view="artists"]');
        this.albumsLink = document.querySelector('[data-view="albums"]');
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.themeToggle, 'click', () => {
            theme.toggle();
            this.updateThemeIcon();
        });

        this.addEventListenerManaged(this.settingsBtn, 'click', () => {
            this.emit('showSettings');
        });

        theme.on('change', () => {
            this.updateThemeIcon();
        });

        // 窗口控制按钮事件监听器
        this.addEventListenerManaged(this.minimizeBtn, 'click', async () => {
            await this.minimizeWindow();
        });

        this.addEventListenerManaged(this.maximizeBtn, 'click', async () => {
            await this.toggleMaximizeWindow();
        });

        this.addEventListenerManaged(this.closeBtn, 'click', async () => {
            await this.closeWindow();
        });

        this.addEventListenerManaged(this.navbarContent, 'dblclick', async () => {
            await this.toggleMaximizeWindow();
        });

        // 监听窗口最大化状态变化
        this.removeWindowMaximizedListener = navigationDataService.onWindowMaximizedChanged((isMaximized) => {
            this.updateMaximizeButton(isMaximized);
        });

        // 窗口拖拽事件监听器
        // 0.2.5版本 移除自定义拖拽，暂时保留相关方法
        // this.setupWindowDrag();

        // 侧边栏切换按钮
        this.addEventListenerManaged(this.sidebarToggleBtn, 'click', () => {
            this.toggleSidebar();
        });

        // 侧边栏导航
        const sidebarLinks = document.querySelectorAll<HTMLElement>('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (view) {
                    this.navigateToView(view);
                }
            });
        });

        // 监听网络磁盘事件
        this.removeNetworkDriveConnectedListener = navigationDataService.onNetworkDriveConnected(async () => {
            await this.loadNetworkDrives();
        });

        this.removeNetworkDriveDisconnectedListener = navigationDataService.onNetworkDriveDisconnected(async () => {
            await this.loadNetworkDrives();
        });
    }

    updateThemeIcon(): void {
        const currentTheme = theme.current;
        if (currentTheme === 'dark') {
            this.lightIcon.style.display = 'none';
            this.darkIcon.style.display = 'block';
        } else {
            this.lightIcon.style.display = 'block';
            this.darkIcon.style.display = 'none';
        }
    }

    navigateToView(view: SidebarView): void {
        this.updateSidebarSelection(view);
        this.currentView = view;
        this.emit('viewChanged', view);
    }

    updateSidebarSelection(type: string, id: string | null = null): void {
        document.querySelectorAll<HTMLElement>('.sidebar-link, .playlist-sidebar-item, .network-drive-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        if (type === 'playlist' && id) {
            document.querySelector<HTMLElement>(`[data-playlist-id="${id}"]`)?.classList.add('active');
            return;
        }

        if (type === 'network-drive' && id) {
            document.querySelector<HTMLElement>(`[data-drive-id="${id}"]`)?.classList.add('active');
            return;
        }

        document.querySelector<HTMLElement>(`[data-view="${type}"]`)?.classList.add('active');
    }

    // 切换侧边栏收缩状态
    toggleSidebar(): void {
        this.sidebarCollapsed = !this.sidebarCollapsed;

        if (this.sidebarCollapsed) {
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        } else {
            this.sidebar.classList.remove('collapsed');
            this.app.classList.remove('sidebar-collapsed');
        }

        this.renderUserPlaylists();
        this.renderNetworkDrives(); // 重新渲染网络磁盘
        cacheManager.setLocalCache('sidebarCollapsed', this.sidebarCollapsed);
        console.log('🎵 Navigation: 侧边栏状态切换', this.sidebarCollapsed ? '收缩' : '展开');
    }

    // 窗口控制方法
    async minimizeWindow(): Promise<void> {
        try {
            await navigationDataService.minimizeWindow();
            console.log('🎵 Navigation: 窗口最小化');
        } catch (error) {
            console.error('❌ Navigation: 窗口最小化失败', error);
        }
    }

    async toggleMaximizeWindow(): Promise<void> {
        try {
            await navigationDataService.toggleMaximizeWindow();
            console.log('🎵 Navigation: 窗口最大化/还原切换');
        } catch (error) {
            console.error('❌ Navigation: 窗口最大化/还原失败', error);
        }
    }

    async closeWindow(): Promise<void> {
        try {
            await navigationDataService.closeWindow();
        } catch (error) {
            console.error('❌ Navigation: 窗口关闭失败', error);
        }
    }

    updateMaximizeButton(isMaximized: boolean): void {
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

    async initializeWindowState(): Promise<WindowStateResult> {
        try {
            const isMaximized = await navigationDataService.isWindowMaximized();
            this.updateMaximizeButton(isMaximized);
            return {
                status: true,
            };
        } catch (error) {
            return {
                status: false,
                error: error
            };
        }
    }

    // 恢复侧边栏状态
    restoreSidebarState(): void {
        const savedState = cacheManager.getLocalCache<boolean | string>('sidebarCollapsed');
        if (savedState === true || savedState === 'true') {
            this.sidebarCollapsed = true;
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        }
    }

    // 控制统计信息按钮显示/隐藏
    updateStatisticsButtonVisibility(enabled: boolean): void {
        if (!this.statisticsLink) {
            console.warn('🎵 Navigation: 统计信息按钮元素不存在');
            return;
        }
        const listItem = this.statisticsLink.parentElement;
        if (listItem) {
            listItem.style.display = enabled ? 'block' : 'none';
        }
    }

    // 控制最近播放按钮显示/隐藏
    updateRecentPlayButtonVisibility(enabled: boolean): void {
        if (!this.recentLink) {
            console.warn('🎵 Navigation: 最近播放按钮元素不存在');
            return;
        }
        const listItem = this.recentLink.parentElement;
        if (listItem) {
            listItem.style.display = enabled ? 'block' : 'none';
        }
    }

    // 控制艺术家页面按钮显示/隐藏
    updateArtistsPageButtonVisibility(enabled: boolean): void {
        if (!this.artistsLink) {
            console.warn('🎵 Navigation: 艺术家页面按钮元素不存在');
            return;
        }
        const listItem = this.artistsLink.parentElement;
        if (listItem) {
            listItem.style.display = enabled ? 'block' : 'none';
        }
    }

    // 控制专辑页面按钮显示/隐藏
    updateAlbumsPageButtonVisibility(enabled: boolean): void {
        if (!this.albumsLink) {
            console.warn('🎵 Navigation: 专辑页面按钮元素不存在');
            return;
        }
        const listItem = this.albumsLink.parentElement;
        if (listItem) {
            listItem.style.display = enabled ? 'block' : 'none';
        }
    }

    // 初始化侧边栏按钮状态
    initializeSidebarButtonsState(): void {
        try {
            const settings = cacheManager.getLocalCache<Record<string, boolean>>('musicbox-settings') || {};

            // 统计信息按钮状态
            const statisticsEnabled = Object.prototype.hasOwnProperty.call(settings, 'statistics') ? settings.statistics : true;
            this.updateStatisticsButtonVisibility(statisticsEnabled);

            // 最近播放按钮状态
            const recentPlayEnabled = Object.prototype.hasOwnProperty.call(settings, 'recentPlay') ? settings.recentPlay : true;
            this.updateRecentPlayButtonVisibility(recentPlayEnabled);

            // 艺术家页面按钮状态
            const artistsPageEnabled = Object.prototype.hasOwnProperty.call(settings, 'artistsPage') ? settings.artistsPage : true;
            this.updateArtistsPageButtonVisibility(artistsPageEnabled);

            // 专辑页面按钮状态
            const albumsPageEnabled = Object.prototype.hasOwnProperty.call(settings, 'albumsPage') ? settings.albumsPage : true;
            this.updateAlbumsPageButtonVisibility(albumsPageEnabled);
            // console.log('🎵 Navigation: 侧边栏按钮状态初始化完成 - 统计信息:', statisticsEnabled, '最近播放:', recentPlayEnabled, '艺术家/专辑页面:', artistsPageEnabled);
        } catch (error) {
            console.error('❌ Navigation: 初始化侧边栏按钮状态失败:', error);
        }
    }

    // 歌单管理方法
    // 加载用户歌单
    async loadUserPlaylists(): Promise<void> {
        try {
            this.userPlaylists = await navigationDataService.getPlaylists() as SidebarPlaylist[];
            this.renderUserPlaylists();
            // console.log(`🎵 Navigation: 加载了 ${this.userPlaylists.length} 个用户歌单`);
        } catch (error) {
            console.error('❌ Navigation: 加载用户歌单失败', error);
            this.userPlaylists = [];
            this.renderUserPlaylists();
        }
    }

    // 渲染用户歌单列表
    renderUserPlaylists(): void {
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
    renderPlaylistItem(playlist: SidebarPlaylist): string {
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
    setupPlaylistItemEvents(): void {
        if (!this.userPlaylistsList) {
            return;
        }

        this.userPlaylistsList.querySelectorAll<HTMLElement>('.playlist-sidebar-item').forEach(item => {
            const playlistId = item.dataset.playlistId;
            if (!playlistId) {
                return;
            }

            // 点击歌单项
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement | null;
                if (!target?.closest('.sidebar-playlist-action-btn')) {
                    this.openPlaylist(playlistId);
                }
            });

            // 操作按钮（仅在展开状态下存在）
            item.querySelectorAll<HTMLElement>('.sidebar-playlist-action-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    await this.handlePlaylistAction(playlistId, action);
                });
            });
        });
    }

    // 打开歌单详情
    openPlaylist(playlistId: string): void {
        const playlist = this.userPlaylists.find(p => p.id === playlistId);
        if (playlist) {
            // console.log('🎵 Navigation: 打开歌单', playlist.name);
            this.emit('playlistSelected', playlist);
        }
    }

    // 处理歌单操作
    async handlePlaylistAction(playlistId: string, action?: string): Promise<void> {
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
    async renamePlaylist(playlist: SidebarPlaylist): Promise<void> {
        // 触发重命名对话框显示事件
        this.emit('showRenameDialog', playlist);
    }

    // 删除歌单
    async deletePlaylist(playlist: SidebarPlaylist): Promise<void> {
        const confirmOptions: ConfirmOptions = {
            title: '删除歌单',
            message: `确定要删除歌单 "${playlist.name}" 吗？此操作不可撤销。`,
            confirmText: '删除',
            type: 'danger'
        };
        const confirmed = await appConfirmationService.confirm(confirmOptions);

        if (!confirmed) {
            return;
        }

        try {
            const result = await navigationDataService.deletePlaylist(playlist.id);
            if (result.success) {
                await this.refreshPlaylists();
                appNotificationService.showInfo(`歌单 "${playlist.name}" 已删除`);
            } else {
                console.error('❌ Navigation: 歌单删除失败', result.error);
                appNotificationService.showError(result.error || '删除失败');
            }
        } catch (error) {
            console.error('❌ Navigation: 歌单删除失败', error);
            appNotificationService.showError('删除失败，请重试');
        }
    }

    // 刷新歌单列表
    async refreshPlaylists(): Promise<void> {
        await this.loadUserPlaylists();
    }


    // --- 网络磁盘管理 ---

    async loadNetworkDrives(): Promise<void> {
        try {
            const mountedDrives = await navigationDataService.getMountedNetworkDrives();
            this.networkDrives = mountedDrives || [];
            this.renderNetworkDrives();
            console.log(`✅ Navigation: 加载了 ${this.networkDrives.length} 个网络磁盘`);
        } catch (error) {
            console.error('❌ Navigation: 加载网络磁盘列表失败', error);
            this.networkDrives = [];
            this.renderNetworkDrives();
        }
    }

    renderNetworkDrives(): void {
        if (!this.networkDrivesList || !this.networkDrivesSection) {
            return;
        }

        if (this.networkDrives.length === 0) {
            this.networkDrivesSection.style.display = 'none';
            return;
        }

        this.networkDrivesSection.style.display = 'block';
        this.networkDrivesList.innerHTML = this.networkDrives.map(drive =>
            this.renderNetworkDriveItem(drive)
        ).join('');

        this.setupNetworkDriveItemEvents();
    }

    renderNetworkDriveItem(drive: NetworkDrive): string {
        // 根据磁盘类型选择 SVG 图标
        const iconPath = drive.type === 'smb'
            ? 'M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z'
            : 'M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.04Z';

        const displayName = drive.config?.displayName || drive.displayName || '未命名磁盘';

        if (this.sidebarCollapsed) {
            return `
                <li>
                    <div class="network-drive-sidebar-item collapsed-item"
                         data-drive-id="${drive.id}"
                         title="${this.escapeHtml(displayName)}">
                        <svg class="drive-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="${iconPath}"/>
                        </svg>
                    </div>
                </li>
            `;
        } else {
            return `
                <li>
                    <div class="network-drive-sidebar-item" data-drive-id="${drive.id}">
                        <svg class="drive-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="${iconPath}"/>
                        </svg>
                        <span class="drive-name">${this.escapeHtml(displayName)}</span>
                        <div class="sidebar-drive-actions">
                            <button class="sidebar-drive-action-btn" data-action="refresh" title="刷新连接">
                                <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </li>
            `;
        }
    }

    setupNetworkDriveItemEvents(): void {
        if (!this.networkDrivesList) {
            return;
        }

        this.networkDrivesList.querySelectorAll<HTMLElement>('.network-drive-sidebar-item').forEach(item => {
            const driveId = item.dataset.driveId;
            const drive = this.networkDrives.find(d => d.id === driveId);
            if (!drive) return;

            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement | null;
                if (!target?.closest('.sidebar-drive-action-btn')) {
                    this.emit('networkDriveSelected', drive);
                }
            });

            const refreshBtn = item.querySelector<HTMLElement>('[data-action="refresh"]');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.refreshNetworkDrive(drive);
                });
            }
        });
    }

    async refreshNetworkDrive(drive: NetworkDrive): Promise<void> {
        try {
            await navigationDataService.refreshNetworkDrive(drive.id);
            await this.loadNetworkDrives();
            appNotificationService.showInfo(`网络磁盘 "${drive.displayName || drive.config?.displayName || '未命名磁盘'}" 已刷新`);
        } catch (error) {
            console.error('❌ Navigation: 刷新网络磁盘失败', error);
            appNotificationService.showError('刷新失败，请重试');
        }
    }

    // HTML转义
    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy(): void {
        if (this.removeLibraryUpdatedListener) {
            this.removeLibraryUpdatedListener();
            this.removeLibraryUpdatedListener = null;
        }
        if (this.removeWindowMaximizedListener) {
            this.removeWindowMaximizedListener();
            this.removeWindowMaximizedListener = null;
        }
        if (this.removeNetworkDriveConnectedListener) {
            this.removeNetworkDriveConnectedListener();
            this.removeNetworkDriveConnectedListener = null;
        }
        if (this.removeNetworkDriveDisconnectedListener) {
            this.removeNetworkDriveDisconnectedListener();
            this.removeNetworkDriveDisconnectedListener = null;
        }

        // 清理用户歌单数据
        this.userPlaylists = [];

        // 重置状态
        this.currentView = null;
        this.sidebarCollapsed = false;
        super.destroy();
    }
}

export {Navigation};
