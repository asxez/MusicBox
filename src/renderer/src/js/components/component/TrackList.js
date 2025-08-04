/**
 * 我的音乐页组件
 */

class TrackList extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.selectedTracks = new Set();
    }

    setTracks(tracks) {
        this.tracks = tracks;
        this.render();
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
        item.className = 'track-item';
        item.dataset.index = index;

        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info">
                <div class="track-title">${sanitizeHTML(track.title || 'Unknown Title')}</div>
                <div class="track-artist">${sanitizeHTML(track.artist || 'Unknown Artist')}</div>
            </div>
            <div class="track-album">${sanitizeHTML(track.album || 'Unknown Album')}</div>
            <div class="track-duration">${formatTime(track.duration || 0)}</div>
        `;

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

    async playTrack(track, index) {
        try {
            console.log(`🎵 双击播放: ${track.title || track.filePath}`);

            // 加载并播放音频文件
            const loadResult = await api.loadTrack(track.filePath);
            if (loadResult) {
                // 自动开始播放
                const playResult = await api.play();
                if (playResult) {
                    console.log('✅ 双击播放成功');
                } else {
                    console.log('❌ 双击播放失败');
                }
            } else {
                console.log('❌ 双击加载文件失败');
            }

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
}
