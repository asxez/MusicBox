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
        this.setupCoverUpdateListener();
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

    destroy() {
        // 清理封面更新订阅
        if (this.coverUpdateUnsubscribe) {
            this.coverUpdateUnsubscribe = null;
        }

        // 清理数据
        this.tracks = [];
        this.filteredTracks = [];
        this.currentTrackIndex = -1;
        super.destroy();
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

    setupCoverUpdateListener() {
        // 监听封面更新事件
        this.coverUpdateUnsubscribe = window.coverUpdateManager.onCoverUpdate(async (data) => {
            await this.handleCoverUpdate(data);
        });
    }

    setTracks(tracks) {
        this.tracks = tracks;
        this.render();

        // 异步加载封面
        if (this.showCovers) {
            this.preloadVisibleCovers();
        }
    }

    // 预加载可见区域的封面
    preloadVisibleCovers() {
        const tracksToPreload = this.tracks.slice(0, 12);

        tracksToPreload.forEach((track) => {
            if (!track.cover && track.filePath) {
                this.loadTrackCoverAsync(track);
            }
        });
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
        if (track.cover) {
            // console.log('🔍 TrackList: getTrackCover检查封面数据', {
            //     type: typeof track.cover,
            //     constructor: track.cover.constructor.name,
            //     value: typeof track.cover === 'string' ?
            //            track.cover.substring(0, 100) + '...' :
            //            JSON.stringify(track.cover)
            // });

            if (typeof track.cover !== 'string') {
                console.error('❌ TrackList: track.cover不是字符串，返回默认封面', {
                    type: typeof track.cover,
                    value: track.cover
                });
                return 'assets/images/default-cover.svg';
            }

            return track.cover;
        }

        // 异步获取封面，先返回默认封面
        this.loadTrackCoverAsync(track);
        return 'assets/images/default-cover.svg';
    }

    async loadTrackCoverAsync(track) {
        try {
            // 使用requestIdleCallback优化性能，在浏览器空闲时加载封面
            const loadCover = async () => {
                const coverResult = await window.api.getCover(
                    track.title, track.artist, track.album, track.filePath
                );

                if (coverResult.success && coverResult.imageUrl && typeof coverResult.imageUrl === 'string') {
                    let coverUrl = coverResult.imageUrl;

                    // 处理本地文件路径格式
                    if (coverResult.type === 'local-file' && coverResult.filePath) {
                        if (!coverUrl.startsWith('file://')) {
                            coverUrl = coverResult.filePath.replace(/\\/g, '/');
                            if (!coverUrl.startsWith('/')) {
                                coverUrl = '/' + coverUrl;
                            }
                            coverUrl = `file://${coverUrl}`;
                        }
                    }

                    track.cover = coverUrl;

                    // 更新DOM
                    requestAnimationFrame(() => {
                        const trackItems = this.element.querySelectorAll('.track-item');
                        trackItems.forEach((item) => {
                            if (parseInt(item.dataset.index) === this.tracks.indexOf(track)) {
                                const coverImg = item.querySelector('.track-cover');
                                if (coverImg) {
                                    coverImg.src = track.cover;
                                }
                            }
                        });
                    });
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

    // 更新DOM中的歌曲封面
    updateTrackCoverInDOM(track) {
        try {
            const trackItems = this.element.querySelectorAll('.track-item');
            trackItems.forEach((item, index) => {
                if (this.tracks[index] === track) {
                    const coverImg = item.querySelector('.track-cover img');
                    if (coverImg && track.cover) {
                        console.log('🔄 TrackList: 更新DOM中的封面', {
                            title: track.title,
                            coverType: typeof track.cover,
                            coverValue: typeof track.cover === 'string' ?
                                       track.cover.substring(0, 100) + '...' :
                                       JSON.stringify(track.cover)
                        });

                        // 严格的类型检查
                        if (typeof track.cover !== 'string') {
                            console.error('❌ TrackList: track.cover不是字符串，无法设置为src', {
                                type: typeof track.cover,
                                value: track.cover
                            });
                            coverImg.src = 'assets/images/default-cover.svg';
                            return;
                        }

                        console.log('🔄 TrackList: 即将设置coverImg.src =', track.cover.substring(0, 100) + '...');
                        coverImg.src = track.cover;
                        coverImg.onerror = () => {
                            console.warn('⚠️ TrackList: 封面加载失败，使用默认封面');
                            coverImg.src = 'assets/images/default-cover.svg';
                        };
                    }
                }
            });
        } catch (error) {
            console.error('❌ TrackList: 更新DOM封面失败', error);
        }
    }

    async playTrack(track, index) {
        try {
            console.log(`🎵 双击播放: ${track.title || track.filePath}`);

            // 触发trackPlayed事件，让App.js处理播放逻辑
            // 可以确保播放列表正确设置，避免重复的播放操作
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

    // 处理封面更新事件
    async handleCoverUpdate(data) {
        const { filePath, title, artist, type } = data;

        // 只处理封面更新事件
        if (type && type !== 'cover-updated' && type !== 'manual-refresh') {
            return;
        }

        // 查找匹配的歌曲
        const matchingTrack = this.tracks.find(track =>
            track.filePath === filePath ||
            (track.title === title && track.artist === artist)
        );

        if (matchingTrack) {
            // 清除缓存并重新获取封面
            if (matchingTrack.cover) {
                delete matchingTrack.cover;
            }
            await this.refreshTrackCoverInDOM(matchingTrack);
        }
    }

    async refreshTrackCoverInDOM(track) {
        try {
            // 强制重新获取封面
            const coverResult = await api.getCover(track.title, track.artist, track.album, track.filePath, true);
            if (coverResult.success && coverResult.imageUrl) {
                track.cover = coverResult.imageUrl;
                this.updateTrackCoverInDOM(track);
            } else {
                track.cover = null;
            }
        } catch (error) {
            console.error('TrackList封面刷新失败:', error);
        }
    }
}

window.components.component.TrackList = TrackList;
