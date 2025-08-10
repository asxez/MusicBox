/**
 * 统计页组件
 */

class StatisticsPage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.recentTracks = [];
        this.playStats = {};
        this.setupElements();
        this.setupEventListeners();
    }

    setupElements() {
        this.container = this.element;
    }

    setupEventListeners() {
        // 监听音乐库更新
        api.on('libraryUpdated', (tracks) => {
            this.tracks = tracks;
            this.render();
        });

        // 监听播放历史更新
        api.on('trackChanged', (track) => {
            this.updatePlayHistory(track);
        });
    }

    async show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.tracks = await api.getTracks();
        this.loadPlayHistory();
        this.calculatePlayStats();
        this.render();
    }

    hide() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    loadPlayHistory() {
        const history = window.cacheManager.getLocalCache('musicbox-play-history')
        if (history) {
            try {
                this.recentTracks = history.slice(0, 50);
            } catch (error) {
                console.error('加载播放历史失败:', error);
                this.recentTracks = [];
            }
        }
    }

    updatePlayHistory(track) {
        if (!track || !track.filePath) return;
        this.loadPlayHistory();
        this.updatePlayCount(track);
        this.calculatePlayStats();
    }

    // 更新播放次数统计
    updatePlayCount(track) {
        if (!track || !track.filePath) return;

        try {
            let playCountStats = this.loadPlayCountStats();
            const trackKey = this.getTrackKey(track);

            // 增加播放次数
            playCountStats[trackKey] = (playCountStats[trackKey] || 0) + 1;

            // 保存统计数据
            window.cacheManager.setLocalCache('musicbox-play-count-stats', playCountStats);

            console.log(`📊 StatisticsPage: 更新播放次数 - ${track.title}: ${playCountStats[trackKey]} 次`);
        } catch (error) {
            console.error('❌ StatisticsPage: 更新播放次数失败:', error);
        }
    }

    // 加载播放次数统计
    loadPlayCountStats() {
        try {
            return window.cacheManager.getLocalCache('musicbox-play-count-stats') || {};
        } catch (error) {
            console.error('❌ StatisticsPage: 加载播放次数统计失败:', error);
            return {};
        }
    }

    // 生成歌曲唯一标识
    getTrackKey(track) {
        return `${track.title || 'Unknown'}_${track.artist || 'Unknown'}_${track.album || 'Unknown'}`;
    }

    // 获取最常播放的歌曲
    getMostPlayedTracks(playCountStats, limit = 10) {
        const sortedTracks = Object.entries(playCountStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([trackKey, playCount]) => {
                const [title, artist, album] = trackKey.split('_');
                return {
                    title: title || 'Unknown',
                    artist: artist || 'Unknown',
                    album: album || 'Unknown',
                    playCount
                };
            });

        return sortedTracks;
    }

    calculatePlayStats() {
        // 加载播放统计数据
        const playCountStats = this.loadPlayCountStats();

        // 计算累计听歌数量（播放历史记录）
        const totalPlayedSongs = this.recentTracks.length;

        // 计算累计听歌时长（播放历史中歌曲的实际时长）
        const totalPlayedDuration = this.recentTracks.reduce((sum, track) => {
            return sum + (track.duration || 0);
        }, 0);

        // 计算最常播放的歌曲
        const mostPlayedTracks = this.getMostPlayedTracks(playCountStats);

        // 计算播放次数统计
        const totalPlayCount = Object.values(playCountStats).reduce((sum, count) => sum + count, 0);

        this.playStats = {
            totalTracks: this.tracks.length,
            recentPlays: this.recentTracks.length,
            totalDuration: this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
            favoriteArtist: this.getMostPlayedArtist(),
            totalSize: this.tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0),
            uniqueArtists: this.getUniqueArtists().length,
            uniqueAlbums: this.getUniqueAlbums().length,
            averageDuration: this.tracks.length > 0 ?
                this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0) / this.tracks.length : 0,
            totalPlayedSongs: totalPlayedSongs,
            totalPlayedDuration: totalPlayedDuration,
            totalPlayCount: totalPlayCount,
            mostPlayedTracks: mostPlayedTracks,
            averagePlayCount: totalPlayCount > 0 ? totalPlayCount / Object.keys(playCountStats).length : 0
        };
    }

    getMostPlayedArtist() {
        const artistCounts = {};
        this.recentTracks.forEach(track => {
            if (track.artist) {
                artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
            }
        });

        let favoriteArtist = '暂无';
        let maxCount = 0;
        for (const [artist, count] of Object.entries(artistCounts)) {
            if (count > maxCount) {
                maxCount = count;
                favoriteArtist = artist;
            }
        }
        return favoriteArtist;
    }

    getUniqueArtists() {
        const artists = new Set();
        this.tracks.forEach(track => {
            if (track.artist) {
                artists.add(track.artist);
            }
        });
        return Array.from(artists);
    }

    getUniqueAlbums() {
        const albums = new Set();
        this.tracks.forEach(track => {
            if (track.album) {
                albums.add(track.album);
            }
        });
        return Array.from(albums);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}分钟`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `${hours}小时${remainingMinutes}分钟`;
        }
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="page-content statistics-page">
                <!-- 页面标题 -->
                <div class="page-header">
                    <h1 class="page-title">
                        <svg class="page-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z"/>
                        </svg>
                        音乐库统计
                    </h1>
                    <p class="page-subtitle">详细的音乐库数据分析和播放统计</p>
                </div>

                <!-- 核心统计数据 -->
                <div class="stats-overview">
                    <div class="stats-grid">
                        <div class="stat-card primary">
                            <div class="stat-icon">🎵</div>
                            <div class="stat-number">${this.playStats.totalTracks}</div>
                            <div class="stat-label">音乐总数</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">👨‍🎤</div>
                            <div class="stat-number">${this.playStats.uniqueArtists}</div>
                            <div class="stat-label">艺术家</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💿</div>
                            <div class="stat-number">${this.playStats.uniqueAlbums}</div>
                            <div class="stat-label">专辑</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏱️</div>
                            <div class="stat-number">${this.formatDuration(this.playStats.totalDuration)}</div>
                            <div class="stat-label">总时长</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💾</div>
                            <div class="stat-number">${this.formatFileSize(this.playStats.totalSize)}</div>
                            <div class="stat-label">总大小</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-number">${this.formatDuration(this.playStats.averageDuration)}</div>
                            <div class="stat-label">平均时长</div>
                        </div>
                    </div>
                </div>

                <!-- 播放统计 -->
                <div class="stats-section">
                    <h2 class="section-title">
                        <svg class="title-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z"/>
                        </svg>
                        播放统计
                    </h2>
                    <div class="play-stats-grid">
                        <div class="stat-card">
                            <div class="stat-number">${this.playStats.totalPlayedSongs}</div>
                            <div class="stat-label">累计听歌</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.formatDuration(this.playStats.totalPlayedDuration)}</div>
                            <div class="stat-label">听歌时长</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.playStats.favoriteArtist}</div>
                            <div class="stat-label">最常听艺术家</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

window.components.component.StatisticsPage = StatisticsPage;
