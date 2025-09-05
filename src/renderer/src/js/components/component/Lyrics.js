/**
 * 歌词页组件
 */

class Lyrics extends Component {
    constructor(element) {
        super(element);
        this.isPlaying = false;
        this.element = element;
        this.isVisible = false;
        this.currentTrack = null;
        this.lyrics = [];
        this.currentLyricIndex = -1;
        this.listenersSetup = false; // 事件监听器是否已设置

        // 防重复加载机制
        this._lastTrackPath = null; // 上次更新的歌曲路径
        this._lastLoadedLyricsPath = null; // 上次加载歌词的歌曲路径
        this._isLoadingLyrics = false; // 是否正在加载歌词
        this._updateTrackInfoInProgress = false; // 是否正在更新歌曲信息
        this._pendingUpdatePromise = null; // 当前正在执行的更新Promise

        this.setupElements();
    }

    async show(track) {
        // 只在首次显示或事件监听器被清理后才设置
        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.setupAPIListeners();
            this.listenersSetup = true;
        }

        // 检查是否需要更新歌曲信息
        const trackPath = track ? (track.filePath || track.path || `${track.title}_${track.artist}`) : null;
        const needsUpdate = !this.currentTrack ||
            (this.currentTrack.filePath || this.currentTrack.path || `${this.currentTrack.title}_${this.currentTrack.artist}`) !== trackPath;

        if (needsUpdate && track) {
            await this.updateTrackInfo(track);
        }

        this.currentTrack = track;
        this.isVisible = true;
        this.isPlaying = api.isPlaying;

        // 动画显示
        this.page.style.display = 'block';
        setTimeout(() => {
            this.page.classList.add('show');
        }, 10);

        this.updateFullscreenState();
        await this.initializeControls();

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

        // 重置防重复状态
        this._lastTrackPath = null;
        this._lastLoadedLyricsPath = null;
        this._isLoadingLyrics = false;
        this._updateTrackInfoInProgress = false;
        this._pendingUpdatePromise = null;
        setTimeout(() => {
            if (!this.isVisible) {
                this.page.style.display = 'none';
            }
        }, 300);
    }

    destroy() {
        // 清理歌词数据
        this.lyrics = [];
        this.currentTrack = null;
        this.currentLyricIndex = -1;

        // 重置状态
        this.isVisible = false;
        this.isPlaying = false;
        this.listenersSetup = false;
        super.destroy();
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
        this.addEventListenerManaged(this.closeBtn, 'click', () => {
            this.hide();
        });

        this.addEventListenerManaged(this.fullscreenBtn, 'click', () => {
            this.toggleFullscreen();
        });

        this.addEventListenerManaged(this.playBtn, 'click', async () => {
            await this.togglePlayPause();
        });

        this.addEventListenerManaged(this.prevBtn, 'click', async () => {
            await api.previousTrack();
        });

        this.addEventListenerManaged(this.nextBtn, 'click', async () => {
            await api.nextTrack();
        });

        // 音量控制事件
        this.addEventListenerManaged(this.volumeBtn, 'click', async () => {
            await this.toggleVolumeMute();
        });

        // 音量条点击和拖拽事件
        this.addEventListenerManaged(this.volumeSliderContainer, 'mousedown', async (e) => {
            this.isDraggingVolume = true;
            await this.updateVolumeFromEvent(e);
        });
        this.addEventListenerManaged(this.volumeSliderContainer, 'click', async (e) => {
            if (!this.isDraggingVolume) {
                await this.updateVolumeFromEvent(e);
            }
        });

        // 播放模式切换事件
        this.addEventListenerManaged(this.playModeBtn, 'click', () => {
            const newMode = api.togglePlayMode();
            this.updatePlayModeDisplay(newMode);
        });

        // 进度条交互事件
        this.addEventListenerManaged(this.progressBar, 'click', async (e) => {
            await this.seekToPosition(e);
        });
        this.addEventListenerManaged(this.progressBar, 'mousedown', (e) => {
            this.startProgressDrag(e);
        });

        // document
        this.addEventListenerManaged(document, 'mousemove', async (e) => {
            if (this.isDraggingProgress) {
                this.updateProgressDrag(e);
            }
            if (this.isDraggingVolume) {
                await this.updateVolumeFromEvent(e);
            }
        });
        this.addEventListenerManaged(document, 'mouseup', async () => {
            if (this.isDraggingProgress) {
                await this.endProgressDrag();
            }
            if (this.isDraggingVolume) {
                this.isDraggingVolume = false;
            }
        });

        // 鼠标隐藏逻辑
        const HIDE_DELAY = 2000;
        let mouseTimer = null;
        this.elementMouseMoveHandler = () => {
            if (this.isVisible && this.isFullscreen) {
                this.element.classList.remove('hide-cursor');
                clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    if (this.isVisible && this.isFullscreen) {
                        this.element.classList.add('hide-cursor');
                    }
                }, HIDE_DELAY);
            }
        };
        this.addEventListenerManaged(this.element, 'mousemove', this.elementMouseMoveHandler);

        this.clearHideTimer = () => {
            clearTimeout(mouseTimer);
            mouseTimer = null;
            this.element.classList.remove('hide-cursor');
        };

        this.addEventListenerManaged(document, 'fullscreenchange', () => {
            if (!this.isFullscreen) this.clearHideTimer();
            this.updateFullscreenState();
        });
    }

    setupAPIListeners() {
        // 监听播放进度变化，用于歌词同步和进度条更新
        this.addAPIEventListenerManaged('positionChanged', (position) => {
            this.updateLyricHighlight(position);
        });

        this.addAPIEventListenerManaged('playbackStateChanged', (state) => {
            this.isPlaying = state === 'playing';
            this.updatePlayButton();
        });

        // 时长变化事件
        this.addAPIEventListenerManaged('durationChanged', (duration) => {
            if (this.durationEl && duration > 0) {
                this.durationEl.textContent = this.formatTime(duration);
            }
        });
    }

    async toggle(track) {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show(track);
        }
    }

    async togglePlayPause() {
        // 防止重复调用的锁定机制
        if (this._toggleInProgress) {
            return;
        }

        this._toggleInProgress = true;
        try {
            if (this.isPlaying) {
                // console.log('🔄 Lyrics: 请求暂停');
                const result = await api.pause();
                if (!result) {
                    console.error('❌ Lyrics: 暂停失败');
                }
            } else {
                // console.log('🔄 Lyrics: 请求播放');
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
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async updateTrackInfo(track) {
        if (!track) return;

        // 检查是否正在更新或是同一首歌
        const trackPath = track.filePath || track.path || `${track.title}_${track.artist}`;

        // 如果有正在执行的更新Promise，等待它完成
        if (this._pendingUpdatePromise) {
            await this._pendingUpdatePromise;
        }

        // 再次检查是否需要更新（可能在等待期间已经更新了相同的歌曲）
        if (this._lastTrackPath === trackPath) {
            return;
        }

        if (this._updateTrackInfoInProgress) {
            return;
        }

        this._updateTrackInfoInProgress = true;
        this._lastTrackPath = trackPath;

        // 创建更新Promise
        this._pendingUpdatePromise = this._doUpdateTrackInfo(track);

        try {
            await this._pendingUpdatePromise;
        } finally {
            this._pendingUpdatePromise = null;
            this._updateTrackInfoInProgress = false;
        }
    }

    async _doUpdateTrackInfo(track) {
        try {
            console.log('🎵 Lyrics: 开始更新歌曲信息', track.title, '时间戳:', Date.now());

            this.trackTitle.textContent = track.title || '未知歌曲';
            this.trackArtist.textContent = track.artist || '未知艺术家';

            // 正确更新总时长显示
            if (this.durationEl && track.duration) {
                this.durationEl.textContent = this.formatTime(track.duration);
            }

            // 更新封面和歌词
            await this.loadLyrics(track);
            await this.updateCoverArt(track);
        } catch (error) {
            console.error('❌ Lyrics: 歌曲信息更新失败:', error);
            throw error;
        }
    }

    async loadLyrics(track) {
        if (!track || !track.title || !track.artist) {
            this.showNoLyrics();
            return;
        }

        // 防重复加载机制
        const trackPath = track.filePath || track.path || `${track.title}_${track.artist}`;

        // 检查是否正在加载或已经加载过相同歌曲
        if (this._isLoadingLyrics || this._lastLoadedLyricsPath === trackPath) {
            return;
        }

        this._isLoadingLyrics = true;
        this._lastLoadedLyricsPath = trackPath;

        // 检查是否已有内嵌的歌词
        if (track.lyrics) {
            // console.log('🎵 Lyrics: 使用内嵌歌词');
            this.lyrics = track.lyrics;
            this.renderLyrics();

            // 同步歌词到桌面歌词窗口
            if (api && api.syncToDesktopLyrics) {
                await api.syncToDesktopLyrics('lyrics', this.lyrics);
            }
            return;
        }

        this.showLoading();

        try {
            const lyricsResult = await api.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                this.lyrics = api.parseLRC(lyricsResult.lrc);
                if (this.lyrics.length > 0) {
                    // 缓存歌词到track对象
                    track.lyrics = this.lyrics;
                    track.lrcText = lyricsResult.lrc;
                    this.renderLyrics();

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
            this._isLoadingLyrics = false;
        }
    }

    async updateCoverArt(track) {
        // 首先设置默认封面和背景
        this.trackCover.src = 'assets/images/default-cover.svg';
        this.trackCover.classList.add('loading');
        await this.setBackgroundImage(null); // 清空背景

        try {
            let finalImageUrl = null;

            // 检查是否已有本地封面
            if (track.cover) {
                // console.log('🖼️ Lyrics: 使用本地封面', {
                //     type: typeof track.cover,
                //     constructor: track.cover.constructor.name,
                //     value: typeof track.cover === 'string' ?
                //         track.cover.substring(0, 100) + '...' :
                //         JSON.stringify(track.cover)
                // });

                if (typeof track.cover !== 'string') {
                    console.error('❌ Lyrics: track.cover不是字符串，无法设置为src', {
                        type: typeof track.cover,
                        value: track.cover
                    });
                    this.trackCover.src = 'assets/images/default-cover.svg';
                    this.trackCover.classList.remove('loading');
                    return;
                }

                console.log('🔄 Lyrics: 即将设置trackCover.src =', track.cover.substring(0, 100) + '...');
                finalImageUrl = track.cover;
            }

            // 如果没有本地封面，尝试从API获取
            if (!finalImageUrl && track.title && track.artist) {
                const coverResult = await api.getCover(track.title, track.artist, track.album, track.filePath);

                if (coverResult.success && coverResult.imageUrl) {
                    // console.log('✅ Lyrics: 封面获取成功', {
                    //     source: coverResult.source,
                    //     type: coverResult.type,
                    //     urlType: typeof coverResult.imageUrl
                    // });

                    // 验证URL格式
                    if (typeof coverResult.imageUrl === 'string') {
                        finalImageUrl = coverResult.imageUrl;
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

            // 统一设置封面和背景
            if (finalImageUrl) {
                await this.setCoverAndBackground(finalImageUrl);
            }
        } catch (error) {
            console.error('❌ Lyrics: 封面更新失败:', error);
        } finally {
            this.trackCover.classList.remove('loading');
        }
    }

    // 设置背景图片的辅助方法
    async setBackgroundImage(imageUrl) {
        if (!this.background) return;

        if (imageUrl) {
            try {
                // 处理不同类型的URL
                const processedUrl = await this.processImageUrl(imageUrl);
                if (processedUrl) {
                    this.background.style.backgroundImage = `url("${processedUrl}")`;
                } else {
                    this.background.style.backgroundImage = 'none';
                }
            } catch (error) {
                console.error('❌ Lyrics: 背景图片设置失败:', error);
                this.background.style.backgroundImage = 'none';
            }
        } else {
            this.background.style.backgroundImage = 'none';
        }
    }

    // 处理图片URL，将file://协议转换为可用格式
    async processImageUrl(url) {
        if (!url || typeof url !== 'string') return null;

        // 如果是data URL或blob URL，直接返回
        if (url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
        }

        // 如果是HTTP/HTTPS URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // 如果是file://协议，转换为blob URL
        if (url.startsWith('file://')) {
            return await this.convertFileUrlToBlobUrl(url);
        }

        // 其他情况，尝试作为本地文件路径处理
        return await this.convertLocalPathToBlobUrl(url);
    }

    // 将file://协议的URL转换为blob URL
    async convertFileUrlToBlobUrl(fileUrl) {
        try {
            // 提取文件路径
            let filePath = fileUrl.replace('file://', '');

            // Windows路径处理
            if (filePath.startsWith('/') && filePath.includes(':')) {
                filePath = filePath.substring(1); // 移除开头的/
            }

            return await this.convertLocalPathToBlobUrl(filePath);
        } catch (error) {
            console.error('❌ Lyrics: file://协议转换失败:', error);
            return null;
        }
    }

    // 将本地文件路径转换为blob URL
    async convertLocalPathToBlobUrl(filePath) {
        try {
            // 读取文件数据
            const fileData = await window.electronAPI.fs.readFile(filePath);
            if (!fileData || fileData.length === 0) {
                console.error('❌ Lyrics: 文件数据为空');
                return null;
            }

            // 根据文件扩展名确定MIME类型
            const mimeType = this.getMimeTypeFromPath(filePath);

            // 创建Blob
            const uint8Array = new Uint8Array(fileData);
            const blob = new Blob([uint8Array], {type: mimeType});

            // 创建blob URL
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('❌ Lyrics: 本地文件转换失败:', error);
            return null;
        }
    }

    // 根据文件路径获取MIME类型
    getMimeTypeFromPath(filePath) {
        const ext = filePath.toLowerCase().split('.').pop();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }

    // 统一设置封面和背景的方法
    async setCoverAndBackground(imageUrl) {
        try {
            // 使用urlValidator安全设置封面图片
            const success = await window.urlValidator.safeSetImageSrc(this.trackCover, imageUrl);
            if (!success) {
                this.trackCover.src = 'assets/images/default-cover.svg';
            }

            // 设置背景图片
            await this.setBackgroundImage(imageUrl);
        } catch (error) {
            console.error('❌ Lyrics: 封面和背景设置失败:', error);
            this.trackCover.src = 'assets/images/default-cover.svg';
            await this.setBackgroundImage(null);
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
    }

    // 初始化控件状态
    async initializeControls() {
        this.isPlaying = api.isPlaying;

        const currentVolume = api.getVolume ? (await api.getVolume() * 100) : 50;
        await this.setVolume(currentVolume);
        const currentMode = api.getPlayMode ? api.getPlayMode() : 'repeat';
        this.updatePlayModeDisplay(currentMode);
        this.updatePlayButton();
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
            console.warn(' Player: 播放模式图标元素不存在');
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
