/**
 * 我的音乐页组件
 */

import {formatTime, sanitizeHTML} from "@utils";
import {cacheManager} from "@services/CacheManager";
import {coverUpdateManager} from "@services/cover/CoverUpdateManager";
import {Component} from "@components/base/Component";
import {api} from "@api/api";
import {app} from "@core/app";
import {coverAPI} from "@api/CoverAPI";

class TrackList extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.selectedTracks = new Set();
        this.showCovers = this.getShowCoversSettings();
        this.loadingCovers = new Set(); // 跟踪正在加载的封面，避免重复请求
        this.coversPreloaded = false; // 防重复标志：是否已经预加载过封面
        this.lastTracksHash = null; // 上次tracks的哈希值，用于检测真正的变化
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
        this.loadingCovers.clear();
        super.destroy();
    }

    getShowCoversSettings() {
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};
        return settings.hasOwnProperty('showTrackCovers') ? settings.showTrackCovers : true;
    }

    // 生成tracks的简单哈希值
    generateTracksHash(tracks) {
        if (!tracks || tracks.length === 0) return 'empty';
        // 使用tracks数量和前几个文件路径生成简单哈希
        const sample = tracks.slice(0, 3).map(t => t.filePath || t.title).join('|');
        return `${tracks.length}_${sample}`;
    }

    setupSettingsListener() {
        // 延迟设置监听器，确保app.components.settings已初始化
        const setupListener = () => {
            if (app && app.components && app.components.settings) {
                app.components.settings.on('showTrackCoversEnabled', (enabled) => {
                    this.showCovers = enabled;
                    // 重置预加载状态，因为设置发生了变化
                    this.coversPreloaded = false;
                    this.render(); // 重新渲染列表

                    // 如果启用了封面显示，立即预加载
                    if (enabled && this.tracks.length > 0) {
                        setTimeout(() => {
                            this.preloadVisibleCovers();
                            this.coversPreloaded = true;
                        }, 100);
                    }
                });
            } else {
                // 如果还没有初始化，延迟重试
                setTimeout(setupListener, 100);
            }
        };
        setupListener();
    }

    setupCoverUpdateListener() {
        // 监听封面更新事件
        this.coverUpdateUnsubscribe = coverUpdateManager.onCoverUpdate(async (data) => {
            await this.handleCoverUpdate(data);
        });
    }

    setTracks(tracks) {
        // 检测tracks是否真正发生了变化
        const newTracksHash = this.generateTracksHash(tracks);
        const tracksChanged = this.lastTracksHash !== newTracksHash;

        this.tracks = tracks;
        this.lastTracksHash = newTracksHash;

        // 清理之前的加载状态
        this.loadingCovers.clear();

        this.render();

        // 只有在tracks真正变化或首次加载时才预加载封面
        if (this.showCovers && (tracksChanged || !this.coversPreloaded)) {
            setTimeout(() => {
                this.preloadVisibleCovers();
                this.coversPreloaded = true;
            }, 100);
        }
    }

    // 预加载可见区域的封面
    preloadVisibleCovers() {
        const tracksToPreload = this.tracks.slice(0, 12);
        tracksToPreload.forEach((track) => {
            if (!track.cover && track.filePath && !this.loadingCovers.has(track.filePath)) {
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
            if (typeof track.cover !== 'string') {
                console.error('❌ TrackList: track.cover不是字符串，返回默认封面', {
                    type: typeof track.cover,
                    value: track.cover
                });
                return 'assets/images/default-cover.svg';
            }

            return track.cover;
        }

        // 获取封面，先返回默认封面
        if (!this.loadingCovers.has(track.filePath)) {
            this.loadTrackCoverAsync(track);
        }
        return 'assets/images/default-cover.svg';
    }

    async loadTrackCoverAsync(track) {
        if (!track.filePath) return;
        if (this.loadingCovers.has(track.filePath)) return;

        this.loadingCovers.add(track.filePath);

        try {
            // 使用requestIdleCallback优化性能，在浏览器空闲时加载封面
            const loadCover = async () => {
                try {
                    const coverResult = await coverAPI.getCover(
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

                        // 更新DOM - 修复选择器问题
                        requestAnimationFrame(() => {
                            this.updateTrackCoverInDOM(track);
                        });
                    }
                } catch (error) {
                    console.warn('TrackList: 封面加载失败:', error);
                } finally {
                    // 清理加载状态
                    this.loadingCovers.delete(track.filePath);
                }
            };

            // 如果支持requestIdleCallback，使用它；否则使用setTimeout
            if (window.requestIdleCallback) {
                window.requestIdleCallback(loadCover);
            } else {
                setTimeout(loadCover, 0);
            }
        } catch (error) {
            console.warn('⚠️ TrackList: 加载封面失败:', error);
            this.loadingCovers.delete(track.filePath);
        }
    }

    // 更新DOM中的歌曲封面
    updateTrackCoverInDOM(track) {
        try {
            const trackItems = this.element.querySelectorAll('.track-item');
            trackItems.forEach((item, index) => {
                if (this.tracks[index] === track) {
                    // 查找.track-cover元素（img标签）
                    const coverImg = item.querySelector('.track-cover');
                    if (coverImg && track.cover) {
                        // 严格的类型检查
                        if (typeof track.cover !== 'string') {
                            console.error('❌ TrackList: track.cover不是字符串，无法设置为src', {
                                type: typeof track.cover,
                                value: track.cover
                            });
                            coverImg.src = 'assets/images/default-cover.svg';
                            return;
                        }

                        // 设置封面前先验证URL
                        // 特别是blob URL
                        if (track.cover.startsWith('blob:')) {
                            // 对于blob URL，添加额外的错误处理
                            coverImg.onerror = () => {
                                console.warn('⚠️ TrackList: Blob封面加载失败，使用默认封面', {
                                    blobUrl: track.cover.substring(0, 50) + '...',
                                    trackTitle: track.title
                                });
                                coverImg.src = 'assets/images/default-cover.svg';
                                // 清理失效的封面引用
                                track.cover = null;
                            };
                        } else {
                            coverImg.onerror = () => {
                                console.warn('⚠️ TrackList: 封面加载失败，使用默认封面');
                                coverImg.src = 'assets/images/default-cover.svg';
                            };
                        }

                        coverImg.src = track.cover;
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
            // 清除加载状态
            if (matchingTrack.filePath) {
                this.loadingCovers.delete(matchingTrack.filePath);
            }

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
            const coverResult = await coverAPI.getCover(track.title, track.artist, track.album, track.filePath, true);
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

export { TrackList };
