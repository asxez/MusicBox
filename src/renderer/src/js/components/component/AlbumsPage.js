/**
 * 专辑页组件
 * 营造“收藏实体专辑”的沉浸式浏览体验
 */

class AlbumsPage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.albums = [];
        this.selectedAlbum = null; // { key, name, artist, year, cover, tracks:[], totalDuration }
        this.viewSize = 'm'; // s | m | l
        this.sortBy = 'name';
        this.container = this.element;
        // 共享元素转场：记忆源位置信息与滚动
        this._lastSourceRect = null;   // {left, top, width, height, radius, scrollTop}
        this._lastSourceKey = null;    // 专辑 key
        this._lastGridScrollTop = 0;   // 进入时的滚动位置
        // 封面获取去重与队列
        this._coverRequests = new Set();  // in-flight keys
        this._coverFailures = new Set();  // failed keys (避免重复请求)
        this._coverQueue = [];            // 待处理队列（存储专辑key）
        this._coverConcurrency = 0;
        this._coverMaxConcurrency = 5;
        this._bindLibraryEvents();
    }

    _bindLibraryEvents() {
        api.on('libraryUpdated', (tracks) => {
            this.tracks = tracks || [];
            this.processAlbums();
            if (this.isVisible) this.render();
        });
    }

    async show() {
        if (this.element) this.element.style.display = 'block';
        this.isVisible = true;
        this.tracks = await api.getTracks();
        this.processAlbums();
        this.render();

        // 记忆共享元素转场所需信息
        this._lastSourceRect = null;   // {left, top, width, height, radius, scrollTop}
        this._lastSourceKey = null;    // 对应的专辑 key，返回时用于定位原卡片
        this._lastGridScrollTop = 0;   // 返回时恢复滚动
    }

    hide() {
        this.isVisible = false;
        this.selectedAlbum = null;
        if (this.container) this.container.innerHTML = '';
    }

    // 归并专辑
    processAlbums() {
        const map = new Map();
        this.tracks.forEach(track => {
            const albumName = track.album || '未知专辑';
            const albumArtist = track.albumartist || track.artist || '未知艺术家';
            const key = `${albumName}:::${albumArtist}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: albumName,
                    artist: albumArtist,
                    year: track.year || null,
                    cover: track.cover || null,
                    tracks: [],
                    totalDuration: 0
                });
            }
            const album = map.get(key);
            album.tracks.push(track);
            album.totalDuration += track.duration || 0;
            if (!album.cover && track.cover) album.cover = track.cover;
            // 最早年份
            if (!album.year && track.year) album.year = track.year;
        });

        this.albums = Array.from(map.values());
        this.sortAlbums(this.sortBy);
        // 补全缺失封面
        this.scheduleCoversForMissing();
    }

    // 将缺失封面的专辑加入获取队列
    scheduleCoversForMissing() {
        if (!this.albums || this.albums.length === 0) return;
        for (const album of this.albums) {
            if (!album.cover) {
                const key = album.key;
                if (this._coverRequests.has(key) || this._coverFailures.has(key)) continue;
                this._coverQueue.push(key);
            }
        }
        this._drainCoverQueue();
    }

    async _drainCoverQueue() {
        while (this._coverConcurrency < this._coverMaxConcurrency && this._coverQueue.length > 0) {
            const key = this._coverQueue.shift();
            const album = this.albums.find(a => a.key === key);
            if (!album || album.cover) continue;
            this._coverConcurrency++;
            this._coverRequests.add(key);
            this._fetchAlbumCover(album)
                .catch(() => {
                })
                .finally(() => {
                    this._coverRequests.delete(key);
                    this._coverConcurrency--;
                    // 继续处理队列
                    if (this._coverQueue.length > 0) this._drainCoverQueue();
                });
        }
    }

    // 获取专辑封面
    async _fetchAlbumCover(album) {
        try {
            const artist = this._sanitize(album.artist);
            const name = this._sanitize(album.name || album.album);
            if (!name || !artist) {
                this._coverFailures.add(album.key);
                return;
            }
            // 显示加载态
            this._setAlbumCardLoading(album.key, true);
            const result = await window.api.getCover('', artist, name, null, false);
            if (result && result.success && result.imageUrl) {
                // 更新专辑数据
                album.cover = result.imageUrl;
                // 局部刷新：更新对应卡片的图片src
                this._updateAlbumCardCover(album.key, result.imageUrl);
            } else {
                this._coverFailures.add(album.key);
            }
        } catch (e) {
            console.warn('获取专辑封面失败:', album?.name, e?.message);
            this._coverFailures.add(album.key);
        } finally {
            this._setAlbumCardLoading(album.key, false);
        }
    }

    _sanitize(val) {
        if (val == null) return '';
        return String(val).trim();
    }

    _setAlbumCardLoading(key, loading) {
        const tile = this.container && this.container.querySelector(`.albumsx-tile[data-album-key="${CSS.escape(key)}"]`);
        if (!tile) return;
        const art = tile.querySelector('.art');
        if (!art) return;
        if (loading) art.classList.add('loading'); else art.classList.remove('loading');
    }

    _updateAlbumCardCover(key, url) {
        const tile = this.container && this.container.querySelector(`.albumsx-tile[data-album-key="${CSS.escape(key)}"]`);
        if (!tile) return;
        const img = tile.querySelector('.art img');
        if (!img) return;
        // 平滑淡入替换
        const fadeOut = img.animate([{opacity: 1}, {opacity: 0.1}], {duration: 140, fill: 'forwards'});
        fadeOut.finished.catch(() => {
        }).finally(() => {
            img.src = url;
            img.decode?.().catch(() => {
            }).finally(() => {
                img.animate([{opacity: 0.1}, {opacity: 1}], {duration: 160, fill: 'forwards'});
            });
        });
    }


    sortAlbums(sortBy) {
        this.sortBy = sortBy;
        switch (sortBy) {
            case 'name':
                this.albums.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                break;
            case 'artist':
                this.albums.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN'));
                break;
            case 'tracks':
                this.albums.sort((a, b) => b.tracks.length - a.tracks.length);
                break;
            case 'year':
                this.albums.sort((a, b) => (b.year || 0) - (a.year || 0));
                break;
            default:
                break;
        }
    }

    render() {
        if (!this.container) return;
        if (this.selectedAlbum) {
            this.renderAlbumDetail();
        } else {
            this.renderAlbumsList();
        }
    }

    // 专辑墙
    renderAlbumsList() {
        const sizes = {s: 110, m: 150, l: 200};
        const coverSize = sizes[this.viewSize] || sizes.m;
        const total = this.albums.length;
        this.container.innerHTML = `
            <div class="albumsx page">
                <div class="albumsx-toolbar">
                    <div class="left cluster">
                        <div class="title">
                            <span class="disc" aria-hidden>💿</span>
                            <span>专辑</span>
                            <em class="muted">${total} 张</em>
                        </div>
                        <div class="segmented" role="tablist" aria-label="封面尺寸">
                            <button class="seg-btn ${this.viewSize === 's' ? 'active' : ''}" data-size="s">小</button>
                            <button class="seg-btn ${this.viewSize === 'm' ? 'active' : ''}" data-size="m">中</button>
                            <button class="seg-btn ${this.viewSize === 'l' ? 'active' : ''}" data-size="l">大</button>
                        </div>
                    </div>
                    <div class="right cluster">
                        <div class="select">
                            <select id="album-sort" aria-label="排序">
                                <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>按专辑名</option>
                                <option value="artist" ${this.sortBy === 'artist' ? 'selected' : ''}>按艺术家</option>
                                <option value="tracks" ${this.sortBy === 'tracks' ? 'selected' : ''}>按歌曲数</option>
                                <option value="year" ${this.sortBy === 'year' ? 'selected' : ''}>按年份</option>
                            </select>
                        </div>
                        <div class="search-inline">
                            <input type="text" id="album-query" placeholder="搜索专辑或艺术家…" />
                        </div>
                    </div>
                </div>
                ${total ? `
                <div class="albumsx-grid" style="--cover:${coverSize}px;">
                    ${this.albums.map(a => this.renderAlbumTile(a)).join('')}
                </div>` : this.renderEmptyState()}
            </div>`;

        this.setupListEventListeners();
    }

    renderEmptyState() {
        return `
            <div class="albumsx-empty">
                <div class="icon">
                    <svg viewBox="0 0 24 24"><path d="M12,2A10,10 0 1,0 22,12A10,10 0 0,0 12,2M12,7A5,5 0 1,1 7,12A5,5 0 0,1 12,7Z"/></svg>
                </div>
                <h3>暂无专辑</h3>
                <p>添加一些音乐后，这里会像唱片墙一样展示你的收藏</p>
            </div>`;
    }

    renderAlbumTile(album) {
        const trackCount = album.tracks.length;
        const cover = album.cover || 'assets/images/default-cover.svg';
        const title = this.escapeHtml(album.name);
        const subtitle = `${this.escapeHtml(album.artist)} · ${album.year || '年份未知'} · ${trackCount} 首`;
        return `
            <div class="albumsx-tile" data-album-key="${this.escapeHtml(album.key)}" title="${title}\n${subtitle}">
                <div class="art shadow">
                    <img src="${cover}" alt="${title}" loading="lazy"/>
                </div>
                <div class="meta">
                    <div class="name clamp-1">${title}</div>
                    <div class="sub clamp-1">${subtitle}</div>
                </div>
            </div>`;
    }

    // 详情页
    // 布局：左封面右信息，下方歌曲，顶部毛玻璃栏
    renderAlbumDetail() {
        const album = this.selectedAlbum;
        const tracks = [...album.tracks].sort((a, b) => (a.disc || 0) - (b.disc || 0) || (a.track || 0) - (b.track || 0));
        const duration = this.formatDuration(album.totalDuration);
        const cover = album.cover || 'assets/images/default-cover.svg';
        this.container.innerHTML = `
            <div class="albumsx detail">
                <div class="detail-topbar">
                    <button class="ghost" id="back-to-albums" title="返回">
                        <svg viewBox="0 0 24 24"><path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/></svg>
                        返回
                    </button>
                </div>
                <div class="detail-hero">
                    <div class="cover">
                        <img src="${cover}" alt="${this.escapeHtml(album.name)}"/>
                    </div>
                    <div class="info">
                        <h1 class="name">${this.escapeHtml(album.name)}</h1>
                        <div class="stats">
                            <span>${this.escapeHtml(album.artist)}</span>
                            <span>·</span>
                            <span>${album.year || '年份未知'}</span>
                            <span>·</span>
                            <span>${tracks.length} 首</span>
                            <span>·</span>
                            <span>${duration}</span>
                        </div>
                        <div class="actions">
                            <button class="primary" id="play-album">
                                <svg viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z"/></svg>
                                播放专辑
                            </button>
                            <button class="outline" id="shuffle-album">
                                <svg viewBox="0 0 24 24"><path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/></svg>
                                随机播放
                            </button>
                        </div>
                    </div>
                </div>
                <div class="detail-tracks">
                    ${tracks.map((t, i) => this.renderTrackRow(t, i)).join('')}
                </div>
            </div>`;
        this.setupDetailEventListeners();
    }

    renderTrackRow(track, index) {
        return `
            <div class="trackx" data-track-path="${this.escapeHtml(track.filePath)}" data-index="${index}">
                <div class="idx">${track.track || index + 1}</div>
                <div class="t-main">
                    <div class="t-title clamp-1">${this.escapeHtml(track.title || '未知标题')}</div>
                </div>
                <div class="t-tail">
                    <span class="t-time">${formatTime(track.duration || 0)}</span>
                    <button class="i-btn" title="播放">
                        <svg viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z"/></svg>
                    </button>
                    <button class="i-btn" title="添加到播放列表">
                        <svg viewBox="0 0 24 24"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                    </button>
                </div>
            </div>`;
    }

    setupListEventListeners() {
        // 封面尺寸切换
        this.container.querySelectorAll('.seg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                if (size && size !== this.viewSize) {
                    this.viewSize = size;
                    this.render();
                }
            });
        });
        // 排序
        const sortSelect = this.container.querySelector('#album-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortAlbums(sortSelect.value);
                this.render();
            });
        }
        // 搜索
        const q = this.container.querySelector('#album-query');
        if (q) {
            q.addEventListener('input', () => {
                const kw = q.value.trim().toLowerCase();
                this.container.querySelectorAll('.albumsx-tile').forEach(tile => {
                    const key = tile.dataset.albumKey;
                    const album = this.albums.find(a => a.key === key);
                    if (!album) return;
                    const hit = (album.name || '').toLowerCase().includes(kw) || (album.artist || '').toLowerCase().includes(kw);
                    tile.style.display = hit ? '' : 'none';
                });
            });
        }
        // 专辑卡事件
        this.container.querySelectorAll('.albumsx-tile').forEach(tile => {
            const key = tile.dataset.albumKey;
            const album = this.albums.find(a => a.key === key);
            if (!album) return;
            const art = tile.querySelector('.art');


            // 双击进入详情
            // 飞入动画
            tile.addEventListener('dblclick', () => this.animateToDetail(tile, album));

            // 方向性高光，指针事件
            if (art) this.attachGlossHandlers(art);
        });
    }

    setupDetailEventListeners() {
        // 返回
        // 反向共享元素转场
        const backBtn = this.container.querySelector('#back-to-albums');
        if (backBtn) backBtn.addEventListener('click', () => {
            this.animateBackToGrid();
        });

        // 播放 / 随机
        const playBtn = this.container.querySelector('#play-album');
        if (playBtn) playBtn.addEventListener('click', () => this.emit('playAll', this.selectedAlbum.tracks.sort((a, b) => (a.track || 0) - (b.track || 0))));
        const shuffleBtn = this.container.querySelector('#shuffle-album');
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.emit('playAll', [...this.selectedAlbum.tracks].sort(() => Math.random() - 0.5)));

        // 歌曲行
        this.container.querySelectorAll('.trackx').forEach(row => {
            const trackPath = row.dataset.trackPath;
            const track = this.selectedAlbum.tracks.find(t => t.filePath === trackPath);
            if (!track) return;

            const play = row.querySelector('.i-btn:first-of-type');
            if (play) play.addEventListener('click', (e) => {
                e.stopPropagation();
                this.emit('trackPlayed', track, 0);
            });

            const add = row.querySelector('.i-btn:last-of-type');
            if (add) add.addEventListener('click', (e) => {
                e.stopPropagation();
                this.emit('addToPlaylist', track);
            });

            row.addEventListener('dblclick', () => this.emit('trackPlayed', track, 0));
        });
    }

    showAlbumDetail(album) {
        this.selectedAlbum = album;
        this.render();
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
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // 方向性高光跟随：利用 CSS 变量驱动，节流到 rAF
    attachGlossHandlers(artEl) {
        let raf = 0;
        const onMove = (e) => {
            if (raf) return; // rAF 节流
            raf = requestAnimationFrame(() => {
                raf = 0;
                const rect = artEl.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;  // 0..1
                const y = (e.clientY - rect.top) / rect.height;  // 0..1
                // 将坐标映射到 CSS 变量：用于渐变方向与强度
                artEl.style.setProperty('--mx', x.toFixed(4));
                artEl.style.setProperty('--my', y.toFixed(4));
                // 强度：靠近中心更亮，靠边更弱
                const cx = Math.abs(x - 0.5) * 2; // 0..1
                const cy = Math.abs(y - 0.5) * 2; // 0..1
                const dist = Math.sqrt(cx * cx + cy * cy); // 0..~1.4
                const strength = Math.max(0, 1 - dist); // 1..0
                artEl.style.setProperty('--gloss', (0.25 + 0.55 * strength).toFixed(3));
                // 方向角度：以鼠标向量确定
                const angle = Math.atan2(y - 0.5, x - 0.5) * 180 / Math.PI; // -180..180
                artEl.style.setProperty('--ang', angle.toFixed(2));
            });
        };
        const onLeave = () => {
            artEl.style.setProperty('--gloss', '0');
        };
        artEl.addEventListener('mousemove', onMove);
        artEl.addEventListener('mouseleave', onLeave);
    }

    // 封面飞入过渡：共享元素转场
    // 固定定位 + 顶左原点缩放/平移
    animateToDetail(tileEl, album) {
        const srcArtImg = tileEl.querySelector('.art img');
        const srcArt = tileEl.querySelector('.art');
        if (!srcArtImg || !srcArt) return this.showAlbumDetail(album);
        const srcRect = srcArtImg.getBoundingClientRect();

        // 预渲染详情页用于定位目标元素
        // 记忆源卡片位置信息 & 当前滚动位置
        // 反向转场与滚动恢复
        const scrollEl = this.getScrollContainer();
        const srcRadius = getComputedStyle(srcArt).borderRadius;
        this._lastSourceRect = {
            left: srcRect.left, top: srcRect.top, width: srcRect.width, height: srcRect.height,
            radius: srcRadius, scrollTop: scrollEl ? scrollEl.scrollTop : (window.scrollY || 0)
        };
        this._lastSourceKey = album.key;
        this._lastGridScrollTop = this._lastSourceRect.scrollTop;

        this.selectedAlbum = album;
        this.render();
        const dstCover = this.container.querySelector('.detail-hero .cover');
        const dstImg = dstCover ? dstCover.querySelector('img') : null;
        if (!dstCover || !dstImg) return; // 回退
        // 设置详情内容初始态
        // 飞入完成后的分层进入动画
        this.prepareDetailSequence();
        // 强制一次布局以确保 rect 精准
        void dstCover.offsetHeight;
        const dstRect = dstCover.getBoundingClientRect();

        // 构建过渡层（ghost）
        const ghostWrap = document.createElement('div');
        const ghost = srcArtImg.cloneNode(true);
        Object.assign(ghostWrap.style, {
            position: 'fixed',
            left: `${srcRect.left}px`,
            top: `${srcRect.top}px`,
            width: `${srcRect.width}px`,
            height: `${srcRect.height}px`,
            borderRadius: srcRadius,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,.25)',
            zIndex: '9999',
            willChange: 'transform, border-radius',
            transformOrigin: 'top left',
            pointerEvents: 'none'
        });
        Object.assign(ghost.style, {width: '100%', height: '100%', objectFit: 'cover'});
        document.body.appendChild(ghostWrap);
        ghostWrap.appendChild(ghost);

        // 隐藏目标封面但保留布局
        const prevVis = dstCover.style.visibility;
        dstCover.style.visibility = 'hidden';

        // 计算目标位移与缩放
        // 以顶左为原点，避免回弹
        const dx = dstRect.left - srcRect.left;
        const dy = dstRect.top - srcRect.top;
        const sx = dstRect.width / srcRect.width;
        const sy = dstRect.height / srcRect.height;
        const dstRadius = getComputedStyle(dstCover).borderRadius;

        const anim = ghostWrap.animate([
            {transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: srcRadius},
            {transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: dstRadius}
        ], {
            duration: 420,
            easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            fill: 'forwards'
        });

        anim.onfinish = () => {
            // 等一帧，确保动画最终帧已提交
            requestAnimationFrame(() => {
                // 显示目标封面，做一次交叉淡入，掩盖任何潜在的亚像素差异
                dstCover.style.visibility = prevVis;
                const fadeIn = dstImg.animate([
                    {opacity: 0},
                    {opacity: 1}
                ], {duration: 140, easing: 'ease-out', fill: 'forwards'});
                const fadeOut = ghostWrap.animate([
                    {opacity: 1},
                    {opacity: 0}
                ], {duration: 140, easing: 'ease-out', fill: 'forwards'});
                // 最终清理 + 开始内容分层进入
                Promise.allSettled([fadeIn.finished, fadeOut.finished]).finally(() => {
                    ghostWrap.remove();
                    this.runDetailSequence();
                });
            });
        };
    }

    // 详情页内容分层进入：设置初始态
    prepareDetailSequence() {
        const title = this.container.querySelector('.detail-hero .info .name');
        const stats = this.container.querySelector('.detail-hero .info .stats');
        const actions = this.container.querySelector('.detail-hero .info .actions');
        const tracks = this.container.querySelectorAll('.detail-tracks .trackx');
        const setInit = (elList) => {
            if (!elList) return;
            const els = elList instanceof NodeList ? Array.from(elList) : [elList];
            els.forEach(el => {
                if (el) {
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(10px)';
                }
            });
        };
        setInit(title);
        setInit(stats);
        setInit(actions);
        setInit(tracks);
    }

    // 详情页内容分层进入：执行序列
    runDetailSequence() {
        const title = this.container.querySelector('.detail-hero .info .name');
        const stats = this.container.querySelector('.detail-hero .info .stats');
        const actions = this.container.querySelector('.detail-hero .info .actions');
        const tracks = this.container.querySelectorAll('.detail-tracks .trackx');
        const phase = (els, delayBase) => {
            const list = els instanceof NodeList ? Array.from(els) : [els];
            list.forEach((el, i) => {
                if (!el) return;
                el.animate([
                    {opacity: 0, transform: 'translateY(10px)'},
                    {opacity: 1, transform: 'translateY(0px)'}
                ], {duration: 240, delay: delayBase + i * 24, easing: 'ease-out', fill: 'forwards'});
            });
        };
        // 封面飞入完成后顺序：标题 → 统计 → 按钮 → 歌曲
        phase(title, 40);
        phase(stats, 120);
        phase(actions, 200);
        phase(tracks, 280); // 列表逐个延迟 24ms，整体节奏轻快
    }

    // 反向共享元素转场：从详情页封面飞回网格卡片
    animateBackToGrid() {
        const dstCover = this.container.querySelector('.detail-hero .cover');
        const dstImg = dstCover ? dstCover.querySelector('img') : null;
        if (!dstCover || !dstImg) {
            this.selectedAlbum = null;
            this.render();
            return;
        }
        const dstRect = dstCover.getBoundingClientRect();
        const src = this._lastSourceRect;

        // 先淡出详情的文本内容
        const title = this.container.querySelector('.detail-hero .info .name');
        const stats = this.container.querySelector('.detail-hero .info .stats');
        const actions = this.container.querySelector('.detail-hero .info .actions');
        const tracks = this.container.querySelectorAll('.detail-tracks .trackx');
        const fadeOut = (els) => {
            const list = els instanceof NodeList ? Array.from(els) : [els];
            return list.map(el => el ? el.animate([
                {opacity: 1, transform: 'translateY(0px)'},
                {opacity: 0, transform: 'translateY(6px)'}
            ], {duration: 150, easing: 'ease-in', fill: 'forwards'}).finished : Promise.resolve());
        };
        Promise.allSettled([
            ...fadeOut(title), ...fadeOut(stats), ...fadeOut(actions), ...fadeOut(tracks)
        ]).finally(() => {
            // 创建 ghost 做反向飞行
            const ghostWrap = document.createElement('div');
            const ghost = dstImg.cloneNode(true);
            const dstRadius = getComputedStyle(dstCover).borderRadius;
            Object.assign(ghostWrap.style, {
                position: 'fixed', left: `${dstRect.left}px`, top: `${dstRect.top}px`,
                width: `${dstRect.width}px`, height: `${dstRect.height}px`,
                borderRadius: dstRadius, overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,.25)', zIndex: '9999',
                transformOrigin: 'top left', willChange: 'transform, border-radius', pointerEvents: 'none'
            });
            Object.assign(ghost.style, {width: '100%', height: '100%', objectFit: 'cover'});
            document.body.appendChild(ghostWrap);
            ghostWrap.appendChild(ghost);

            // 切换视图到网格，但先隐藏网格中可能的目标卡片以避免闪烁
            const key = this._lastSourceKey;
            this.selectedAlbum = null;
            this.render();
            const gridTile = key ? this.container.querySelector(`.albumsx-tile[data-album-key="${CSS.escape(key)}"]`) : null;
            const gridArt = gridTile ? gridTile.querySelector('.art') : null;
            if (gridArt) gridArt.style.visibility = 'hidden';

            // 恢复网格滚动到进入时的位置
            const scrollEl = this.getScrollContainer();
            if (scrollEl) scrollEl.scrollTop = this._lastGridScrollTop || 0; else window.scrollTo(0, this._lastGridScrollTop || 0);

            // 强制布局后获取源卡片（网格）目标 rect
            let targetRect;
            if (gridArt) {
                void gridArt.offsetHeight;
                const img = gridArt.querySelector('img') || gridArt;
                targetRect = img.getBoundingClientRect();
            }

            // 若无法找到原卡片，使用淡出收场
            if (!src || !targetRect) {
                ghostWrap.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: 'ease-out', fill: 'forwards'})
                    .onfinish = () => {
                    ghostWrap.remove();
                    if (gridArt) gridArt.style.visibility = '';
                };
                return;
            }

            const dx = (src.left ?? targetRect.left) - dstRect.left;
            const dy = (src.top ?? targetRect.top) - dstRect.top;
            const sx = (src.width ?? targetRect.width) / dstRect.width;
            const sy = (src.height ?? targetRect.height) / dstRect.height;
            const finalRadius = src.radius || getComputedStyle(gridArt).borderRadius;

            const anim = ghostWrap.animate([
                {transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: dstRadius},
                {transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: finalRadius}
            ], {duration: 420, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards'});

            anim.onfinish = () => {
                requestAnimationFrame(() => {
                    if (gridArt) gridArt.style.visibility = '';
                    // 交叉淡入淡出，保证无缝
                    const fadeInGrid = gridArt ? gridArt.animate([{opacity: 0}, {opacity: 1}], {
                        duration: 140,
                        fill: 'forwards'
                    }) : null;
                    ghostWrap.animate([{opacity: 1}, {opacity: 0}], {duration: 140, fill: 'forwards'})
                        .onfinish = () => {
                        ghostWrap.remove();
                    };
                    if (fadeInGrid && fadeInGrid.finished) fadeInGrid.finished.catch(() => {
                    });
                });
            };
        });
    }

    // 获取可滚动容器
    getScrollContainer() {
        return document.querySelector('.main-content');
    }
}

window.components.component.AlbumsPage = AlbumsPage;
