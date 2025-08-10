/**
 * 艺术家页组件
 */

class ArtistsPage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.artists = [];
        this.selectedArtist = null;
        this.viewMode = 'grid'; // grid or list
        this.setupElements();
        this.setupEventListeners();
    }

    setupElements() {
        this.container = this.element;
    }

    setupEventListeners() {
        // 监听音乐库更新
        api.on('libraryUpdated', (tracks) => {
            this.tracks = tracks;
            this.processArtists();
            if (this.isVisible) {
                this.render();
            }
        });
    }

    async show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.isVisible = true;
        this.tracks = await api.getTracks();
        this.processArtists();
        this.render();
    }

    hide() {
        this.isVisible = false;
        this.selectedArtist = null;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    processArtists() {
        const artistMap = new Map();

        this.tracks.forEach(track => {
            const artistName = track.artist || '未知艺术家';

            if (!artistMap.has(artistName)) {
                artistMap.set(artistName, {
                    name: artistName,
                    tracks: [],
                    albums: new Set(),
                    totalDuration: 0,
                    cover: null
                });
            }

            const artist = artistMap.get(artistName);
            artist.tracks.push(track);
            artist.totalDuration += track.duration || 0;

            if (track.album) {
                artist.albums.add(track.album);
            }

            // 使用第一个有封面的歌曲作为艺术家封面
            if (!artist.cover && track.cover) {
                artist.cover = track.cover;
            }
        });

        this.artists = Array.from(artistMap.values())
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }

    render() {
        if (!this.container) return;

        if (this.selectedArtist) {
            this.renderArtistDetail();
        } else {
            this.renderArtistsList();
        }
    }

    renderArtistsList() {
        this.container.innerHTML = `
            <div class="page-content artists-page">
                <!-- 页面头部 -->
                <div class="hero-section">
                    <div class="hero-content">
                        <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 12px;">
                            <svg style="width: 40px; height: 40px; margin-right: 16px; vertical-align: middle;" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                            </svg>
                            艺术家
                        </h1>
                        <p style="font-size: 18px; opacity: 0.9; margin-bottom: 0;">
                            共 ${this.artists.length} 位艺术家 · 探索您的音乐世界
                        </p>
                    </div>
                </div>

                ${this.artists.length > 0 ? `
                    <div class="artists-controls">
                        <div class="view-controls">
                            <button class="view-btn ${this.viewMode === 'grid' ? 'active' : ''}" data-view="grid">
                                <svg viewBox="0 0 24 24">
                                    <path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3"/>
                                </svg>
                            </button>
                            <button class="view-btn ${this.viewMode === 'list' ? 'active' : ''}" data-view="list">
                                <svg viewBox="0 0 24 24">
                                    <path d="M9,5V9H21V5M9,19H21V15H9M9,14H21V10H9M4,9H8V5H4M4,19H8V15H4M4,14H8V10H4"/>
                                </svg>
                            </button>
                        </div>
                        <div class="sort-controls">
                            <select class="sort-select" id="artist-sort">
                                <option value="name">按名称排序</option>
                                <option value="tracks">按歌曲数排序</option>
                                <option value="duration">按时长排序</option>
                            </select>
                        </div>
                    </div>

                    <div class="content-grid ${this.viewMode === 'grid' ? 'auto-fit' : 'grid-1'}">
                        ${this.artists.map(artist => this.renderModernArtistCard(artist)).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <svg viewBox="0 0 24 24">
                                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                            </svg>
                        </div>
                        <h3 class="empty-title">暂无艺术家</h3>
                        <p class="empty-description">添加一些音乐后，这里会显示艺术家信息</p>
                    </div>
                `}
            </div>
        `;

        this.setupListEventListeners();
    }

    renderModernArtistCard(artist) {
        const albumCount = artist.albums.size;
        const trackCount = artist.tracks.length;

        if (this.viewMode === 'grid') {
            return `
                <div class="music-card artist-card" data-artist="${artist.name}">
                    <img class="card-cover" src="assets/images/default-cover.svg" alt="${artist.name}" loading="lazy" style="border-radius: 50%;">
                    <div class="card-title">${this.escapeHtml(artist.name)}</div>
                    <div class="card-subtitle">${trackCount} 首歌曲 · ${albumCount} 张专辑</div>
                </div>
            `;
        } else {
            return `
                <div class="artist-list-item" data-artist="${artist.name}">
                    <img class="artist-avatar" src="assets/images/default-cover.svg" alt="${artist.name}" loading="lazy">
                    <div class="artist-info">
                        <div class="artist-name">${this.escapeHtml(artist.name)}</div>
                        <div class="artist-stats">${trackCount} 首歌曲 · ${albumCount} 张专辑</div>
                    </div>
                    <button class="play-artist-btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                        </svg>
                    </button>
                </div>
            `;
        }
    }

    renderArtistCard(artist) {
        const albumCount = artist.albums.size;
        const trackCount = artist.tracks.length;

        if (this.viewMode === 'grid') {
            return `
                <div class="artist-card" data-artist="${artist.name}">
                    <div class="artist-cover">
                        <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}" loading="lazy">
                        <div class="artist-overlay">
                            <button class="play-btn" title="播放全部">
                                <svg viewBox="0 0 24 24">
                                    <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="artist-info">
                        <h3 class="artist-name" title="${artist.name}">${artist.name}</h3>
                        <div class="artist-stats">
                            <span>${trackCount} 首歌曲</span>
                            ${albumCount > 0 ? `<span>•</span><span>${albumCount} 张专辑</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="artist-row" data-artist="${artist.name}">
                    <div class="artist-cover">
                        <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}" loading="lazy">
                    </div>
                    <div class="artist-info">
                        <h3 class="artist-name">${artist.name}</h3>
                        <div class="artist-stats">
                            ${trackCount} 首歌曲 • ${albumCount} 张专辑 • ${this.formatDuration(artist.totalDuration)}
                        </div>
                    </div>
                    <div class="artist-actions">
                        <button class="action-btn" title="播放全部">
                            <svg viewBox="0 0 24 24">
                                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                            </svg>
                        </button>
                        <button class="action-btn" title="查看详情">
                            <svg viewBox="0 0 24 24">
                                <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    renderArtistDetail() {
        const artist = this.selectedArtist;
        const albums = this.groupTracksByAlbum(artist.tracks);

        this.container.innerHTML = `
            <div class="page-content artist-detail">
                <div class="artist-header">
                    <button class="back-btn" id="back-to-artists">
                        <svg viewBox="0 0 24 24">
                            <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
                        </svg>
                        返回
                    </button>
                    <div class="artist-hero">
                        <div class="artist-cover-large">
                            <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}">
                        </div>
                        <div class="artist-info">
                            <h1 class="artist-name">${artist.name}</h1>
                            <div class="artist-stats">
                                <span>${artist.tracks.length} 首歌曲</span>
                                <span>•</span>
                                <span>${artist.albums.size} 张专辑</span>
                                <span>•</span>
                                <span>${this.formatDuration(artist.totalDuration)}</span>
                            </div>
                            <div class="artist-actions">
                                <button class="primary-button" id="play-artist">
                                    <svg class="icon" viewBox="0 0 24 24">
                                        <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                    </svg>
                                    播放全部
                                </button>
                                <button class="secondary-button" id="shuffle-artist">
                                    <svg class="icon" viewBox="0 0 24 24">
                                        <path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/>
                                    </svg>
                                    随机播放
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="artist-content">
                    ${Object.entries(albums).map(([albumName, tracks]) => `
                        <div class="album-section">
                            <div class="album-header">
                                <div class="album-cover">
                                    <img src="${tracks[0].cover || 'assets/images/default-cover.svg'}" alt="${albumName}">
                                </div>
                                <div class="album-info">
                                    <h3 class="album-title">${albumName}</h3>
                                    <div class="album-stats">
                                        ${tracks.length} 首歌曲 • ${this.formatDuration(tracks.reduce((sum, t) => sum + (t.duration || 0), 0))}
                                    </div>
                                </div>
                                <button class="album-play-btn" data-album="${albumName}">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="album-tracks">
                                ${tracks.map((track, index) => this.renderTrackRow(track, index)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.setupDetailEventListeners();
    }

    groupTracksByAlbum(tracks) {
        const albums = {};
        tracks.forEach(track => {
            const albumName = track.album || '未知专辑';
            if (!albums[albumName]) {
                albums[albumName] = [];
            }
            albums[albumName].push(track);
        });

        // 按专辑内的歌曲编号排序
        Object.values(albums).forEach(albumTracks => {
            albumTracks.sort((a, b) => (a.track || 0) - (b.track || 0));
        });

        return albums;
    }

    renderTrackRow(track, index) {
        return `
            <div class="track-row" data-track-path="${track.filePath}" data-index="${index}">
                <div class="track-number">${track.track || index + 1}</div>
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-duration">${formatTime(track.duration || 0)}</div>
                </div>
                <div class="track-actions">
                    <button class="action-btn small" title="播放">
                        <svg viewBox="0 0 24 24">
                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                        </svg>
                    </button>
                    <button class="action-btn small" title="添加到播放列表">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    setupListEventListeners() {
        // 视图切换
        this.container.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newView = btn.dataset.view;
                if (newView !== this.viewMode) {
                    this.viewMode = newView;
                    this.render();
                }
            });
        });

        // 排序
        const sortSelect = this.container.querySelector('#artist-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortArtists(sortSelect.value);
                this.render();
            });
        }

        // 艺术家卡片/行点击
        this.container.querySelectorAll('.artist-card, .artist-row').forEach(item => {
            const artistName = item.dataset.artist;
            const artist = this.artists.find(a => a.name === artistName);

            if (!artist) return;

            // 播放按钮
            const playBtn = item.querySelector('.play-btn, .artist-actions .action-btn:first-child');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emit('playAll', artist.tracks);
                });
            }

            // 查看详情按钮或双击
            const detailBtn = item.querySelector('.artist-actions .action-btn:last-child');
            if (detailBtn) {
                detailBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showArtistDetail(artist);
                });
            }

            item.addEventListener('dblclick', () => {
                this.showArtistDetail(artist);
            });
        });
    }

    setupDetailEventListeners() {
        // 返回按钮
        const backBtn = this.container.querySelector('#back-to-artists');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.selectedArtist = null;
                this.render();
            });
        }

        // 播放全部按钮
        const playAllBtn = this.container.querySelector('#play-artist');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => {
                this.emit('playAll', this.selectedArtist.tracks);
            });
        }

        // 随机播放按钮
        const shuffleBtn = this.container.querySelector('#shuffle-artist');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                const shuffledTracks = [...this.selectedArtist.tracks].sort(() => Math.random() - 0.5);
                this.emit('playAll', shuffledTracks);
            });
        }

        // 专辑播放按钮
        this.container.querySelectorAll('.album-play-btn').forEach(btn => {
            const albumName = btn.dataset.album;
            btn.addEventListener('click', () => {
                const albumTracks = this.selectedArtist.tracks.filter(t => (t.album || '未知专辑') === albumName);
                this.emit('playAll', albumTracks);
            });
        });

        // 歌曲行事件
        this.container.querySelectorAll('.track-row').forEach(row => {
            const trackPath = row.dataset.trackPath;
            const track = this.selectedArtist.tracks.find(t => t.filePath === trackPath);

            if (!track) return;

            // 播放按钮
            const playBtn = row.querySelector('.track-actions .action-btn:first-child');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emit('trackPlayed', track, 0);
                });
            }

            // 添加到播放列表按钮
            const addBtn = row.querySelector('.track-actions .action-btn:last-child');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.emit('addToPlaylist', track);
                });
            }

            // 双击播放
            row.addEventListener('dblclick', () => {
                this.emit('trackPlayed', track, 0);
            });
        });
    }

    showArtistDetail(artist) {
        this.selectedArtist = artist;
        this.render();
    }

    sortArtists(sortBy) {
        switch (sortBy) {
            case 'name':
                this.artists.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                break;
            case 'tracks':
                this.artists.sort((a, b) => b.tracks.length - a.tracks.length);
                break;
            case 'duration':
                this.artists.sort((a, b) => b.totalDuration - a.totalDuration);
                break;
        }
    }

    formatDuration(seconds) {
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} 分钟`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours} 小时 ${minutes} 分钟`;
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.components.component.ArtistsPage = ArtistsPage;
