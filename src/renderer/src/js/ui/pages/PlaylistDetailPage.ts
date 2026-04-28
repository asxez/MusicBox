/**
 * 歌单页组件
 */

import {Component} from "@components/base/Component";
import {api} from "@api/api";
import {app} from "@core/app";
import {trackCoverDisplayPreferenceService} from "@services/preferences/TrackCoverDisplayPreferenceService";
import {coverAPI, fileAPI, libraryAPI} from "@js/api";
import type {Unsubscribe} from "@api/types/common";
import type {Playlist, Track} from "@api/types/library";

type PlaylistDetailTrack = Track & {
    fileId?: string;
    fileName?: string;
};

type PlaylistDetail = Partial<Playlist> & {
    id: string;
    name: string;
    description?: string;
    createdAt?: number | string | Date;
    trackIds?: string[];
    trackCount?: number;
    coverImage?: string | null;
};

interface CoverResult {
    success?: boolean;
    imageUrl?: string;
    type?: string;
    filePath?: string;
    error?: string;
}

interface AddTracksResult {
    success: boolean;
    error?: string;
    successCount?: number;
    failCount?: number;
    errors?: string[];
    totalCount?: number;
}

class PlaylistDetailPage extends Component {
    public isVisible: boolean;
    public currentPlaylist: PlaylistDetail | null;
    public tracks: PlaylistDetailTrack[];
    public selectedTracks: Set<number>;
    private container: HTMLElement | null;
    private isMultiSelectMode: boolean;
    private lastSelectedIndex: number;
    private showCovers: boolean;
    private documentClickHandler: ((event: MouseEvent) => void) | null;
    private coverDisplayPreferenceUnsubscribe: Unsubscribe | null = null;

    constructor(container: string | Element | null) {
        super(container);
        this.isVisible = false;
        this.currentPlaylist = null;
        this.tracks = [];
        this.selectedTracks = new Set();
        this.isMultiSelectMode = false;
        this.lastSelectedIndex = -1;
        this.container = this.element instanceof HTMLElement ? this.element : null;
        this.documentClickHandler = null;

        // 获取封面显示设置
        this.showCovers = this.getShowCoversSettings();

        this.setupElements();
        this.setupSettingsListener();
    }

    async show(playlist: PlaylistDetail): Promise<void> {
        this.isVisible = true;
        this.currentPlaylist = playlist;

        if (this.element instanceof HTMLElement) {
            // 预设样式，减少可见的样式变换
            this.element.style.display = 'block';
            this.element.style.opacity = '0';
            this.element.style.transform = 'translateY(10px)';
        }

        // 每次显示新歌单时都需要重新绑定事件监听器
        await this.loadPlaylistCover();
        await this.loadPlaylistTracks();
        this.render();

        // 平滑显示页面
        if (this.element instanceof HTMLElement) {
            const element = this.element;
            requestAnimationFrame(() => {
                element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            });
        }
    }

    hide(): void {
        this.isVisible = false;
        this.currentPlaylist = null;
        this.tracks = [];

        // 清理事件监听器
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
            this.documentClickHandler = null;
        }

        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy(): void {
        if (this.coverDisplayPreferenceUnsubscribe) {
            this.coverDisplayPreferenceUnsubscribe();
            this.coverDisplayPreferenceUnsubscribe = null;
        }
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
            this.documentClickHandler = null;
        }
        super.destroy();
    }

    setupElements(): void {
        this.container = this.element instanceof HTMLElement ? this.element : null;
    }

    getShowCoversSettings(): boolean {
        return trackCoverDisplayPreferenceService.isEnabled();
    }

    setupSettingsListener(): void {
        this.coverDisplayPreferenceUnsubscribe = trackCoverDisplayPreferenceService.onChanged((enabled) => {
            this.showCovers = enabled;
            if (this.isVisible) {
                this.render();
            }
        });
    }

    render(): void {
        if (!this.currentPlaylist || !this.container) return;

        const createdDate = new Date(this.currentPlaylist.createdAt || Date.now());
        // 使用实际加载的tracks数量，确保UI状态与数据一致
        const trackCount = this.tracks ? this.tracks.length : (this.currentPlaylist.trackIds ? this.currentPlaylist.trackIds.length : 0);
        const totalDuration = this.calculateTotalDuration();

        this.container.innerHTML = `
            <div class="page-content playlist-page">
                <!-- 现代化Hero区域 -->
                <div class="playlist-hero">
                    <div class="hero-background">
                        <div class="gradient-overlay"></div>
                    </div>
                    <div class="hero-content">
                        <div class="playlist-cover-container">
                            <div class="playlist-cover" id="playlist-cover" data-playlist-id="${this.currentPlaylist.id}">
                                ${this.renderPlaylistCover()}
                                <div class="cover-shadow"></div>
                            </div>
                        </div>
                        <div class="playlist-info">
                            <div class="playlist-type">
                                <svg class="type-icon" viewBox="0 0 24 24">
                                    <path d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>
                                </svg>
                                <span>歌单</span>
                            </div>
                            <h1 class="playlist-title">${this.escapeHtml(this.currentPlaylist.name)}</h1>
                            ${this.currentPlaylist.description ? `
                            <p class="playlist-description">${this.escapeHtml(this.currentPlaylist.description)}</p>
                            ` : ''}
                            <div class="playlist-meta">
                                <span class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24">
                                        <path d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8.01,12 6,14.01 6,16.5S8.01,21 10.5,21S15,18.99 15,16.5V6H19V3H12Z"/>
                                    </svg>
                                    <span>${trackCount} 首歌曲</span>
                                </span>
                                ${totalDuration ? `
                                <span class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24">
                                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                                    </svg>
                                    <span>${this.formatTotalDuration(totalDuration)}</span>
                                </span>
                                ` : ''}
                                <span class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24">
                                        <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"/>
                                    </svg>
                                    <span>创建于 ${createdDate.toLocaleDateString('zh-CN')}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 现代化操作按钮区域 -->
                <div class="playlist-actions">
                    <div class="actions-primary">
                        <button class="play-btn primary" id="playlist-play-all" ${trackCount === 0 ? 'disabled' : ''}>
                            <div class="btn-content">
                                <svg class="play-icon" viewBox="0 0 24 24">
                                    <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                </svg>
                                <span class="btn-text">播放全部</span>
                            </div>
                        </button>
                        <button class="shuffle-btn secondary" id="playlist-shuffle" ${trackCount === 0 ? 'disabled' : ''}>
                            <svg class="shuffle-icon" viewBox="0 0 24 24">
                                <path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="actions-secondary">
                        <button class="action-btn add-songs" id="playlist-add-songs">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                            </svg>
                            <span>添加歌曲</span>
                        </button>
                        <button class="action-btn add-from-folder" id="playlist-add-from-folder">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4M14,12H12V14H10V12H8V10H10V8H12V10H14V12Z"/>
                            </svg>
                            <span>从文件夹添加</span>
                        </button>
                        <div class="action-menu">
                            <button class="action-btn menu-trigger" id="playlist-menu">
                                <svg class="icon" viewBox="0 0 24 24">
                                    <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/>
                                </svg>
                            </button>
                            <div class="menu-dropdown" id="playlist-menu-dropdown">
                                <button class="menu-item" id="playlist-clear" ${trackCount === 0 ? 'disabled' : ''}>
                                    <svg class="menu-icon" viewBox="0 0 24 24">
                                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                                    </svg>
                                    <span>清空歌单</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 现代化歌曲列表区域 -->
                <div class="tracks-section">
                    ${trackCount > 0 ? `
                    <div class="tracks-header">
                        <div class="header-left">
                            <h3 class="tracks-title">歌曲列表</h3>
                            <span class="tracks-count">${trackCount} 首歌曲</span>
                        </div>
                        <div class="header-right">
                            <div class="tracks-controls">
                                <button class="control-btn" id="select-all-tracks">
                                    <svg class="icon" viewBox="0 0 24 24">
                                        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                                    </svg>
                                    <span>全选</span>
                                </button>
                                <button class="control-btn" id="clear-selection" style="display: none;">
                                    <svg class="icon" viewBox="0 0 24 24">
                                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                                    </svg>
                                    <span>取消选择</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    <!-- 始终渲染tracks-container，确保DOM结构一致 -->
                    <div class="tracks-container" id="playlist-track-list">
                        ${this.renderTrackList()}
                    </div>
                </div>
            </div>
        `;

        this.setupDynamicEventListeners();

        // 直接绑定事件，因为DOM结构现在是一致的
        this.setupTrackListEvents();
    }

    setupDynamicEventListeners(): void {
        if (!this.container) return;
        // 播放全部按钮
        const playAllBtn = this.container.querySelector('#playlist-play-all');
        if (playAllBtn) playAllBtn.addEventListener('click', () => this.playAllTracks());

        // 随机播放按钮
        const shuffleBtn = this.container.querySelector('#playlist-shuffle');
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.shufflePlayTracks());

        // 添加歌曲按钮
        const addSongsBtn = this.container.querySelector('#playlist-add-songs');
        if (addSongsBtn) addSongsBtn.addEventListener('click', () => this.showAddSongsDialog());

        // 从文件夹添加音乐按钮
        const addFromFolderBtn = this.container.querySelector('#playlist-add-from-folder');
        if (addFromFolderBtn) addFromFolderBtn.addEventListener('click', () => this.addFromFolder());

        // 全选按钮
        const selectAllBtn = this.container.querySelector('#select-all-tracks');
        if (selectAllBtn) selectAllBtn.addEventListener('click', () => this.selectAllTracks());

        // 清除选择按钮
        const clearSelectionBtn = this.container.querySelector('#clear-selection');
        if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', () => this.clearSelection());

        // 菜单按钮
        const menuBtn = this.container.querySelector('#playlist-menu');
        const menuDropdown = this.container.querySelector('#playlist-menu-dropdown');
        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('show');
            });

            // 设置document点击监听器
            // 每次都重新设置，因为DOM已重新生成
            this.setupDocumentClickHandler(menuDropdown);

            // 菜单项事件
            const clearBtn = menuDropdown.querySelector('#playlist-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', async () => {
                    menuDropdown.classList.remove('show');
                    await this.clearPlaylist();
                });
            }
        }

        // setupTrackListEvents() 已在 render() 方法中调用，这里不需要重复调用
        this.setupCoverContextMenu();
    }

    // 设置document点击监听器，避免重复绑定
    setupDocumentClickHandler(menuDropdown: Element): void {
        // 先移除旧的监听器
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
        }

        // 创建新的监听器
        this.documentClickHandler = () => {
            menuDropdown.classList.remove('show');
        };

        // 添加新的监听器
        document.addEventListener('click', this.documentClickHandler);
    }

    async loadPlaylistCover(): Promise<void> {
        if (!this.currentPlaylist) return;
        try {
            const result = await api.getPlaylistCover(this.currentPlaylist.id);
            if (result.success && result.coverPath) {
                this.currentPlaylist.coverImage = result.coverPath;
            } else {
                this.currentPlaylist.coverImage = null;
            }
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 加载歌单封面失败', error);
            this.currentPlaylist.coverImage = null;
        }
    }

    async loadPlaylistTracks(): Promise<void> {
        if (!this.currentPlaylist) return;
        try {
            const result = await libraryAPI.getPlaylistDetail(this.currentPlaylist.id);
            if (result.success) {
                this.tracks = (result.tracks || result.playlist?.tracks || []) as PlaylistDetailTrack[];

                // 同步更新currentPlaylist对象，确保UI状态正确
                if (result.playlist) {
                    const playlistDetail = result.playlist as PlaylistDetail;
                    this.currentPlaylist.trackIds = playlistDetail.trackIds || [];
                    this.currentPlaylist.trackCount = this.tracks.length;
                    // 如果有其他需要同步的属性，也在这里更新
                    if (playlistDetail.name) this.currentPlaylist.name = playlistDetail.name;
                    if (playlistDetail.description !== undefined) this.currentPlaylist.description = playlistDetail.description;
                }

                this.render();
            } else {
                console.error('❌ PlaylistDetailPage: 加载歌单歌曲失败', result.error);
                this.tracks = [];
                // 同步更新空状态
                this.currentPlaylist.trackIds = [];
                this.currentPlaylist.trackCount = 0;
                this.render();
            }
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 加载歌单歌曲失败', error);
            this.tracks = [];
            // 同步更新空状态
            this.currentPlaylist.trackIds = [];
            this.currentPlaylist.trackCount = 0;
            this.render();
        }
    }

    renderTrackList(): string {
        if (this.tracks.length === 0) {
            return `
                <div class="playlist-empty-state">
                    <div class="empty-content">
                        <div class="empty-illustration">
                            <svg class="empty-icon" viewBox="0 0 24 24">
                                <path d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8.01,12 6,14.01 6,16.5S8.01,21 10.5,21S15,18.99 15,16.5V6H19V3H12Z"/>
                            </svg>
                            <div class="empty-waves">
                                <div class="wave wave-1"></div>
                                <div class="wave wave-2"></div>
                                <div class="wave wave-3"></div>
                            </div>
                        </div>
                        <h3 class="empty-title">歌单还是空的</h3>
                        <p class="empty-description">添加一些您喜欢的音乐，开始您的音乐之旅</p>
                        <button class="empty-action-btn" onclick="document.getElementById('playlist-add-songs').click()">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                            </svg>
                            <span>添加歌曲</span>
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="modern-tracks-table ${this.showCovers ? 'with-covers' : ''}">
                <div class="tracks-table-header">
                    <div class="header-cell cell-number">#</div>
                    ${this.showCovers ? '<div class="header-cell cell-cover">封面</div>' : ''}
                    <div class="header-cell cell-title">歌曲</div>
                    <div class="header-cell cell-album">专辑</div>
                    <div class="header-cell cell-duration">
                        <svg class="duration-icon" viewBox="0 0 24 24">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                        </svg>
                    </div>
                    <div class="header-cell cell-actions"></div>
                </div>
                <div class="tracks-table-body">
                    ${this.tracks.map((track, index) => `
                        <div class="track-row ${this.selectedTracks.has(index) ? 'selected' : ''}" data-track-index="${index}">
                            <div class="track-cell cell-number">
                                <div class="track-number-container">
                                    <span class="track-number">${index + 1}</span>
                                    <div class="play-indicator">
                                        <svg class="play-icon" viewBox="0 0 24 24">
                                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            ${this.showCovers ? `
                            <div class="track-cell cell-cover">
                                <img class="track-cover" src="${this.getTrackCover(track)}" alt="封面" loading="lazy" onerror="this.src='assets/images/default-cover.svg'">
                            </div>
                            ` : ''}
                            <div class="track-cell cell-title">
                                <div class="track-main-info">
                                    <div class="track-name">${this.escapeHtml(track.title || track.fileName)}</div>
                                    <div class="track-artist">${this.escapeHtml(track.artist || '未知艺术家')}</div>
                                </div>
                            </div>
                            <div class="track-cell cell-album">
                                <span class="album-name">${this.escapeHtml(track.album || '未知专辑')}</span>
                            </div>
                            <div class="track-cell cell-duration">
                                <span class="duration-text">${this.formatDuration(track.duration)}</span>
                            </div>
                            <div class="track-cell cell-actions">
                                <div class="track-actions">
                                    <button class="track-action-btn like-btn" data-action="like">
                                        <svg class="icon" viewBox="0 0 24 24">
                                            <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                                        </svg>
                                    </button>
                                    <button class="track-action-btn remove-btn" data-action="remove">
                                        <svg class="icon" viewBox="0 0 24 24">
                                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    setupTrackListEvents(): void {
        if (!this.container) return;
        const trackListContainer = this.container.querySelector('#playlist-track-list');
        if (!trackListContainer) {
            console.warn('⚠️ PlaylistDetailPage: 未找到歌曲列表容器');
            return;
        }

        // 对于空歌单，容器存在但没有歌曲行，这是正常情况
        if (this.tracks && this.tracks.length === 0) {
            return;
        }

        const trackRows = trackListContainer.querySelectorAll('.track-row');
        // 检查是否已经绑定过事件
        if (trackRows.length > 0 && trackRows[0].hasAttribute('data-events-bound')) {
            return;
        }

        // 添加事件监听
        trackRows.forEach((item) => {
            const row = item as HTMLElement;
            const index = parseInt(row.dataset.trackIndex || '0');
            const track = this.tracks[index];

            // 主要点击事件
            row.addEventListener('click', async (e: MouseEvent) => {
                // 如果点击的是操作按钮，不处理
                if ((e.target as HTMLElement | null)?.closest('.track-action-btn')) {
                    return;
                }

                // 多选模式处理
                if (e.ctrlKey || e.metaKey) {
                    this.toggleTrackSelection(index);
                } else if (e.shiftKey && this.selectedTracks.size > 0) {
                    this.selectTrackRange(index);
                } else if (this.isMultiSelectMode) {
                    this.toggleTrackSelection(index);
                }
            });

            // 双击播放
            row.addEventListener('dblclick', async (e: MouseEvent) => {
                if (!(e.target as HTMLElement | null)?.closest('.track-action-btn')) {
                    await this.playTrack(track, index);
                }
            });

            // 右键菜单
            row.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();
                // 右键点击的条目若不在选中集合中，则先选中它
                if (!this.selectedTracks.has(index)) {
                    this.selectedTracks.clear();
                    this.selectedTracks.add(index);
                    this.lastSelectedIndex = index;
                    this.updateMultiSelectMode();
                    this.updateTrackSelectionUI();
                }
                this.showTrackContextMenu(e.clientX, e.clientY, track, index);
            });

            // 操作按钮
            const likeBtn = row.querySelector('[data-action="like"]');
            if (likeBtn) {
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleTrackLike(track, index);
                });
            }

            const removeBtn = row.querySelector('[data-action="remove"]');
            if (removeBtn) {
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (this.selectedTracks.size > 1 && this.selectedTracks.has(index)) {
                        await this.removeSelectedTracks();
                    } else {
                        await this.removeTrackFromPlaylist(track, index);
                    }
                });
            }

            // 标记该行已绑定事件，防止重复绑定
            row.setAttribute('data-events-bound', 'true');
        });
    }

    async playTrack(track: PlaylistDetailTrack, index: number): Promise<void> {
        try {
            app.components.playlist.setTracks(this.tracks, index);
            await app.playTrackFromPlaylist(track, index);
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 播放歌曲失败', error);
        }
    }

    async playAllTracks(): Promise<void> {
        if (this.tracks.length === 0) {
            app.showInfo('歌单为空，无法播放');
            return;
        }
        this.emit('playAllTracks', this.tracks);
    }

    async shufflePlayTracks(): Promise<void> {
        if (this.tracks.length === 0) {
            app.showInfo('歌单为空，无法播放');
            return;
        }

        // 创建随机播放列表
        const shuffledTracks = [...this.tracks].sort(() => Math.random() - 0.5);
        this.emit('playAllTracks', shuffledTracks);
    }

    showAddSongsDialog(): void {
        this.emit('showAddSongsDialog', this.currentPlaylist);
    }

    // 从文件夹添加音乐
    async addFromFolder(): Promise<void> {
        try {
            // 显示进度提示
            app.showInfo('正在选择文件夹...');

            // 打开文件夹选择对话框
            const folderPath = await fileAPI.openDirectory();
            if (!folderPath) {
                return;
            }

            // 显示扫描进度
            app.showInfo('正在扫描文件夹中的音频文件...');

            // 扫描文件夹中的音频文件
            const audioFiles = await this.scanFolderForAudioFiles(folderPath);

            if (audioFiles.length === 0) {
                app.showInfo('在选择的文件夹中未找到音频文件');
                return;
            }

            // 显示添加进度
            app.showInfo(`正在添加 ${audioFiles.length} 首歌曲到歌单...`);

            // 批量添加到歌单
            const result = await this.addTracksToPlaylist(audioFiles);

            // 显示结果
            if (result.success) {
                const successCount = result.successCount || 0;
                const failCount = result.failCount || 0;

                let message = `成功添加 ${successCount} 首歌曲到歌单`;
                if (failCount > 0) {
                    message += `，${failCount} 首歌曲添加失败`;
                }
                app.showSuccess(message);
                await this.loadPlaylistTracks();
                this.emit('playlistUpdated', this.currentPlaylist);
            } else {
                app.showError(result.error || '添加歌曲到歌单失败');
            }

        } catch (error) {
            app.showError('从文件夹添加音乐失败，请重试');
        }
    }

    async clearPlaylist(): Promise<void> {
        if (!this.currentPlaylist || !this.tracks.length) return;

        const confirmMessage = `确定要清空歌单"${this.currentPlaylist.name}"吗？\n这将移除歌单中的所有 ${this.tracks.length} 首歌曲，此操作无法撤销。`;
        const confirmed = await app.confirm({
            title: '清空歌单',
            message: confirmMessage,
            confirmText: '清空',
            type: 'warning'
        });

        if (!confirmed) {
            return;
        }

        try {
            // 批量移除所有歌曲
            const trackIds = this.tracks.map((track) => track.fileId).filter((fileId): fileId is string => Boolean(fileId));
            const result = await libraryAPI.removeFromPlaylist(
                this.currentPlaylist.id,
                trackIds
            );

            if (result.success) {
                // 重新加载歌单
                await this.loadPlaylistTracks();

                // 触发歌单更新事件
                this.emit('playlistUpdated', this.currentPlaylist);

                app.showInfo(`歌单"${this.currentPlaylist.name}"已清空`);
            } else {
                app.showError(result.error || '清空歌单失败');
            }
        } catch (error) {
            app.showError('清空歌单失败，请重试');
        }
    }

    // 多选功能方法
    toggleTrackSelection(index: number): void {
        if (this.selectedTracks.has(index)) {
            this.selectedTracks.delete(index);
        } else {
            this.selectedTracks.add(index);
        }
        this.lastSelectedIndex = index;
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    selectTrackRange(endIndex: number): void {
        const startIndex = this.lastSelectedIndex >= 0 ? this.lastSelectedIndex : endIndex;
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);
        for (let i = min; i <= max; i++) {
            this.selectedTracks.add(i);
        }
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    selectAllTracks(): void {
        this.selectedTracks.clear();
        for (let i = 0; i < this.tracks.length; i++) {
            this.selectedTracks.add(i);
        }
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    clearSelection(): void {
        this.selectedTracks.clear();
        this.lastSelectedIndex = -1;
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    updateMultiSelectMode(): void {
        if (!this.container) return;
        this.isMultiSelectMode = this.selectedTracks.size > 0;

        // 更新清除选择按钮的显示状态
        const clearSelectionBtn = this.container.querySelector('#clear-selection');
        if (clearSelectionBtn) {
            (clearSelectionBtn as HTMLElement).style.display = this.isMultiSelectMode ? 'block' : 'none';
        }

        // 更新全选按钮文本
        const selectAllBtn = this.container.querySelector('#select-all-tracks');
        if (selectAllBtn) {
            if (this.selectedTracks.size === this.tracks.length && this.tracks.length > 0) {
                selectAllBtn.textContent = '取消全选';
                (selectAllBtn as HTMLElement).onclick = () => this.clearSelection();
            } else {
                selectAllBtn.textContent = '全选';
                (selectAllBtn as HTMLElement).onclick = () => this.selectAllTracks();
            }
        }
    }

    updateTrackSelectionUI(): void {
        if (!this.container) return;
        const trackItems = this.container.querySelectorAll('.track-row');
        trackItems.forEach((item) => {
            const row = item as HTMLElement;
            const index = parseInt(row.dataset.trackIndex || '0');
            if (this.selectedTracks.has(index)) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    async removeSelectedTracks(): Promise<void> {
        if (this.selectedTracks.size === 0) return;

        const selectedCount = this.selectedTracks.size;
        const confirmed = await app.confirm({
            title: '移除歌曲',
            message: `确定要从歌单中移除选中的 ${selectedCount} 首歌曲吗？`,
            confirmText: '移除',
            type: 'warning'
        });

        if (!confirmed) {
            return;
        }

        try {
            const selectedIndices = Array.from(this.selectedTracks).sort((a, b) => b - a); // 从后往前删除
            let successCount = 0;
            let failCount = 0;

            for (const index of selectedIndices) {
                const track = this.tracks[index];
                if (track) {
                    try {
                        const result = await libraryAPI.removeFromPlaylist(
                            this.currentPlaylist!.id,
                            track.fileId ? [track.fileId] : []
                        );

                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                            console.warn('❌ 移除歌曲失败:', track.title, result.error);
                        }
                    } catch (error) {
                        failCount++;
                        console.error('❌ 移除歌曲异常:', track.title, error);
                    }
                }
            }

            // 清除选择状态
            this.clearSelection();

            // 重新加载歌单
            await this.loadPlaylistTracks();

            // 触发歌单更新事件
            this.emit('playlistUpdated', this.currentPlaylist);

            if (failCount === 0) {
                app.showInfo(`成功移除 ${successCount} 首歌曲`);
            } else {
                app.showInfo(`移除完成：成功 ${successCount} 首，失败 ${failCount} 首`);
            }
        } catch (error) {
            app.showError('批量移除失败，请重试');
        }
    }

    toggleTrackLike(track: PlaylistDetailTrack, _index: number): void {
        // 可以实现喜欢/取消喜欢功能
        console.log('🎵 切换歌曲喜欢状态:', track.title);
        // TODO: 实现喜欢功能
    }

    async removeTrackFromPlaylist(track: PlaylistDetailTrack, _index: number): Promise<void> {
        if (!confirm(`确定要从歌单中移除 "${track.title}" 吗？`)) {
            return;
        }

        try {
            const result = await libraryAPI.removeFromPlaylist(
                this.currentPlaylist!.id,
                track.fileId ? [track.fileId] : []
            );

            if (result.success) {
                // 重新加载歌单
                await this.loadPlaylistTracks();

                // 触发歌单更新事件
                this.emit('playlistUpdated', this.currentPlaylist);
                app.showInfo(`已从歌单中移除 "${track.title}"`);
            } else {
                app.showError(result.error || '移除失败');
            }
        } catch (error) {
            app.showError('移除失败，请重试');
        }
    }

    calculateTotalDuration(): number {
        if (!this.tracks || this.tracks.length === 0) return 0;

        return this.tracks.reduce((total, track) => {
            return total + (track.duration || 0);
        }, 0);
    }

    formatTotalDuration(totalSeconds: number): string {
        if (!totalSeconds || totalSeconds <= 0) return '0 分钟';

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} 小时 ${minutes} 分钟`;
        } else {
            return `${minutes} 分钟`;
        }
    }

    formatDuration(duration?: number): string {
        if (!duration || duration <= 0) return '--:--';

        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    escapeHtml(text: unknown): string {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    getTrackCover(track: PlaylistDetailTrack): string {
        // 优先使用已缓存的封面
        if (track.cover && typeof track.cover === 'string') {
            return track.cover;
        }

        // 异步获取封面，先返回默认封面
        this.loadTrackCoverAsync(track);
        return 'assets/images/default-cover.svg';
    }

    async loadTrackCoverAsync(track: PlaylistDetailTrack): Promise<void> {
        try {
            // 使用requestIdleCallback优化性能，在浏览器空闲时加载封面
            const loadCover = async () => {
                const coverResult = await coverAPI.getCover(
                    track.title, track.artist, track.album, track.filePath
                ) as CoverResult;

                if (coverResult.success && coverResult.imageUrl && typeof coverResult.imageUrl === 'string') {
                    // // 确保路径格式正确，处理路径
                    let coverUrl = coverResult.imageUrl;

                    // 处理本地文件路径格式
                    if (coverResult.type === 'local-file' && coverResult.filePath) {
                        if (!coverUrl.startsWith('file://')) {
                            coverUrl = coverResult.filePath.replace(/\\/g, '/');
                            if (!coverUrl.startsWith('/')) {
                                coverUrl = '/' + coverUrl;
                            }
                            coverUrl = `file://${coverUrl}`;
                        }
                    }

                    // 更新track对象的封面信息
                    track.cover = coverUrl;

                    // 使用requestAnimationFrame确保DOM更新在下一帧进行
                    requestAnimationFrame(() => {
                        if (!this.container) return;
                        const trackRows = this.container.querySelectorAll('.track-row');
                        trackRows.forEach((row, index) => {
                            const trackRow = row as HTMLElement;
                            if (parseInt(trackRow.dataset.trackIndex || '0') === index && this.tracks[index] === track) {
                                const coverImg = trackRow.querySelector<HTMLImageElement>('.track-cover');
                                if (coverImg) {
                                    coverImg.src = track.cover || 'assets/images/default-cover.svg';
                                }
                            }
                        });
                    });
                } else {
                    console.warn(`⚠️ PlaylistDetailPage: 封面加载失败 - ${track.title}:`, coverResult.error || '未知错误');
                }
            };

            // 如果支持requestIdleCallback，使用它；否则使用setTimeout
            if (window.requestIdleCallback) {
                window.requestIdleCallback(loadCover);
            } else {
                setTimeout(loadCover, 0);
            }
        } catch (error) {
            console.warn('PlaylistDetailPage: 加载封面失败:', error);
        }
    }

    // 渲染歌单封面
    renderPlaylistCover(): string {
        if (this.currentPlaylist && this.currentPlaylist.coverImage) {
            // 如果有自定义封面，显示自定义封面
            return `
                <img class="cover-image" src="file://${this.currentPlaylist.coverImage}" alt="歌单封面" />
            `;
        } else {
            // 显示默认占位符
            return `
                <div class="cover-placeholder">
                    <svg class="cover-icon" viewBox="0 0 24 24">
                        <path d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>
                    </svg>
                </div>
            `;
        }
    }

    // 设置封面右键菜单事件监听器
    setupCoverContextMenu(): void {
        if (!this.container) return;
        const coverElement = this.container.querySelector('#playlist-cover');
        if (!coverElement) return;

        coverElement.addEventListener('contextmenu', (e) => {
            const mouseEvent = e as MouseEvent;
            e.preventDefault();
            this.showCoverContextMenu(mouseEvent.clientX, mouseEvent.clientY);
        });

        coverElement.addEventListener('dblclick', (e) => {
            const mouseEvent = e as MouseEvent;
            this.showCoverContextMenu(mouseEvent.clientX, mouseEvent.clientY);
        });
    }

    // 显示封面右键菜单
    showCoverContextMenu(x: number, y: number): void {
        // 移除现有的菜单
        this.hideCoverContextMenu();

        const hasCustomCover = this.currentPlaylist && this.currentPlaylist.coverImage;

        const menu = document.createElement('div');
        menu.className = 'cover-context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" id="add-cover">
                <svg class="menu-icon" viewBox="0 0 24 24">
                    <path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/>
                </svg>
                <span>${hasCustomCover ? '更换封面' : '添加封面'}</span>
            </div>
            ${hasCustomCover ? `
            <div class="context-menu-item" id="remove-cover">
                <svg class="menu-icon" viewBox="0 0 24 24">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
                <span>移除封面</span>
            </div>
            ` : ''}
        `;

        // 设置菜单位置
        menu.style.position = 'fixed';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.zIndex = '10000';

        document.body.appendChild(menu);

        // 调整菜单位置，确保不超出屏幕
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }

        // 添加菜单项事件监听器
        const addCoverItem = menu.querySelector('#add-cover');
        const removeCoverItem = menu.querySelector('#remove-cover');

        if (addCoverItem) {
            addCoverItem.addEventListener('click', async () => {
                this.hideCoverContextMenu();
                await this.selectAndSetCover();
            });
        }

        if (removeCoverItem) {
            removeCoverItem.addEventListener('click', async () => {
                this.hideCoverContextMenu();
                await this.removeCover();
            });
        }

        // 点击外部关闭菜单
        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                this.hideCoverContextMenu();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    // 隐藏封面右键菜单
    hideCoverContextMenu(): void {
        const existingMenu = document.querySelector('.cover-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    // 选择并设置封面
    async selectAndSetCover(): Promise<void> {
        try {
            const result = await fileAPI.selectImageFile();
            if (result.success && result.path) {
                console.log('✅ 选择的图片路径:', result.path);
                await this.setCover(result.path);
            }
        } catch (error) {
            app.showError('选择图片失败，请重试');
        }
    }

    // 设置歌单封面
    async setCover(imagePath: string): Promise<void> {
        if (!this.currentPlaylist) return;
        try {
            if (!this.isValidImageFile(imagePath)) {
                throw new Error('不支持的图片格式，请选择 JPG、PNG、GIF、WebP 或 BMP 格式的图片');
            }

            console.log(`🖼️ 设置歌单封面: ${this.currentPlaylist.id} -> ${imagePath}`);
            const result = await api.updatePlaylistCover(this.currentPlaylist.id, imagePath);

            if (result.success) {
                // 更新当前歌单对象
                this.currentPlaylist.coverImage = imagePath;
                this.updateCoverDisplay();

                // 触发歌单更新事件
                this.emit('playlistUpdated', this.currentPlaylist);
                this.emit('playlistCoverUpdated', this.currentPlaylist);
                app.showInfo('歌单封面设置成功');
            } else {
                throw new Error(result.error || '设置封面失败');
            }
        } catch (error) {
            app.showError(getErrorMessage(error) || '设置封面失败，请重试');
        }
    }

    // 移除歌单封面
    async removeCover(): Promise<void> {
        if (!this.currentPlaylist) return;
        try {
            if (!confirm('确定要移除歌单封面吗？')) {
                return;
            }

            console.log(`🗑️ 移除歌单封面: ${this.currentPlaylist.id}`);
            const result = await api.removePlaylistCover(this.currentPlaylist.id);

            if (result.success) {
                // 更新当前歌单对象
                this.currentPlaylist.coverImage = null;
                this.updateCoverDisplay();

                // 触发歌单更新事件
                this.emit('playlistUpdated', this.currentPlaylist);
                this.emit('playlistCoverUpdated', this.currentPlaylist);
                app.showInfo('歌单封面已移除');
            } else {
                throw new Error(result.error || '移除封面失败');
            }
        } catch (error) {
            app.showError(getErrorMessage(error) || '移除封面失败，请重试');
        }
    }

    // 更新封面显示
    updateCoverDisplay(): void {
        if (!this.container) return;
        const coverElement = this.container.querySelector('#playlist-cover');
        if (coverElement) {
            coverElement.innerHTML = this.renderPlaylistCover() + '<div class="cover-shadow"></div>';
        }
    }

    // 验证图片文件
    isValidImageFile(filePath: unknown): filePath is string {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        return validExtensions.includes(extension);
    }

    showTrackContextMenu(x: number, y: number, track: PlaylistDetailTrack, index: number): void {
        const contextMenu = app.components.contextMenu;
        contextMenu.show(x, y, track, index, this.selectedTracks);
    }

    // 扫描文件夹中的音频文件
    async scanFolderForAudioFiles(folderPath: string): Promise<any[]> {
        try {
            const result = await libraryAPI.scanDirectoryForFiles(folderPath);
            if (result && result.success && result.files) {
                return result.files;
            } else {
                console.warn('📁 扫描文件夹失败或未找到音频文件');
                return [];
            }
        } catch (error) {
            console.error('❌ 扫描文件夹失败:', error);
            return [];
        }
    }

    // 批量添加音频文件到歌单
    async addTracksToPlaylist(audioFiles: any[]): Promise<AddTracksResult> {
        try {
            if (!this.currentPlaylist || !audioFiles || audioFiles.length === 0) {
                return {success: false, error: '无效的参数'};
            }

            let successCount = 0;
            let failCount = 0;
            const errors: string[] = [];

            // 批量处理音频文件
            for (const audioFile of audioFiles) {
                try {
                    // 首先确保文件在音乐库中
                    const addToLibraryResult = await libraryAPI.addTrackToLibrary(audioFile);
                    if (addToLibraryResult && addToLibraryResult.success && addToLibraryResult.track) {
                        // 添加到歌单
                        const addToPlaylistResult = await libraryAPI.addToPlaylist(
                            this.currentPlaylist.id,
                            addToLibraryResult.track.fileId ? [addToLibraryResult.track.fileId] : []
                        );

                        if (addToPlaylistResult && addToPlaylistResult.success) {
                            successCount++;
                        } else {
                            failCount++;
                            const error = `添加到歌单失败: ${audioFile.fileName || audioFile.filePath}`;
                            errors.push(error);
                            console.warn(`⚠️ ${error}`);
                        }
                    } else {
                        failCount++;
                        const error = `添加到音乐库失败: ${audioFile.fileName || audioFile.filePath}`;
                        errors.push(error);
                        console.warn(`⚠️ ${error}`);
                    }
                } catch (error) {
                    failCount++;
                    const errorMsg = `处理文件失败: ${audioFile.fileName || audioFile.filePath} - ${getErrorMessage(error)}`;
                    errors.push(errorMsg);
                    console.error(`❌ ${errorMsg}`);
                }
            }

            return {
                success: successCount > 0,
                successCount,
                failCount,
                errors,
                totalCount: audioFiles.length
            };
        } catch (error) {
            console.error('❌ 批量添加音频文件到歌单失败:', error);
            return {
                success: false,
                error: getErrorMessage(error) || '批量添加失败',
                successCount: 0,
                failCount: audioFiles ? audioFiles.length : 0
            };
        }
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export { PlaylistDetailPage };
