/**
 * 播放列表组件
 */

import {formatTime} from "@utils/index.js";
import {Component} from "@components/base/Component";
import type {Track} from "@api/types/track";

interface PlaylistTrackEventPayload {
    track: Track;
    index: number;
}

interface PlaylistTrackRemovedPayload extends PlaylistTrackEventPayload {
    wasCurrentTrack: boolean;
}

class Playlist extends Component {
    isVisible: boolean;
    tracks: Track[];
    currentTrackIndex: number;
    listenersSetup: boolean;
    panel!: HTMLElement;
    closeBtn!: HTMLElement;
    clearBtn!: HTMLElement;
    countEl!: HTMLElement;
    tracksContainer!: HTMLElement;

    constructor(element: HTMLElement | null) {
        super(element);
        this.element = element;
        this.isVisible = false;
        this.tracks = [];
        this.currentTrackIndex = -1;
        this.listenersSetup = false; // 事件监听器是否已设置

        this.setupElements();
    }

    show(): void {
        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.isVisible = true;
        this.panel.style.display = 'flex';
        this.panel.classList.add('show');

        // 自动滚动到当前播放的歌曲
        this.scrollToCurrentTrack();
    }

    hide(): void {
        this.isVisible = false;
        this.panel.classList.remove('show');
        setTimeout(() => {
            if (!this.isVisible) {
                this.panel.style.display = 'none';
            }
        }, 300);
    }

    destroy(): void {
        // 清理播放列表数据
        this.tracks = [];
        this.listenersSetup = false;

        // 清理DOM内容
        if (this.tracksContainer) {
            this.tracksContainer.innerHTML = '';
        }

        super.destroy();
    }

    setupElements(): void {
        const element = this.element as HTMLElement;
        this.panel = element;
        this.closeBtn = element.querySelector('#playlist-close') as HTMLElement;
        this.clearBtn = element.querySelector('#playlist-clear') as HTMLElement;
        this.countEl = element.querySelector('#playlist-count') as HTMLElement;
        this.tracksContainer = element.querySelector('#playlist-tracks') as HTMLElement;
    }

    setupEventListeners(): void {
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement | null;
            if (this.isVisible && target && !this.panel.contains(target) && !target.closest('#playlist-btn')) {
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

    toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    addTrack(track: Track, shouldRender = true): number {
        this.tracks.push(track);
        if (shouldRender) {
            this.render();
        }
        console.log('🎵 Playlist: 添加歌曲到播放列表:', track.title);
        return this.tracks.length - 1; // 返回新添加歌曲的索引
    }

    removeTrack(index: number): void {
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
            const payload: PlaylistTrackRemovedPayload = {track, index, wasCurrentTrack};
            this.emit('trackRemoved', payload);
            console.log('🎵 Playlist: 从播放列表移除歌曲:', track.title, '是否为当前播放:', wasCurrentTrack);
        }
    }

    clear(): void {
        this.tracks = [];
        this.currentTrackIndex = -1;
        this.render();
        this.emit('playlistCleared');
    }

    setTracks(tracks: Track[], currentIndex = -1): void {
        this.tracks = [...tracks];
        this.currentTrackIndex = currentIndex;
        this.render();
        console.log('🎵 Playlist: 设置播放列表:', tracks.length, '首歌曲');
    }

    setCurrentTrack(index: number): void {
        this.currentTrackIndex = index;
        this.render();

        // 如果播放列表可见，滚动到当前歌曲
        if (this.isVisible) {
            this.scrollToCurrentTrack();
        }
    }

    scrollToCurrentTrack(): void {
        if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length) {
            setTimeout(() => {
                const currentTrackEl = this.tracksContainer.querySelector<HTMLElement>(`[data-index="${this.currentTrackIndex}"]`);
                if (currentTrackEl) {
                    currentTrackEl.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100); // 等待渲染完成
        }
    }

    render(): void {
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
        this.tracksContainer.querySelectorAll<HTMLElement>('.playlist-track').forEach(trackEl => {
            trackEl.addEventListener('click', (e) => {
                const target = e.target as HTMLElement | null;
                if (!target?.closest('.playlist-track-remove')) {
                    const index = Number.parseInt(trackEl.dataset.index || '-1', 10);
                    const payload = this.createTrackPayload(index);
                    if (payload) {
                        this.emit('trackSelected', payload);
                    }
                }
            });

            // Add double-click event for playing
            trackEl.addEventListener('dblclick', (e) => {
                const target = e.target as HTMLElement | null;
                if (!target?.closest('.playlist-track-remove')) {
                    const index = Number.parseInt(trackEl.dataset.index || '-1', 10);
                    const payload = this.createTrackPayload(index);
                    if (payload) {
                        this.emit('trackPlayed', payload);
                    }
                }
            });
        });

        // Add event listeners to remove buttons
        this.tracksContainer.querySelectorAll<HTMLElement>('.playlist-track-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = Number.parseInt(removeBtn.dataset.index || '-1', 10);
                this.removeTrack(index);
            });
        });
    }

    createTrackPayload(index: number): PlaylistTrackEventPayload | null {
        const track = this.tracks[index];
        if (!track) {
            return null;
        }
        return {track, index};
    }
}

export { Playlist };
