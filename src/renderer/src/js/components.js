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
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Previous/next buttons
        this.prevBtn.addEventListener('click', () => {
            api.previousTrack();
        });

        this.nextBtn.addEventListener('click', () => {
            api.nextTrack();
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

        document.addEventListener('mouseup', () => {
            if (this.isDraggingProgress) {
                this.isDraggingProgress = false;
                this.progressBarContainer.classList.remove('dragging');
                this.progressTooltip.style.opacity = '0';
                const progress = parseFloat(this.progressFill.style.width) / 100;
                api.seek(this.duration * progress);
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

        document.addEventListener('mouseup', () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
                const volume = parseFloat(this.volumeFill.style.width) / 100;
                api.setVolume(volume);
            }
        });

        this.volumeBtn.addEventListener('click', () => {
            this.toggleMute();
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
        api.on('trackChanged', (track) => {
            this.updateTrackInfo(track);
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
        api.on('trackLoaded', (track) => {
            console.log('Track loaded in player:', track);
            this.updateTrackInfo(track);
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

    toggleMute() {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            api.setVolume(0);
        } else {
            api.setVolume(this.previousVolume || 0.7);
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

        item.addEventListener('dblclick', () => {
            this.playTrack(track, index);
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
        this.crossfadeToggle = this.element.querySelector('#crossfade-toggle');
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
        this.crossfadeToggle.addEventListener('change', (e) => {
            this.updateSetting('crossfade', e.target.checked);
        });

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
        this.viewCacheStatsBtn.addEventListener('click', () => {
            this.showCacheStatistics();
        });

        this.validateCacheBtn.addEventListener('click', () => {
            this.validateCache();
        });

        this.clearCacheBtn.addEventListener('click', () => {
            this.clearCache();
        });

        // 关闭设置页面 (ESC键)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show() {
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
        this.showCacheStatistics();
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

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // 初始化设置值
    initializeSettings() {
        this.languageSelect.value = this.settings.language || 'zh-CN';
        this.defaultVolumeSlider.value = this.settings.defaultVolume || 50;
        this.volumeValue.textContent = `${this.settings.defaultVolume || 50}%`;
        this.crossfadeToggle.checked = this.settings.crossfade || false;
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
        this.playmodeBtn = this.element.querySelector('#lyrics-playmode-btn');
        this.modeSequenceIcon = this.playmodeBtn.querySelector('.lyrics-mode-sequence');
        this.modeShuffleIcon = this.playmodeBtn.querySelector('.lyrics-mode-shuffle');
        this.modeRepeatOneIcon = this.playmodeBtn.querySelector('.lyrics-mode-repeat-one');

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
        this.volumeSliderContainer.addEventListener('mousedown', (e) => {
            this.isDraggingVolume = true;
            this.updateVolumeFromEvent(e);
        });

        this.volumeSliderContainer.addEventListener('click', (e) => {
            if (!this.isDraggingVolume) {
                this.updateVolumeFromEvent(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingVolume) {
                this.updateVolumeFromEvent(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
            }
        });

        // 播放模式切换事件
        this.playmodeBtn.addEventListener('click', () => {
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
        document.addEventListener('mousemove', () => {
            if (this.isVisible && this.isFullscreen) {
                document.body.classList.remove('hide-cursor');
                clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    document.body.classList.add('hide-cursor');
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

        api.on('trackLoaded', (track) => {
            console.log('Track loaded in lyrics:', track);
            this.updateTrackInfo(track);
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
    updateVolumeFromEvent(e) {
        if (!this.volumeSliderContainer) return;

        const rect = this.volumeSliderContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const volume = Math.round(percentage * 100);

        this.setVolume(volume);
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
