/**
 * 重命名歌单对话框组件
 */

class RenamePlaylistDialog extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentPlaylist = null;

        this.setupElements();
    }

    setupElements() {
        this.overlay = document.getElementById('rename-playlist-dialog');
        this.dialog = this.overlay.querySelector('.modal-dialog');
        this.closeBtn = document.getElementById('rename-playlist-close');
        this.cancelBtn = document.getElementById('rename-playlist-cancel');
        this.confirmBtn = document.getElementById('rename-playlist-confirm');
        this.nameInput = document.getElementById('rename-playlist-input');
        this.errorElement = document.getElementById('rename-playlist-error');
    }

    setupEventListeners() {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.renamePlaylist());
        this.addEventListenerManaged(this.nameInput, 'input', () => this.validateInput());
        this.addEventListenerManaged(this.nameInput, 'keydown', (e) => {
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

        this.addEventListenerManaged(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show(playlist) {
        if (!this.listenersSetup) {
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

    hide() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentPlaylist = null;
    }

    destroy() {
        this.listenersSetup = false;
        return super.destroy();
    }

    validateInput() {
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

    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
    }

    hideError() {
        this.errorElement.style.display = 'none';
    }

    async renamePlaylist() {
        if (!this.validateInput() || !this.currentPlaylist) {
            return;
        }

        const newName = this.nameInput.value.trim();

        try {
            this.confirmBtn.disabled = true;
            this.confirmBtn.textContent = '重命名中...';
            const result = await window.electronAPI.library.renamePlaylist(this.currentPlaylist.id, newName);

            if (result.success) {
                // 触发重命名成功事件
                this.emit('playlistRenamed', result.playlist);
                this.hide();

                if (window.app && window.app.showInfo) {
                    window.app.showInfo(`歌单已重命名为 "${newName}"`);
                }
            } else {
                this.showError(result.error || '重命名失败');
            }
        } catch (error) {
            this.showError('重命名失败，请重试');
        } finally {
            this.confirmBtn.disabled = false;
            this.confirmBtn.textContent = '重命名';
        }
    }
}

window.components.dialogs.RenamePlaylistDialog = RenamePlaylistDialog;
