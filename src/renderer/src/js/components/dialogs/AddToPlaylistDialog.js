/**
 * 添加到歌单对话框组件
 */

class AddToPlaylistDialog extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentTrack = null;
        this.playlists = [];
        this.listenersSetup = false; // 事件监听器是否已设置
    }

    async show(track) {
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

    hide() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentTrack = null;
    }

    destroy() {
        this.currentTrack = null;
        this.playlists = [];
        this.listenersSetup = false;
        return super.destroy();
    }

    setupElements() {
        this.overlay = document.getElementById('add-to-playlist-dialog');
        this.dialog = this.overlay.querySelector('.modal-dialog');
        this.closeBtn = document.getElementById('add-to-playlist-close');
        this.cancelBtn = document.getElementById('add-to-playlist-cancel');
        this.playlistList = document.getElementById('playlist-selection-list');
        this.createNewBtn = document.getElementById('create-new-playlist-option');
    }

    setupEventListeners() {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        // 创建新歌单按钮
        this.addEventListenerManaged(this.createNewBtn, 'click', () => {
            this.hide();
            this.emit('createNewPlaylist', this.currentTrack);
        });

        // 点击遮罩层关闭
        this.addEventListenerManaged(this.overlay, 'click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC键关闭
        this.addEventListenerManaged(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async loadPlaylists() {
        try {
            this.playlists = await window.electronAPI.library.getPlaylists();
            this.renderPlaylistList();
        } catch (error) {
            console.error('❌ 加载歌单列表失败:', error);
            this.playlists = [];
            this.renderPlaylistList();
        }
    }

    renderPlaylistList() {
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
                const playlistId = item.dataset.playlistId;
                this.addToPlaylist(playlistId);
            });
        });
    }

    async addToPlaylist(playlistId) {
        if (!this.currentTrack) {
            return;
        }

        try {
            const result = await window.electronAPI.library.addToPlaylist(
                playlistId,
                this.currentTrack.fileId
            );
            if (result.success) {
                const playlist = this.playlists.find(p => p.id === playlistId);
                console.log('✅ 歌曲已添加到歌单:', playlist?.name);
                if (window.app && window.app.showInfo) {
                    window.app.showInfo(`已添加到歌单 "${playlist?.name || '未知'}"`);
                }

                // 触发添加成功事件
                this.emit('trackAdded', {playlist, track: this.currentTrack});
                this.hide();
            } else {
                console.error('❌ 添加到歌单失败:', result.error);
                if (window.app && window.app.showError) {
                    window.app.showError(result.error || '添加到歌单失败');
                }
            }
        } catch (error) {
            console.error('❌ 添加到歌单失败:', error);
            if (window.app && window.app.showError) {
                window.app.showError('添加到歌单失败，请重试');
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.components.dialogs.AddToPlaylistDialog = AddToPlaylistDialog;
