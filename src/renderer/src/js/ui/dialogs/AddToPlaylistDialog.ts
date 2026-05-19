/**
 * 添加到歌单对话框组件
 */

import {Component} from "@ui/base/Component";
import {playlistDialogActionService} from "@js/features/playlists";
import type {Playlist, Track} from "@api/types/library";

class AddToPlaylistDialog extends Component {
    private isVisible: boolean;
    private currentTrack: Track | null;
    private playlists: Array<Playlist & {trackIds?: string[]}>;
    private listenersSetup: boolean;
    private overlay!: HTMLElement;
    private closeBtn!: HTMLElement;
    private cancelBtn!: HTMLElement;
    private playlistList!: HTMLElement;
    private createNewBtn!: HTMLElement;

    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentTrack = null;
        this.playlists = [];
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    async show(track: Track): Promise<void> {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.isVisible = true;
        this.currentTrack = track;
        this.overlay.style.display = 'flex';

        // 加载歌单列表
        await this.loadPlaylists();
    }

    hide(): void {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentTrack = null;
    }

    destroy(): void {
        this.currentTrack = null;
        this.playlists = [];
        this.listenersSetup = false;
        super.destroy();
    }

    setupElements(): void {
        this.overlay = document.getElementById('add-to-playlist-dialog') as HTMLElement;
        this.closeBtn = document.getElementById('add-to-playlist-close') as HTMLElement;
        this.cancelBtn = document.getElementById('add-to-playlist-cancel') as HTMLElement;
        this.playlistList = document.getElementById('playlist-selection-list') as HTMLElement;
        this.createNewBtn = document.getElementById('create-new-playlist-option') as HTMLElement;
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        // 创建新歌单按钮
        this.addEventListenerManaged(this.createNewBtn, 'click', () => {
            this.hide();
            this.emit('createNewPlaylist', this.currentTrack);
        });

        // 点击遮罩层关闭
        this.addEventListenerManaged(this.overlay, 'click', (e: Event) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC键关闭
        this.addEventListenerManaged(document, 'keydown', (e: Event) => {
            const event = e as KeyboardEvent;
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async loadPlaylists(): Promise<void> {
        try {
            this.playlists = await playlistDialogActionService.getPlaylists();
            this.renderPlaylistList();
        } catch (error) {
            console.error('❌ 加载歌单列表失败:', error);
            this.playlists = [];
            this.renderPlaylistList();
        }
    }

    renderPlaylistList(): void {
        if (this.playlists.length === 0) {
            this.playlistList.innerHTML = `
                <div class="empty-state">
                    <p>暂无歌单，请先创建一个歌单</p>
                </div>
            `;
            return;
        }

        this.playlistList.innerHTML = this.playlists.map(playlist => `
            <div class="playlist-item" data-playlist-id="${playlist.id}">
                <svg class="playlist-icon" viewBox="0 0 24 24">
                    <path d="M13,2V8H21V2M13,9V15H21V9M13,16V22H21V16M3,2V8H11V2M3,9V15H11V9M3,16V22H11V16Z"/>
                </svg>
                <div class="playlist-info">
                    <div class="playlist-name">${this.escapeHtml(playlist.name)}</div>
                    <div class="playlist-count">${playlist.trackIds ? playlist.trackIds.length : 0} 首歌曲</div>
                </div>
            </div>
        `).join('');

        // 添加点击事件
        this.playlistList.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                const playlistId = (item as HTMLElement).dataset.playlistId;
                if (playlistId) {
                    this.addToPlaylist(playlistId);
                }
            });
        });
    }

    async addToPlaylist(playlistId: string): Promise<void> {
        if (!this.currentTrack?.fileId) {
            this.emit('notification', {type: 'error', message: '当前歌曲缺少文件标识，无法添加到歌单'});
            return;
        }

        try {
            const result = await playlistDialogActionService.addTrackToPlaylist(playlistId, this.currentTrack, this.playlists);
            if (result.success) {
                const playlist = result.playlist;
                this.emit('notification', {type: 'info', message: `已添加到歌单 "${playlist?.name || '未知'}"`});

                // 触发添加成功事件
                this.emit('trackAdded', {playlist, track: this.currentTrack});
                this.hide();
            } else {
                console.error('❌ 添加到歌单失败:', result.error);
                this.emit('notification', {type: 'error', message: result.error || '添加到歌单失败'});
            }
        } catch (error) {
            console.error('❌ 添加到歌单失败:', error);
            this.emit('notification', {type: 'error', message: '添加到歌单失败，请重试'});
        }
    }

    escapeHtml(text: string = ''): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { AddToPlaylistDialog };
