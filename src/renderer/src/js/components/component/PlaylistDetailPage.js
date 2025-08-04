/**
 * 歌单页组件
 */

class PlaylistDetailPage extends Component {
    constructor(container) {
        super(container);
        this.isVisible = false;
        this.currentPlaylist = null;
        this.tracks = [];
        this.selectedTracks = new Set();
        this.isMultiSelectMode = false;

        this.setupElements();
        this.setupEventListeners();

        console.log('🎵 PlaylistDetailPage: 组件初始化完成');
    }

    setupElements() {
        this.container = this.element;
    }

    setupEventListeners() {
        // 事件监听将在render方法中动态添加
    }

    async show(playlist) {
        this.isVisible = true;
        this.currentPlaylist = playlist;

        if (this.element) {
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
        if (this.element) {
            requestAnimationFrame(() => {
                this.element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                this.element.style.opacity = '1';
                this.element.style.transform = 'translateY(0)';
            });
        }

        console.log('🎵 PlaylistDetailPage: 显示歌单详情', playlist.name);
    }

    hide() {
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
        console.log('🎵 PlaylistDetailPage: 隐藏歌单详情');
    }

    render() {
        if (!this.currentPlaylist || !this.container) return;

        const createdDate = new Date(this.currentPlaylist.createdAt);
        const trackCount = this.currentPlaylist.trackIds ? this.currentPlaylist.trackIds.length : 0;
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

    setupDynamicEventListeners() {
        console.log('🔧 PlaylistDetailPage: 设置动态事件监听器');

        // 播放全部按钮
        const playAllBtn = this.container.querySelector('#playlist-play-all');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => this.playAllTracks());
            console.log('✅ 绑定播放全部按钮事件');
        }

        // 随机播放按钮
        const shuffleBtn = this.container.querySelector('#playlist-shuffle');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.shufflePlayTracks());
            console.log('✅ 绑定随机播放按钮事件');
        }

        // 添加歌曲按钮
        const addSongsBtn = this.container.querySelector('#playlist-add-songs');
        if (addSongsBtn) {
            addSongsBtn.addEventListener('click', () => this.showAddSongsDialog());
            console.log('✅ 绑定添加歌曲按钮事件');
        } else {
            console.warn('⚠️ 未找到添加歌曲按钮元素');
        }

        // 全选按钮
        const selectAllBtn = this.container.querySelector('#select-all-tracks');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllTracks());
        }

        // 清除选择按钮
        const clearSelectionBtn = this.container.querySelector('#clear-selection');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        }

        // 菜单按钮
        const menuBtn = this.container.querySelector('#playlist-menu');
        const menuDropdown = this.container.querySelector('#playlist-menu-dropdown');
        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('show');
                console.log('🔧 菜单按钮点击，切换显示状态');
            });
            console.log('✅ 绑定菜单按钮事件');

            // 设置document点击监听器（每次都重新设置，因为DOM已重新生成）
            this.setupDocumentClickHandler(menuDropdown);

            // 菜单项事件
            const clearBtn = menuDropdown.querySelector('#playlist-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', async () => {
                    menuDropdown.classList.remove('show');
                    console.log('🔧 清空歌单按钮点击');
                    await this.clearPlaylist();
                });
                console.log('✅ 绑定清空歌单按钮事件');
            } else {
                console.warn('⚠️ 未找到清空歌单按钮元素');
            }
        } else {
            console.warn('⚠️ 未找到菜单按钮或下拉菜单元素');
        }

        // setupTrackListEvents() 已在 render() 方法中调用，这里不需要重复调用
        this.setupCoverContextMenu();
    }

    // 设置document点击监听器，避免重复绑定
    setupDocumentClickHandler(menuDropdown) {
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
        console.log('✅ 设置document点击监听器');
    }

    async loadPlaylistCover() {
        try {
            const result = await api.getPlaylistCover(this.currentPlaylist.id);
            if (result.success && result.coverPath) {
                this.currentPlaylist.coverImage = result.coverPath;
                console.log('✅ PlaylistDetailPage: 加载歌单封面成功', result.coverPath);
            } else {
                this.currentPlaylist.coverImage = null;
                console.log('📷 PlaylistDetailPage: 歌单无自定义封面');
            }
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 加载歌单封面失败', error);
            this.currentPlaylist.coverImage = null;
        }
    }

    async loadPlaylistTracks() {
        try {
            const result = await window.electronAPI.library.getPlaylistDetail(this.currentPlaylist.id);
            if (result.success) {
                this.tracks = result.playlist.tracks || [];
                this.render();
                // 确保DOM更新后再绑定事件
                setTimeout(() => {
                    this.setupTrackListEvents();
                }, 50);
            } else {
                console.error('❌ PlaylistDetailPage: 加载歌单歌曲失败', result.error);
                this.tracks = [];
                this.render();
            }
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 加载歌单歌曲失败', error);
            this.tracks = [];
            this.render();
        }
    }

    renderTrackList() {
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
            <div class="modern-tracks-table">
                <div class="tracks-table-header">
                    <div class="header-cell cell-number">#</div>
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

    setupTrackListEvents() {
        const trackListContainer = this.container.querySelector('#playlist-track-list');
        if (!trackListContainer) {
            console.warn('⚠️ PlaylistDetailPage: 未找到歌曲列表容器');
            return;
        }

        // 对于空歌单，容器存在但没有歌曲行，这是正常情况
        if (this.tracks && this.tracks.length === 0) {
            console.log('📝 PlaylistDetailPage: 歌单为空，跳过歌曲行事件绑定');
            return;
        }

        const trackRows = trackListContainer.querySelectorAll('.track-row');
        console.log(`🔧 PlaylistDetailPage: 设置歌曲列表事件监听器，共 ${trackRows.length} 首歌曲`);

        // 添加事件监听
        trackRows.forEach(item => {
            const index = parseInt(item.dataset.trackIndex);
            const track = this.tracks[index];

            // 主要点击事件
            item.addEventListener('click', async (e) => {
                // 如果点击的是操作按钮，不处理
                if (e.target.closest('.track-action-btn')) {
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
            item.addEventListener('dblclick', async (e) => {
                if (!e.target.closest('.track-action-btn')) {
                    await this.playAllTracks();
                    // await this.playTrack(track, index);
                }
            });

            // 操作按钮
            const likeBtn = item.querySelector('[data-action="like"]');
            if (likeBtn) {
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleTrackLike(track, index);
                });
            }

            const removeBtn = item.querySelector('[data-action="remove"]');
            if (removeBtn) {
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    console.log(`🔧 删除按钮点击: ${track.title} (索引: ${index})`);
                    if (this.selectedTracks.size > 1 && this.selectedTracks.has(index)) {
                        console.log('🔧 执行批量删除');
                        await this.removeSelectedTracks();
                    } else {
                        console.log('🔧 执行单首歌曲删除');
                        await this.removeTrackFromPlaylist(track, index);
                    }
                });
                console.log(`✅ 绑定删除按钮事件: ${track.title}`);
            }
        });
    }

    async playTrack(track, index) {
        try {
            console.log('🎵 PlaylistDetailPage: 播放歌曲', track.title);
            this.emit('trackPlayed', track, index);
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 播放歌曲失败', error);
        }
    }

    async playAllTracks() {
        if (this.tracks.length === 0) {
            if (window.app && window.app.showInfo) {
                window.app.showInfo('歌单为空，无法播放');
            }
            return;
        }
        try {
            console.log('🎵 PlaylistDetailPage: 播放全部歌曲');
            this.emit('playAllTracks', this.tracks);
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 播放全部失败', error);
        }
    }

    async shufflePlayTracks() {
        if (this.tracks.length === 0) {
            if (window.app && window.app.showInfo) {
                window.app.showInfo('歌单为空，无法播放');
            }
            return;
        }

        try {
            // 创建随机播放列表
            const shuffledTracks = [...this.tracks].sort(() => Math.random() - 0.5);
            console.log('🎵 PlaylistDetailPage: 随机播放歌曲');
            this.emit('playAllTracks', shuffledTracks);
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 随机播放失败', error);
        }
    }

    showAddSongsDialog() {
        this.emit('showAddSongsDialog', this.currentPlaylist);
    }

    async clearPlaylist() {
        if (!this.currentPlaylist || !this.tracks.length) return;

        const confirmMessage = `确定要清空歌单"${this.currentPlaylist.name}"吗？\n这将移除歌单中的所有 ${this.tracks.length} 首歌曲，此操作无法撤销。`;
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // 批量移除所有歌曲
            const trackIds = this.tracks.map(track => track.fileId);
            const result = await window.electronAPI.library.removeFromPlaylist(
                this.currentPlaylist.id,
                trackIds
            );

            if (result.success) {
                console.log('✅ 歌单清空成功');

                // 重新加载歌单
                await this.loadPlaylistTracks();
                this.render();

                // 触发歌单更新事件
                this.emit('playlistUpdated', this.currentPlaylist);

                if (window.app && window.app.showInfo) {
                    window.app.showInfo(`歌单"${this.currentPlaylist.name}"已清空`);
                }
            } else {
                console.error('❌ 清空歌单失败:', result.error);
                if (window.app && window.app.showError) {
                    window.app.showError(result.error || '清空歌单失败');
                }
            }
        } catch (error) {
            console.error('❌ 清空歌单异常:', error);
            if (window.app && window.app.showError) {
                window.app.showError('清空歌单失败，请重试');
            }
        }
    }

    // 多选功能方法
    toggleTrackSelection(index) {
        if (this.selectedTracks.has(index)) {
            this.selectedTracks.delete(index);
        } else {
            this.selectedTracks.add(index);
        }

        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    selectTrackRange(endIndex) {
        const selectedIndices = Array.from(this.selectedTracks);
        if (selectedIndices.length === 0) {
            this.selectedTracks.add(endIndex);
        } else {
            const startIndex = Math.max(...selectedIndices);
            const minIndex = Math.min(startIndex, endIndex);
            const maxIndex = Math.max(startIndex, endIndex);

            for (let i = minIndex; i <= maxIndex; i++) {
                this.selectedTracks.add(i);
            }
        }
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    selectAllTracks() {
        this.selectedTracks.clear();
        for (let i = 0; i < this.tracks.length; i++) {
            this.selectedTracks.add(i);
        }
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    clearSelection() {
        this.selectedTracks.clear();
        this.updateMultiSelectMode();
        this.updateTrackSelectionUI();
    }

    updateMultiSelectMode() {
        this.isMultiSelectMode = this.selectedTracks.size > 0;

        // 更新清除选择按钮的显示状态
        const clearSelectionBtn = this.container.querySelector('#clear-selection');
        if (clearSelectionBtn) {
            clearSelectionBtn.style.display = this.isMultiSelectMode ? 'block' : 'none';
        }

        // 更新全选按钮文本
        const selectAllBtn = this.container.querySelector('#select-all-tracks');
        if (selectAllBtn) {
            if (this.selectedTracks.size === this.tracks.length && this.tracks.length > 0) {
                selectAllBtn.textContent = '取消全选';
                selectAllBtn.onclick = () => this.clearSelection();
            } else {
                selectAllBtn.textContent = '全选';
                selectAllBtn.onclick = () => this.selectAllTracks();
            }
        }
    }

    updateTrackSelectionUI() {
        const trackItems = this.container.querySelectorAll('.playlist-track-item');
        trackItems.forEach((item, index) => {
            if (this.selectedTracks.has(index)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    async removeSelectedTracks() {
        if (this.selectedTracks.size === 0) return;

        const selectedCount = this.selectedTracks.size;
        if (!confirm(`确定要从歌单中移除选中的 ${selectedCount} 首歌曲吗？`)) {
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
                        const result = await window.electronAPI.library.removeFromPlaylist(
                            this.currentPlaylist.id,
                            track.fileId
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

            console.log(`✅ 批量移除歌曲完成: 成功 ${successCount}, 失败 ${failCount}`);

            // 清除选择状态
            this.clearSelection();

            // 重新加载歌单
            await this.loadPlaylistTracks();
            this.render();

            // 触发歌单更新事件
            this.emit('playlistUpdated', this.currentPlaylist);

            if (window.app && window.app.showInfo) {
                if (failCount === 0) {
                    window.app.showInfo(`成功移除 ${successCount} 首歌曲`);
                } else {
                    window.app.showInfo(`移除完成：成功 ${successCount} 首，失败 ${failCount} 首`);
                }
            }
        } catch (error) {
            console.error('❌ 批量移除歌曲失败:', error);
            if (window.app && window.app.showError) {
                window.app.showError('批量移除失败，请重试');
            }
        }
    }

    toggleTrackLike(track, index) {
        // 可以实现喜欢/取消喜欢功能
        console.log('🎵 切换歌曲喜欢状态:', track.title);
        // TODO: 实现喜欢功能
    }

    async removeTrackFromPlaylist(track, index) {
        if (!confirm(`确定要从歌单中移除 "${track.title}" 吗？`)) {
            return;
        }

        try {
            const result = await window.electronAPI.library.removeFromPlaylist(
                this.currentPlaylist.id,
                track.fileId
            );

            if (result.success) {
                console.log('✅ PlaylistDetailPage: 歌曲已从歌单移除');

                // 重新加载歌单
                await this.loadPlaylistTracks();
                this.currentPlaylist.trackIds = this.currentPlaylist.trackIds.filter(id => id !== track.fileId);
                this.render();

                // 触发歌单更新事件
                this.emit('playlistUpdated', this.currentPlaylist);

                if (window.app && window.app.showInfo) {
                    window.app.showInfo(`已从歌单中移除 "${track.title}"`);
                }
            } else {
                console.error('❌ PlaylistDetailPage: 移除歌曲失败', result.error);
                if (window.app && window.app.showError) {
                    window.app.showError(result.error || '移除失败');
                }
            }
        } catch (error) {
            console.error('❌ PlaylistDetailPage: 移除歌曲失败', error);
            if (window.app && window.app.showError) {
                window.app.showError('移除失败，请重试');
            }
        }
    }

    calculateTotalDuration() {
        if (!this.tracks || this.tracks.length === 0) return 0;

        return this.tracks.reduce((total, track) => {
            return total + (track.duration || 0);
        }, 0);
    }

    formatTotalDuration(totalSeconds) {
        if (!totalSeconds || totalSeconds <= 0) return '0 分钟';

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} 小时 ${minutes} 分钟`;
        } else {
            return `${minutes} 分钟`;
        }
    }

    formatDuration(duration) {
        if (!duration || duration <= 0) return '--:--';

        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 渲染歌单封面
    renderPlaylistCover() {
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
    setupCoverContextMenu() {
        const coverElement = this.container.querySelector('#playlist-cover');
        if (!coverElement) return;

        coverElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showCoverContextMenu(e.clientX, e.clientY);
        });
    }

    // 显示封面右键菜单
    showCoverContextMenu(x, y) {
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
            removeCoverItem.addEventListener('click', async() => {
                this.hideCoverContextMenu();
                await this.removeCover();
            });
        }

        // 点击外部关闭菜单
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                this.hideCoverContextMenu();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    // 隐藏封面右键菜单
    hideCoverContextMenu() {
        const existingMenu = document.querySelector('.cover-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    // 选择并设置封面
    async selectAndSetCover() {
        try {
            console.log('🖼️ 选择歌单封面图片...');
            const result = await api.selectImageFile();

            if (result.success && result.path) {
                console.log('✅ 选择的图片路径:', result.path);
                await this.setCover(result.path);
            } else {
                console.log('❌ 用户取消选择图片');
            }
        } catch (error) {
            console.error('❌ 选择封面图片失败:', error);
            if (window.app && window.app.showError) {
                window.app.showError('选择图片失败，请重试');
            }
        }
    }

    // 设置歌单封面
    async setCover(imagePath) {
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
                console.log('✅ 歌单封面设置成功');
                if (window.app && window.app.showInfo) {
                    window.app.showInfo('歌单封面设置成功');
                }
            } else {
                throw new Error(result.error || '设置封面失败');
            }
        } catch (error) {
            console.error('❌ 设置歌单封面失败:', error);
            if (window.app && window.app.showError) {
                window.app.showError(error.message || '设置封面失败，请重试');
            }
        }
    }

    // 移除歌单封面
    async removeCover() {
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
                console.log('✅ 歌单封面移除成功');
                if (window.app && window.app.showInfo) {
                    window.app.showInfo('歌单封面已移除');
                }
            } else {
                throw new Error(result.error || '移除封面失败');
            }
        } catch (error) {
            console.error('❌ 移除歌单封面失败:', error);
            if (window.app && window.app.showError) {
                window.app.showError(error.message || '移除封面失败，请重试');
            }
        }
    }

    // 更新封面显示
    updateCoverDisplay() {
        const coverElement = this.container.querySelector('#playlist-cover');
        if (coverElement) {
            coverElement.innerHTML = this.renderPlaylistCover() + '<div class="cover-shadow"></div>';
        }
    }

    // 验证图片文件
    isValidImageFile(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return false;
        }

        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        return validExtensions.includes(extension);
    }
}
