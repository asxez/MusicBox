class Component extends EventEmitter {
    constructor(element) {
        super();
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.isDestroyed = false;

        if (!this.element) {
            console.error('Component element not found');
            return;
        }

        this.init();
    }

    init() {
        // Override in subclasses
    }

    destroy() {
        this.isDestroyed = true;
        this.removeAllListeners();
    }

    removeAllListeners() {
        this.events = {};
    }
}

// Player Component
class Player extends Component {
    constructor() {
        super('#player');
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.previousVolume = 0.7;
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;

        this.setupElements();
        this.setupEventListeners();
        this.setupAPIListeners();
        this.updateUI();
    }

    setupElements() {
        this.playPauseBtn = this.element.querySelector('#play-pause-btn');
        this.prevBtn = this.element.querySelector('#prev-btn');
        this.nextBtn = this.element.querySelector('#next-btn');
        this.playModeBtn = this.element.querySelector('#play-mode-btn');
        this.lyricsBtn = this.element.querySelector('#lyrics-btn');
        this.playlistBtn = this.element.querySelector('#playlist-btn');
        this.likeBtn = this.element.querySelector('#like-btn');

        this.trackCover = this.element.querySelector('#track-cover');
        this.trackTitle = this.element.querySelector('#track-title');
        this.trackArtist = this.element.querySelector('#track-artist');

        // Updated selectors for new structure
        this.progressBarContainer = this.element.querySelector('.progress-bar-container');
        this.progressTrack = this.element.querySelector('.progress-track');
        this.progressFill = this.element.querySelector('#progress-fill');
        this.progressHandle = this.element.querySelector('#progress-handle');
        this.progressTooltip = this.element.querySelector('#progress-tooltip');

        this.volumeBtn = this.element.querySelector('#volume-btn');
        this.volumeSlider = this.element.querySelector('.volume-slider');
        this.volumeFill = this.element.querySelector('#volume-fill');
        this.volumeHandle = this.element.querySelector('#volume-handle');

        this.playIcon = this.playPauseBtn.querySelector('.play-icon');
        this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

        // Play mode icons
        this.modeSequenceIcon = this.playModeBtn ? this.playModeBtn.querySelector('.mode-sequence') : null;
        this.modeShuffleIcon = this.playModeBtn ? this.playModeBtn.querySelector('.mode-shuffle') : null;
        this.modeRepeatOneIcon = this.playModeBtn ? this.playModeBtn.querySelector('.mode-repeat-one') : null;

        // Volume icons
        this.volumeHighIcon = this.volumeBtn.querySelector('.volume-high');
        this.volumeHalfIcon = this.volumeBtn.querySelector('.volume-half');
        this.volumeMuteIcon = this.volumeBtn.querySelector('.volume-mute');
    }

    setupEventListeners() {
        // Play/pause button
        this.playPauseBtn.addEventListener('click', async () => {
            await this.togglePlayPause();
        });

        // Previous/next buttons
        this.prevBtn.addEventListener('click', async () => {
            await api.previousTrack();
        });

        this.nextBtn.addEventListener('click', async () => {
            await api.nextTrack();
        });

        // Progress bar - improved interaction
        this.progressBarContainer.addEventListener('mousedown', (e) => {
            this.isDraggingProgress = true;
            this.progressBarContainer.classList.add('dragging');
            this.updateProgress(e);
            e.preventDefault();
        });

        // Show tooltip on hover
        this.progressBarContainer.addEventListener('mousemove', (e) => {
            if (!this.isDraggingProgress) {
                this.updateProgressTooltip(e);
            }
        });

        this.progressBarContainer.addEventListener('mouseleave', () => {
            if (!this.isDraggingProgress) {
                this.progressTooltip.style.opacity = '0';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingProgress) {
                this.updateProgress(e);
            }
        });

        document.addEventListener('mouseup', async () => {
            if (this.isDraggingProgress) {
                this.isDraggingProgress = false;
                this.progressBarContainer.classList.remove('dragging');
                this.progressTooltip.style.opacity = '0';
                const progress = parseFloat(this.progressFill.style.width) / 100;
                await api.seek(this.duration * progress);
            }
        });

        // Volume slider
        this.volumeSlider.addEventListener('mousedown', (e) => {
            this.isDraggingVolume = true;
            this.updateVolume(e);
        });

        this.volumeSlider.addEventListener('input', (e) => {
            this.updateVolume(e.target.value);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingVolume) {
                this.updateVolume(e);
            }
        });

        document.addEventListener('mouseup', async () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
                const volume = parseFloat(this.volumeFill.style.width) / 100;
                await api.setVolume(volume);
            }
        });

        this.volumeBtn.addEventListener('click', async () => {
            await this.toggleMute();
        });
        this.playModeBtn.addEventListener('click', () => {
            const newMode = api.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });
        this.lyricsBtn.addEventListener('click', () => {
            this.emit('toggleLyrics');
        });
        this.playlistBtn.addEventListener('click', () => {
            this.emit('togglePlaylist');
        });

        // API events
        api.on('trackChanged', async (track) => {
            await this.updateTrackInfo(track);
        });

        api.on('playbackStateChanged', (state) => {
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('positionChanged', (position) => {
            if (!this.isDraggingProgress) {
                this.currentTime = position;
                this.updateProgressDisplay();
            }
        });

        api.on('volumeChanged', (volume) => {
            this.volume = volume;
            this.updateVolumeDisplay();
        });

        api.on('trackIndexChanged', (index) => {
            this.emit('trackIndexChanged', index);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayPause().then(() => {
                    console.log('⏸️⏭️ 收到键盘更新状态')
                });
            }
        });
    }

    setupAPIListeners() {
        // 用于实时更新的增强型 API 事件监听
        api.on('trackLoaded', async (track) => {
            console.log('Track loaded in player:', track);
            await this.updateTrackInfo(track);
        });

        api.on('durationChanged', (duration) => {
            this.duration = duration;
            this.updateProgressDisplay();
        });

        api.on('positionChanged', (position) => {
            if (!this.isDraggingProgress) {
                this.currentTime = position;
                this.updateProgressDisplay();
            }
        });

        api.on('playbackStateChanged', (state) => {
            console.log('🎵 Player: 收到播放状态变化事件:', state);
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('volumeChanged', (volume) => {
            this.volume = volume;
            this.updateVolumeDisplay();
        });
    }

    updateProgress(e) {
        const rect = this.progressTrack.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.progressFill.style.width = `${progress * 100}%`;
        this.progressHandle.style.left = `${progress * 100}%`;

        // 更新进度条位置和内容
        const time = this.duration * progress;
        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    updateProgressTooltip(e) {
        const rect = this.progressTrack.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = this.duration * progress;

        this.progressTooltip.textContent = formatTime(time);
        this.progressTooltip.style.left = `${progress * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }

    updateVolume(e) {
        const rect = this.volumeSlider.getBoundingClientRect();
        const volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.volumeFill.style.width = `${volume * 100}%`;
        this.volumeHandle.style.left = `${volume * 100}%`;
    }

    async updateTrackInfo(track) {
        if (track) {
            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';
            this.duration = track.duration || 0;
            // 更新封面图片
            await this.updateCoverArt(track);
        }
    }

    async updateCoverArt(track) {
        // 首先设置默认封面
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');

        try {
            // 检查是否已有本地封面
            if (track.cover) {
                console.log('🖼️ Player: 使用本地封面');
                this.trackCover.src = track.cover;
                this.trackCover.classList.remove('loading');
                return;
            }

            // 尝试从API获取封面
            if (track.title && track.artist) {
                console.log('🖼️ Player: 从API获取封面');
                const coverResult = await api.getCover(track.title, track.artist, track.album);

                if (coverResult.success) {
                    this.trackCover.src = coverResult.imageUrl;
                    console.log('✅ Player: 封面更新成功');

                    // 缓存封面URL到track对象
                    track.coverUrl = coverResult.imageUrl;
                } else {
                    console.log('❌ Player: 封面获取失败，使用默认封面');
                }
            }
        } catch (error) {
            console.error('❌ Player: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    updatePlayButton() {
        console.log('🔄 Player: 更新播放按钮，当前状态:', this.isPlaying);

        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            console.log('✅ Player: 显示暂停图标');
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            console.log('✅ Player: 显示播放图标');
        }
    }

    updateProgressDisplay() {
        if (!this.isDraggingProgress) {
            const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
            this.progressFill.style.width = `${progress}%`;
            this.progressHandle.style.left = `${progress}%`;
        }
    }

    updateVolumeDisplay() {
        const volumePercent = this.volume * 100;
        this.volumeFill.style.width = `${volumePercent}%`;
        this.volumeHandle.style.left = `${volumePercent}%`;

        // Update volume icon based on volume level
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        // Hide all icons first
        if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';

        // Show appropriate icon based on volume level
        if (this.volume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.volume <= 0.5) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'block';
        }
    }

    updatePlayModeDisplay(mode) {
        // 检查是否有这个模式
        if (!this.modeSequenceIcon || !this.modeShuffleIcon || !this.modeRepeatOneIcon) {
            console.warn('🎵 Player: 播放模式图标元素不存在');
            return;
        }

        this.modeSequenceIcon.style.display = 'none';
        this.modeShuffleIcon.style.display = 'none';
        this.modeRepeatOneIcon.style.display = 'none';
        switch (mode) {
            case 'sequence':
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                this.modeShuffleIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                this.modeRepeatOneIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '单曲循环';
                break;
            default:
                // 默认显示顺序播放
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
        }
        console.log('🎵 Player: 播放模式显示更新为:', mode);
    }

    updateUI() {
        this.updatePlayButton();
        this.updateProgressDisplay();
        this.updateVolumeDisplay();
        this.updatePlayModeDisplay(api.getPlayMode());
    }

    async togglePlayPause() {
        console.log('🔄 Player: 切换播放状态，当前状态:', this.isPlaying);

        try {
            if (this.isPlaying) {
                console.log('🔄 Player: 请求暂停');
                const result = await api.pause();
                if (!result) {
                    console.error('❌ Player: 暂停失败');
                }
            } else {
                console.log('🔄 Player: 请求播放');
                const result = await api.play();
                if (!result) {
                    console.error('❌ Player: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Player: 切换播放状态失败:', error);
        }
    }

    async toggleMute() {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            await api.setVolume(0);
        } else {
            await api.setVolume(this.previousVolume || 0.7);
        }
    }
}

// Search Component
class Search extends Component {
    constructor() {
        super('#search-input');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const debouncedSearch = debounce((query) => {
            this.performSearch(query);
        }, 200);

        this.element.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                debouncedSearch(query);
            } else if (query.length === 0) {
                this.clearSearch();
            }
        });

        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.element.value = '';
                this.clearSearch();
            }
        });
    }

    async performSearch(query) {
        try {
            const results = await api.searchLibrary(query);
            this.emit('searchResults', results);
        } catch (error) {
            console.error('Search failed:', error);
            showToast('搜索失败', 'error');
        }
    }

    clearSearch() {
        this.emit('searchCleared');
    }
}

// Navigation Component
class Navigation extends Component {
    constructor() {
        super('#navbar');
        this.currentView = 'library';
        this.sidebarCollapsed = false;
        this.setupElements();
        this.setupEventListeners();
        this.restoreSidebarState();
    }

    setupElements() {
        this.backBtn = this.element.querySelector('#back-btn');
        this.forwardBtn = this.element.querySelector('#forward-btn');
        this.settingsBtn = this.element.querySelector('#settings-btn');
        this.themeToggle = this.element.querySelector('#theme-toggle');
        this.lightIcon = this.themeToggle.querySelector('.light-icon');
        this.darkIcon = this.themeToggle.querySelector('.dark-icon');

        // 侧边栏相关元素
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        this.app = document.getElementById('app');
    }

    setupEventListeners() {
        this.themeToggle.addEventListener('click', () => {
            theme.toggle();
            this.updateThemeIcon();
        });

        this.settingsBtn.addEventListener('click', () => {
            this.emit('showSettings');
        });

        // Listen for theme changes
        theme.on('change', () => {
            this.updateThemeIcon();
        });

        // Initialize theme icon
        this.updateThemeIcon();

        // 侧边栏切换按钮
        this.sidebarToggleBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Sidebar navigation
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
        // Update active link
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

        // 保存状态到本地存储
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);

        console.log('🎵 Navigation: 侧边栏状态切换', this.sidebarCollapsed ? '收缩' : '展开');
    }

    // 恢复侧边栏状态
    restoreSidebarState() {
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            this.sidebarCollapsed = true;
            this.sidebar.classList.add('collapsed');
            this.app.classList.add('sidebar-collapsed');
        }
    }
}

// Track List Component
class TrackList extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.selectedTracks = new Set();
    }

    setTracks(tracks) {
        this.tracks = tracks;
        this.render();
    }

    render() {
        if (!this.element) return;

        this.element.innerHTML = '';

        if (this.tracks.length === 0) {
            this.element.innerHTML = '<div class="empty-state">啥也没有！</div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'track-list';

        this.tracks.forEach((track, index) => {
            const item = this.createTrackItem(track, index);
            list.appendChild(item);
        });

        this.element.appendChild(list);
    }

    createTrackItem(track, index) {
        const item = document.createElement('div');
        item.className = 'track-item';
        item.dataset.index = index;

        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info">
                <div class="track-title">${sanitizeHTML(track.title || 'Unknown Title')}</div>
                <div class="track-artist">${sanitizeHTML(track.artist || 'Unknown Artist')}</div>
            </div>
            <div class="track-album">${sanitizeHTML(track.album || 'Unknown Album')}</div>
            <div class="track-duration">${formatTime(track.duration || 0)}</div>
        `;

        item.addEventListener('dblclick', async () => {
            await this.playTrack(track, index);
        });

        item.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.toggleTrackSelection(index);
            } else {
                this.selectTrack(index);
            }
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.emit('trackRightClick', track, index, e.clientX, e.clientY);
        });

        return item;
    }

    async playTrack(track, index) {
        try {
            console.log(`🎵 双击播放: ${track.title || track.filePath}`);

            // 加载并播放音频文件
            const loadResult = await api.loadTrack(track.filePath);
            if (loadResult) {
                // 自动开始播放
                const playResult = await api.play();
                if (playResult) {
                    console.log('✅ 双击播放成功');
                } else {
                    console.log('❌ 双击播放失败');
                }
            } else {
                console.log('❌ 双击加载文件失败');
            }

            this.emit('trackPlayed', track, index);
        } catch (error) {
            console.error('❌ 双击播放错误:', error);
        }
    }

    selectTrack(index) {
        this.selectedTracks.clear();
        this.selectedTracks.add(index);
        this.updateSelection();
    }

    toggleTrackSelection(index) {
        if (this.selectedTracks.has(index)) {
            this.selectedTracks.delete(index);
        } else {
            this.selectedTracks.add(index);
        }
        this.updateSelection();
    }

    updateSelection() {
        const items = this.element.querySelectorAll('.track-item');
        items.forEach((item, index) => {
            if (this.selectedTracks.has(index)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

// Playlist component
class Playlist extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.tracks = [];
        this.currentTrackIndex = -1;

        this.setupElements();
        this.setupEventListeners();

        console.log('🎵 Playlist: 组件初始化完成');
    }

    setupElements() {
        this.panel = this.element;
        this.closeBtn = this.element.querySelector('#playlist-close');
        this.clearBtn = this.element.querySelector('#playlist-clear');
        this.countEl = this.element.querySelector('#playlist-count');
        this.tracksContainer = this.element.querySelector('#playlist-tracks');
    }

    setupEventListeners() {
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.panel.contains(e.target) && !e.target.closest('#playlist-btn')) {
                this.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show() {
        this.isVisible = true;
        this.panel.style.display = 'flex';
        this.panel.classList.add('show');

        // 自动滚动到当前播放的歌曲
        this.scrollToCurrentTrack();

        console.log('🎵 Playlist: 显示播放列表');
    }

    hide() {
        this.isVisible = false;
        this.panel.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                this.panel.style.display = 'none';
            }
        }, 300);
        console.log('🎵 Playlist: 隐藏播放列表');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    addTrack(track, shouldRender = true) {
        this.tracks.push(track);
        if (shouldRender) {
            this.render();
        }
        console.log('🎵 Playlist: 添加歌曲到播放列表:', track.title);
        return this.tracks.length - 1; // 返回新添加歌曲的索引
    }

    removeTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            const track = this.tracks[index];
            const wasCurrentTrack = index === this.currentTrackIndex;

            this.tracks.splice(index, 1);

            // Adjust current track index
            if (index < this.currentTrackIndex) {
                this.currentTrackIndex--;
            } else if (index === this.currentTrackIndex) {
                // 如果删除的是当前播放歌曲
                if (this.tracks.length > 0) {
                    // 如果还有歌曲，保持在相同位置
                    this.currentTrackIndex = Math.min(index, this.tracks.length - 1);
                } else {
                    // 如果没有歌曲了，设置为-1
                    this.currentTrackIndex = -1;
                }
            }

            this.render();
            this.emit('trackRemoved', {track, index, wasCurrentTrack});
            console.log('🎵 Playlist: 从播放列表移除歌曲:', track.title, '是否为当前播放:', wasCurrentTrack);
        }
    }

    clear() {
        this.tracks = [];
        this.currentTrackIndex = -1;
        this.render();
        this.emit('playlistCleared');
        console.log('🎵 Playlist: 清空播放列表');
    }

    setTracks(tracks, currentIndex = -1) {
        this.tracks = [...tracks];
        this.currentTrackIndex = currentIndex;
        this.render();
        console.log('🎵 Playlist: 设置播放列表:', tracks.length, '首歌曲');
    }

    setCurrentTrack(index) {
        this.currentTrackIndex = index;
        this.render();

        // 如果播放列表可见，滚动到当前歌曲
        if (this.isVisible) {
            this.scrollToCurrentTrack();
        }
    }

    scrollToCurrentTrack() {
        if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length) {
            setTimeout(() => {
                const currentTrackEl = this.tracksContainer.querySelector(`[data-index="${this.currentTrackIndex}"]`);
                if (currentTrackEl) {
                    currentTrackEl.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100); // 等待渲染完成
        }
    }

    render() {
        this.countEl.textContent = `${this.tracks.length} 首歌曲`;

        if (this.tracks.length === 0) {
            this.tracksContainer.innerHTML = `
                <div class="playlist-empty">
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A3,3 0 0,0 7,16A3,3 0 0,0 10,19A3,3 0 0,0 13,16V7H19V5H12V3Z"/>
                    </svg>
                    <p>播放列表为空</p>
                </div>
            `;
            return;
        }

        this.tracksContainer.innerHTML = this.tracks.map((track, index) => {
            const isCurrent = index === this.currentTrackIndex;
            const trackNumber = isCurrent ?
                `<svg class="icon playing-icon" viewBox="0 0 24 24">
                    <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                </svg>` :
                (index + 1);

            return `
                <div class="playlist-track ${isCurrent ? 'current playing' : ''}" data-index="${index}">
                    <div class="playlist-track-number">${trackNumber}</div>
                    <div class="playlist-track-info">
                        <div class="playlist-track-title">${track.title || 'Unknown Title'}</div>
                        <div class="playlist-track-artist">${track.artist || 'Unknown Artist'}</div>
                    </div>
                    <div class="playlist-track-duration">${formatTime(track.duration || 0)}</div>
                    <button class="playlist-track-remove" data-index="${index}">
                        <svg class="icon" viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Add event listeners to track elements
        this.tracksContainer.querySelectorAll('.playlist-track').forEach(trackEl => {
            trackEl.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-track-remove')) {
                    const index = parseInt(trackEl.dataset.index);
                    this.emit('trackSelected', {track: this.tracks[index], index});
                }
            });

            // Add double-click event for playing
            trackEl.addEventListener('dblclick', (e) => {
                if (!e.target.closest('.playlist-track-remove')) {
                    const index = parseInt(trackEl.dataset.index);
                    this.emit('trackPlayed', {track: this.tracks[index], index});
                }
            });
        });

        // Add event listeners to remove buttons
        this.tracksContainer.querySelectorAll('.playlist-track-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(removeBtn.dataset.index);
                this.removeTrack(index);
            });
        });
    }
}

// Context Menu component
class ContextMenu extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.currentIndex = -1;

        this.setupElements();
        this.setupEventListeners();

        console.log('🎵 ContextMenu: 组件初始化完成');
    }

    setupElements() {
        this.menu = this.element;
        this.playItem = this.element.querySelector('#context-play');
        this.addToPlaylistItem = this.element.querySelector('#context-add-to-playlist');
        this.deleteItem = this.element.querySelector('#context-delete');
    }

    setupEventListeners() {
        this.playItem.addEventListener('click', () => {
            this.emit('play', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.addToPlaylistItem.addEventListener('click', () => {
            this.emit('addToPlaylist', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        this.deleteItem.addEventListener('click', () => {
            this.emit('delete', {track: this.currentTrack, index: this.currentIndex});
            this.hide();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show(x, y, track, index) {
        this.currentTrack = track;
        this.currentIndex = index;
        this.isVisible = true;

        // Position the menu
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.style.display = 'block';

        // Adjust position if menu goes off screen
        const rect = this.menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            this.menu.style.left = `${windowWidth - rect.width - 10}px`;
        }

        if (rect.bottom > windowHeight) {
            this.menu.style.top = `${windowHeight - rect.height - 10}px`;
        }

        console.log('🎵 ContextMenu: 显示右键菜单');
    }

    hide() {
        this.isVisible = false;
        this.menu.style.display = 'none';
        this.currentTrack = null;
        this.currentIndex = -1;
        console.log('🎵 ContextMenu: 隐藏右键菜单');
    }
}

// Settings component
class Settings extends EventEmitter {
    constructor(element) {
        super();
        this.element = element;
        this.isVisible = false;
        this.settings = this.loadSettings();

        this.setupElements();
        this.setupEventListeners();
        this.initializeSettings();

        console.log('🎵 Settings: 组件初始化完成');
    }

    setupElements() {
        this.page = this.element;

        // 关闭按钮
        this.closeBtn = this.element.querySelector('#settings-close-btn');

        // 设置控件元素
        this.languageSelect = this.element.querySelector('#language-select');
        this.defaultVolumeSlider = this.element.querySelector('#default-volume');
        this.volumeValue = this.element.querySelector('.volume-value');
        this.autoplayToggle = this.element.querySelector('#autoplay-toggle');
        this.rememberPositionToggle = this.element.querySelector('#remember-position-toggle');
        this.autoScanToggle = this.element.querySelector('#auto-scan-toggle');
        this.selectFolderBtn = this.element.querySelector('#select-folder-btn');
        this.selectLyricsFolderBtn = this.element.querySelector('#select-lyrics-folder-btn');
        this.lyricsFolderPath = this.element.querySelector('#lyrics-folder-path');
        this.rescanLibraryBtn = this.element.querySelector('#rescan-library-btn');
        this.checkUpdatesBtn = this.element.querySelector('#check-updates-btn');

        // 缓存管理元素
        this.viewCacheStatsBtn = this.element.querySelector('#view-cache-stats-btn');
        this.validateCacheBtn = this.element.querySelector('#validate-cache-btn');
        this.clearCacheBtn = this.element.querySelector('#clear-cache-btn');
        this.cacheStatsDescription = this.element.querySelector('#cache-stats-description');
    }

    setupEventListeners() {
        // 关闭按钮事件
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // 语言设置
        this.languageSelect.addEventListener('change', (e) => {
            this.updateSetting('language', e.target.value);
            this.emit('languageChanged', e.target.value);
        });

        // 默认音量设置
        this.defaultVolumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            this.volumeValue.textContent = `${volume}%`;
            this.updateSetting('defaultVolume', volume);
            this.emit('defaultVolumeChanged', volume);
        });

        // 各种开关设置
        this.autoplayToggle.addEventListener('change', (e) => {
            this.updateSetting('autoplay', e.target.checked);
        });

        this.rememberPositionToggle.addEventListener('change', (e) => {
            this.updateSetting('rememberPosition', e.target.checked);
        });

        this.autoScanToggle.addEventListener('change', (e) => {
            this.updateSetting('autoScan', e.target.checked);
        });

        // 按钮事件
        this.selectFolderBtn.addEventListener('click', () => {
            this.emit('selectMusicFolder');
        });

        this.selectLyricsFolderBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectFolder();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const selectedPath = result.filePaths[0];
                    this.updateSetting('lyricsDirectory', selectedPath);
                    this.lyricsFolderPath.textContent = selectedPath;
                    this.lyricsFolderPath.classList.add('selected');

                    // 更新本地歌词管理器
                    if (window.localLyricsManager) {
                        window.localLyricsManager.setLyricsDirectory(selectedPath);
                    }

                    console.log(`✅ Settings: 本地歌词目录已设置为 ${selectedPath}`);
                }
            } catch (error) {
                console.error('❌ Settings: 选择歌词目录失败:', error);
            }
        });

        this.rescanLibraryBtn.addEventListener('click', () => {
            this.emit('rescanLibrary');
        });

        this.checkUpdatesBtn.addEventListener('click', () => {
            this.emit('checkUpdates');
        });

        // 缓存管理按钮事件
        this.viewCacheStatsBtn.addEventListener('click', async () => {
            await this.showCacheStatistics();
        });

        this.validateCacheBtn.addEventListener('click', async () => {
            await this.validateCache();
        });

        this.clearCacheBtn.addEventListener('click', async () => {
            await this.clearCache();
        });

        // 关闭设置页面 (ESC键)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async show() {
        this.isVisible = true;
        this.page.style.display = 'block';

        // 隐藏其他页面元素
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';

        // 使用 requestAnimationFrame 确保动画正常播放
        requestAnimationFrame(() => {
            this.page.classList.add('show');
        });

        // 加载缓存统计信息
        await this.showCacheStatistics();
        console.log('🎵 Settings: 显示设置页面');
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');
        this.page.classList.add('hiding');

        // 等待动画完成后隐藏页面
        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
                this.page.classList.remove('hiding');

                // 恢复其他页面元素
                document.getElementById('sidebar').style.display = 'block';
                document.getElementById('main-content').style.display = 'block';
            }
        }, 300);

        console.log('🎵 Settings: 隐藏设置页面');
    }

    async toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show();
        }
    }

    // 初始化设置值
    initializeSettings() {
        this.languageSelect.value = this.settings.language || 'zh-CN';
        this.defaultVolumeSlider.value = this.settings.defaultVolume || 50;
        this.volumeValue.textContent = `${this.settings.defaultVolume || 50}%`;
        this.autoplayToggle.checked = this.settings.autoplay || false;
        this.rememberPositionToggle.checked = this.settings.rememberPosition || false;
        this.autoScanToggle.checked = this.settings.autoScan || false;

        // 初始化本地歌词目录
        const lyricsDirectory = this.settings.lyricsDirectory;
        if (lyricsDirectory) {
            this.lyricsFolderPath.textContent = lyricsDirectory;
            this.lyricsFolderPath.classList.add('selected');

            // 设置本地歌词管理器
            if (window.localLyricsManager) {
                window.localLyricsManager.setLyricsDirectory(lyricsDirectory);
            }
        } else {
            this.lyricsFolderPath.textContent = '未选择';
            this.lyricsFolderPath.classList.remove('selected');
        }
    }

    // 加载设置
    loadSettings() {
        let settings = window.cacheManager.getLocalCache('musicbox-settings');
        if (settings === null)
            settings = {};
        return settings;
    }

    // 更新设置
    updateSetting(key, value) {
        this.settings[key] = value;
        window.cacheManager.setLocalCache('musicbox-settings', this.settings);
    }

    // 获取设置值
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    // 更新音乐文件夹路径显示
    updateMusicFolderPath(path) {
        this.updateSetting('musicDirectory', path);
        console.log(`✅ Settings: 音乐文件夹路径已更新为 ${path}`);
        // 这里可以添加UI更新逻辑，比如显示选中的路径
    }

    // 缓存管理方法
    async showCacheStatistics() {
        try {
            this.viewCacheStatsBtn.disabled = true;
            this.viewCacheStatsBtn.textContent = '获取中...';

            const stats = await api.getCacheStatistics();

            if (stats) {
                const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
                const cacheAgeDays = Math.floor(stats.cacheAge / (1000 * 60 * 60 * 24));

                this.cacheStatsDescription.textContent =
                    `缓存了 ${stats.totalTracks} 个音乐文件，总大小 ${totalSizeMB} MB，已扫描 ${stats.scannedDirectories} 个目录，缓存时间 ${cacheAgeDays} 天`;

                showToast(`缓存统计: ${stats.totalTracks} 个文件，${totalSizeMB} MB`, 'info');
            } else {
                showToast('获取缓存统计失败', 'error');
            }
        } catch (error) {
            console.error('获取缓存统计失败:', error);
            showToast('获取缓存统计失败', 'error');
        } finally {
            this.viewCacheStatsBtn.disabled = false;
            this.viewCacheStatsBtn.textContent = '查看统计';
        }
    }

    async validateCache() {
        try {
            this.validateCacheBtn.disabled = true;
            this.validateCacheBtn.textContent = '验证中...';
            showToast('开始验证缓存，请稍候...', 'info');
            const result = await api.validateCache();

            if (result) {
                const message = `缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`;
                showToast(message, 'success');
            } else {
                showToast('缓存验证失败', 'error');
            }
        } catch (error) {
            console.error('缓存验证失败:', error);
            showToast('缓存验证失败', 'error');
        } finally {
            this.validateCacheBtn.disabled = false;
            this.validateCacheBtn.textContent = '验证缓存';
        }
    }

    async clearCache() {
        if (!confirm('确定要清空所有缓存吗？这将删除所有已缓存的音乐文件信息，下次启动时需要重新扫描。')) {
            return;
        }

        try {
            this.clearCacheBtn.disabled = true;
            this.clearCacheBtn.textContent = '清空中...';

            const success = await api.clearCache();

            if (success) {
                showToast('缓存已清空', 'success');
                this.cacheStatsDescription.textContent = '缓存已清空';
            } else {
                showToast('清空缓存失败', 'error');
            }
        } catch (error) {
            console.error('清空缓存失败:', error);
            showToast('清空缓存失败', 'error');
        } finally {
            this.clearCacheBtn.disabled = false;
            this.clearCacheBtn.textContent = '清空缓存';
        }
    }
}

// Lyrics component
class Lyrics extends EventEmitter {
    constructor(element) {
        super();
        this.isPlaying = false;
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.isLoading = false;

        this.setupElements();
        this.setupEventListeners();
        this.setupAPIListeners();
        console.log('🎵 Lyrics: 组件初始化完成');
    }

    setupElements() {
        this.page = this.element;
        this.background = this.element.querySelector('.lyrics-background');
        this.closeBtn = this.element.querySelector('#lyrics-close');
        this.fullscreenBtn = this.element.querySelector('#lyrics-fullscreen');

        // 全屏按钮图标
        this.fullscreenIcon = this.fullscreenBtn.querySelector('.fullscreen-icon');
        this.fullscreenExitIcon = this.fullscreenBtn.querySelector('.fullscreen-exit-icon');

        // 封面和歌曲信息
        this.trackCover = this.element.querySelector('#lyrics-cover-image');
        this.trackTitle = this.element.querySelector('#lyrics-track-title');
        this.trackArtist = this.element.querySelector('#lyrics-track-artist');

        // 歌词显示
        this.lyricsDisplay = this.element.querySelector('#lyrics-display');

        // 播放控制
        this.playBtn = this.element.querySelector('#lyrics-play-btn');
        this.prevBtn = this.element.querySelector('#lyrics-prev-btn');
        this.nextBtn = this.element.querySelector('#lyrics-next-btn');
        this.playIcon = this.playBtn.querySelector('.play-icon');
        this.pauseIcon = this.playBtn.querySelector('.pause-icon');

        // 进度条
        this.progressBar = this.element.querySelector('#lyrics-progress-bar');
        this.progressFill = this.element.querySelector('#lyrics-progress-fill');
        this.progressHandle = this.element.querySelector('#lyrics-progress-handle');
        this.currentTimeEl = this.element.querySelector('#lyrics-current-time');
        this.durationEl = this.element.querySelector('#lyrics-duration');

        // 音量控制
        this.volumeBtn = this.element.querySelector('#lyrics-volume-btn');
        this.volumeSliderContainer = this.element.querySelector('.volume-slider-container');
        this.volumeSlider = this.element.querySelector('.volume-slider');
        this.volumeFill = this.element.querySelector('#lyrics-volume-fill');
        this.volumeHandle = this.element.querySelector('#lyrics-volume-handle');
        this.volumeIcon = this.volumeBtn.querySelector('.volume-icon');
        this.volumeMuteIcon = this.volumeBtn.querySelector('.volume-mute-icon');
        this.volumeHalfIcon = this.volumeBtn.querySelector('.volume-half-icon');

        // 播放模式控制
        this.playModeBtn = this.element.querySelector('#lyrics-playmode-btn');
        this.modeSequenceIcon = this.playModeBtn.querySelector('.lyrics-mode-sequence');
        this.modeShuffleIcon = this.playModeBtn.querySelector('.lyrics-mode-shuffle');
        this.modeRepeatOneIcon = this.playModeBtn.querySelector('.lyrics-mode-repeat-one');

        // 全屏状态
        this.isFullscreen = false;

        // 控制状态
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;
        this.currentVolume = 50;
        this.previousVolume = 50;
    }

    setupEventListeners() {
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        this.playBtn.addEventListener('click', async () => {
            await this.togglePlayPause();
        });

        this.prevBtn.addEventListener('click', async () => {
            await api.previousTrack();
        });

        this.nextBtn.addEventListener('click', async () => {
            await api.nextTrack();
        });

        // 音量控制事件
        this.volumeBtn.addEventListener('click', async () => {
            await this.toggleVolumeMute();
        });

        // 音量条点击和拖拽事件
        this.volumeSliderContainer.addEventListener('mousedown', async (e) => {
            this.isDraggingVolume = true;
            await this.updateVolumeFromEvent(e);
        });

        this.volumeSliderContainer.addEventListener('click', async (e) => {
            if (!this.isDraggingVolume) {
                await this.updateVolumeFromEvent(e);
            }
        });

        document.addEventListener('mousemove', async (e) => {
            if (this.isDraggingVolume) {
                await this.updateVolumeFromEvent(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
            }
        });

        // 播放模式切换事件
        this.playModeBtn.addEventListener('click', () => {
            const newMode = api.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });

        // 进度条交互事件
        this.progressBar.addEventListener('click', async (e) => {
            await this.seekToPosition(e);
        });

        this.progressBar.addEventListener('mousedown', (e) => {
            this.startProgressDrag(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingProgress) {
                this.updateProgressDrag(e);
            }
        });

        document.addEventListener('mouseup', async () => {
            if (this.isDraggingProgress) {
                await this.endProgressDrag();
            }
        });

        // 监听全屏状态变化
        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenState();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                if (this.isFullscreen) {
                    this.exitFullscreen();
                } else {
                    this.hide();
                }
            } else if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayPause().then(() => {
                    console.log('⏸️⏭️ 收到键盘更新状态')
                });
            } else if (e.key === 'F11' && this.isVisible) {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });

        const HIDE_DELAY = 2000;
        let mouseTimer = null;
        this.element.addEventListener('mousemove', () => {
            if (this.isVisible && this.isFullscreen) {
                this.element.classList.remove('hide-cursor');
                clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    this.element.classList.add('hide-cursor');
                }, HIDE_DELAY);
            }
        });

        api.on('playbackStateChanged', (state) => {
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('trackChanged', async (track) => {
            await this.updateTrackInfo(track);
        });

        // 监听时长变化事件，确保总时长正确显示
        api.on('durationChanged', (duration) => {
            if (this.durationEl && duration > 0) {
                this.durationEl.textContent = this.formatTime(duration);
                console.log('🎵 Lyrics: 时长更新:', this.formatTime(duration));
            }
        });
    }

    setupAPIListeners() {
        // 监听播放进度变化，用于歌词同步
        api.on('positionChanged', (position) => {
            this.updateLyricHighlight(position);
        });

        api.on('playbackStateChanged', (state) => {
            console.log('🎵 Player: 收到播放状态变化事件:', state);
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('trackLoaded', async (track) => {
            console.log('Track loaded in lyrics:', track);
            await this.updateTrackInfo(track);
        });
    }

    show(track) {
        this.currentTrack = track;
        this.isVisible = true;
        this.isPlaying = api.isPlaying;
        // 动画显示
        this.page.style.display = 'block';
        setTimeout(() => {
            this.page.classList.add('show');
        }, 10);

        // 初始化全屏状态
        this.updateFullscreenState();

        // 初始化控件状态
        this.initializeControls().then(() => {
        });

        // 确保歌词显示区域滚动到顶部
        setTimeout(() => {
            if (this.lyricsDisplay) {
                this.lyricsDisplay.scrollTop = 0;
            }
        }, 50);
        console.log('🎵 Lyrics: 显示歌词页面');
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');

        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
            }
        }, 300);

        console.log('🎵 Lyrics: 隐藏歌词页面');
    }

    toggle(track) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(track);
        }
    }

    async togglePlayPause() {
        console.log('🔄 Player: 切换播放状态，当前状态:', this.isPlaying);
        try {
            if (this.isPlaying) {
                console.log('🔄 Player: 请求暂停');
                const result = await api.pause();
                if (!result) {
                    console.error('❌ Player: 暂停失败');
                }
            } else {
                console.log('🔄 Player: 请求播放');
                const result = await api.play();
                if (!result) {
                    console.error('❌ Player: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Player: 切换播放状态失败:', error);
        }
    }

    updateProgress(currentTime, duration) {
        // 更新进度条填充和滑块位置
        if (this.progressFill && this.progressHandle && duration > 0) {
            const percentage = (currentTime / duration) * 100;
            this.progressFill.style.width = `${percentage}%`;
            this.progressHandle.style.left = `${percentage}%`;
        }
        // 更新时间显示
        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(currentTime);
        }
        if (this.durationEl) {
            this.durationEl.textContent = this.formatTime(duration);
        }
    }

    updatePlayButton() {
        console.log('🔄 Player: 更新播放按钮，当前状态:', this.isPlaying);
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            console.log('✅ Player: 显示暂停图标');
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            console.log('✅ Player: 显示播放图标');
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async updateTrackInfo(track) {
        if (track) {
            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';

            // 正确更新总时长显示
            if (this.durationEl && track.duration) {
                this.durationEl.textContent = this.formatTime(track.duration);
                console.log('🎵 Lyrics: 更新总时长显示:', this.formatTime(track.duration));
            }

            // 更新封面和歌词
            await this.loadLyrics(track);
            await this.updateCoverArt(track);
        }
    }

    async loadLyrics(track) {
        if (!track || !track.title || !track.artist) {
            this.showNoLyrics();
            return;
        }

        // 检查是否已有缓存的歌词
        if (track.lyrics) {
            console.log('🎵 Lyrics: 使用缓存歌词');
            this.lyrics = track.lyrics;
            this.renderLyrics();
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            console.log('🎵 Lyrics: 从API获取歌词');
            const lyricsResult = await api.getLyrics(track.title, track.artist, track.album);

            if (lyricsResult.success) {
                this.lyrics = api.parseLRC(lyricsResult.lrc);
                if (this.lyrics.length > 0) {
                    // 缓存歌词到track对象
                    track.lyrics = this.lyrics;
                    track.lrcText = lyricsResult.lrc;
                    this.renderLyrics();
                    console.log('✅ Lyrics: 歌词加载成功');
                } else {
                    this.showNoLyrics();
                    console.log('❌ Lyrics: 歌词解析失败');
                }
            } else {
                this.showNoLyrics();
                console.log('❌ Lyrics: 歌词获取失败');
            }
        } catch (error) {
            console.error('❌ Lyrics: 歌词加载失败:', error);
            this.showNoLyrics();
        } finally {
            this.isLoading = false;
        }
    }

    async updateCoverArt(track) {
        // 首先设置默认封面
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');
        try {
            // 检查是否已有本地封面
            if (track.cover) {
                console.log('🖼️ Player: 使用本地封面');
                this.trackCover.src = track.cover;
                this.trackCover.classList.remove('loading');
                this.background.style.backgroundImage = `url(${track.cover})`;
                return;
            }

            // 尝试从API获取封面
            if (track.title && track.artist) {
                console.log('🖼️ Player: 从API获取封面');
                const coverResult = await api.getCover(track.title, track.artist, track.album);
                if (coverResult.success) {
                    this.trackCover.src = coverResult.imageUrl;
                    console.log('✅ Player: 封面更新成功');
                    // 缓存封面URL到track对象
                    track.coverUrl = coverResult.imageUrl;
                } else {
                    console.log('❌ Player: 封面获取失败，使用默认封面');
                }
            }
            // Set background image if available
            if (track.coverUrl) {
                this.background.style.backgroundImage = `url(${track.coverUrl})`;
            } else {
                this.background.style.backgroundImage = 'none';
            }
        } catch (error) {
            console.error('❌ Player: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    showLoading() {
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <p class="lyrics-line loading">正在加载歌词...</p>
            </div>
        `;
    }

    showNoLyrics() {
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                <p class="lyrics-line">暂无歌词</p>
                <p class="lyrics-line">请欣赏音乐</p>
                <div class="lyrics-line-spacer"></div>
            </div>
        `;
    }

    renderLyrics() {
        if (!this.lyrics || this.lyrics.length === 0) {
            this.showNoLyrics();
            return;
        }

        const lyricsHTML = this.lyrics.map((lyric, index) => {
            return `<p class="lyrics-line" data-time="${lyric.time}" data-index="${index}">${lyric.content}</p>`;
        }).join('');

        this.lyricsDisplay.innerHTML = `
            <div class="lyrics-text">
                <div class="lyrics-line-spacer"></div>
                ${lyricsHTML}
                <div class="lyrics-line-spacer"></div>
            </div>
        `;

        // 重置滚动位置到顶部，确保从第一行歌词开始显示
        this.lyricsDisplay.scrollTop = 0;
        // 添加点击事件，允许用户跳转到指定时间
        this.lyricsDisplay.querySelectorAll('.lyrics-line').forEach(line => {
            line.addEventListener('click', async () => {
                const time = parseFloat(line.dataset.time);
                if (!isNaN(time)) {
                    await api.seek(time);
                }
            });
        });

        // 重置当前歌词索引
        this.currentLyricIndex = -1;
        console.log('🎵 Lyrics: 歌词渲染完成，滚动位置已重置');
    }

    updateLyricHighlight(currentTime) {
        if (!this.lyrics || this.lyrics.length === 0 || !this.isVisible) {
            return;
        }

        // 找到当前时间对应的歌词行
        let newIndex = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果索引发生变化，更新高亮
        if (newIndex !== this.currentLyricIndex) {
            // 移除之前的高亮
            if (this.currentLyricIndex >= 0) {
                const prevLine = this.lyricsDisplay.querySelector(`[data-index="${this.currentLyricIndex}"]`);
                if (prevLine) {
                    prevLine.classList.remove('highlight');
                }
            }

            // 添加新的高亮
            if (newIndex >= 0) {
                const currentLine = this.lyricsDisplay.querySelector(`[data-index="${newIndex}"]`);
                if (currentLine) {
                    currentLine.classList.add('highlight');

                    // 只有在歌曲开始播放后才进行自动滚动
                    // 避免在歌词刚加载时就滚动到中间位置
                    if (currentTime > 0 && this.currentLyricIndex >= 0) {
                        currentLine.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }
            }

            this.currentLyricIndex = newIndex;
        }
    }

    updateLyrics(lyrics) {
        // 兼容旧的接口，现在使用loadLyrics方法
        if (this.currentTrack) {
            this.currentTrack.lyrics = lyrics;
            this.lyrics = lyrics;
            this.renderLyrics();
        }
    }

    // 全屏功能方法
    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().then(() => {
                console.log('🎵 Lyrics: 进入全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 进入全屏失败:', err);
            });
        } else if (document.documentElement.webkitRequestFullscreen) {
            // Safari 支持
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            // IE/Edge 支持
            document.documentElement.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                console.log('🎵 Lyrics: 退出全屏模式');
            }).catch(err => {
                console.error('❌ Lyrics: 退出全屏失败:', err);
            });
        } else if (document.webkitExitFullscreen) {
            // Safari 支持
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            // IE/Edge 支持
            document.msExitFullscreen();
        }
    }

    updateFullscreenState() {
        this.isFullscreen = !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement);

        // 更新按钮图标
        if (this.isFullscreen) {
            this.fullscreenIcon.style.display = 'none';
            this.fullscreenExitIcon.style.display = 'block';
        } else {
            this.fullscreenIcon.style.display = 'block';
            this.fullscreenExitIcon.style.display = 'none';
        }

        console.log('🎵 Lyrics: 全屏状态更新:', this.isFullscreen ? '全屏' : '窗口');
    }

    // 初始化控件状态
    async initializeControls() {
        const currentVolume = api.getVolume ? (await api.getVolume() * 100) : 50;
        await this.setVolume(currentVolume);

        const currentMode = api.getPlayMode ? api.getPlayMode() : 'repeat';
        this.updatePlayModeDisplay(currentMode);
        console.log('🎵 Lyrics: 控件状态初始化完成');
    }

    // 音量控制方法
    async setVolume(volume) {
        this.currentVolume = Math.max(0, Math.min(100, volume));

        // 更新音量条填充和滑块位置
        const percentage = this.currentVolume / 100;
        if (this.volumeFill) {
            this.volumeFill.style.width = `${this.currentVolume}%`;
        }
        if (this.volumeHandle) {
            this.volumeHandle.style.left = `${this.currentVolume}%`;
        }

        // 更新音量图标
        if (this.volumeIcon) this.volumeIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';
        if (this.currentVolume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.currentVolume <= 50) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeIcon) this.volumeIcon.style.display = 'block';
            this.volumeMuteIcon.style.display = 'none';
            this.volumeHalfIcon.style.display = 'none';
        }

        // 同步到主播放器
        await api.setVolume(this.currentVolume / 100);
        console.log('🎵 Lyrics: 音量设置为', this.currentVolume + '%');
    }

    // 从鼠标事件更新音量
    async updateVolumeFromEvent(e) {
        if (!this.volumeSliderContainer) return;

        const rect = this.volumeSliderContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const volume = Math.round(percentage * 100);

        await this.setVolume(volume);
    }

    async toggleVolumeMute() {
        if (this.currentVolume > 0) {
            this.previousVolume = this.currentVolume;
            await this.setVolume(0);
        } else {
            await this.setVolume(this.previousVolume || 50);
        }
    }

    updatePlayModeDisplay(mode) {
        if (!this.modeSequenceIcon || !this.modeShuffleIcon || !this.modeRepeatOneIcon) {
            console.warn('🎵 Player: 播放模式图标元素不存在');
            return;
        }
        this.modeSequenceIcon.style.display = 'none';
        this.modeShuffleIcon.style.display = 'none';
        this.modeRepeatOneIcon.style.display = 'none';
        switch (mode) {
            case 'sequence':
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
            case 'shuffle':
                this.modeShuffleIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '随机播放';
                break;
            case 'repeat-one':
                this.modeRepeatOneIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '单曲循环';
                break;
            default:
                // 默认显示顺序播放
                this.modeSequenceIcon.style.display = 'block';
                if (this.playModeBtn) this.playModeBtn.title = '顺序播放';
                break;
        }
        console.log('🎵 Player: 播放模式显示更新为:', mode);
    }

    // 进度条交互方法
    async seekToPosition(e) {
        if (!this.currentTrack || !await api.getDuration()) return;
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const seekTime = percentage * await api.getDuration();
        await api.seek(seekTime);
        console.log('🎵 Lyrics: 跳转到', this.formatTime(seekTime));
    }

    startProgressDrag(e) {
        this.isDraggingProgress = true;
        this.progressBar.classList.add('dragging');
        this.updateProgressDrag(e);
    }

    updateProgressDrag(e) {
        if (!this.isDraggingProgress || !this.currentTrack || !api.getDuration()) return;

        const rect = this.progressBar.getBoundingClientRect();
        const dragX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const percentage = dragX / rect.width;

        // 实时更新进度条显示
        this.progressFill.style.width = `${percentage * 100}%`;
        this.currentTimeEl.textContent = this.formatTime(percentage * api.getDuration());
    }

    async endProgressDrag() {
        if (!this.isDraggingProgress) return;

        this.isDraggingProgress = false;
        this.progressBar.classList.remove('dragging');

        // 执行实际的跳转
        const percentage = parseFloat(this.progressFill.style.width) / 100;
        const seekTime = percentage * await api.getDuration();
        await api.seek(seekTime);
    }
}

// Home Page Component
class HomePage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.recentTracks = [];
        this.personalizedRecommendations = [];
        this.setupElements();
        console.log('🏠 HomePage: 新首页组件初始化完成');
    }

    setupElements() {
        this.container = this.element;
    }

    async show() {
        console.log('🏠 HomePage: 显示新首页');
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.tracks = await api.getTracks();
        this.render();
    }

    hide() {
        console.log('🏠 HomePage: 隐藏首页');
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    // 沉浸式功能事件监听器
    setupImmersiveEventListeners() {
        // 可视化控制按钮
        const toggleVisualizerBtn = this.container.querySelector('#toggle-visualizer');
        if (toggleVisualizerBtn) {
            toggleVisualizerBtn.addEventListener('click', () => {
                this.toggleAudioVisualizer();
            });
        }

        const toggleBreathingBtn = this.container.querySelector('#toggle-breathing');
        if (toggleBreathingBtn) {
            toggleBreathingBtn.addEventListener('click', () => {
                this.toggleBreathingGuide();
            });
        }

        const toggleAmbientBtn = this.container.querySelector('#toggle-ambient');
        if (toggleAmbientBtn) {
            toggleAmbientBtn.addEventListener('click', () => {
                this.toggleAmbientMode();
            });
        }

        // 专注模式按钮
        const focusBtn = this.container.querySelector('.focus-btn');
        if (focusBtn) {
            focusBtn.addEventListener('click', () => {
                this.enterFocusMode();
            });
        }

        // 冥想计时器按钮
        this.container.querySelectorAll('.timer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.minutes);
                this.startMeditationTimer(minutes);
            });
        });

        // 心情记录按钮
        this.container.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mood = btn.dataset.mood;
                this.recordMood(mood);
                btn.classList.add('selected');
                setTimeout(() => btn.classList.remove('selected'), 1000);
            });
        });

        // 音乐日记保存按钮
        const saveDiaryBtn = this.container.querySelector('.save-diary-btn');
        if (saveDiaryBtn) {
            saveDiaryBtn.addEventListener('click', () => {
                this.saveMusicDiary();
            });
        }

        // 时间氛围卡片
        const timeAtmosphereCard = this.container.querySelector('#time-atmosphere');
        if (timeAtmosphereCard) {
            timeAtmosphereCard.addEventListener('click', () => {
                this.toggleTimeBasedAtmosphere();
            });
        }

        // 天气同步卡片
        const weatherAtmosphereCard = this.container.querySelector('#weather-atmosphere');
        if (weatherAtmosphereCard) {
            weatherAtmosphereCard.addEventListener('click', () => {
                this.toggleWeatherSync();
            });
        }
    }

    // 沉浸式功能实现方法
    toggleAudioVisualizer() {
        const visualizer = this.container.querySelector('#audio-visualizer');
        if (!visualizer) return;

        const isActive = visualizer.classList.contains('active');
        if (isActive) {
            visualizer.classList.remove('active');
            this.stopAudioVisualization();
        } else {
            visualizer.classList.add('active');
            this.startAudioVisualization();
        }
        console.log('🎵 音频可视化:', isActive ? '关闭' : '开启');
    }

    startAudioVisualization() {
        // todo 改高级实现
        // 简单的音频可视化实现
        const canvas = this.container.querySelector('#audio-visualizer');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // 创建简单的波形动画
        let animationId;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制动态波形
            const time = Date.now() * 0.002;
            const centerY = canvas.height / 2;

            ctx.strokeStyle = 'rgba(51, 94, 234, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let x = 0; x < canvas.width; x += 2) {
                const y = centerY + Math.sin(x * 0.02 + time) * 20 +
                         Math.sin(x * 0.01 + time * 1.5) * 10;
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            animationId = requestAnimationFrame(animate);
        };

        this.visualizationAnimation = animationId;
        animate();
    }

    stopAudioVisualization() {
        if (this.visualizationAnimation) {
            cancelAnimationFrame(this.visualizationAnimation);
            this.visualizationAnimation = null;
        }
    }

    toggleBreathingGuide() {
        const breathingCircle = this.container.querySelector('#breathing-circle');
        if (!breathingCircle) return;

        const isActive = breathingCircle.classList.contains('active');
        if (isActive) {
            breathingCircle.classList.remove('active');
            this.stopBreathingGuide();
        } else {
            breathingCircle.classList.add('active');
            this.startBreathingGuide();
        }
        console.log('🫁 呼吸引导:', isActive ? '关闭' : '开启');
    }

    startBreathingGuide() {
        const breathingCircle = this.container.querySelector('#breathing-circle');
        const breathingText = breathingCircle?.querySelector('.breathing-text');
        if (!breathingCircle || !breathingText) return;

        let phase = 'inhale'; // inhale, hold, exhale
        let count = 0;

        const updateBreathing = () => {
            switch (phase) {
                case 'inhale':
                    breathingText.textContent = '吸气';
                    breathingCircle.style.transform = 'scale(1.3)';
                    if (count >= 4) {
                        phase = 'hold';
                        count = 0;
                    }
                    break;
                case 'hold':
                    breathingText.textContent = '屏息';
                    if (count >= 2) {
                        phase = 'exhale';
                        count = 0;
                    }
                    break;
                case 'exhale':
                    breathingText.textContent = '呼气';
                    breathingCircle.style.transform = 'scale(1)';
                    if (count >= 4) {
                        phase = 'inhale';
                        count = 0;
                    }
                    break;
            }
            count++;
        };

        this.breathingInterval = setInterval(updateBreathing, 1000);
        updateBreathing();
    }

    stopBreathingGuide() {
        if (this.breathingInterval) {
            clearInterval(this.breathingInterval);
            this.breathingInterval = null;
        }

        const breathingCircle = this.container.querySelector('#breathing-circle');
        const breathingText = breathingCircle?.querySelector('.breathing-text');
        if (breathingCircle && breathingText) {
            breathingCircle.style.transform = 'scale(1)';
            breathingText.textContent = '深呼吸';
        }
    }

    toggleAmbientMode() {
        const ambientOverlay = this.container.querySelector('#ambient-overlay');
        if (!ambientOverlay) return;

        const isActive = ambientOverlay.classList.contains('active');
        if (isActive) {
            ambientOverlay.classList.remove('active');
        } else {
            ambientOverlay.classList.add('active');
            this.updateAmbientMode();
        }
        console.log('🌅 环境氛围:', isActive ? '关闭' : '开启');
    }

    updateAmbientMode() {
        const hour = new Date().getHours();
        const ambientOverlay = this.container.querySelector('#ambient-overlay');
        if (!ambientOverlay) return;

        let gradient;
        if (hour >= 6 && hour < 12) {
            // 早晨 - 温暖的金色
            gradient = 'linear-gradient(45deg, rgba(255, 193, 7, 0.1), rgba(255, 152, 0, 0.05))';
        } else if (hour >= 12 && hour < 18) {
            // 下午 - 明亮的蓝色
            gradient = 'linear-gradient(45deg, rgba(33, 150, 243, 0.1), rgba(3, 169, 244, 0.05))';
        } else if (hour >= 18 && hour < 22) {
            // 傍晚 - 温暖的橙色
            gradient = 'linear-gradient(45deg, rgba(255, 87, 34, 0.1), rgba(255, 152, 0, 0.05))';
        } else {
            // 夜晚 - 深蓝紫色
            gradient = 'linear-gradient(45deg, rgba(63, 81, 181, 0.1), rgba(103, 58, 183, 0.05))';
        }
        ambientOverlay.style.background = gradient;
    }

    enterFocusMode() {
        // 进入专注模式 - 隐藏干扰元素，突出音乐体验
        document.body.classList.add('focus-mode');

        // 启动所有沉浸式功能
        this.toggleAudioVisualizer();
        this.toggleBreathingGuide();
        this.toggleAmbientMode();

        console.log('🎯 进入专注模式');

        // 显示专注模式提示
        this.showFocusModeNotification();
    }

    showFocusModeNotification() {
        const notification = document.createElement('div');
        notification.className = 'focus-mode-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>专注模式已开启</h3>
                <p>享受沉浸式音乐体验</p>
                <button class="exit-focus-btn">退出专注模式</button>
            </div>
        `;

        document.body.appendChild(notification);

        // 退出专注模式按钮
        notification.querySelector('.exit-focus-btn').addEventListener('click', () => {
            this.exitFocusMode();
            notification.remove();
        });

        // 5秒后自动隐藏通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    exitFocusMode() {
        document.body.classList.remove('focus-mode');
        console.log('🎯 退出专注模式');
    }

    startMeditationTimer(minutes) {
        console.log(`🧘 开始冥想计时: ${minutes}分钟`);

        // 创建冥想计时器界面
        const timerOverlay = document.createElement('div');
        timerOverlay.className = 'meditation-timer-overlay';
        timerOverlay.innerHTML = `
            <div class="timer-content">
                <div class="timer-circle">
                    <div class="timer-text">
                        <div class="timer-minutes">${minutes}</div>
                        <div class="timer-label">分钟</div>
                    </div>
                </div>
                <div class="timer-controls">
                    <button class="timer-pause-btn">暂停</button>
                    <button class="timer-stop-btn">停止</button>
                </div>
            </div>
        `;

        document.body.appendChild(timerOverlay);

        // 启动计时器逻辑
        this.runMeditationTimer(minutes, timerOverlay);
    }

    runMeditationTimer(totalMinutes, overlay) {
        let remainingSeconds = totalMinutes * 60;
        const timerText = overlay.querySelector('.timer-minutes');
        const pauseBtn = overlay.querySelector('.timer-pause-btn');
        const stopBtn = overlay.querySelector('.timer-stop-btn');

        let isPaused = false;
        let timerInterval;

        const updateTimer = () => {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (remainingSeconds <= 0) {
                this.completeMeditationTimer(overlay);
                return;
            }

            remainingSeconds--;
        };

        const startTimer = () => {
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();
        };

        pauseBtn.addEventListener('click', () => {
            if (isPaused) {
                startTimer();
                pauseBtn.textContent = '暂停';
                isPaused = false;
            } else {
                clearInterval(timerInterval);
                pauseBtn.textContent = '继续';
                isPaused = true;
            }
        });

        stopBtn.addEventListener('click', () => {
            clearInterval(timerInterval);
            overlay.remove();
        });

        startTimer();
    }

    completeMeditationTimer(overlay) {
        overlay.innerHTML = `
            <div class="timer-content">
                <div class="timer-complete">
                    <div class="complete-icon">✨</div>
                    <h3>冥想完成</h3>
                    <p>感谢您的专注时光</p>
                    <button class="close-timer-btn">关闭</button>
                </div>
            </div>
        `;

        overlay.querySelector('.close-timer-btn').addEventListener('click', () => {
            overlay.remove();
        });

        // 3秒后自动关闭
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 3000);
    }

    recordMood(mood) {
        const moodData = {
            mood: mood,
            timestamp: new Date().toISOString(),
            currentTrack: api.currentTrack?.title || null
        };

        // 保存到本地存储
        const moodHistory = JSON.parse(localStorage.getItem('musicbox-mood-history') || '[]');
        moodHistory.push(moodData);

        // 只保留最近100条记录
        if (moodHistory.length > 100) {
            moodHistory.splice(0, moodHistory.length - 100);
        }

        localStorage.setItem('musicbox-mood-history', JSON.stringify(moodHistory));
        console.log('💭 记录心情:', mood);
    }

    saveMusicDiary() {
        const diaryInput = this.container.querySelector('.diary-input');
        if (!diaryInput || !diaryInput.value.trim()) return;

        const diaryEntry = {
            content: diaryInput.value.trim(),
            timestamp: new Date().toISOString(),
            currentTrack: api.currentTrack?.title || null
        };

        // 保存到本地存储
        const diaryHistory = JSON.parse(localStorage.getItem('musicbox-diary-history') || '[]');
        diaryHistory.push(diaryEntry);

        localStorage.setItem('musicbox-diary-history', JSON.stringify(diaryHistory));

        // 清空输入框并显示保存成功提示
        diaryInput.value = '';
        const saveBtn = this.container.querySelector('.save-diary-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '已保存';
        saveBtn.disabled = true;

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }, 2000);

        console.log('📝 保存音乐日记');
    }

    toggleTimeBasedAtmosphere() {
        const card = this.container.querySelector('#time-atmosphere');
        const isActive = card.classList.contains('active');

        if (isActive) {
            card.classList.remove('active');
        } else {
            card.classList.add('active');
            this.updateTimeBasedAtmosphere();
        }

        console.log('⏰ 时间氛围:', isActive ? '关闭' : '开启');
    }

    updateTimeBasedAtmosphere() {
        const hour = new Date().getHours();
        const timeMoodText = this.container.querySelector('#time-mood-text');
        if (!timeMoodText) return;

        let moodText;
        if (hour >= 6 && hour < 12) {
            moodText = '清晨时光，适合轻松愉悦的音乐';
        } else if (hour >= 12 && hour < 18) {
            moodText = '午后阳光，享受温暖的旋律';
        } else if (hour >= 18 && hour < 22) {
            moodText = '黄昏时分，沉浸在柔和的音符中';
        } else {
            moodText = '夜深人静，让心灵在音乐中放松';
        }

        timeMoodText.textContent = moodText;
    }

    toggleWeatherSync() {
        const card = this.container.querySelector('#weather-atmosphere');
        const isActive = card.classList.contains('active');

        if (isActive) {
            card.classList.remove('active');
        } else {
            card.classList.add('active');
            // 这里可以添加实际的天气API调用
            console.log('🌤️ 天气同步功能需要天气API支持');
        }

        console.log('🌤️ 天气同步:', isActive ? '关闭' : '开启');
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="page-content immersive-home">
                <!-- 沉浸式音乐可视化中心 -->
                <div class="music-visualization-center">
                    <div class="visualization-container">
                        <canvas id="audio-visualizer" class="audio-visualizer"></canvas>
                        <div class="breathing-guide">
                            <div class="breathing-circle" id="breathing-circle">
                                <div class="breathing-text">深呼吸</div>
                            </div>
                        </div>
                        <div class="ambient-overlay" id="ambient-overlay"></div>
                    </div>

                    <div class="visualization-controls">
                        <button class="viz-control-btn" id="toggle-visualizer" title="切换可视化">
                            <svg viewBox="0 0 24 24">
                                <path d="M3,2H5V22H3V2M7,12H9V22H7V12M11,6H13V22H11V6M15,9H17V22H15V9M19,13H21V22H19V13Z"/>
                            </svg>
                        </button>
                        <button class="viz-control-btn" id="toggle-breathing" title="呼吸引导">
                            <svg viewBox="0 0 24 24">
                                <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6Z"/>
                            </svg>
                        </button>
                        <button class="viz-control-btn" id="toggle-ambient" title="环境氛围">
                            <svg viewBox="0 0 24 24">
                                <path d="M12,18.5A6.5,6.5 0 0,1 5.5,12A6.5,6.5 0 0,1 12,5.5A6.5,6.5 0 0,1 18.5,12A6.5,6.5 0 0,1 12,18.5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- 情绪氛围调节器 -->
                <div class="mood-atmosphere-section">
                    <div class="atmosphere-cards">
                        <div class="atmosphere-card time-based" id="time-atmosphere">
                            <div class="atmosphere-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                                </svg>
                            </div>
                            <div class="atmosphere-content">
                                <h3>时光氛围</h3>
                                <p id="time-mood-text">根据当前时间调节界面氛围</p>
                            </div>
                        </div>

                        <div class="atmosphere-card weather-sync" id="weather-atmosphere">
                            <div class="atmosphere-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13Z"/>
                                </svg>
                            </div>
                            <div class="atmosphere-content">
                                <h3>天气同步</h3>
                                <p>与当地天气同步的背景效果</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 专注与冥想助手 -->
                <div class="focus-meditation-section">
                    <div class="focus-cards">
                        <div class="focus-card focus-mode" id="focus-mode-card">
                            <div class="focus-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                                </svg>
                            </div>
                            <div class="focus-content">
                                <h3>专注模式</h3>
                                <p>进入沉浸式音乐聆听体验</p>
                                <button class="focus-btn">开始专注</button>
                            </div>
                        </div>

                        <div class="focus-card meditation-timer" id="meditation-timer-card">
                            <div class="focus-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.78 12.45,22 13,22C13.55,22 14.05,21.78 14.41,21.41L21.41,14.41C21.78,14.05 22,13.55 22,13C22,12.45 21.78,11.95 21.41,11.58Z"/>
                                </svg>
                            </div>
                            <div class="focus-content">
                                <h3>冥想计时</h3>
                                <p>配合音乐的冥想和放松</p>
                                <div class="timer-controls">
                                    <button class="timer-btn" data-minutes="5">5分钟</button>
                                    <button class="timer-btn" data-minutes="10">10分钟</button>
                                    <button class="timer-btn" data-minutes="15">15分钟</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 音乐生活方式面板 -->
                <div class="music-lifestyle-section">
                    <div class="lifestyle-cards">
                        <div class="lifestyle-card mood-journal" id="mood-journal-card">
                            <div class="lifestyle-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                                </svg>
                            </div>
                            <div class="lifestyle-content">
                                <h3>聆听心情</h3>
                                <p>记录每次聆听时的心情状态</p>
                                <div class="mood-buttons">
                                    <button class="mood-btn" data-mood="happy">😊</button>
                                    <button class="mood-btn" data-mood="calm">😌</button>
                                    <button class="mood-btn" data-mood="sad">😢</button>
                                    <button class="mood-btn" data-mood="excited">🤩</button>
                                </div>
                            </div>
                        </div>

                        <div class="lifestyle-card music-diary" id="music-diary-card">
                            <div class="lifestyle-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                            </div>
                            <div class="lifestyle-content">
                                <h3>音乐日记</h3>
                                <p>记录音乐带给你的感悟</p>
                                <textarea class="diary-input" placeholder="今天的音乐让我想到了..."></textarea>
                                <button class="save-diary-btn">保存感悟</button>
                            </div>
                        </div>

                        <div class="lifestyle-card listening-habits" id="listening-habits-card">
                            <div class="lifestyle-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
                                </svg>
                            </div>
                            <div class="lifestyle-content">
                                <h3>聆听洞察</h3>
                                <p>美观展示你的聆听习惯</p>
                                <div class="habits-preview">
                                    <div class="habit-item">
                                        <span class="habit-label">今日聆听</span>
                                        <span class="habit-value" id="today-listening">0分钟</span>
                                    </div>
                                    <div class="habit-item">
                                        <span class="habit-label">最爱时段</span>
                                        <span class="habit-value" id="favorite-time">晚上</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
           
                <!-- 空状态 - 沉浸式引导 -->
                <div class="immersive-empty-state">
                    <div class="empty-visualization">
                        <div class="empty-waves">
                            <div class="wave"></div>
                            <div class="wave"></div>
                            <div class="wave"></div>
                        </div>
                    </div>
                    <div class="empty-content">
                        <h2>开启你的音乐之旅</h2>
                        <p>让音乐成为生活的一部分，创造属于你的沉浸式聆听体验</p>
                        <div class="empty-actions">
                            <button class="immersive-btn primary" id="scan-folder-btn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                                </svg>
                                扫描音乐文件夹
                            </button>
                            <button class="immersive-btn secondary" id="add-files-btn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                                </svg>
                                添加音乐文件
                            </button>
                        </div>
                    </div>
                </div>
                
            </div>
        `;

        this.setupPageEventListeners();
    }

    setupPageEventListeners() {
        // 沉浸式首页功能事件监听器
        this.setupImmersiveEventListeners();

        // 扫描文件夹按钮
        const scanBtn = this.container.querySelector('#scan-folder-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', async () => {
                try {
                    await app.openDirectoryDialog();
                    this.tracks = await api.getTracks();
                    this.render();
                } catch (error) {
                    console.error('扫描文件夹失败:', error);
                }
            });
        }

        // 添加文件按钮
        const addFilesBtn = this.container.querySelector('#add-files-btn');
        if (addFilesBtn) {
            addFilesBtn.addEventListener('click', async () => {
                try {
                    await app.openFileDialog();
                    this.tracks = await api.getTracks();
                    this.render();
                } catch (error) {
                    console.error('添加文件失败:', error);
                }
            });
        }
    }
}

// Statistics Page Component
class StatisticsPage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.recentTracks = [];
        this.playStats = {};
        this.setupElements();
        this.setupEventListeners();
        console.log('📊 StatisticsPage: 统计页面组件初始化完成');
    }

    setupElements() {
        this.container = this.element;
    }

    setupEventListeners() {
        // 监听音乐库更新
        api.on('libraryUpdated', (tracks) => {
            this.tracks = tracks;
            this.render();
        });

        // 监听播放历史更新
        api.on('trackChanged', (track) => {
            this.updatePlayHistory(track);
        });
    }

    async show() {
        console.log('📊 StatisticsPage: 显示统计页面');
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.tracks = await api.getTracks();
        this.loadPlayHistory();
        this.calculatePlayStats();
        this.render();
    }

    hide() {
        console.log('📊 StatisticsPage: 隐藏统计页面');
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    loadPlayHistory() {
        const history = localStorage.getItem('musicbox-play-history');
        if (history) {
            try {
                const historyData = JSON.parse(history);
                this.recentTracks = historyData.slice(0, 50);
            } catch (error) {
                console.error('加载播放历史失败:', error);
                this.recentTracks = [];
            }
        }
    }

    updatePlayHistory(track) {
        if (!track || !track.filePath) return;
        this.loadPlayHistory();
        this.calculatePlayStats();
    }

    calculatePlayStats() {
        // 计算累计听歌数量（播放历史记录）
        const totalPlayedSongs = this.recentTracks.length;

        // 计算累计听歌时长（播放历史中歌曲的实际时长）
        const totalPlayedDuration = this.recentTracks.reduce((sum, track) => {
            return sum + (track.duration || 0);
        }, 0);

        this.playStats = {
            totalTracks: this.tracks.length,
            recentPlays: this.recentTracks.length,
            totalDuration: this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
            favoriteArtist: this.getMostPlayedArtist(),
            totalSize: this.tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0),
            uniqueArtists: this.getUniqueArtists().length,
            uniqueAlbums: this.getUniqueAlbums().length,
            averageDuration: this.tracks.length > 0 ?
                this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0) / this.tracks.length : 0,
            totalPlayedSongs: totalPlayedSongs,
            totalPlayedDuration: totalPlayedDuration
        };
    }

    getMostPlayedArtist() {
        const artistCounts = {};
        this.recentTracks.forEach(track => {
            if (track.artist) {
                artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
            }
        });

        let favoriteArtist = '暂无';
        let maxCount = 0;
        for (const [artist, count] of Object.entries(artistCounts)) {
            if (count > maxCount) {
                maxCount = count;
                favoriteArtist = artist;
            }
        }
        return favoriteArtist;
    }

    getUniqueArtists() {
        const artists = new Set();
        this.tracks.forEach(track => {
            if (track.artist) {
                artists.add(track.artist);
            }
        });
        return Array.from(artists);
    }

    getUniqueAlbums() {
        const albums = new Set();
        this.tracks.forEach(track => {
            if (track.album) {
                albums.add(track.album);
            }
        });
        return Array.from(albums);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}分钟`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `${hours}小时${remainingMinutes}分钟`;
        }
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="page-content statistics-page">
                <!-- 页面标题 -->
                <div class="page-header">
                    <h1 class="page-title">
                        <svg class="page-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z"/>
                        </svg>
                        音乐库统计
                    </h1>
                    <p class="page-subtitle">详细的音乐库数据分析和播放统计</p>
                </div>

                <!-- 核心统计数据 -->
                <div class="stats-overview">
                    <div class="stats-grid">
                        <div class="stat-card primary">
                            <div class="stat-icon">🎵</div>
                            <div class="stat-number">${this.playStats.totalTracks}</div>
                            <div class="stat-label">音乐总数</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">👨‍🎤</div>
                            <div class="stat-number">${this.playStats.uniqueArtists}</div>
                            <div class="stat-label">艺术家</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💿</div>
                            <div class="stat-number">${this.playStats.uniqueAlbums}</div>
                            <div class="stat-label">专辑</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏱️</div>
                            <div class="stat-number">${this.formatDuration(this.playStats.totalDuration)}</div>
                            <div class="stat-label">总时长</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💾</div>
                            <div class="stat-number">${this.formatFileSize(this.playStats.totalSize)}</div>
                            <div class="stat-label">总大小</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-number">${this.formatDuration(this.playStats.averageDuration)}</div>
                            <div class="stat-label">平均时长</div>
                        </div>
                    </div>
                </div>

                <!-- 播放统计 -->
                <div class="stats-section">
                    <h2 class="section-title">
                        <svg class="title-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z"/>
                        </svg>
                        播放统计
                    </h2>
                    <div class="play-stats-grid">
                        <div class="stat-card">
                            <div class="stat-number">${this.playStats.totalPlayedSongs}</div>
                            <div class="stat-label">累计听歌</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.formatDuration(this.playStats.totalPlayedDuration)}</div>
                            <div class="stat-label">听歌时长</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.playStats.favoriteArtist}</div>
                            <div class="stat-label">最常听艺术家</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Recent Page Component
class RecentPage extends Component {
    constructor(container) {
        super(container);
        this.recentTracks = [];
        this.setupElements();
        this.setupEventListeners();
        console.log('🕒 RecentPage: 组件初始化完成');
    }

    setupElements() {
        this.container = this.element;
    }

    setupEventListeners() {
        // 监听播放历史更新
        api.on('trackChanged', (track) => {
            this.updatePlayHistory(track);
            if (this.isVisible) {
                this.render();
            }
        });
    }

    async show() {
        console.log('🕒 RecentPage: 显示最近播放页面');
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.isVisible = true;
        this.loadPlayHistory();
        this.render();
    }

    hide() {
        console.log('🕒 RecentPage: 隐藏最近播放页面');
        this.isVisible = false;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    loadPlayHistory() {
        const history = localStorage.getItem('musicbox-play-history');
        if (history) {
            try {
                this.recentTracks = JSON.parse(history);
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
        try {
            const stored = localStorage.getItem('musicbox-play-history');
            if (stored) {
                history = JSON.parse(stored);
            }
        } catch (error) {
            console.error('读取播放历史失败:', error);
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

        try {
            localStorage.setItem('musicbox-play-history', JSON.stringify(history));
            this.recentTracks = history;
        } catch (error) {
            console.error('保存播放历史失败:', error);
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
                    <img src="${track.coverUrl || 'assets/images/default-cover.svg'}" alt="封面" loading="lazy">
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
                    <button class="action-btn small" title="从历史中移除">
                        <svg viewBox="0 0 24 24">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
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
                    this.removeFromHistory(index);
                });
            }
        });
    }

    clearHistory() {
        this.recentTracks = [];
        localStorage.removeItem('musicbox-play-history');
        this.render();
        showToast('播放历史已清空', 'success');
    }

    removeFromHistory(index) {
        if (index >= 0 && index < this.recentTracks.length) {
            const track = this.recentTracks[index];
            this.recentTracks.splice(index, 1);

            try {
                localStorage.setItem('musicbox-play-history', JSON.stringify(this.recentTracks));
                this.render();
                showToast(`已从历史中移除 "${track.title}"`, 'success');
            } catch (error) {
                console.error('移除历史记录失败:', error);
                showToast('移除失败', 'error');
            }
        }
    }
}

// Artists Page Component
class ArtistsPage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.artists = [];
        this.selectedArtist = null;
        this.viewMode = 'grid'; // grid or list
        this.setupElements();
        this.setupEventListeners();
        console.log('🎤 ArtistsPage: 组件初始化完成');
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
        console.log('🎤 ArtistsPage: 显示艺术家页面');
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.isVisible = true;
        this.tracks = await api.getTracks();
        this.processArtists();
        this.render();
    }

    hide() {
        console.log('🎤 ArtistsPage: 隐藏艺术家页面');
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
                    coverUrl: null
                });
            }

            const artist = artistMap.get(artistName);
            artist.tracks.push(track);
            artist.totalDuration += track.duration || 0;

            if (track.album) {
                artist.albums.add(track.album);
            }

            // 使用第一个有封面的歌曲作为艺术家封面
            if (!artist.coverUrl && track.coverUrl) {
                artist.coverUrl = track.coverUrl;
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
                        <img src="${artist.coverUrl || 'assets/images/default-cover.svg'}" alt="${artist.name}" loading="lazy">
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
                        <img src="${artist.coverUrl || 'assets/images/default-cover.svg'}" alt="${artist.name}" loading="lazy">
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
                            <img src="${artist.coverUrl || 'assets/images/default-cover.svg'}" alt="${artist.name}">
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
                                    <img src="${tracks[0].coverUrl || 'assets/images/default-cover.svg'}" alt="${albumName}">
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

        // 按专辑内的曲目编号排序
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
