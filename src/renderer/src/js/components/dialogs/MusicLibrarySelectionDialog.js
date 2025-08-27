/**
 * 音乐库选择对话框组件
 */

class MusicLibrarySelectionDialog extends Component {
    constructor() {
        super(null, false);
        this.isVisible = false;
        this.currentPlaylist = null;
        this.allTracks = [];
        this.filteredTracks = [];
        this.selectedTracks = new Set();
        this.listenersSetup = false; // 事件监听器是否已设置
        this.setupElements();
    }

    setupElements() {
        this.overlay = document.getElementById('music-library-selection-dialog');
        this.dialog = this.overlay.querySelector('.modal-dialog');
        this.closeBtn = document.getElementById('music-library-close');
        this.cancelBtn = document.getElementById('music-library-cancel');
        this.confirmBtn = document.getElementById('music-library-confirm');
        this.searchInput = document.getElementById('library-search-input');
        this.selectAllBtn = document.getElementById('select-all-tracks');
        this.clearSelectionBtn = document.getElementById('clear-selection');
        this.selectedCountElement = document.getElementById('selected-count');
        this.trackListContainer = document.getElementById('library-track-list');
    }

    setupEventListeners() {
        this.addEventListenerManaged(this.closeBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.cancelBtn, 'click', () => this.hide());
        this.addEventListenerManaged(this.confirmBtn, 'click', () => this.addSelectedTracks());
        this.addEventListenerManaged(this.searchInput, 'input', () => this.handleSearch());

        // 全选和清除选择按钮
        this.addEventListenerManaged(this.selectAllBtn, 'click', () => this.selectAllTracks());
        this.addEventListenerManaged(this.clearSelectionBtn, 'click', () => this.clearSelection());

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

    async show(playlist) {
        if (!this.listenersSetup) {
            this.setupEventListeners();
            this.listenersSetup = true;
        }
        this.isVisible = true;
        this.currentPlaylist = playlist;
        this.overlay.style.display = 'flex';

        // 重置状态
        this.selectedTracks.clear();
        this.searchInput.value = '';
        this.updateSelectedCount();
        await this.loadMusicLibrary();
    }

    hide() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        this.currentPlaylist = null;
        this.selectedTracks.clear();
    }

    destroy() {
        this.listenersSetup = false;
        return super.destroy();
    }

    async loadMusicLibrary() {
        try {
            // 显示加载状态
            this.trackListContainer.innerHTML = `
                <div class="library-empty-state">
                    <div class="loading-spinner"></div>
                    <h3>加载音乐库...</h3>
                </div>
            `;

            // 获取所有音乐
            const tracks = await window.electronAPI.library.getTracks();
            this.allTracks = tracks || [];

            // 过滤掉已在歌单中的歌曲
            if (this.currentPlaylist && this.currentPlaylist.trackIds) {
                this.allTracks = this.allTracks.filter(track =>
                    !this.currentPlaylist.trackIds.includes(track.fileId)
                );
            }

            this.filteredTracks = [...this.allTracks];
            this.renderTrackList();

        } catch (error) {
            console.error('❌ 加载音乐库失败:', error);
            this.trackListContainer.innerHTML = `
                <div class="library-empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24">
                        <path d="M12,2C13.1,2 14,2.9 14,4C14,5.1 13.1,6 12,6C10.9,6 10,5.1 10,4C10,2.9 10.9,2 12,2M21,9V7L15,1H5C3.89,1 3,1.89 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,9H14V4H5V21H19V9Z"/>
                    </svg>
                    <h3>加载失败</h3>
                    <p>无法加载音乐库，请重试</p>
                </div>
            `;
        }
    }

    renderTrackList() {
        if (this.filteredTracks.length === 0) {
            this.trackListContainer.innerHTML = `
                <div class="library-empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24">
                        <path d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8.01,12 6,14.01 6,16.5S8.01,21 10.5,21S15,18.99 15,16.5V6H19V3H12Z"/>
                    </svg>
                    <h3>没有可添加的歌曲</h3>
                    <p>所有歌曲都已在歌单中，或音乐库为空</p>
                </div>
            `;
            return;
        }

        this.trackListContainer.innerHTML = this.filteredTracks.map((track, index) => `
            <div class="library-track-item" data-track-index="${index}">
                <input type="checkbox" class="track-checkbox" data-track-id="${track.fileId}">
                <div class="track-info">
                    <div class="track-title">${this.escapeHtml(track.title || track.fileName)}</div>
                    <div class="track-meta">${this.escapeHtml(track.artist || '未知艺术家')} • ${this.escapeHtml(track.album || '未知专辑')}</div>
                </div>
                <div class="track-duration">${this.formatDuration(track.duration)}</div>
            </div>
        `).join('');

        this.setupTrackListEvents();
    }

    setupTrackListEvents() {
        // 为每个歌曲项添加事件监听
        this.trackListContainer.querySelectorAll('.library-track-item').forEach(item => {
            const checkbox = item.querySelector('.track-checkbox');
            const trackId = checkbox.dataset.trackId;

            // 点击整行切换选择状态
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    checkbox.checked = !checkbox.checked;
                }
                this.handleTrackSelection(trackId, checkbox.checked);
            });

            // 复选框变化事件
            checkbox.addEventListener('change', (e) => {
                this.handleTrackSelection(trackId, e.target.checked);
            });
        });
    }

    handleTrackSelection(trackId, isSelected) {
        if (isSelected) {
            this.selectedTracks.add(trackId);
        } else {
            this.selectedTracks.delete(trackId);
        }

        this.updateSelectedCount();
        this.updateTrackItemStyles();
    }

    updateTrackItemStyles() {
        this.trackListContainer.querySelectorAll('.library-track-item').forEach(item => {
            const checkbox = item.querySelector('.track-checkbox');
            const trackId = checkbox.dataset.trackId;

            if (this.selectedTracks.has(trackId)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    updateSelectedCount() {
        const count = this.selectedTracks.size;
        this.selectedCountElement.textContent = count;
        this.confirmBtn.disabled = count === 0;

        if (count === 0) {
            this.confirmBtn.textContent = '添加选中歌曲';
        } else {
            this.confirmBtn.textContent = `添加 ${count} 首歌曲`;
        }
    }

    handleSearch() {
        const query = this.searchInput.value.trim().toLowerCase();

        if (query === '') {
            this.filteredTracks = [...this.allTracks];
        } else {
            this.filteredTracks = this.allTracks.filter(track => {
                const title = (track.title || track.fileName || '').toLowerCase();
                const artist = (track.artist || '').toLowerCase();
                const album = (track.album || '').toLowerCase();

                return title.includes(query) ||
                    artist.includes(query) ||
                    album.includes(query);
            });
        }

        // 清除当前选择状态（因为索引会变化）
        this.selectedTracks.clear();
        this.updateSelectedCount();

        this.renderTrackList();
    }

    selectAllTracks() {
        this.selectedTracks.clear();
        this.filteredTracks.forEach(track => {
            this.selectedTracks.add(track.fileId);
        });

        // 更新UI
        this.trackListContainer.querySelectorAll('.track-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });

        this.updateSelectedCount();
        this.updateTrackItemStyles();
    }

    clearSelection() {
        this.selectedTracks.clear();

        // 更新UI
        this.trackListContainer.querySelectorAll('.track-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        this.updateSelectedCount();
        this.updateTrackItemStyles();
    }

    async addSelectedTracks() {
        if (this.selectedTracks.size === 0 || !this.currentPlaylist) {
            return;
        }

        try {
            // 显示加载状态
            this.confirmBtn.disabled = true;
            this.confirmBtn.textContent = '添加中...';

            const selectedTrackIds = Array.from(this.selectedTracks);
            let successCount = 0;
            let failCount = 0;

            // 批量添加歌曲
            for (const trackId of selectedTrackIds) {
                try {
                    const result = await window.electronAPI.library.addToPlaylist(
                        this.currentPlaylist.id,
                        trackId
                    );

                    if (result.success) {
                        successCount++;
                    } else {
                        failCount++;
                        console.warn('❌ 添加歌曲失败:', trackId, result.error);
                    }
                } catch (error) {
                    failCount++;
                    console.error('❌ 添加歌曲异常:', trackId, error);
                }
            }

            console.log(`✅ 批量添加歌曲完成: 成功 ${successCount}, 失败 ${failCount}`);

            // 触发歌单更新事件
            this.emit('tracksAdded', {
                playlist: this.currentPlaylist,
                addedCount: successCount,
                failedCount: failCount
            });
            this.hide();

            if (window.app && window.app.showInfo) {
                if (failCount === 0) {
                    window.app.showInfo(`成功添加 ${successCount} 首歌曲到歌单`);
                } else {
                    window.app.showInfo(`添加完成：成功 ${successCount} 首，失败 ${failCount} 首`);
                }
            }
        } catch (error) {
            console.error('❌ 批量添加歌曲失败:', error);
            if (window.app && window.app.showError) {
                window.app.showError('添加歌曲失败，请重试');
            }
        } finally {
            // 恢复按钮状态
            this.confirmBtn.disabled = false;
            this.updateSelectedCount();
        }
    }

    formatDuration(duration) {
        if (!duration || duration <= 0) return '--:--';

        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.components.dialogs.MusicLibrarySelectionDialog = MusicLibrarySelectionDialog;
