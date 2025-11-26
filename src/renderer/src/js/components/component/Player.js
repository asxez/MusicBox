// 播放器组件

import {formatTime, showToast} from "@js/utils";
import {cacheManager} from "@services/CacheManager";
import {urlValidator} from "@utils/URLValidator";
import {Component} from "@components/base/Component";
import {api} from "@api/api";
import {coverAPI, windowAPI, lyricsAPI} from "@js/api";

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
        this.isMiniMode = false;
        this.miniModeButton = null;

        // 迷你模式歌词相关
        this._miniModeLyricsRafId = null;
        this._miniModeLyricsLastUpdateTime = 0;
        this._miniModeLyricsUpdateInterval = 16;
        this.miniModePositionChangeHandler = null;
        this._miniModeCurrentLyricIndex = -1;
        this._miniModeLyrics = []; // 迷你模式的独立歌词数据

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
        this.miniModeButton = this.element.querySelector('#mini-mode-btn');

        this.trackCover = this.element.querySelector('#track-cover');
        this.trackCoverContainer = this.element.querySelector('.track-cover-container');
        this.trackTitle = this.element.querySelector('#track-title');
        this.trackArtist = this.element.querySelector('#track-artist');

        this.progressBarContainer = this.element.querySelector('.progress-bar-container');
        this.progressTrack = this.element.querySelector('.progress-track');
        this.progressFill = this.element.querySelector('#progress-fill');
        this.progressHandle = this.element.querySelector('#progress-handle');
        this.progressTooltip = this.element.querySelector('#progress-tooltip');

        this.volumeBtn = this.element.querySelector('#volume-btn');
        this.volumeSlider = this.element.querySelector('.volume-slider');
        this.volumeSliderContainer = this.element.querySelector('.volume-slider-container');
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

        this.volumeSliderContainer.addEventListener('mousewheel', async (e) => {
            if (e.wheelDelta < 0) await api.setVolume(Math.min(1, this.volume + 0.01));
            else await api.setVolume(Math.max(0, this.volume - 0.01));
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

        // 点击封面也打开歌词页
        this.coverClickHandler = () => {
            this.emit('toggleLyrics');
        };
        this.trackCoverContainer.addEventListener('click', this.coverClickHandler);

        // 双击封面切换迷你模式
        this.coverDblClickHandler = async () => {
            if (this.isMiniMode) {
                await this.toggleMiniMode();
            }
        };
        this.trackCoverContainer.addEventListener('dblclick', this.coverDblClickHandler);

        // 封面悬浮效果
        this.coverMouseEnterHandler = () => {
            this.trackCoverContainer.classList.add('hover');
        };
        this.trackCoverContainer.addEventListener('mouseenter', this.coverMouseEnterHandler);

        this.coverMouseLeaveHandler = () => {
            this.trackCoverContainer.classList.remove('hover');
        };
        this.trackCoverContainer.addEventListener('mouseleave', this.coverMouseLeaveHandler);

        // 桌面歌词按钮事件
        if (this.desktopLyricsBtn) {
            this.desktopLyricsBtn.addEventListener('click', async () => {
                await this.toggleDesktopLyrics();
            });
        }

        // 迷你模式按钮
        if (this.miniModeButton) {
            this.miniModeButton.addEventListener('click', async () => {
                await this.toggleMiniMode();
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
        // 0.2.5版本 改进更新机制
        // 记录待更新的track，避免丢失更新
        this._updateLock = false;
        this._pendingTrack = null;

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
            // 如果正在更新，记录新的track待后续处理
            if (this._updateLock) {
                this._pendingTrack = track;
                return;
            }

            this._updateLock = true;
            try {
                await this.updateTrackInfo(track);

                // 检查是否有待处理的track
                while (this._pendingTrack) {
                    const nextTrack = this._pendingTrack;
                    this._pendingTrack = null;
                    await this.updateTrackInfo(nextTrack);
                }
            } finally {
                this._updateLock = false;
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

            // 在迷你模式下，立即清理旧状态
            if (this.isMiniMode) {
                this._miniModeLyrics = [];
                this._miniModeCurrentLyricIndex = -1;
                this.showNoMiniModeLyrics();
            }

            // 并行加载封面和歌词
            if (this.isMiniMode) {
                await Promise.all([
                    this.updateCoverArt(track),
                    this.loadMiniModeLyrics(track)
                ]);
            } else {
                await this.updateCoverArt(track);
            }
        }
    }

    async updateCoverArt(track) {
        // 首先设置默认封面
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');

        try {
            // 获取封面
            if (track.title && track.artist) {
                const coverResult = await coverAPI.getCover(track.title, track.artist, track.album, track.filePath, true);
                if (coverResult.success && coverResult.imageUrl) {
                    if (typeof coverResult.imageUrl === 'string') {
                        // 使用安全的图片设置方法
                        if (urlValidator) {
                            const success = await urlValidator.safeSetImageSrc(
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

            // 迷你模式下，更新背景
            if (this.isMiniMode) {
                await this.updateMiniModeBackground();
            }
        }
    }

    async handleCoverUpdate(data) {
        const {filePath, title, artist, type} = data;

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
            await this.restoreMiniModeState();
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

    async toggleMiniMode() {
        try {
            this.isMiniMode = !this.isMiniMode;
            if (this.isMiniMode) {
                await this.enterMiniMode();
            } else {
                await this.exitMiniMode();
            }

            cacheManager.setLocalCache('miniModeEnabled', this.isMiniMode);
        } catch (error) {
            console.error('❌ Player: 切换迷你模式失败:', error);
            showToast('迷你模式切换失败', 'error');
        }
    }

    async enterMiniMode() {
        await windowAPI.setSkipTaskbar(true);
        await windowAPI.setMinimumSize(400, 145);

        // 添加迷你模式类
        document.body.classList.add('mini-mode');

        // 设置始终置顶
        await windowAPI.setAlwaysOnTop(true);

        // 禁止窗口缩放
        await windowAPI.setResizable(false);

        // 调整窗口大小
        const miniWidth = 400;
        const miniHeight = 145;
        const currentBounds = await windowAPI.getBounds();

        await windowAPI.setBounds({
            x: currentBounds.x,
            y: currentBounds.y,
            width: miniWidth,
            height: miniHeight
        });

        // 更新按钮状态
        if (this.miniModeButton) {
            this.miniModeButton.classList.add('active');
            this.miniModeButton.title = '退出迷你模式';
        }

        // 移除封面的普通事件（保留双击事件用于退出迷你模式）
        this.trackCoverContainer.removeEventListener('click', this.coverClickHandler);
        this.trackCoverContainer.removeEventListener('mouseenter', this.coverMouseEnterHandler);
        this.trackCoverContainer.removeEventListener('mouseleave', this.coverMouseLeaveHandler);

        // 添加鼠标进入/离开窗口的监听（悬浮展开/收起）
        this.miniModeMouseEnterHandler = () => {
            document.body.classList.remove('mini-mode-collapsed');
        };
        this.miniModeMouseLeaveHandler = () => {
            document.body.classList.add('mini-mode-collapsed');
        };

        // 监听app容器
        const appContainer = document.querySelector('.app');
        if (appContainer) {
            appContainer.addEventListener('mouseenter', this.miniModeMouseEnterHandler);
            appContainer.addEventListener('mouseleave', this.miniModeMouseLeaveHandler);
            this.miniModeAppContainer = appContainer;
        }

        // 初始状态：收起
        document.body.classList.add('mini-mode-collapsed');

        // 更新迷你模式背景
        await this.updateMiniModeBackground();

        // 加载当前歌曲的歌词
        const currentTrack = api.getCurrentTrack();
        if (currentTrack) {
            await this.loadMiniModeLyrics(currentTrack);
        }

        // 添加播放进度监听，用于更新歌词逐字高亮
        this.miniModePositionChangeHandler = (position) => {
            // 计算当前歌词索引
            this.updateMiniModeLyricIndex(position);
            // 更新逐字高亮
            this.updateMiniModeLyricsWordHighlight(position);
        };
        api.on('positionChanged', this.miniModePositionChangeHandler);

        // 初始更新歌词显示
        this.updateMiniModeLyrics();
    }

    async exitMiniMode() {
        await windowAPI.setSkipTaskbar(false);
        await windowAPI.setMinimumSize(1080, 720);
        // 移除迷你模式类
        document.body.classList.remove('mini-mode');

        // 取消始终置顶
        await windowAPI.setAlwaysOnTop(false);

        // 恢复窗口缩放
        await windowAPI.setResizable(true);

        // 恢复窗口
        const {width, height} = cacheManager.getLocalCache('mainWindow-size') || [1440, 900];
        await windowAPI.setSize(width, height);

        // 更新按钮状态
        if (this.miniModeButton) {
            this.miniModeButton.classList.remove('active');
            this.miniModeButton.title = '迷你模式';
        }

        // 恢复封面事件
        this.trackCoverContainer.addEventListener('click', this.coverClickHandler);
        this.trackCoverContainer.addEventListener('mouseenter', this.coverMouseEnterHandler);
        this.trackCoverContainer.addEventListener('mouseleave', this.coverMouseLeaveHandler);

        // 移除迷你模式悬浮事件
        if (this.miniModeMouseEnterHandler && this.miniModeMouseLeaveHandler && this.miniModeAppContainer) {
            this.miniModeAppContainer.removeEventListener('mouseenter', this.miniModeMouseEnterHandler);
            this.miniModeAppContainer.removeEventListener('mouseleave', this.miniModeMouseLeaveHandler);
            this.miniModeMouseEnterHandler = null;
            this.miniModeMouseLeaveHandler = null;
            this.miniModeAppContainer = null;
        }

        // 移除播放进度监听
        if (this.miniModePositionChangeHandler) {
            api.off('positionChanged', this.miniModePositionChangeHandler);
            this.miniModePositionChangeHandler = null;
        }

        // 取消RAF请求
        if (this._miniModeLyricsRafId) {
            cancelAnimationFrame(this._miniModeLyricsRafId);
            this._miniModeLyricsRafId = null;
        }

        // 重置状态
        this._miniModeCurrentLyricIndex = -1;
        this._miniModeLyrics = []; // 清空歌词数据

        // 移除迷你模式歌词元素
        const miniLyricsElement = document.querySelector('.mini-mode-lyrics');
        if (miniLyricsElement) {
            miniLyricsElement.remove();
        }

        // 移除collapsed类
        document.body.classList.remove('mini-mode-collapsed');

        // 清除迷你模式背景
        this.clearMiniModeBackground();
    }

    async restoreMiniModeState() {
        const savedState = cacheManager.getLocalCache('miniModeEnabled');
        if (savedState === true) {
            this.isMiniMode = false;
            await this.toggleMiniMode();
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
            this.desktopLyricsBtn.style.display = '';
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
            const settings = cacheManager.getLocalCache('musicbox-settings') || {};
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

    // 迷你模式：提取封面主色
    async extractDominantColor(imgElement) {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = imgElement.naturalWidth || imgElement.width;
                canvas.height = imgElement.naturalHeight || imgElement.height;

                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

                // 获取图像数据
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 简单的颜色统计算法：取平均色
                let r = 0, g = 0, b = 0, count = 0;

                // 采样：每隔10个像素采样一次以提高性能
                for (let i = 0; i < data.length; i += 40) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // 调整亮度，使背景更柔和
                const brightness = (r + g + b) / 3;
                if (brightness > 200) {
                    // 如果太亮，降低亮度
                    r = Math.round(r * 0.6);
                    g = Math.round(g * 0.6);
                    b = Math.round(b * 0.6);
                } else if (brightness < 50) {
                    // 如果太暗，提高亮度
                    r = Math.min(255, Math.round(r * 1.5));
                    g = Math.min(255, Math.round(g * 1.5));
                    b = Math.min(255, Math.round(b * 1.5));
                }

                resolve(`${r}, ${g}, ${b}`);
            } catch (error) {
                console.error('❌ Player: 提取封面主色失败:', error);
                resolve('60, 80, 120'); // 默认蓝色调
            }
        });
    }

    // 迷你模式：更新背景
    async updateMiniModeBackground() {
        if (!this.isMiniMode) return;

        const coverImg = this.trackCover;
        // 检查封面是否成功加载
        if (coverImg && coverImg.complete && coverImg.naturalWidth > 0 &&
            coverImg.src && !coverImg.src.includes('default-cover.svg')) {
            try {
                const dominantColor = await this.extractDominantColor(coverImg);
                document.documentElement.style.setProperty('--mini-mode-bg-color', dominantColor);
            } catch (error) {
                this.setDefaultMiniModeBackground();
            }
        } else {
            // 封面未加载或加载失败，使用默认背景色
            this.setDefaultMiniModeBackground();
        }
    }

    // 迷你模式：设置默认背景色
    setDefaultMiniModeBackground() {
        const defaultColor = '60, 80, 120'; // 默认蓝色调
        document.documentElement.style.setProperty('--mini-mode-bg-color', defaultColor);
    }

    // 迷你模式：清除背景
    clearMiniModeBackground() {
        document.documentElement.style.removeProperty('--mini-mode-bg-color');
    }

    // 迷你模式：更新歌词显示
    updateMiniModeLyrics() {
        if (!this.isMiniMode) return;

        // 使用迷你模式自己的歌词数据
        if (!this._miniModeLyrics || this._miniModeLyrics.length === 0) {
            this.showNoMiniModeLyrics();
            return;
        }

        const currentIndex = this._miniModeCurrentLyricIndex;
        if (currentIndex < 0 || currentIndex >= this._miniModeLyrics.length) {
            this.showNoMiniModeLyrics();
            return;
        }

        const currentLyric = this._miniModeLyrics[currentIndex];

        let miniLyricsElement = document.querySelector('.mini-mode-lyrics');
        if (!miniLyricsElement) {
            miniLyricsElement = document.createElement('div');
            miniLyricsElement.className = 'mini-mode-lyrics';
            const playerControls = this.element.querySelector('.controls');
            if (playerControls) {
                playerControls.appendChild(miniLyricsElement);
            }
        }

        // 检查是否为逐字歌词
        const isWordByWord = currentLyric.type === 'word-by-word' && currentLyric.words && currentLyric.words.length > 0;

        if (isWordByWord) {
            miniLyricsElement.classList.add('lyrics-word-by-word');
            miniLyricsElement.innerHTML = '';

            // 根据歌词数据创建逐字元素
            currentLyric.words.forEach((word, index) => {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'lyric-word';
                wordSpan.setAttribute('data-word-index', index);
                wordSpan.setAttribute('data-word-time', word.time);
                wordSpan.setAttribute('data-word-text', word.text);
                wordSpan.textContent = word.text;
                wordSpan.style.setProperty('--word-progress', '0');
                miniLyricsElement.appendChild(wordSpan);
            });
        } else {
            // 普通歌词
            miniLyricsElement.classList.remove('lyrics-word-by-word');
            miniLyricsElement.textContent = currentLyric.content || '暂无歌词';
        }
    }

    // 迷你模式：显示无歌词状态
    showNoMiniModeLyrics() {
        let miniLyricsElement = document.querySelector('.mini-mode-lyrics');
        if (!miniLyricsElement) {
            miniLyricsElement = document.createElement('div');
            miniLyricsElement.className = 'mini-mode-lyrics';
            const playerControls = this.element.querySelector('.controls');
            if (playerControls) {
                playerControls.appendChild(miniLyricsElement);
            }
        }
        miniLyricsElement.classList.remove('lyrics-word-by-word');
        miniLyricsElement.textContent = '暂无歌词';
    }

    // 迷你模式：加载歌词数据
    async loadMiniModeLyrics(track) {
        if (!track || !track.title || !track.artist) {
            this._miniModeLyrics = [];
            this._miniModeCurrentLyricIndex = -1;
            this.showNoMiniModeLyrics();
            return;
        }

        try {
            let parsedLyrics = null;

            // 检查是否已有内嵌的歌词
            if (track.lyrics) {
                parsedLyrics = track.lyrics;
            } else {
                // 从API获取歌词
                const lyricsResult = await lyricsAPI.getLyrics(track.title, track.artist, track.album, track.filePath);
                if (lyricsResult.success) {
                    if (lyricsResult.format === 'ttml' && lyricsResult.content) {
                        parsedLyrics = lyricsAPI.parseTTML(lyricsResult.content);
                    } else if (lyricsResult.lrc) {
                        parsedLyrics = lyricsAPI.parseLRC(lyricsResult.lrc);
                    } else if (lyricsResult.content) {
                        parsedLyrics = lyricsAPI.parse(lyricsResult.content, lyricsResult.format);
                    }
                }
            }

            if (parsedLyrics && parsedLyrics.length > 0) {
                this._miniModeLyrics = parsedLyrics;

                // 根据当前播放位置初始化歌词索引（修复关键）
                const currentTime = this.currentTime || 0;
                let initialIndex = 0;

                // 找到当前时间对应的歌词索引
                for (let i = 0; i < parsedLyrics.length; i++) {
                    if (currentTime >= parsedLyrics[i].time) {
                        initialIndex = i;
                    } else {
                        break;
                    }
                }

                this._miniModeCurrentLyricIndex = initialIndex;
                console.log(`✅ Player: 迷你模式歌词加载成功，共${parsedLyrics.length}行，当前索引:${initialIndex}，播放位置:${currentTime.toFixed(2)}s`);

                // 立即更新显示
                this.updateMiniModeLyrics();
            } else {
                this._miniModeLyrics = [];
                this._miniModeCurrentLyricIndex = -1;
                this.showNoMiniModeLyrics();
            }
        } catch (error) {
            console.error('❌ Player: 迷你模式歌词加载失败:', error);
            this._miniModeLyrics = [];
            this._miniModeCurrentLyricIndex = -1;
            this.showNoMiniModeLyrics();
        }
    }

    // 迷你模式：更新歌词索引
    updateMiniModeLyricIndex(currentTime) {
        if (!this._miniModeLyrics || this._miniModeLyrics.length === 0) {
            return;
        }

        // 找到当前时间对应的歌词索引
        let newIndex = -1;
        for (let i = 0; i < this._miniModeLyrics.length; i++) {
            if (currentTime >= this._miniModeLyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }

        // 如果没有找到匹配的歌词行（当前时间早于第一句歌词），显示第一句
        if (newIndex === -1 && this._miniModeLyrics.length > 0) {
            newIndex = 0;
        }

        // 如果索引变化，更新显示
        if (newIndex !== this._miniModeCurrentLyricIndex) {
            this._miniModeCurrentLyricIndex = newIndex;
            this.updateMiniModeLyrics();
        }
    }

    // 迷你模式：更新逐字歌词高亮
    updateMiniModeLyricsWordHighlight(currentTime) {
        if (!this.isMiniMode) return;

        const miniLyricsElement = document.querySelector('.mini-mode-lyrics');
        if (!miniLyricsElement || !miniLyricsElement.classList.contains('lyrics-word-by-word')) {
            return;
        }

        // 节流控制
        const now = performance.now();
        if (now - this._miniModeLyricsLastUpdateTime < this._miniModeLyricsUpdateInterval) {
            return;
        }
        this._miniModeLyricsLastUpdateTime = now;

        const words = miniLyricsElement.querySelectorAll('.lyric-word');
        if (words.length === 0) return;

        // 取消之前的RAF请求
        if (this._miniModeLyricsRafId) {
            cancelAnimationFrame(this._miniModeLyricsRafId);
        }

        // 使用requestAnimationFrame优化DOM操作
        this._miniModeLyricsRafId = requestAnimationFrame(() => {
            this._miniModeLyricsRafId = null;

            for (let i = 0; i < words.length; i++) {
                const wordElement = words[i];
                const wordStartTime = parseFloat(wordElement.getAttribute('data-word-time'));

                // 计算词的结束时间
                let wordEndTime;
                if (i < words.length - 1) {
                    wordEndTime = parseFloat(words[i + 1].getAttribute('data-word-time'));
                } else {
                    // 最后一个词，假设持续0.5秒
                    wordEndTime = wordStartTime + 0.5;
                }

                if (currentTime < wordStartTime) {
                    // 未播放的字
                    wordElement.classList.remove('highlight', 'played');
                    wordElement.style.setProperty('--word-progress', '0');
                } else if (currentTime >= wordEndTime) {
                    // 已播放的字
                    wordElement.classList.remove('highlight');
                    wordElement.classList.add('played');
                    wordElement.style.setProperty('--word-progress', '1');
                } else {
                    // 正在播放的字
                    const duration = wordEndTime - wordStartTime;
                    const progress = duration > 0 ? (currentTime - wordStartTime) / duration : 1;
                    const clampedProgress = Math.max(0, Math.min(1, progress));

                    wordElement.classList.add('highlight');
                    wordElement.classList.remove('played');
                    wordElement.style.setProperty('--word-progress', clampedProgress.toFixed(2));
                }
            }
        });
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

export {Player};
