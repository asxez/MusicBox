/**
 * 我的音乐页组件
 */

import {formatTime, sanitizeHTML} from "@utils/index.js";
import {coverUpdateManager} from "@js/features/mediaAssets/service";
import type {CoverUpdateData} from "@js/features/mediaAssets/service";
import {trackCoverDisplayPreferenceService} from "@js/features/settings/service";
import {Component} from "@ui/base/Component";
import {mediaController} from "@js/features/media";
import type {Unsubscribe} from "@api/types/common";
import type {Track} from "@api/types/track";

type ExtendedCoverUpdateData = CoverUpdateData & {
    type?: 'cover-updated' | 'manual-refresh';
};

class TrackList extends Component {
    tracks: Track[];
    selectedTracks: Set<number>;
    lastSelectedIndex: number;
    showCovers: boolean;
    loadingCovers: Set<string>;
    lastTracksHash: string | null;
    coverObserver: IntersectionObserver | null;
    coverUpdateUnsubscribe: (() => void) | null = null;
    coverDisplayPreferenceUnsubscribe: Unsubscribe | null = null;
    filteredTracks: Track[] = [];
    currentTrackIndex = -1;

    constructor(container: string | Element | null) {
        super(container);
        this.tracks = [];
        this.selectedTracks = new Set();
        this.lastSelectedIndex = -1;
        this.showCovers = this.getShowCoversSettings();
        this.loadingCovers = new Set();
        this.lastTracksHash = null;
        this.coverObserver = null;
        this.setupIntersectionObserver();
        this.setupSettingsListener();
        this.setupCoverUpdateListener();
    }

    setupIntersectionObserver(): void {
        this.coverObserver = new IntersectionObserver(async (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    const filePath = img.dataset.filePath;
                    if (filePath && !this.loadingCovers.has(filePath)) {
                        const track = this.tracks.find(t => t.filePath === filePath);
                        if (track && !track.cover) {
                            await this.loadTrackCoverAsync(track);
                        }
                    }
                    this.coverObserver?.unobserve(img);
                }
            }
        }, {
            root: null,
            rootMargin: '200px',
            threshold: 0.01
        });
    }

    show(): void {
        if (this.element) {
            (this.element as HTMLElement).style.display = 'block';
        }
        if (!this.coverObserver) {
            this.setupIntersectionObserver();
        }
    }

    hide(): void {
        if (this.element) {
            (this.element as HTMLElement).style.display = 'none';
        }
        if (this.coverObserver) {
            this.coverObserver.disconnect();
            this.coverObserver = null;
        }
    }

    destroy(): void {
        if (this.coverObserver) {
            this.coverObserver.disconnect();
            this.coverObserver = null;
        }
        if (this.coverUpdateUnsubscribe) {
            this.coverUpdateUnsubscribe();
            this.coverUpdateUnsubscribe = null;
        }
        if (this.coverDisplayPreferenceUnsubscribe) {
            this.coverDisplayPreferenceUnsubscribe();
            this.coverDisplayPreferenceUnsubscribe = null;
        }
        this.tracks = [];
        this.filteredTracks = [];
        this.currentTrackIndex = -1;
        this.loadingCovers.clear();
        super.destroy();
    }

    getShowCoversSettings(): boolean {
        return trackCoverDisplayPreferenceService.isEnabled();
    }

    // 生成tracks的简单哈希值
    generateTracksHash(tracks: Track[]): string {
        if (!tracks || tracks.length === 0) return 'empty';
        // 使用tracks数量和前几个文件路径生成简单哈希
        const sample = tracks.slice(0, 3).map(t => t.filePath || t.title).join('|');
        return `${tracks.length}_${sample}`;
    }

    setupSettingsListener(): void {
        this.coverDisplayPreferenceUnsubscribe = trackCoverDisplayPreferenceService.onChanged((enabled) => {
            this.showCovers = enabled;
            this.render();
        });
    }

    setupCoverUpdateListener(): void {
        // 监听封面更新事件
        this.coverUpdateUnsubscribe = coverUpdateManager.onCoverUpdate(async (data) => {
            await this.handleCoverUpdate(data as ExtendedCoverUpdateData);
        });
    }

    setTracks(tracks: Track[]): void {
        const newTracksHash = this.generateTracksHash(tracks);
        this.tracks = tracks;
        this.lastTracksHash = newTracksHash;
        this.selectedTracks.clear();
        this.lastSelectedIndex = -1;
        this.loadingCovers.clear();
        this.render();
    }

    render(): void {
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

    createTrackItem(track: Track, index: number): HTMLElement {
        const item = document.createElement('div');
        item.className = this.showCovers ? 'track-item with-cover' : 'track-item';
        item.dataset.index = String(index);

        if (this.showCovers) {
            const coverSrc = track.cover || 'assets/images/default-cover.svg';
            item.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-cover-container">
                    <img class="track-cover" src="${coverSrc}" alt="封面" data-file-path="${track.filePath || ''}" loading="lazy" onerror="this.src='assets/images/default-cover.svg'">
                </div>
                <div class="track-info">
                    <div class="track-title">${sanitizeHTML(track.title || 'Unknown Title')}</div>
                    <div class="track-artist">${sanitizeHTML(track.artist || 'Unknown Artist')}</div>
                </div>
                <div class="track-album">${sanitizeHTML(track.album || 'Unknown Album')}</div>
                <div class="track-duration">${formatTime(track.duration || 0)}</div>
            `;

            if (!track.cover && this.coverObserver) {
                const img = item.querySelector<HTMLImageElement>('.track-cover');
                if (img) this.coverObserver.observe(img);
            }
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

        item.addEventListener('click', (e: MouseEvent) => {
            if (e.ctrlKey || e.metaKey) {
                this.toggleTrackSelection(index);
            } else if (e.shiftKey && this.selectedTracks.size > 0) {
                this.selectTrackRange(index);
            } else {
                this.selectTrack(index);
            }
        });

        item.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            // 右键点击的条目若不在选中集合中，则先选中它
            if (!this.selectedTracks.has(index)) {
                this.selectTrack(index);
            }
            this.emit('trackRightClick', track, index, e.clientX, e.clientY, this.selectedTracks);
        });

        return item;
    }

    async loadTrackCoverAsync(track: Track): Promise<void> {
        if (!track.filePath) return;
        if (this.loadingCovers.has(track.filePath)) return;

        this.loadingCovers.add(track.filePath);

        try {
            // 使用requestIdleCallback优化性能，在浏览器空闲时加载封面
            const loadCover = async (): Promise<void> => {
                try {
                    const coverResult = await mediaController.getCover(
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
    updateTrackCoverInDOM(track: Track): void {
        try {
            if (!this.element) {
                return;
            }

            const trackItems = this.element.querySelectorAll<HTMLElement>('.track-item');
            trackItems.forEach((item, index) => {
                if (this.tracks[index] === track) {
                    // 查找.track-cover元素（img标签）
                    const coverImg = item.querySelector<HTMLImageElement>('.track-cover');
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
                        const coverUrl = track.cover;
                        if (coverUrl.startsWith('blob:')) {
                            // 对于blob URL，添加额外的错误处理
                            coverImg.onerror = () => {
                                console.warn('⚠️ TrackList: Blob封面加载失败，使用默认封面', {
                                    blobUrl: coverUrl.substring(0, 50) + '...',
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

                        coverImg.src = coverUrl;
                    }
                }
            });
        } catch (error) {
            console.error('❌ TrackList: 更新DOM封面失败', error);
        }
    }

    async playTrack(track: Track, index: number): Promise<void> {
        try {
            console.log(`🎵 双击播放: ${track.title || track.filePath}`);

            // 触发trackPlayed事件，让App.js处理播放逻辑
            // 可以确保播放列表正确设置，避免重复的播放操作
            this.emit('trackPlayed', track, index);
        } catch (error) {
            console.error('❌ 双击播放错误:', error);
        }
    }

    selectTrack(index: number): void {
        this.selectedTracks.clear();
        this.selectedTracks.add(index);
        this.lastSelectedIndex = index;
        this.updateSelection();
    }

    toggleTrackSelection(index: number): void {
        if (this.selectedTracks.has(index)) {
            this.selectedTracks.delete(index);
        } else {
            this.selectedTracks.add(index);
        }
        this.lastSelectedIndex = index;
        this.updateSelection();
    }

    selectTrackRange(endIndex: number): void {
        const startIndex = this.lastSelectedIndex >= 0 ? this.lastSelectedIndex : endIndex;
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);
        for (let i = min; i <= max; i++) {
            this.selectedTracks.add(i);
        }
        this.updateSelection();
    }

    updateSelection(): void {
        if (!this.element) {
            return;
        }

        const items = this.element.querySelectorAll<HTMLElement>('.track-item');
        items.forEach((item, index) => {
            if (this.selectedTracks.has(index)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // 处理封面更新事件
    async handleCoverUpdate(data: ExtendedCoverUpdateData): Promise<void> {
        const {filePath, title, artist, type} = data;

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

    async refreshTrackCoverInDOM(track: Track): Promise<void> {
        try {
            // 强制重新获取封面
            const coverResult = await mediaController.getCover(track.title, track.artist, track.album, track.filePath, true);
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

export {TrackList};
