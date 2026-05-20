/**
 * 创建歌单对话框组件
 */

import {Component} from "@ui/base/Component";
import {playlistDialogActionService} from "@/features/playlists/service/PlaylistDialogActionService";
import type {Playlist, Track} from "@api/types/library";

type TrackToAdd = Track;

interface PlaylistResult {
    success: boolean;
    playlist?: Playlist;
    error?: string;
}

class CreatePlaylistDialog extends Component {
    private isVisible: boolean;
    private currentTrackToAdd: TrackToAdd | null;
    private listenersSetup: boolean;
    private overlay!: HTMLElement;
    public dialog!: HTMLElement;
    private closeBtn!: HTMLElement;
    private cancelBtn!: HTMLElement;
    private confirmBtn!: HTMLButtonElement;
    private nameInput!: HTMLInputElement;
    private descriptionInput!: HTMLInputElement;
    private errorElement!: HTMLElement;

    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentTrackToAdd = null; // 用于记录要添加到新歌单的歌曲
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    show(trackToAdd: TrackToAdd | null = null): void {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.isVisible = true;
        this.currentTrackToAdd = trackToAdd;
        this.overlay.style.display = 'flex';

        // 重置表单
        this.nameInput.value = '';
        this.descriptionInput.value = '';
        this.hideError();
        this.validateInput();

        // 聚焦到输入框
        setTimeout(() => {
            this.nameInput.focus();
        }, 100);
    }

    hide(): void {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentTrackToAdd = null;
    }

    destroy(): void {
        this.listenersSetup = false;
        super.destroy();
    }

    setupElements(): void {
        this.overlay = document.getElementById('create-playlist-dialog') as HTMLElement;
        this.dialog = this.overlay.querySelector('.modal-dialog') as HTMLElement;
        this.closeBtn = document.getElementById('create-playlist-close') as HTMLElement;
        this.cancelBtn = document.getElementById('create-playlist-cancel') as HTMLElement;
        this.confirmBtn = document.getElementById('create-playlist-confirm') as HTMLButtonElement;
        this.nameInput = document.getElementById('playlist-name-input') as HTMLInputElement;
        this.descriptionInput = document.getElementById('playlist-description-input') as HTMLInputElement;
        this.errorElement = document.getElementById('playlist-name-error') as HTMLElement;
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.createPlaylist());

        // 输入框事件
        this.addEventListenerManaged(this.nameInput, 'input', () => this.validateInput());
        this.addEventListenerManaged(this.nameInput, 'keydown', (event) => {
            const e = event as KeyboardEvent;
            if (e.key === 'Enter' && !this.confirmBtn.disabled) {
                this.createPlaylist();
            }
        });

        // 点击遮罩层关闭
        this.addEventListenerManaged(this.overlay, 'click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        this.addEventListenerManaged(document, 'keydown', (event) => {
            const e = event as KeyboardEvent;
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    validateInput(): boolean {
        const name = this.nameInput.value.trim();
        const isValid = name.length > 0 && name.length <= 50;
        this.confirmBtn.disabled = !isValid;

        if (name.length > 50) {
            this.showError('歌单名称不能超过50个字符');
        } else {
            this.hideError();
        }
        return isValid;
    }

    showError(message: string): void {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
    }

    hideError(): void {
        this.errorElement.style.display = 'none';
    }

    async createPlaylist(): Promise<void> {
        if (!this.validateInput()) {
            return;
        }

        const name = this.nameInput.value.trim();
        const description = this.descriptionInput.value.trim();

        try {
            // 显示加载状态
            this.confirmBtn.disabled = true;
            this.confirmBtn.textContent = '创建中...';
            const result = await playlistDialogActionService.createPlaylist(name, description, this.currentTrackToAdd) as PlaylistResult;
            if (result.success && result.playlist) {
                // 触发歌单创建事件
                this.emit('playlistCreated', result.playlist);
                this.hide();
                this.emit('notification', {type: 'info', message: `歌单 "${name}" 创建成功`});
            } else {
                this.showError(result.error || '创建歌单失败');
            }
        } catch (error) {
            console.error('❌ 创建歌单失败:', error);
            this.showError('创建歌单失败，请重试');
        } finally {
            this.confirmBtn.disabled = false;
            this.confirmBtn.textContent = '创建';
        }
    }
}

export { CreatePlaylistDialog };
