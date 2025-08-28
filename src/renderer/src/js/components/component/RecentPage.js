/**
 * 最近播放页组件
 */

class RecentPage extends Component {
    constructor(container) {
        super(container);
        this.recentTracks = [];
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    async show() {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupAPIListeners();
            this.listenersSetup = true;
        }
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.isVisible = true;
        this.loadPlayHistory();
        this.render();
    }

    hide() {
        this.isVisible = false;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy() {
        this.recentTracks = [];
        this.listenersSetup = false;
        return super.destroy();
    }

    setupElements() {
        this.container = this.element;
    }

    setupAPIListeners() {
        // 监听播放历史更新
        this.addAPIEventListenerManaged('trackChanged', (track) => {
            this.updatePlayHistory(track);
        });
    }

    loadPlayHistory() {
        const history = window.cacheManager.getLocalCache('musicbox-play-history');
        if (history) {
            try {
                this.recentTracks = history;
            } catch (error) {
                console.error('加载播放历史失败:', error);
                this.recentTracks = [];
            }
        } else {
            this.recentTracks = [];
        }
    }

    updatePlayHistory(track) {
        if (!track || !track.filePath) return;

        let history = [];
        const stored = window.cacheManager.getLocalCache('musicbox-play-history')
        if (stored) {
            history = stored;
        }

        // 移除重复项
        history = history.filter(item => item.filePath !== track.filePath);

        // 添加到开头
        history.unshift({
            ...track,
            playTime: Date.now()
        });

        // 限制历史记录数量
        history = history.slice(0, 100);
        window.cacheManager.setLocalCache('musicbox-play-history', history);
        this.recentTracks = history;
    }

    // 清空播放历史
    clearHistory() {
        try {
            window.cacheManager.removeLocalCache('musicbox-play-history');
            this.recentTracks = [];
            this.render();
        } catch (error) {
            console.error('❌ RecentPage: 清空播放历史失败:', error);
        }
    }

    // 移除单个历史记录
    removeHistoryItem(trackPath) {
        try {
            let history = window.cacheManager.getLocalCache('musicbox-play-history') || [];
            history = history.filter(item => item.filePath !== trackPath);

            window.cacheManager.setLocalCache('musicbox-play-history', history);
            this.recentTracks = history;
            this.render();
        } catch (error) {
            console.error('❌ RecentPage: 移除历史记录失败:', error);
        }
    }

    render() {
        if (!this.container) return;

        // 按日期分组
        const groupedTracks = this.groupTracksByDate();

        this.container.innerHTML = `
            <div class="page-content recent-page">
                <!-- 页面头部 -->
                <div class="hero-section">
                    <div class="hero-content">
                        <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 12px;">
                            <svg style="width: 40px; height: 40px; margin-right: 16px; vertical-align: middle;" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z"/>
                            </svg>
                            最近播放
                        </h1>
                        <p style="font-size: 18px; opacity: 0.9; margin-bottom: 0;">
                            共 ${this.recentTracks.length} 首歌曲 · 记录您的音乐足迹
                        </p>
                    </div>
                </div>

                ${this.recentTracks.length > 0 ? `
                    <div class="recent-actions">
                        <button class="action-btn" id="play-all-recent">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                            </svg>
                            播放全部
                        </button>
                        <button class="action-btn secondary" id="clear-history">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                            </svg>
                            清空历史
                        </button>
                    </div>

                    <div class="recent-content">
                        ${Object.entries(groupedTracks).map(([date, tracks]) => `
                            <div class="date-group">
                                <div class="date-header">
                                    <h3 class="date-title">${date}</h3>
                                    <span class="date-count">${tracks.length} 首</span>
                                </div>
                                <div class="track-list">
                                    ${tracks.map((track, index) => this.renderTrackItem(track, index)).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <svg viewBox="0 0 24 24">
                                <path d="M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z"/>
                            </svg>
                        </div>
                        <h3 class="empty-title">暂无播放历史</h3>
                        <p class="empty-description">开始播放音乐后，这里会显示您的播放历史</p>
                        <button class="primary-button" id="go-to-library">浏览音乐库</button>
                    </div>
                `}
            </div>
        `;

        this.setupPageEventListeners();

        // 预加载当前显示的歌曲封面
        this.preloadVisibleCovers();
    }

    groupTracksByDate() {
        const groups = {};
        const now = new Date();

        this.recentTracks.forEach(track => {
            const playDate = new Date(track.playTime || Date.now());
            const diffDays = Math.floor((now - playDate) / (1000 * 60 * 60 * 24));

            let dateKey;
            if (diffDays === 0) {
                dateKey = '今天';
            } else if (diffDays === 1) {
                dateKey = '昨天';
            } else if (diffDays < 7) {
                dateKey = `${diffDays} 天前`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                dateKey = `${weeks} 周前`;
            } else {
                dateKey = playDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long'
                });
            }

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(track);
        });

        return groups;
    }

    renderTrackItem(track, index) {
        const playTime = new Date(track.playTime || Date.now());
        const timeStr = playTime.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="track-item" data-track-path="${track.filePath}" data-index="${index}">
                <div class="track-cover">
                    <img src="${this.getTrackCover(track)}" alt="封面" loading="lazy" onerror="this.src='assets/images/default-cover.svg'">
                    <div class="track-overlay">
                        <button class="play-btn">
                            <svg viewBox="0 0 24 24">
                                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="track-info">
                    <div class="track-title" title="${track.title}">${track.title}</div>
                    <div class="track-meta">
                        <span class="track-artist" title="${track.artist}">${track.artist}</span>
                        <span class="track-separator">•</span>
                        <span class="track-album" title="${track.album}">${track.album}</span>
                    </div>
                </div>
                <div class="track-time">
                    <span class="play-time">${timeStr}</span>
                    <span class="track-duration">${formatTime(track.duration || 0)}</span>
                </div>
                <div class="track-actions">
                    <button class="action-btn small" title="添加到播放列表">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                    </button>
                    <button class="action-btn small">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    getTrackCover(track) {
        // 优先使用已缓存的封面
        if (track.cover && typeof track.cover === 'string') {
            return track.cover;
        }

        // 异步获取封面，先返回默认封面
        this.loadTrackCoverAsync(track);
        return 'assets/images/default-cover.svg';
    }

    async loadTrackCoverAsync(track) {
        try {
            // 使用requestIdleCallback优化性能，在浏览器空闲时加载封面
            const loadCover = async () => {
                const coverResult = await window.api.getCover(
                    track.title, track.artist, track.album
                );

                if (coverResult.success && coverResult.filePath) {
                    // 确保路径格式正确，处理路径
                    let coverPath = coverResult.filePath;

                    // 如果路径不是以file://开头，添加协议前缀
                    if (!coverPath.startsWith('file://')) {
                        // 处理路径中的反斜杠
                        coverPath = coverPath.replace(/\\/g, '/');
                        // 确保路径以/开头（对于绝对路径）
                        if (!coverPath.startsWith('/')) {
                            coverPath = '/' + coverPath;
                        }
                        coverPath = `file://${coverPath}`;
                    }

                    // 更新track对象的封面信息
                    track.cover = coverPath;
                    console.log(`✅ RecentPage: 封面加载成功 - ${track.title}, 路径: ${track.cover}`);

                    // 使用requestAnimationFrame确保DOM更新在下一帧进行
                    requestAnimationFrame(() => {
                        const trackItems = this.container.querySelectorAll('.track-item');
                        trackItems.forEach((item, index) => {
                            const itemIndex = parseInt(item.dataset.index);
                            if (this.recentTracks[itemIndex] === track) {
                                const coverImg = item.querySelector('.track-cover img');
                                if (coverImg) {
                                    coverImg.src = track.cover;
                                    console.log(`🖼️ RecentPage: 更新封面图片 - ${track.title}`);
                                }
                            }
                        });
                    });
                } else {
                    console.warn(`⚠️ RecentPage: 封面加载失败 - ${track.title}:`, coverResult.error || '未知错误');
                }
            };

            // 如果支持requestIdleCallback，使用它；否则使用setTimeout
            if (window.requestIdleCallback) {
                window.requestIdleCallback(loadCover);
            } else {
                setTimeout(loadCover, 0);
            }
        } catch (error) {
            console.warn('RecentPage: 加载封面失败:', error);
        }
    }

    preloadVisibleCovers() {
        // 预加载当前页面显示的所有歌曲封面
        if (this.recentTracks.length > 0 && window.localCoverManager) {
            console.log(`🖼️ RecentPage: 开始预加载 ${this.recentTracks.length} 首最近播放歌曲的封面`);

            // 为每首歌曲触发封面加载
            this.recentTracks.forEach(track => {
                if (!track.cover) {
                    this.loadTrackCoverAsync(track);
                }
            });
        }
    }

    setupPageEventListeners() {
        // 播放全部按钮
        const playAllBtn = this.container.querySelector('#play-all-recent');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => {
                if (this.recentTracks.length > 0) {
                    this.emit('playAll', this.recentTracks);
                }
            });
        }

        // 清空历史按钮
        const clearBtn = this.container.querySelector('#clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空播放历史吗？此操作无法撤销。')) {
                    this.clearHistory();
                }
            });
        }

        // 去音乐库按钮
        const goToLibraryBtn = this.container.querySelector('#go-to-library');
        if (goToLibraryBtn) {
            goToLibraryBtn.addEventListener('click', () => {
                this.emit('viewChange', 'library');
            });
        }

        // 歌曲项目事件
        this.container.querySelectorAll('.track-item').forEach(item => {
            const trackPath = item.dataset.trackPath;
            const index = parseInt(item.dataset.index);
            const track = this.recentTracks[index];

            if (!track) return;

            // 播放按钮
            const playBtn = item.querySelector('.play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emit('trackPlayed', track, index);
                });
            }

            // 双击播放
            item.addEventListener('dblclick', () => {
                this.emit('trackPlayed', track, index);
            });

            // 添加到播放列表
            const addBtn = item.querySelector('.track-actions .action-btn:first-child');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emit('addToPlaylist', track);
                });
            }

            // 从历史中移除
            const removeBtn = item.querySelector('.track-actions .action-btn:last-child');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const track = this.recentTracks[index];
                    if (track && confirm(`确定要从历史中移除 "${track.title}" 吗？`)) {
                        this.removeHistoryItem(track.filePath);
                    }
                });
            }
        });
    }
}

window.components.component.RecentPage = RecentPage;
