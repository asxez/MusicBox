/**
 * 艺术家页组件
 */

import {urlValidator} from "@utils/URLValidator";
import {Component} from "@ui/base/Component";
import {coverAPI, libraryAPI} from "@js/api";
import type {Track} from "@api/types/track";

type ArtistViewMode = 'constellation' | 'galaxy';

interface ArtistInfo {
    name: string;
    tracks: Track[];
    albums: Set<string>;
    totalDuration: number;
    cover: string | null;
}

interface StarParticle {
    x: number;
    y: number;
    radius: number;
    opacity: number;
    speed: number;
}

interface SourceRectSnapshot {
    left: number;
    top: number;
    width: number;
    height: number;
    radius: string;
    scrollTop: number;
}

interface CoverResult {
    success?: boolean;
    imageUrl?: string;
    error?: string;
}

class ArtistsPage extends Component {
    private container: any;
    private tracks: Track[];
    private artists: ArtistInfo[];
    private filteredArtists: ArtistInfo[];
    private selectedArtist: ArtistInfo | null;
    private viewMode: ArtistViewMode;
    private listenersSetup: boolean;
    private heroAnimationId: number | null;
    private _coverFailures: Set<string>;
    private _coverLoading: Set<string>;
    private _coverFetchingInProgress: boolean;

    constructor(container: string | Element | null) {
        super(container);
        this.tracks = [];
        this.artists = [];
        this.filteredArtists = [];
        this.selectedArtist = null;
        this.viewMode = 'constellation'; // constellation or galaxy
        this.listenersSetup = false; // 事件监听器是否已设置
        this.heroAnimationId = null;
        this._coverFailures = new Set(); // 记录封面获取失败的艺术家
        this._coverLoading = new Set(); // 记录正在加载封面的艺术家
        this._coverFetchingInProgress = false; // 防止重复启动封面获取
    }

    async show(): Promise<void> {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupAPIListeners();
            this.listenersSetup = true;
        }
        if (this.element instanceof HTMLElement) {
            this.element.style.display = 'block';
        }

        // 只有在没有tracks数据时才获取，避免重复调用
        if (!this.tracks || this.tracks.length === 0) {
            this.tracks = await libraryAPI.getTracks() as Track[];
            this.processArtists();
        }

        this.render();
    }

    // 生成tracks的简单哈希值
    _generateTracksHash(tracks: Track[]): string {
        if (!tracks || tracks.length === 0) return 'empty';
        const sample = tracks.slice(0, 3).map(t => t.filePath || t.title).join('|');
        return `${tracks.length}_${sample}`;
    }

    hide(): void {
        this.selectedArtist = null;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy(): void {
        // 清理动画资源
        if (this.heroAnimationId) {
            cancelAnimationFrame(this.heroAnimationId);
            this.heroAnimationId = null;
        }

        this.tracks.length = 0;
        this.artists.length = 0;
        this.filteredArtists.length = 0;
        this.selectedArtist = null;
        this.listenersSetup = false;

        // 清理封面获取相关状态
        if (this._coverFailures) {
            this._coverFailures.clear();
        }
        if (this._coverLoading) {
            this._coverLoading.clear();
        }
        this._coverFetchingInProgress = false;

        super.destroy();
    }

    setupElements(): void {
        this.container = this.element;
    }

    setupAPIListeners(): void {
        // 监听音乐库更新
        this.addAPIEventListenerManaged('libraryUpdated', (tracks: Track[]) => {
            this.tracks = tracks;
            this.processArtists();
        });
    }

    processArtists(): void {
        const artistMap = new Map<string, ArtistInfo>();
        this.tracks.forEach((track) => {
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

            const artist = artistMap.get(artistName)!;
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

        // 初始化过滤后的艺术家列表
        this.filteredArtists = [...this.artists];
    }

    render(): void {
        if (!this.container) return;

        if (this.selectedArtist) {
            this.renderArtistDetail();
        } else {
            this.renderArtistsList();
        }
    }

    renderArtistsList(): void {
        this.container.innerHTML = `
            <div class="page-content artists-page modern-artists">
                <!-- hero区域 -->
                <div class="artists-hero-section">
                    <div class="hero-background">
                        <canvas id="artists-visualizer" class="artists-visualizer"></canvas>
                        <div class="hero-overlay"></div>
                    </div>
                    <div class="hero-content">
                        <div class="hero-title-container">
                            <div class="hero-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                                </svg>
                            </div>
                            <div class="hero-text">
                                <h1 class="hero-title">音乐星河</h1>
                                <p class="hero-subtitle">探索 ${this.artists.length} 位艺术家的音乐宇宙</p>
                            </div>
                        </div>
                        <div class="hero-stats">
                            <div class="stat-item">
                                <span class="stat-number">${this.artists.length}</span>
                                <span class="stat-label">艺术家</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${this.getTotalTracks()}</span>
                                <span class="stat-label">歌曲</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${this.getTotalAlbums()}</span>
                                <span class="stat-label">专辑</span>
                            </div>
                        </div>
                    </div>
                </div>

                ${this.artists.length > 0 ? `
                    <!-- 现代化控制栏 -->
                    <div class="modern-controls">
                        <div class="search-container">
                            <div class="search-wrapper">
                                <svg class="search-icon" viewBox="0 0 24 24">
                                    <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L20.71,20L19.29,21.42L13.73,15.44C12.59,16.41 11.11,17 9.5,17A6.5,6.5 0 0,1 3,10.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                                </svg>
                                <input type="text" id="artist-search" placeholder="在星河中寻找艺术家..." class="modern-search-input">
                            </div>
                        </div>
                        <div class="view-mode-toggle">
                            <button class="mode-btn ${this.viewMode === 'constellation' ? 'active' : ''}" data-view="constellation" title="星座视图">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M6.5,12.5L7.5,16.5L11.5,17.5L7.5,18.5L6.5,22.5L5.5,18.5L1.5,17.5L5.5,16.5L6.5,12.5M17.5,12.5L18.5,16.5L22.5,17.5L18.5,18.5L17.5,22.5L16.5,18.5L12.5,17.5L16.5,16.5L17.5,12.5Z"/>
                                </svg>
                                <span>星座</span>
                            </button>
                            <button class="mode-btn ${this.viewMode === 'galaxy' ? 'active' : ''}" data-view="galaxy" title="星系视图">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z"/>
                                </svg>
                                <span>星系</span>
                            </button>
                        </div>
                    </div>

                    <!-- 星河式艺术家展示 -->
                    <div class="artists-galaxy ${this.viewMode === 'constellation' ? 'constellation-view' : 'galaxy-view'}">
                        ${this.viewMode === 'constellation' ? this.renderConstellationView() : this.renderGalaxyView()}
                    </div>
                ` : `
                    <div class="empty-state modern-empty">
                        <div class="empty-animation">
                            <div class="empty-stars">
                                <div class="star"></div>
                                <div class="star"></div>
                                <div class="star"></div>
                            </div>
                        </div>
                        <h3 class="empty-title">星河等待探索</h3>
                        <p class="empty-description">添加音乐，让艺术家在这片星河中闪耀</p>
                    </div>
                `}
            </div>
        `;

        this.setupEventListeners();
        this.initializeHeroVisualization();

        // 渲染完成后启动封面获取
        this._startCoverFetching();
    }

    // 设置事件监听器
    setupEventListeners(): void {
        // 搜索功能
        const searchInput = this.container.querySelector('#artist-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e: Event) => {
                this.filterArtists((e.target as HTMLInputElement).value);
            });
        }

        // 视图模式切换
        this.container.querySelectorAll('.mode-btn').forEach((btn: HTMLElement) => {
            btn.addEventListener('click', () => {
                const newMode = btn.dataset.view;
                if (isArtistViewMode(newMode) && newMode !== this.viewMode) {
                    this.switchViewMode(newMode);
                }
            });
        });

        // 绑定不同视图的事件
        this.bindViewSpecificEvents();
    }

    // 初始化hero区域可视化
    initializeHeroVisualization(): void {
        const canvas = this.container.querySelector('#artists-visualizer');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // 创建星空背景动画
        this.createStarfieldAnimation(ctx, canvas);
    }

    // 创建星空背景动画
    createStarfieldAnimation(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        const stars: StarParticle[] = [];
        const numStars = 50;

        // 初始化星星
        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.8 + 0.2,
                speed: Math.random() * 0.5 + 0.1
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制星星
            stars.forEach((star) => {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
                ctx.fill();

                // 星星闪烁效果
                star.opacity += (Math.random() - 0.5) * 0.02;
                star.opacity = Math.max(0.1, Math.min(0.9, star.opacity));

                // 缓慢移动
                star.x += star.speed;
                if (star.x > canvas.width) {
                    star.x = -star.radius;
                }
            });

            this.heroAnimationId = requestAnimationFrame(animate);
        };

        animate();
    }

    // 播放艺术家音乐并显示动画
    playArtistWithAnimation(star: HTMLElement, artist: ArtistInfo): void {
        // 创建波纹效果
        const ripple = document.createElement('div');
        ripple.className = 'play-ripple';
        star.appendChild(ripple);

        // 播放音乐
        this.emit('playAll', artist.tracks);

        // 移除波纹效果
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 1000);
    }

    // 艺术家详情显示
    showArtistDetailWithTransition(artist: ArtistInfo, element: HTMLElement): void {
        // 获取点击的封面元素
        const avatarImg = element.querySelector('.artist-avatar img') ||
            element.querySelector('.star-constellation-core .artist-avatar img') ||
            element.querySelector('.planet-core .artist-avatar img');

        if (!avatarImg) {
            // 如果找不到头像，直接显示详情页面
            return this.showArtistDetail(artist);
        }

        // 执行封面飞入动画
        this.animateToArtistDetail(element, artist, avatarImg as HTMLImageElement);
    }

    // 封面飞入过渡动画：共享元素转场
    animateToArtistDetail(sourceElement: HTMLElement, artist: ArtistInfo, sourceImg: HTMLImageElement): void {
        void sourceElement;
        if (!sourceImg) return this.showArtistDetail(artist);

        const srcRect = sourceImg.getBoundingClientRect();
        const srcContainer = sourceImg.closest('.artist-avatar') ||
            sourceImg.closest('.star-constellation-core') ||
            sourceImg.closest('.planet-core');

        // 记录源位置信息用于可能的返回动画
        const scrollEl = this.getScrollContainer();
        const srcRadius = srcContainer ? getComputedStyle(srcContainer).borderRadius : '50%';
        const sourceSnapshot: SourceRectSnapshot = {
            left: srcRect.left,
            top: srcRect.top,
            width: srcRect.width,
            height: srcRect.height,
            radius: srcRadius,
            scrollTop: scrollEl ? scrollEl.scrollTop : (window.scrollY || 0)
        };
        void sourceSnapshot;

        // 渲染艺术家详情页面
        this.selectedArtist = artist;
        this.render();

        const targetAvatar = this.container.querySelector('.detail-target-avatar');
        const targetImg = targetAvatar ? targetAvatar.querySelector('img') : null;

        if (!targetAvatar || !targetImg) {
            return;
        }

        // 准备详情页面内容的分层进入动画
        this.prepareArtistDetailSequence();

        // 强制布局以确保目标位置准确
        void targetAvatar.offsetHeight;
        const dstRect = targetAvatar.getBoundingClientRect();

        // 创建飞入动画的幽灵元素
        const ghostWrap = document.createElement('div');
        const ghost = sourceImg.cloneNode(true) as HTMLImageElement;

        Object.assign(ghostWrap.style, {
            position: 'fixed',
            left: `${srcRect.left}px`,
            top: `${srcRect.top}px`,
            width: `${srcRect.width}px`,
            height: `${srcRect.height}px`,
            borderRadius: srcRadius,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,.3)',
            zIndex: '9999',
            willChange: 'transform, border-radius',
            transformOrigin: 'top left',
            pointerEvents: 'none'
        });

        Object.assign(ghost.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover'
        });

        document.body.appendChild(ghostWrap);
        ghostWrap.appendChild(ghost);

        // 隐藏目标头像但保留布局
        const prevVis = targetAvatar.style.visibility;
        targetAvatar.style.visibility = 'hidden';

        // 计算目标位移与缩放
        const dx = dstRect.left - srcRect.left;
        const dy = dstRect.top - srcRect.top;
        const sx = dstRect.width / srcRect.width;
        const sy = dstRect.height / srcRect.height;
        const dstRadius = getComputedStyle(targetAvatar).borderRadius;

        // 执行飞入动画
        const anim = ghostWrap.animate([
            {
                transform: 'translate(0px, 0px) scale(1, 1)',
                borderRadius: srcRadius
            },
            {
                transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
                borderRadius: dstRadius
            }
        ], {
            duration: 420,
            easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            fill: 'forwards'
        });

        anim.onfinish = () => {
            requestAnimationFrame(() => {
                // 显示目标头像，交叉淡入掩盖差异
                targetAvatar.style.visibility = prevVis;

                const fadeIn = targetImg.animate([
                    {opacity: 0},
                    {opacity: 1}
                ], {
                    duration: 140,
                    easing: 'ease-out',
                    fill: 'forwards'
                });

                const fadeOut = ghostWrap.animate([
                    {opacity: 1},
                    {opacity: 0}
                ], {
                    duration: 140,
                    easing: 'ease-out',
                    fill: 'forwards'
                });

                // 清理并开始内容分层进入动画
                Promise.allSettled([fadeIn.finished, fadeOut.finished]).finally(() => {
                    ghostWrap.remove();
                    this.runArtistDetailSequence();
                });
            });
        };
    }

    // 获取滚动容器
    getScrollContainer(): any {
        return this.container.closest('.scrollable') ||
            this.container.closest('.page-content') ||
            document.documentElement;
    }

    // 获取艺术家封面
    async _fetchArtistCover(artist: ArtistInfo): Promise<void> {
        try {
            const artistName = this._sanitize(artist.name);
            if (!artistName) {
                this._coverFailures.add(artist.name);
                return;
            }

            // 避免重复请求
            if (this._coverFailures.has(artist.name) || this._coverLoading.has(artist.name)) {
                return;
            }

            // 显示加载态
            this._setArtistCardLoading(artist.name, true);
            this._coverLoading.add(artist.name);

            // 调用API获取艺术家封面
            // 只传艺术家名称，不传专辑名
            const result = await coverAPI.getCover('', artistName, '', null, false) as CoverResult;
            if (result && result.success && result.imageUrl) {
                // 更新艺术家数据
                artist.cover = result.imageUrl;
                // 局部刷新：更新对应卡片的图片src
                this._updateArtistCardCover(artist.name, result.imageUrl);
            } else {
                this._coverFailures.add(artist.name);
                console.log('❌ 艺术家封面获取失败:', artistName, result?.error);
            }
        } catch (e) {
            console.warn('获取艺术家封面失败:', artist?.name, getErrorMessage(e));
            this._coverFailures.add(artist.name);
        } finally {
            this._setArtistCardLoading(artist.name, false);
            this._coverLoading.delete(artist.name);
        }
    }

    // 字符串清理方法
    _sanitize(val: unknown): string {
        if (val == null) return '';
        return String(val).trim();
    }

    // 设置艺术家卡片加载状态
    _setArtistCardLoading(artistName: string, isLoading: boolean): void {
        const artistCards = this.container.querySelectorAll(`[data-artist="${artistName}"]`);
        artistCards.forEach((card: HTMLElement) => {
            const img = card.querySelector('img');
            if (img) {
                if (isLoading) {
                    img.style.opacity = '0.6';
                    img.style.filter = 'blur(1px)';
                } else {
                    img.style.opacity = '';
                    img.style.filter = '';
                }
            }
        });
    }

    // 更新艺术家卡片封面
    _updateArtistCardCover(artistName: string, imageUrl: string): void {
        const artistCards = this.container.querySelectorAll(`[data-artist="${artistName}"]`);
        artistCards.forEach((card: HTMLElement) => {
            const img = card.querySelector('img');
            if (img && imageUrl) {
                // 使用安全的图片设置方法
                if (urlValidator) {
                    urlValidator.safeSetImageSrc(img, imageUrl).then((success: boolean) => {
                        if (success) {
                            img.style.opacity = '';
                            img.style.filter = '';
                        }
                    });
                } else {
                    img.src = imageUrl;
                    img.style.opacity = '';
                    img.style.filter = '';
                }
            }
        });
    }

    // 启动封面获取流程
    _startCoverFetching(): void {
        // 防止重复启动封面获取
        if (this._coverFetchingInProgress) {
            return;
        }

        // 检查是否有需要获取封面的艺术家
        const artistsNeedingCovers = this.filteredArtists.filter((artist) =>
            !artist.cover &&
            !this._coverFailures.has(artist.name) &&
            !this._coverLoading.has(artist.name)
        );

        if (artistsNeedingCovers.length === 0) {
            return; // 没有需要获取封面的艺术家
        }

        this._coverFetchingInProgress = true;

        // 使用requestIdleCallback在浏览器空闲时获取封面，避免阻塞UI
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                this._fetchCoversForVisibleArtists().finally(() => {
                    this._coverFetchingInProgress = false;
                });
            });
        } else {
            // 降级方案：使用setTimeout
            setTimeout(() => {
                this._fetchCoversForVisibleArtists().finally(() => {
                    this._coverFetchingInProgress = false;
                });
            }, 100);
        }
    }

    // 为可见的艺术家获取封面
    async _fetchCoversForVisibleArtists(): Promise<void> {
        // 只为没有封面的艺术家获取封面
        const artistsNeedingCovers = this.filteredArtists.filter((artist) =>
            !artist.cover &&
            !this._coverFailures.has(artist.name) &&
            !this._coverLoading.has(artist.name)
        );

        // 限制并发请求数量，避免过多请求
        const batchSize = 3;
        for (let i = 0; i < artistsNeedingCovers.length; i += batchSize) {
            const batch = artistsNeedingCovers.slice(i, i + batchSize);

            // 并发获取这一批的封面
            await Promise.allSettled(
                batch.map((artist) => this._fetchArtistCover(artist))
            );

            // 在批次之间添加小延迟，避免请求过于频繁
            if (i + batchSize < artistsNeedingCovers.length) {
                await new Promise<void>((resolve) => setTimeout(resolve, 200));
            }
        }
    }

    // 准备艺术家详情页面内容的分层进入动画
    prepareArtistDetailSequence(): void {
        const title = this.container.querySelector('.artist-title');
        const stats = this.container.querySelector('.artist-stats-modern');
        const actions = this.container.querySelector('.artist-actions-modern');
        const tracksTitle = this.container.querySelector('.tracks-title');
        const albums = this.container.querySelectorAll('.album-orbit');

        const setInitialState = (elements: any) => {
            if (!elements) return;
            const els = elements instanceof NodeList ? Array.from(elements) : [elements];
            els.forEach((el: HTMLElement) => {
                if (el) {
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(20px)';
                }
            });
        };

        setInitialState(title);
        setInitialState(stats);
        setInitialState(actions);
        setInitialState(tracksTitle);
        setInitialState(albums);
    }

    // 执行艺术家详情页面内容的分层进入动画
    runArtistDetailSequence(): void {
        const title = this.container.querySelector('.artist-title');
        const stats = this.container.querySelector('.artist-stats-modern');
        const actions = this.container.querySelector('.artist-actions-modern');
        const tracksTitle = this.container.querySelector('.tracks-title');
        const albums = this.container.querySelectorAll('.album-orbit');

        const animatePhase = (elements: any, delayBase: number) => {
            if (!elements) return;
            const els = elements instanceof NodeList ? Array.from(elements) : [elements];
            els.forEach((el: HTMLElement, i: number) => {
                if (el) {
                    el.animate([
                        {opacity: 0, transform: 'translateY(20px)'},
                        {opacity: 1, transform: 'translateY(0px)'}
                    ], {
                        duration: 300,
                        delay: delayBase + i * 50,
                        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
                        fill: 'forwards'
                    });
                }
            });
        };

        // 分层动画序列：标题 → 统计 → 按钮 → 专辑标题 → 专辑列表
        animatePhase(title, 50);
        animatePhase(stats, 150);
        animatePhase(actions, 250);
        animatePhase(tracksTitle, 350);
        animatePhase(albums, 450);
    }

    // 过滤艺术家
    filterArtists(searchTerm: string): void {
        if (!searchTerm.trim()) {
            this.filteredArtists = [...this.artists];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredArtists = this.artists.filter((artist) =>
                artist.name.toLowerCase().includes(term)
            );
        }

        this.updateArtistsDisplay();
    }

    // 更新艺术家显示区域
    updateArtistsDisplay(): void {
        const galaxyContainer = this.container.querySelector('.artists-galaxy');
        if (galaxyContainer) {
            // 根据当前视图模式重新渲染
            galaxyContainer.innerHTML = this.viewMode === 'constellation' ?
                this.renderConstellationView() :
                this.renderGalaxyView();

            galaxyContainer.className = `artists-galaxy ${this.viewMode === 'constellation' ? 'constellation-view' : 'galaxy-view'}`;

            // 重新绑定事件
            this.bindViewSpecificEvents();
        }
    }

    // 获取总歌曲数
    getTotalTracks(): number {
        return this.artists.reduce((total, artist) => total + artist.tracks.length, 0);
    }

    // 获取总专辑数
    getTotalAlbums(): number {
        return this.artists.reduce((total, artist) => total + artist.albums.size, 0);
    }

    // 计算艺术家受欢迎程度
    calculateArtistPopularity(artist: ArtistInfo): number {
        const trackCount = artist.tracks.length;
        const albumCount = artist.albums.size;
        const totalDuration = artist.totalDuration || 0;

        // 基于歌曲数、专辑数和总时长计算受欢迎程度
        const score = (trackCount * 2) + (albumCount * 5) + (totalDuration / 60000); // 转换为分钟

        // 归一化到0-100
        const maxScore = Math.max(...this.artists.map((a) =>
            (a.tracks.length * 2) + (a.albums.size * 5) + ((a.totalDuration || 0) / 60000)
        ));

        return maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 50;
    }

    // 渲染星座视图
    // 网格布局 + 连线效果
    renderConstellationView(): string {
        const sortedArtists = this.getSortedArtistsByPopularity();
        const constellations = this.groupArtistsIntoConstellations(sortedArtists);

        return `
            <svg class="constellation-lines" viewBox="0 0 1200 800">
                ${this.renderConstellationLines(constellations)}
            </svg>
            <div class="constellation-grid">
                ${sortedArtists.map((artist, index) => this.renderConstellationStar(artist, index)).join('')}
            </div>
        `;
    }

    // 渲染星系视图
    // 环形布局
    renderGalaxyView(): string {
        const sortedArtists = this.getSortedArtistsByPopularity();
        const orbits = this.distributeArtistsInOrbits(sortedArtists);

        return `
            <div class="galaxy-center">
                <div class="galaxy-core">
                    <div class="core-glow"></div>
                    <div class="core-text">音乐星系</div>
                </div>
            </div>
            ${orbits.map((orbit, orbitIndex) => `
                <div class="galaxy-orbit orbit-${orbitIndex}" style="--orbit-radius: ${120 + orbitIndex * 80}px; --orbit-speed: ${20 + orbitIndex * 5}s;">
                    ${orbit.map((artist, artistIndex) => this.renderGalaxyPlanet(artist, orbitIndex, artistIndex, orbit.length)).join('')}
                </div>
            `).join('')}
        `;
    }

    // 按受欢迎程度排序艺术家
    getSortedArtistsByPopularity(): ArtistInfo[] {
        return [...this.filteredArtists].sort((a, b) => {
            const popularityA = this.calculateArtistPopularity(a);
            const popularityB = this.calculateArtistPopularity(b);
            return popularityB - popularityA;
        });
    }

    // 将艺术家分组为星座
    groupArtistsIntoConstellations(artists: ArtistInfo[]): ArtistInfo[][] {
        const constellations: ArtistInfo[][] = [];
        const constellationSize = 4; // 每个星座4-6个艺术家

        for (let i = 0; i < artists.length; i += constellationSize) {
            constellations.push(artists.slice(i, i + constellationSize));
        }

        return constellations;
    }

    // 将艺术家分布到不同轨道
    distributeArtistsInOrbits(artists: ArtistInfo[]): ArtistInfo[][] {
        const orbits: ArtistInfo[][] = [[], [], [], []]; // 4个轨道

        artists.forEach((artist) => {
            const popularity = this.calculateArtistPopularity(artist);
            let orbitIndex;

            if (popularity >= 80) orbitIndex = 0; // 内轨道 - 超级巨星
            else if (popularity >= 60) orbitIndex = 1; // 第二轨道 - 知名艺术家
            else if (popularity >= 40) orbitIndex = 2; // 第三轨道 - 新兴艺术家
            else orbitIndex = 3; // 外轨道 - 独立音乐人

            orbits[orbitIndex].push(artist);
        });

        return orbits.filter(orbit => orbit.length > 0);
    }

    // 渲染星座连线
    renderConstellationLines(constellations: ArtistInfo[][]): string {
        let lines = '';

        constellations.forEach((constellation, constellationIndex) => {
            if (constellation.length < 2) return;

            // 为每个星座创建连线
            for (let i = 0; i < constellation.length - 1; i++) {
                const startIndex = constellationIndex * 4 + i;
                const endIndex = startIndex + 1;

                // 计算网格位置
                const cols = Math.ceil(Math.sqrt(this.filteredArtists.length));
                const startRow = Math.floor(startIndex / cols);
                const startCol = startIndex % cols;
                const endRow = Math.floor(endIndex / cols);
                const endCol = endIndex % cols;

                const x1 = (startCol + 0.5) * (1200 / cols);
                const y1 = (startRow + 0.5) * (800 / Math.ceil(this.filteredArtists.length / cols));
                const x2 = (endCol + 0.5) * (1200 / cols);
                const y2 = (endRow + 0.5) * (800 / Math.ceil(this.filteredArtists.length / cols));

                lines += `
                    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                          class="constellation-line"
                          style="--delay: ${i * 0.2}s"/>
                `;
            }
        });

        return lines;
    }

    // 渲染星座中的星星
    renderConstellationStar(artist: ArtistInfo, index: number): string {
        const popularity = this.calculateArtistPopularity(artist);
        const starSize = this.getConstellationStarSize(popularity);
        const trackCount = artist.tracks.length;
        const albumCount = artist.albums.size;

        return `
            <div class="constellation-star ${starSize}"
                 data-artist="${artist.name}"
                 data-index="${index}"
                 style="--animation-delay: ${index * 0.1}s">
                <div class="star-constellation-glow"></div>
                <div class="star-constellation-core">
                    <div class="artist-avatar">
                        <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}" loading="lazy">
                    </div>
                    <div class="constellation-twinkle"></div>
                </div>
                <div class="constellation-info">
                    <h3 class="artist-name">${this.escapeHtml(artist.name)}</h3>
                    <div class="artist-stats">
                        <span>${trackCount} 首歌曲</span>
                        ${albumCount > 0 ? `<span>•</span><span>${albumCount} 张专辑</span>` : ''}
                    </div>
                </div>
                <div class="constellation-actions">
                    <button class="constellation-play-btn" title="播放全部">
                        <svg viewBox="0 0 24 24">
                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染星系中的行星
    renderGalaxyPlanet(artist: ArtistInfo, orbitIndex: number, artistIndex: number, totalInOrbit: number): string {
        const popularity = this.calculateArtistPopularity(artist);
        const planetSize = this.getGalaxyPlanetSize(popularity, orbitIndex);
        const trackCount = artist.tracks.length;
        const albumCount = artist.albums.size;
        const angle = (360 / totalInOrbit) * artistIndex;

        return `
            <div class="galaxy-planet ${planetSize}"
                 data-artist="${artist.name}"
                 style="--planet-angle: ${angle}deg; --animation-delay: ${artistIndex * 0.2}s">
                <div class="planet-orbit-trail"></div>
                <div class="planet-glow"></div>
                <div class="planet-core">
                    <div class="artist-avatar">
                        <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}" loading="lazy">
                    </div>
                    <div class="planet-ring"></div>
                </div>
                <div class="planet-info">
                    <h3 class="artist-name">${this.escapeHtml(artist.name)}</h3>
                    <div class="artist-stats">
                        <span>${trackCount} 首</span>
                        ${albumCount > 0 ? `<span>•</span><span>${albumCount} 专辑</span>` : ''}
                    </div>
                </div>
                <div class="planet-actions">
                    <button class="planet-play-btn" title="播放全部">
                        <svg viewBox="0 0 24 24">
                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // 获取星座星星大小
    getConstellationStarSize(popularity: number): string {
        if (popularity >= 80) return 'constellation-large';
        if (popularity >= 60) return 'constellation-medium';
        if (popularity >= 40) return 'constellation-small';
        return 'constellation-tiny';
    }

    // 获取星系行星大小
    getGalaxyPlanetSize(_popularity: number, orbitIndex: number): string {
        const baseSize = orbitIndex === 0 ? 'large' : orbitIndex === 1 ? 'medium' : orbitIndex === 2 ? 'small' : 'tiny';
        return `planet-${baseSize}`;
    }

    // 绑定视图特定的事件
    bindViewSpecificEvents(): void {
        if (this.viewMode === 'constellation') {
            this.bindConstellationEvents();
        } else {
            this.bindGalaxyEvents();
        }
    }

    // 绑定星座视图事件
    bindConstellationEvents(): void {
        this.container.querySelectorAll('.constellation-star').forEach((star: HTMLElement) => {
            const artistName = star.dataset.artist;
            const artist = this.artists.find(a => a.name === artistName);

            if (!artist) return;

            // 播放按钮
            const playBtn = star.querySelector('.constellation-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    this.playArtistWithAnimation(star, artist);
                    this.triggerConstellationEffect(star);
                });
            }

            // 点击星星查看详情
            star.addEventListener('click', (e: Event) => {
                // 检查是否点击了播放按钮
                if ((e.target as HTMLElement | null)?.closest('.constellation-play-btn')) {
                    return;
                }
                this.showArtistDetailWithTransition(artist, star);
            });

            // 悬停效果
            star.addEventListener('mouseenter', () => {
                this.animateConstellationHover(star, true);
            });

            star.addEventListener('mouseleave', () => {
                this.animateConstellationHover(star, false);
            });
        });
    }

    // 绑定星系视图事件
    bindGalaxyEvents(): void {
        this.container.querySelectorAll('.galaxy-planet').forEach((planet: HTMLElement) => {
            const artistName = planet.dataset.artist;
            const artist = this.artists.find(a => a.name === artistName);

            if (!artist) return;

            // 播放按钮
            const playBtn = planet.querySelector('.planet-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    this.playArtistWithAnimation(planet, artist);
                    this.triggerGalaxyEffect(planet);
                });
            }

            // 点击行星查看详情（避免播放按钮区域）
            planet.addEventListener('click', (e: Event) => {
                // 检查是否点击了播放按钮
                if ((e.target as HTMLElement | null)?.closest('.planet-play-btn')) {
                    return;
                }
                this.showArtistDetailWithTransition(artist, planet);
            });

            // 悬停效果
            planet.addEventListener('mouseenter', () => {
                this.animateGalaxyHover(planet, true);
            });

            planet.addEventListener('mouseleave', () => {
                this.animateGalaxyHover(planet, false);
            });
        });
    }

    // 星座悬停动画
    animateConstellationHover(star: HTMLElement, isHover: boolean): void {
        const core = star.querySelector<HTMLElement>('.star-constellation-core');
        const glow = star.querySelector<HTMLElement>('.star-constellation-glow');
        const twinkle = star.querySelector<HTMLElement>('.constellation-twinkle');
        if (!core || !glow || !twinkle) return;

        if (isHover) {
            core.style.transform = 'scale(1.1)';
            glow.style.opacity = '0.8';
            twinkle.style.animation = 'constellationTwinkle 0.8s ease-in-out infinite';
            this.highlightConstellationConnections(star);
        } else {
            core.style.transform = 'scale(1)';
            glow.style.opacity = '0.4';
            twinkle.style.animation = 'none';
            this.removeConstellationHighlight();
        }
    }

    // 星系悬停动画
    animateGalaxyHover(planet: HTMLElement, isHover: boolean): void {
        const core = planet.querySelector<HTMLElement>('.planet-core');
        const glow = planet.querySelector<HTMLElement>('.planet-glow');
        const ring = planet.querySelector<HTMLElement>('.planet-ring');
        if (!core || !glow || !ring) return;

        if (isHover) {
            core.style.transform = 'scale(1.15)';
            glow.style.opacity = '0.9';
            ring.style.animation = 'planetRingRotate 2s linear infinite';
            this.highlightOrbitTrail(planet);
        } else {
            core.style.transform = 'scale(1)';
            glow.style.opacity = '0.5';
            ring.style.animation = 'planetRingRotate 10s linear infinite';
            this.removeOrbitHighlight();
        }
    }

    // 触发星座效果
    triggerConstellationEffect(star: HTMLElement): void {
        const effect = document.createElement('div');
        effect.className = 'constellation-burst';
        star.appendChild(effect);

        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 1000);
    }

    // 触发星系效果
    triggerGalaxyEffect(planet: HTMLElement): void {
        const effect = document.createElement('div');
        effect.className = 'galaxy-pulse';
        planet.appendChild(effect);

        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 1500);
    }

    // 高亮星座连线
    highlightConstellationConnections(star: HTMLElement): void {
        const index = parseInt(star.dataset.index || '0');
        const lines = this.container.querySelectorAll('.constellation-line');

        lines.forEach((line: SVGLineElement, lineIndex: number) => {
            if (Math.abs(lineIndex - index) <= 1) {
                line.style.stroke = 'var(--color-primary)';
                line.style.strokeWidth = '3';
                line.style.opacity = '1';
            }
        });
    }

    // 移除星座高亮
    removeConstellationHighlight(): void {
        const lines = this.container.querySelectorAll('.constellation-line');
        lines.forEach((line: SVGLineElement) => {
            line.style.stroke = '';
            line.style.strokeWidth = '';
            line.style.opacity = '';
        });
    }

    // 高亮轨道轨迹
    highlightOrbitTrail(planet: HTMLElement): void {
        const orbit = planet.closest<HTMLElement>('.galaxy-orbit');
        if (orbit) {
            orbit.style.boxShadow = '0 0 20px rgba(var(--color-primary-rgb), 0.5)';
        }
    }

    // 移除轨道高亮
    removeOrbitHighlight(): void {
        const orbits = this.container.querySelectorAll('.galaxy-orbit');
        orbits.forEach((orbit: HTMLElement) => {
            orbit.style.boxShadow = '';
        });
    }

    // 切换视图模式
    switchViewMode(newMode: ArtistViewMode): void {
        const galaxyContainer = this.container.querySelector('.artists-galaxy') as HTMLElement | null;
        if (!galaxyContainer) return;

        // 添加淡出效果
        galaxyContainer.style.opacity = '0';
        galaxyContainer.style.transform = 'scale(0.95)';

        setTimeout(() => {
            this.viewMode = newMode;

            // 更新按钮状态
            this.container.querySelectorAll('.mode-btn').forEach((btn: HTMLElement) => {
                btn.classList.toggle('active', btn.dataset.view === newMode);
            });

            // 重新渲染内容
            galaxyContainer.innerHTML = this.viewMode === 'constellation' ?
                this.renderConstellationView() :
                this.renderGalaxyView();
            galaxyContainer.className = `artists-galaxy ${this.viewMode === 'constellation' ? 'constellation-view' : 'galaxy-view'}`;

            // 重新绑定事件
            this.bindViewSpecificEvents();

            // 视图切换后启动封面获取
            this._startCoverFetching();

            // 添加淡入效果
            setTimeout(() => {
                galaxyContainer.style.opacity = '1';
                galaxyContainer.style.transform = 'scale(1)';
            }, 50);
        }, 300);
    }

    renderArtistDetail(): void {
        if (!this.selectedArtist) return;

        const artist = this.selectedArtist;
        const albums = this.groupTracksByAlbum(artist.tracks);
        const popularity = this.calculateArtistPopularity(artist);

        // 为每个专辑准备封面信息
        this.prepareAlbumCovers(albums, artist.name);

        this.container.innerHTML = `
            <div class="page-content artist-detail modern-detail">
                <!-- 沉浸式艺术家英雄区域 -->
                <div class="artist-immersive-hero">
                    <div class="hero-background-blur">
                        <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}">
                        <div class="blur-overlay"></div>
                    </div>

                    <div class="hero-content-wrapper">
                        <button class="modern-back-btn" id="back-to-artists">
                            <svg viewBox="0 0 24 24">
                                <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
                            </svg>
                            <span>返回星河</span>
                        </button>

                        <div class="artist-hero-main">
                            <div class="artist-avatar-container">
                                <div class="avatar-glow" style="--glow-intensity: ${popularity / 100}"></div>
                                <div class="artist-avatar-large detail-target-avatar">
                                    <img src="${artist.cover || 'assets/images/default-cover.svg'}" alt="${artist.name}">
                                </div>
                                <div class="avatar-pulse"></div>
                            </div>

                            <div class="artist-hero-info">
                                <div class="artist-title-section">
                                    <h1 class="artist-title">${artist.name}</h1>
                                </div>

                                <div class="artist-stats-modern">
                                    <div class="stat-card">
                                        <span class="stat-number">${artist.tracks.length}</span>
                                        <span class="stat-label">歌曲</span>
                                    </div>
                                    <div class="stat-card">
                                        <span class="stat-number">${artist.albums.size}</span>
                                        <span class="stat-label">专辑</span>
                                    </div>
                                    <div class="stat-card">
                                        <span class="stat-number">${this.formatDuration(artist.totalDuration)}</span>
                                        <span class="stat-label">总时长</span>
                                    </div>
                                </div>

                                <div class="artist-actions-modern">
                                    <button class="action-btn primary-action" id="play-artist">
                                        <div class="btn-icon">
                                            <svg viewBox="0 0 24 24">
                                                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                            </svg>
                                        </div>
                                        <span>播放全部</span>
                                    </button>
                                    <button class="action-btn secondary-action" id="shuffle-artist">
                                        <div class="btn-icon">
                                            <svg viewBox="0 0 24 24">
                                                <path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/>
                                            </svg>
                                        </div>
                                        <span>随机播放</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 音乐轨道式专辑展示 -->
                <div class="music-tracks-container">
                    <h2 class="tracks-title">音乐轨道</h2>
                    <div class="album-tracks-modern">
                        ${Object.entries(albums).map(([albumName, tracks]) => `
                            <div class="album-orbit" data-album="${albumName}">
                                <div class="orbit-header">
                                    <div class="album-planet">
                                        <img src="${this.getAlbumCover(albumName, tracks)}" alt="${albumName}" class="album-cover-img" data-album="${albumName}">
                                        <div class="planet-ring"></div>
                                    </div>
                                    <div class="orbit-info">
                                        <h3 class="orbit-title">${albumName}</h3>
                                        <div class="orbit-stats">
                                            ${tracks.length} 首歌曲 • ${this.formatDuration(tracks.reduce((sum, t) => sum + (t.duration || 0), 0))}
                                        </div>
                                    </div>
                                    <button class="orbit-play-btn" data-album="${albumName}">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                                        </svg>
                                    </button>
                                </div>
                                <div class="orbit-tracks">
                                    ${tracks.map((track, index) => this.renderTrackRow(track, index)).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        this.setupDetailEventListeners();
    }

    // 渲染歌曲行
    renderTrackRow(track: Track, index: number): string {
        return `
            <div class="track-satellite" data-track-id="${track.id || index}">
                <div class="satellite-number">
                    <span>${String(index + 1).padStart(2, '0')}</span>
                </div>
                <div class="satellite-info">
                    <div class="track-title">${this.escapeHtml(track.title)}</div>
                    <div class="track-duration">${this.formatDuration(track.duration)}</div>
                </div>
                <div class="satellite-actions">
                    <button class="satellite-play-btn" title="播放">
                        <svg viewBox="0 0 24 24">
                            <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    groupTracksByAlbum(tracks: Track[]): Record<string, Track[]> {
        const albums: Record<string, Track[]> = {};
        tracks.forEach((track) => {
            const albumName = track.album || '未知专辑';
            if (!albums[albumName]) {
                albums[albumName] = [];
            }
            albums[albumName].push(track);
        });

        // 按专辑内的歌曲编号排序
        Object.values(albums).forEach((albumTracks) => {
            albumTracks.sort((a, b) => ((a.track as number | undefined) || 0) - ((b.track as number | undefined) || 0));
        });

        return albums;
    }

    // 为专辑准备封面信息
    prepareAlbumCovers(albums: Record<string, Track[]>, artistName: string): void {
        Object.entries(albums).forEach(([albumName, tracks]) => {
            // 为每个专辑异步获取封面
            this.fetchAlbumCoverAsync(albumName, artistName, tracks);
        });
    }

    // 获取专辑封面
    getAlbumCover(_albumName: string, tracks: Track[]): string {
        // 首先检查是否有已缓存的专辑封面
        if (tracks && tracks.length > 0) {
            // 查找是否有歌曲已经有封面
            const trackWithCover = tracks.find((track) => track.cover);
            if (trackWithCover) {
                return trackWithCover.cover || 'assets/images/default-cover.svg';
            }
        }
        return 'assets/images/default-cover.svg';
    }

    // 异步获取专辑封面
    async fetchAlbumCoverAsync(albumName: string, artistName: string, _tracks: Track[]): Promise<void> {
        try {
            // 检查是否已经在获取中
            const albumKey = `${artistName}_${albumName}`;
            if (this._coverLoading.has(albumKey) || this._coverFailures.has(albumKey)) {
                return;
            }

            this._coverLoading.add(albumKey);

            // 调用API获取专辑封面
            const result = await coverAPI.getCover('', artistName, albumName, null, false) as CoverResult;
            if (result && result.success && result.imageUrl) {
                // 更新专辑封面显示
                this.updateAlbumCoverDisplay(albumName, result.imageUrl);
            } else {
                this._coverFailures.add(albumKey);
                console.log('❌ 专辑封面获取失败:', albumName, result?.error);
            }
        } catch (e) {
            console.warn('获取专辑封面失败:', albumName, getErrorMessage(e));
            this._coverFailures.add(`${artistName}_${albumName}`);
        } finally {
            this._coverLoading.delete(`${artistName}_${albumName}`);
        }
    }

    // 更新专辑封面显示
    updateAlbumCoverDisplay(albumName: string, imageUrl: string): void {
        const albumImgs = this.container.querySelectorAll(`img[data-album="${albumName}"]`);
        albumImgs.forEach((img: HTMLImageElement) => {
            if (urlValidator) {
                urlValidator.safeSetImageSrc(img, imageUrl);
            } else {
                img.src = imageUrl;
            }
        });
    }

    setupDetailEventListeners(): void {
        if (!this.selectedArtist) return;
        const selectedArtist = this.selectedArtist;

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
                this.emit('playAll', selectedArtist.tracks);
            });
        }

        // 随机播放按钮
        const shuffleBtn = this.container.querySelector('#shuffle-artist');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                const shuffledTracks = [...selectedArtist.tracks].sort(() => Math.random() - 0.5);
                this.emit('playAll', shuffledTracks);
            });
        }

        // 专辑播放按钮
        this.container.querySelectorAll('.album-play-btn').forEach((btn: HTMLElement) => {
            const albumName = btn.dataset.album;
            btn.addEventListener('click', () => {
                const albumTracks = selectedArtist.tracks.filter((t) => (t.album || '未知专辑') === albumName);
                this.emit('playAll', albumTracks);
            });
        });

        // 歌曲行事件
        this.container.querySelectorAll('.track-row').forEach((row: HTMLElement) => {
            const trackPath = row.dataset.trackPath;
            const track = selectedArtist.tracks.find((t) => t.filePath === trackPath);

            if (!track) return;

            // 播放按钮
            const playBtn = row.querySelector('.track-actions .action-btn:first-child');
            if (playBtn) {
                playBtn.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    this.emit('trackPlayed', track, 0);
                });
            }

            // 添加到播放列表按钮
            const addBtn = row.querySelector('.track-actions .action-btn:last-child');
            if (addBtn) {
                addBtn.addEventListener('click', (e: Event) => {
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

    showArtistDetail(artist: ArtistInfo): void {
        this.selectedArtist = artist;
        this.render();
    }

    formatDuration(seconds: number = 0): string {
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
    escapeHtml(text: unknown): string {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }
}

function isArtistViewMode(value: unknown): value is ArtistViewMode {
    return value === 'constellation' || value === 'galaxy';
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export { ArtistsPage };
