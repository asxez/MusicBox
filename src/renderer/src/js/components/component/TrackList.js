/**
 * 我的音乐页组件
 */

class TrackList extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.selectedTracks = new Set();
        this.showCovers = this.getShowCoversSettings();
        this.setupSettingsListener();
    }

    getShowCoversSettings() {
        const settings = window.cacheManager.getLocalCache('musicbox-settings') || {};
        return settings.hasOwnProperty('showTrackCovers') ? settings.showTrackCovers : true;
    }

    setupSettingsListener() {
        // 延迟设置监听器，确保app.components.settings已初始化
        const setupListener = () => {
            if (window.app && window.app.components && window.app.components.settings) {
                window.app.components.settings.on('showTrackCoversEnabled', (enabled) => {
                    this.showCovers = enabled;
                    this.render(); // 重新渲染列表
                    console.log(`🖼️ TrackList: 封面显示设置已更新为 ${enabled ? '启用' : '禁用'}`);
                });
                console.log('🖼️ TrackList: 设置监听器已设置');
            } else {
                // 如果还没有初始化，延迟重试
                setTimeout(setupListener, 100);
            }
        };
        setupListener();
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
        item.className = this.showCovers ? 'track-item with-cover' : 'track-item';
        item.dataset.index = index;

        // 根据是否显示封面来调整布局
        if (this.showCovers) {
            item.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-cover-container">
                    <img class="track-cover" src="${this.getTrackCover(track)}" alt="封面" loading="lazy" onerror="this.src='assets/images/default-cover.svg'">
                </div>
                <div class="track-info">
                    <div class="track-title">${sanitizeHTML(track.title || 'Unknown Title')}</div>
                    <div class="track-artist">${sanitizeHTML(track.artist || 'Unknown Artist')}</div>
                </div>
                <div class="track-album">${sanitizeHTML(track.album || 'Unknown Album')}</div>
                <div class="track-duration">${formatTime(track.duration || 0)}</div>
            `;
        } else {
            item.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-info">
                    <div class="track-title">${sanitizeHTML(track.title || 'Unknown Title')}</div>
                    <div class="track-artist">${sanitizeHTML(track.artist || 'Unknown Artist')}</div>
                </div>
                <div class="track-album">${sanitizeHTML(track.album || 'Unknown Album')}</div>
                <div class="track-duration">${formatTime(track.duration || 0)}</div>
            `;
        }

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
            if (!window.localCoverManager) return;

            // 使用requestIdleCallback优化性能，在浏览器空闲时加载封面
            const loadCover = async () => {
                const coverResult = await window.api.getCover(
                    track.title, track.artist, track.album
                );

                if (coverResult.success && coverResult.filePath) {
                    // 确保路径格式正确
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
                    console.log(`✅ TrackList: 封面加载成功 - ${track.title}, 路径: ${track.cover}`);

                    // 使用requestAnimationFrame确保DOM更新在下一帧进行
                    requestAnimationFrame(() => {
                        const trackItems = this.element.querySelectorAll('.track-item');
                        trackItems.forEach((item, index) => {
                            if (parseInt(item.dataset.index) === this.tracks.indexOf(track)) {
                                const coverImg = item.querySelector('.track-cover');
                                if (coverImg) {
                                    coverImg.src = track.cover;
                                    console.log(`🖼️ TrackList: 更新封面图片 - ${track.title}`);
                                }
                            }
                        });
                    });
                } else {
                    console.warn(`⚠️ TrackList: 封面加载失败 - ${track.title}:`, coverResult.error || '未知错误');
                }
            };

            // 如果支持requestIdleCallback，使用它；否则使用setTimeout
            if (window.requestIdleCallback) {
                window.requestIdleCallback(loadCover);
            } else {
                setTimeout(loadCover, 0);
            }
        } catch (error) {
            console.warn('TrackList: 加载封面失败:', error);
        }
    }

    // 调试方法：验证封面加载状态
    debugCoverStatus() {
        console.log('🔍 TrackList: 封面加载状态调试');
        this.tracks.forEach((track, index) => {
            console.log(`Track ${index + 1}: ${track.title}`);
            console.log(`  - Cover: ${track.cover || '未设置'}`);
            console.log(`  - Cover type: ${typeof track.cover}`);
        });
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
