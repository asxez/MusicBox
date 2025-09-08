// 播放器组件

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
        this.updateUI().then(r => {
            if (!r.status) console.error('Player UI初始化失败：', r.error);
        });
    }

    setupElements() {
        this.playPauseBtn = this.element.querySelector('#play-pause-btn');
        this.prevBtn = this.element.querySelector('#prev-btn');
        this.nextBtn = this.element.querySelector('#next-btn');
        this.playModeBtn = this.element.querySelector('#play-mode-btn');
        this.lyricsBtn = this.element.querySelector('#lyrics-btn');
        this.playlistBtn = this.element.querySelector('#playlist-btn');
        this.likeBtn = this.element.querySelector('#like-btn');
        this.desktopLyricsBtn = this.element.querySelector('#desktop-lyrics-btn');

        this.trackCover = this.element.querySelector('#track-cover');
        this.trackTitle = this.element.querySelector('#track-title');
        this.trackArtist = this.element.querySelector('#track-artist');


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

                // 拖动结束后，强制同步当前播放状态
                const currentTrack = api.getCurrentTrack();
                if (currentTrack && currentTrack !== this.currentTrack) {
                    await this.updateTrackInfo(currentTrack);
                }
            }
        });

        // Volume slider
        this.volumeSlider.addEventListener('mousedown', async (e) => {
            this.isDraggingVolume = true;
            this.updateVolume(e);
            const volume = parseFloat(this.volumeFill.style.width) / 100;
            await api.setVolume(volume);
        });

        this.volumeSlider.addEventListener('input', async (e) => {
            this.updateVolume(e.target.value);
            const volume = parseFloat(this.volumeFill.style.width) / 100;
            await api.setVolume(volume);
        });

        document.addEventListener('mousemove', async (e) => {
            if (this.isDraggingVolume) {
                this.updateVolume(e);
                const volume = parseFloat(this.volumeFill.style.width) / 100;
                await api.setVolume(volume);
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

        // 桌面歌词按钮事件
        if (this.desktopLyricsBtn) {
            this.desktopLyricsBtn.addEventListener('click', async () => {
                await this.toggleDesktopLyrics();
            });
        }

        // 监听封面更新事件
        if (window.coverUpdateManager) {
            this.coverUpdateUnsubscribe = window.coverUpdateManager.onCoverUpdate((data) => {
                this.handleCoverUpdate(data);
            });
        }
    }

    setupAPIListeners() {
        // 添加更新锁，防止快速切换时UI更新冲突
        this._updateLock = false;

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
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        api.on('volumeChanged', (volume) => {
            this.volume = volume;
            this.updateVolumeDisplay();
        });

        api.on('trackChanged', async (track) => {
            if (!this._updateLock) {
                this._updateLock = true;
                try {
                    await this.updateTrackInfo(track);
                } finally {
                    this._updateLock = false;
                }
            }
        });

        api.on('trackIndexChanged', (index) => {
            this.emit('trackIndexChanged', index);
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
                if (typeof track.cover !== 'string') {
                    console.error('❌ Player: track.cover不是字符串，无法设置为src', {
                        type: typeof track.cover,
                        value: track.cover
                    });
                    this.trackCover.src = 'assets/images/default-cover.svg';
                    this.trackCover.classList.remove('loading');
                    return;
                }

                console.log('🔄 Player: 即将设置trackCover.src =', track.cover.substring(0, 100) + '...');
                this.trackCover.src = track.cover;
                this.trackCover.classList.remove('loading');
                return;
            }

            // 获取封面
            if (track.title && track.artist) {
                const coverResult = await api.getCover(track.title, track.artist, track.album, track.filePath, true);
                if (coverResult.success && coverResult.imageUrl) {
                    if (typeof coverResult.imageUrl === 'string') {
                        // 使用安全的图片设置方法
                        if (window.urlValidator) {
                            const success = await window.urlValidator.safeSetImageSrc(
                                this.trackCover,
                                coverResult.imageUrl
                            );

                            if (success) {
                                track.cover = coverResult.imageUrl;
                            } else {
                                track.cover = null;
                            }
                        } else {
                            this.trackCover.src = coverResult.imageUrl;
                            track.cover = coverResult.imageUrl;
                        }
                    }
                } else {
                    console.log('❌ Player: 封面获取失败，使用默认封面', coverResult.error);
                }
            }
        } catch (error) {
            console.error('❌ Player: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    async handleCoverUpdate(data) {
        const { filePath, title, artist, type } = data;

        // 只处理封面更新事件
        if (type && type !== 'cover-updated' && type !== 'manual-refresh') {
            return;
        }

        const currentTrack = api.getCurrentTrack();
        if (!currentTrack) {
            return;
        }

        // 检查是否是当前播放的歌曲
        const isCurrentTrack = (
            currentTrack.filePath === filePath ||
            (currentTrack.title === title && currentTrack.artist === artist)
        );

        if (isCurrentTrack) {
            // 清除缓存并重新获取封面
            if (currentTrack.cover) {
                delete currentTrack.cover;
            }

            try {
                await this.updateCoverArt(currentTrack);
            } catch (error) {
                console.error('封面更新失败:', error);
            }
        }
    }

    updatePlayButton() {
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
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
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'none';
        if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'none';
        if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';

        if (this.volume === 0) {
            if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
        } else if (this.volume <= 0.5) {
            if (this.volumeHalfIcon) this.volumeHalfIcon.style.display = 'block';
        } else {
            if (this.volumeHighIcon) this.volumeHighIcon.style.display = 'block';
        }
    }

    updatePlayModeDisplay(mode) {
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
    }

    async updateUI() {
        try {
            this.updatePlayButton();
            this.updateProgressDisplay();
            this.updateVolumeDisplay();
            this.updatePlayModeDisplay(api.getPlayMode());
            await this.initDesktopLyricsButton();
            return {
                status: true
            }
        } catch (error) {
            return {
                status: false,
                error: error
            }
        }

    }

    async togglePlayPause() {
        // 防止重复调用的锁定机制
        if (this._toggleInProgress) {
            console.log('🚫 Player: 播放状态切换正在进行中，忽略重复调用');
            return;
        }

        this._toggleInProgress = true;
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
        } finally {
            // 延迟释放锁，确保状态更新完成
            setTimeout(() => {
                this._toggleInProgress = false;
            }, 100);
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

    // 桌面歌词控制方法
    async toggleDesktopLyrics() {
        try {
            const result = await api.toggleDesktopLyrics();

            if (result.success) {
                this.updateDesktopLyricsButton(result.visible);

                if (result.visible) {
                    showToast('桌面歌词已显示', 'success');
                } else {
                    showToast('桌面歌词已隐藏', 'info');
                }
            } else {
                showToast('桌面歌词操作失败', 'error');
            }
        } catch (error) {
            showToast('桌面歌词操作异常', 'error');
        }
    }

    updateDesktopLyricsButton(isVisible) {
        if (!this.desktopLyricsBtn) return;
        if (isVisible) {
            this.desktopLyricsBtn.classList.add('active');
        } else {
            this.desktopLyricsBtn.classList.remove('active');
        }
    }

    async updateDesktopLyricsButtonVisibility(enabled) {
        if (!this.desktopLyricsBtn) {
            return;
        }

        // 根据设置显示或隐藏按钮
        if (enabled) {
            // 启用时显示按钮并启用功能
            this.desktopLyricsBtn.style.display = 'block';
            this.desktopLyricsBtn.disabled = false;

            // 如果启用，检查当前桌面歌词窗口状态
            await this.checkDesktopLyricsWindowState();
        } else {
            // 禁用时隐藏按钮并禁用功能
            this.desktopLyricsBtn.style.display = 'none';
            this.desktopLyricsBtn.disabled = true;
        }
    }

    // 检查桌面歌词窗口状态的独立方法
    async checkDesktopLyricsWindowState() {
        try {
            const isVisible = await api.isDesktopLyricsVisible();
            this.updateDesktopLyricsButton(isVisible);
        } catch (error) {
            console.error('❌ Player: 检查桌面歌词窗口状态失败:', error);
        }
    }

    // 初始化桌面歌词按钮状态
    async initDesktopLyricsButton() {
        if (!this.desktopLyricsBtn) return;

        try {
            // 检查设置中是否启用了桌面歌词功能
            const settings = window.cacheManager.getLocalCache('musicbox-settings') || {};
            // 如果设置中没有明确的值，默认启用；如果有明确的值，使用该值
            const desktopLyricsEnabled = settings.hasOwnProperty('desktopLyrics') ? settings.desktopLyrics : true;

            console.log('🎵 Player: 初始化桌面歌词按钮，设置状态:', desktopLyricsEnabled, '(来源: CacheManager)');

            // 首先设置按钮的显示/隐藏状态
            await this.updateDesktopLyricsButtonVisibility(desktopLyricsEnabled);

            // 如果功能启用，检查桌面歌词窗口的当前状态
            if (desktopLyricsEnabled) {
                const isVisible = await api.isDesktopLyricsVisible();
                this.updateDesktopLyricsButton(isVisible);
            }
        } catch (error) {
            console.error('❌ Player: 初始化桌面歌词按钮状态失败:', error);
        }
    }

    destroy() {
        // 清理封面更新订阅
        if (this.coverUpdateUnsubscribe) {
            this.coverUpdateUnsubscribe();
            this.coverUpdateUnsubscribe = null;
        }

        // 重置播放状态
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;
        super.destroy();
    }
}

window.components.component.Player = Player;
