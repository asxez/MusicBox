/**
 * 简单的歌词插件，采用模拟歌词
 */

class LyricsDisplayPlugin extends PluginBase {
    constructor(context) {
        super(context);
        this.lyricsPanel = null;
        this.currentTrack = null;
    }

    async activate() {
        await super.activate();

        // 创建歌词显示面板
        this.createLyricsPanel();

        // 监听音乐变化
        this.context.player.onTrackChanged(async (track) => {
            this.currentTrack = track;
            await this.loadLyrics(track);
        });

        // 监听播放位置变化
        this.context.player.onPositionChanged((position) => {
            this.highlightCurrentLyric(position);
        });

        this.showNotification('歌词显示插件已启动', 'success');
    }

    createLyricsPanel() {
        // 添加CSS样式
        this.context.ui.addCSS(this.id, `
            .lyrics-panel {
                position: fixed;
                right: 20px;
                top: 100px;
                width: 300px;
                height: 400px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                overflow-y: auto;
                z-index: 1000;
            }
            .lyrics-line {
                margin: 10px 0;
                transition: color 0.3s;
            }
            .lyrics-line.current {
                color: #007acc;
                font-weight: bold;
            }
        `);

        // 创建面板元素
        this.lyricsPanel = this.context.ui.createElement('div', {
            className: 'lyrics-panel',
            innerHTML: '<div>暂无歌词</div>'
        });

        document.body.appendChild(this.lyricsPanel);
    }

    async loadLyrics(track) {
        try {
            // 这里可以调用歌词API或读取本地歌词文件
            const lyrics = await this.fetchLyrics(track);
            this.displayLyrics(lyrics);
        } catch (error) {
            this.lyricsPanel.innerHTML = '<div>歌词加载失败</div>';
        }
    }

    async fetchLyrics(track) {
        // 模拟歌词获取
        return [
            { time: 0, text: track.title },
            { time: 5, text: '演唱：' + track.artist },
            { time: 10, text: '暂无歌词内容...' }
        ];
    }

    displayLyrics(lyrics) {
        const lyricsHTML = lyrics.map((line, index) =>
            `<div class="lyrics-line" data-time="${line.time}" data-index="${index}">
                ${line.text}
            </div>`
        ).join('');

        this.lyricsPanel.innerHTML = lyricsHTML;
    }

    highlightCurrentLyric(position) {
        const lines = this.lyricsPanel.querySelectorAll('.lyrics-line');
        lines.forEach(line => {
            const time = parseFloat(line.dataset.time);
            if (position >= time) {
                line.classList.add('current');
            } else {
                line.classList.remove('current');
            }
        });
    }

    async deactivate() {
        if (this.lyricsPanel) {
            this.lyricsPanel.remove();
        }
        this.context.ui.removeCSS(this.id);
        await super.deactivate();
    }
}

window.PluginClass = LyricsDisplayPlugin;
