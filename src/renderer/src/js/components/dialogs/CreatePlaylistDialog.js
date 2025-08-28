/**
 * 创建歌单对话框组件
 */

class CreatePlaylistDialog extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentTrackToAdd = null; // 用于记录要添加到新歌单的歌曲
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    show(trackToAdd = null) {
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

    hide() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentTrackToAdd = null;
    }

    destroy() {
        this.listenersSetup = false;
        return super.destroy();
    }

    setupElements() {
        this.overlay = document.getElementById('create-playlist-dialog');
        this.dialog = this.overlay.querySelector('.modal-dialog');
        this.closeBtn = document.getElementById('create-playlist-close');
        this.cancelBtn = document.getElementById('create-playlist-cancel');
        this.confirmBtn = document.getElementById('create-playlist-confirm');
        this.nameInput = document.getElementById('playlist-name-input');
        this.descriptionInput = document.getElementById('playlist-description-input');
        this.errorElement = document.getElementById('playlist-name-error');
    }

    setupEventListeners() {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.createPlaylist());

        // 输入框事件
        this.addEventListenerManaged(this.nameInput, 'input', () => this.validateInput());
        this.addEventListenerManaged(this.nameInput, 'keydown', (e) => {
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

        this.addEventListenerManaged(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    validateInput() {
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

    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
    }

    hideError() {
        this.errorElement.style.display = 'none';
    }

    async createPlaylist() {
        if (!this.validateInput()) {
            return;
        }

        const name = this.nameInput.value.trim();
        const description = this.descriptionInput.value.trim();

        try {
            // 显示加载状态
            this.confirmBtn.disabled = true;
            this.confirmBtn.textContent = '创建中...';
            const result = await window.electronAPI.library.createPlaylist(name, description);
            if (result.success) {
                console.log('✅ 歌单创建成功:', result.playlist);

                // 如果有要添加的歌曲，立即添加
                if (this.currentTrackToAdd) {
                    try {
                        await window.electronAPI.library.addToPlaylist(
                            result.playlist.id,
                            this.currentTrackToAdd.fileId
                        );
                        console.log('✅ 歌曲已添加到新歌单');
                    } catch (error) {
                        console.warn('⚠️ 添加歌曲到新歌单失败:', error);
                    }
                }

                // 触发歌单创建事件
                this.emit('playlistCreated', result.playlist);
                this.hide();
                if (window.app && window.app.showInfo) {
                    window.app.showInfo(`歌单 "${name}" 创建成功`);
                }
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

window.components.dialogs.CreatePlaylistDialog = CreatePlaylistDialog;
