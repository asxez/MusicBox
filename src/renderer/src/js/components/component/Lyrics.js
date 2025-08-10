/**
 * 歌词页组件
 */

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

        const HIDE_DELAY = 2000;
        let mouseTimer = null;
        this.element.addEventListener('mousemove', () => {
            if (this.isVisible && this.isFullscreen) {
                this.element.classList.remove('hide-cursor');
                clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    if (this.isVisible && this.isFullscreen) {
                        this.element.classList.add('hide-cursor');
                    }
                }, HIDE_DELAY);
            }
        });
        const clearHideTimer = () => {
            clearTimeout(mouseTimer);
            mouseTimer = null;
            this.element.classList.remove('hide-cursor');
        };
        document.addEventListener('fullscreenchange', () => {
            if (!this.isFullscreen) clearHideTimer();
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
    }

    hide() {
        this.isVisible = false;
        this.page.classList.remove('show');

        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
            }
        }, 300);
    }

    toggle(track) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(track);
        }
    }

    async togglePlayPause() {
        // 防止重复调用的锁定机制
        if (this._toggleInProgress) {
            console.log('🚫 Lyrics: 播放状态切换正在进行中，忽略重复调用');
            return;
        }

        this._toggleInProgress = true;
        console.log('🔄 Lyrics: 切换播放状态，当前状态:', this.isPlaying);

        try {
            if (this.isPlaying) {
                console.log('🔄 Lyrics: 请求暂停');
                const result = await api.pause();
                if (!result) {
                    console.error('❌ Lyrics: 暂停失败');
                }
            } else {
                console.log('🔄 Lyrics: 请求播放');
                const result = await api.play();
                if (!result) {
                    console.error('❌ Lyrics: 播放失败');
                }
            }
        } catch (error) {
            console.error('❌ Lyrics: 切换播放状态失败:', error);
        } finally {
            // 延迟释放锁，确保状态更新完成
            setTimeout(() => {
                this._toggleInProgress = false;
            }, 100);
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

        // 检查是否已有内嵌的歌词
        if (track.lyrics) {
            console.log('🎵 Lyrics: 使用内嵌歌词');
            this.lyrics = track.lyrics;
            this.renderLyrics();

            // 同步歌词到桌面歌词窗口
            if (api && api.syncToDesktopLyrics) {
                await api.syncToDesktopLyrics('lyrics', this.lyrics);
            }
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            console.log('🎵 Lyrics: 从window.api获取歌词');
            const lyricsResult = await api.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                this.lyrics = api.parseLRC(lyricsResult.lrc);
                if (this.lyrics.length > 0) {
                    // 缓存歌词到track对象
                    track.lyrics = this.lyrics;
                    track.lrcText = lyricsResult.lrc;
                    this.renderLyrics();
                    console.log('✅ Lyrics: 歌词加载成功');

                    // 同步歌词到桌面歌词窗口
                    if (api && api.syncToDesktopLyrics) {
                        await api.syncToDesktopLyrics('lyrics', this.lyrics);
                    }
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
                console.log('🖼️ Lyrics: 使用本地封面', {
                    type: typeof track.cover,
                    constructor: track.cover.constructor.name,
                    value: typeof track.cover === 'string' ?
                           track.cover.substring(0, 100) + '...' :
                           JSON.stringify(track.cover)
                });

                if (typeof track.cover !== 'string') {
                    console.error('❌ Lyrics: track.cover不是字符串，无法设置为src', {
                        type: typeof track.cover,
                        value: track.cover
                    });
                    this.trackCover.src = 'assets/images/default-cover.svg';
                    this.trackCover.classList.remove('loading');
                    this.background.style.backgroundImage = 'none';
                    return;
                }

                console.log('🔄 Lyrics: 即将设置trackCover.src =', track.cover.substring(0, 100) + '...');
                this.trackCover.src = track.cover;
                this.trackCover.classList.remove('loading');
                this.background.style.backgroundImage = `url(${track.cover})`;
                return;
            }

            // 尝试从API获取封面
            if (track.title && track.artist) {
                console.log('🖼️ Lyrics: 从API获取封面');
                const coverResult = await api.getCover(track.title, track.artist, track.album, track.filePath);

                if (coverResult.success && coverResult.imageUrl) {
                    console.log('✅ Lyrics: 封面获取成功', {
                        source: coverResult.source,
                        type: coverResult.type,
                        urlType: typeof coverResult.imageUrl
                    });

                    // 验证URL格式
                    if (typeof coverResult.imageUrl === 'string') {
                        this.trackCover.src = coverResult.imageUrl;
                        this.background.style.backgroundImage = `url(${coverResult.imageUrl})`;
                        console.log('✅ Lyrics: 封面更新成功');

                        // 缓存封面URL到track对象
                        track.cover = coverResult.imageUrl;
                    } else {
                        console.error('❌ Lyrics: API返回的imageUrl不是字符串', {
                            type: typeof coverResult.imageUrl,
                            value: coverResult.imageUrl
                        });
                    }
                } else {
                    console.log('❌ Lyrics: 封面获取失败，使用默认封面', coverResult.error);
                }
            }
            // 设置背景图像
            if (track.cover) {
                this.background.style.backgroundImage = `url(${track.cover})`;
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
        const duration = (this.currentTrack && this.currentTrack.duration) ? this.currentTrack.duration : (await api.getDuration());
        if (!this.currentTrack || !duration) return;
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const seekTime = percentage * duration;
        await api.seek(seekTime);
        console.log('🎵 Lyrics: 跳转到', this.formatTime(seekTime));
    }

    startProgressDrag(e) {
        this.isDraggingProgress = true;
        this.progressBar.classList.add('dragging');
        this.updateProgressDrag(e);
    }

    updateProgressDrag(e) {
        const duration = (this.currentTrack && this.currentTrack.duration) ? this.currentTrack.duration : (api.duration || 0);
        if (!this.isDraggingProgress || !this.currentTrack || duration <= 0) return;

        const rect = this.progressBar.getBoundingClientRect();
        const dragX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const percentage = dragX / rect.width;

        // 实时更新进度条显示
        this.progressFill.style.width = `${percentage * 100}%`;
        this.currentTimeEl.textContent = this.formatTime(percentage * duration);
    }

    async endProgressDrag() {
        if (!this.isDraggingProgress) return;

        this.isDraggingProgress = false;
        this.progressBar.classList.remove('dragging');

        // 执行实际的跳转
        const percentage = parseFloat(this.progressFill.style.width) / 100;
        const duration = (this.currentTrack && this.currentTrack.duration) ? this.currentTrack.duration : (await api.getDuration());
        const seekTime = percentage * (duration || 0);
        await api.seek(seekTime);
    }
}

window.components.component.Lyrics = Lyrics;
