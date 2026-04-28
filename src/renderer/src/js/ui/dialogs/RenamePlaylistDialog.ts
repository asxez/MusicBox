/**
 * 重命名歌单对话框组件
 */

import {Component} from "@components/base/Component";
import {libraryAPI} from "@js/api";

interface PlaylistLike {
    id: string;
    name: string;
}

interface RenamePlaylistResult {
    success: boolean;
    playlist?: PlaylistLike;
    error?: string;
}

class RenamePlaylistDialog extends Component {
    private isVisible: boolean;
    private currentPlaylist: PlaylistLike | null;
    private listenersSetup: boolean;
    private overlay!: HTMLElement;
    public dialog!: HTMLElement;
    private closeBtn!: HTMLElement;
    private cancelBtn!: HTMLElement;
    private confirmBtn!: HTMLButtonElement;
    private nameInput!: HTMLInputElement;
    private errorElement!: HTMLElement;

    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentPlaylist = null;
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    show(playlist: PlaylistLike): void {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.isVisible = true;
        this.currentPlaylist = playlist;
        this.overlay.style.display = 'flex';
        this.nameInput.value = playlist.name;
        this.hideError();
        this.validateInput();

        // 聚焦到输入框并选中文本
        setTimeout(() => {
            this.nameInput.focus();
            this.nameInput.select();
        }, 100);
    }

    hide(): void {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentPlaylist = null;
    }

    destroy(): void {
        this.currentPlaylist = null;
        this.listenersSetup = false;
        super.destroy();
    }

    setupElements(): void {
        this.overlay = document.getElementById('rename-playlist-dialog') as HTMLElement;
        this.dialog = this.overlay.querySelector('.modal-dialog') as HTMLElement;
        this.closeBtn = document.getElementById('rename-playlist-close') as HTMLElement;
        this.cancelBtn = document.getElementById('rename-playlist-cancel') as HTMLElement;
        this.confirmBtn = document.getElementById('rename-playlist-confirm') as HTMLButtonElement;
        this.nameInput = document.getElementById('rename-playlist-input') as HTMLInputElement;
        this.errorElement = document.getElementById('rename-playlist-error') as HTMLElement;
    }

    setupEventListeners(): void {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.renamePlaylist());
        this.addEventListenerManaged(this.nameInput, 'input', () => this.validateInput());
        this.addEventListenerManaged(this.nameInput, 'keydown', (event) => {
            const e = event as KeyboardEvent;
            if (e.key === 'Enter' && !this.confirmBtn.disabled) {
                this.renamePlaylist();
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
        const isValid = name.length > 0 && name.length <= 50 && name !== this.currentPlaylist?.name;
        this.confirmBtn.disabled = !isValid;

        if (name.length === 0) {
            this.showError('歌单名称不能为空');
        } else if (name.length > 50) {
            this.showError('歌单名称不能超过50个字符');
        } else if (name === this.currentPlaylist?.name) {
            this.showError('新名称与当前名称相同');
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

    async renamePlaylist(): Promise<void> {
        if (!this.validateInput() || !this.currentPlaylist) {
            return;
        }

        const newName = this.nameInput.value.trim();

        try {
            this.confirmBtn.disabled = true;
            this.confirmBtn.textContent = '重命名中...';
            const result = await libraryAPI.renamePlaylist(this.currentPlaylist.id, newName) as RenamePlaylistResult;

            if (result.success) {
                // 触发重命名成功事件
                this.emit('playlistRenamed', result.playlist);
                this.hide();

                this.emit('notification', {type: 'info', message: `歌单已重命名为 "${newName}"`});
            } else {
                this.showError('重命名失败');
                console.error(result);
            }
        } catch (error) {
            this.showError('重命名失败，请重试');
            console.error(error);
        } finally {
            this.confirmBtn.disabled = false;
            this.confirmBtn.textContent = '重命名';
        }
    }
}

export { RenamePlaylistDialog };
