/**
 * 简单的音乐统计插件
 *
 */

class MusicStatsPlugin extends PluginBase {
    constructor(context) {
        super(context);
        this.playCount = 0;
        this.totalPlayTime = 0;
        this.startTime = null;
    }

    async activate() {
        await super.activate();

        // 加载保存的统计数据
        const savedStats = this.getStorage('stats', { playCount: 0, totalPlayTime: 0 }) || 0;
        this.playCount = savedStats.playCount;
        this.totalPlayTime = savedStats.totalPlayTime;

        // 监听播放事件
        this.context.player.onTrackChanged((track) => {
            this.playCount++;
            this.saveStats();
            this.showNotification(`已播放 ${this.playCount} 首歌曲`, 'info');
        });

        this.context.player.onPlaybackStateChanged((isPlaying) => {
            if (isPlaying) {
                this.startTime = Date.now();
            } else if (this.startTime) {
                this.totalPlayTime += Date.now() - this.startTime;
                this.startTime = null;
                this.saveStats();
            }
        });

        // 添加导航项
        this.context.navigation.addItem({
            id: 'stats-page',
            name: '音乐统计',
            icon: '📊',
            onClick: () => this.showStatsPage()
        });

        this.showNotification('音乐统计插件已启动', 'success');
    }

    saveStats() {
        this.setStorage('stats', {
            playCount: this.playCount,
            totalPlayTime: this.totalPlayTime
        });
    }

    showStatsPage() {
        const hours = Math.floor(this.totalPlayTime / (1000 * 60 * 60));
        const minutes = Math.floor((this.totalPlayTime % (1000 * 60 * 60)) / (1000 * 60));
        this.showNotification(`音乐统计
                播放歌曲数: ${this.playCount} 首
                总播放时长: ${hours}小时${minutes}分钟`
        );
    }

    async deactivate() {
        this.saveStats();
        this.context.navigation.removeItem(this.id, 'stats-page');
        await super.deactivate();
    }
}

window.PluginClass = MusicStatsPlugin;
