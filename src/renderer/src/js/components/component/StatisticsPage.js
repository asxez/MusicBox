/**
 * 统计页组件
 */

import {cacheManager} from "@services/CacheManager";
import {Component} from "@components/base/Component";
import {libraryAPI, userDataAPI} from "@js/api";

class StatisticsPage extends Component {
    constructor(container) {
        super(container);
        this.tracks = [];
        this.recentTracks = [];
        this.playStats = {};
        this.moodHistory = [];
        this.diaryHistory = [];
        this.listenersSetup = false;
    }

    async show() {
        if (!this.listenersSetup) {
            this.setupElements();
            this.setupAPIListeners();
            this.listenersSetup = true;
        }
        if (this.element) {
            this.element.style.display = 'block';
        }
        this.tracks = await libraryAPI.getTracks();
        this.loadPlayHistory();
        this.moodHistory = await userDataAPI.getMoodHistory();
        this.diaryHistory = await userDataAPI.getDiaryHistory();
        this.calculatePlayStats();
        this.render();
    }

    hide() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy() {
        this.tracks.length = 0;
        this.recentTracks.length = 0;
        this.playStats = {};
        this.listenersSetup = false;
        return super.destroy();
    }

    setupElements() {
        this.container = this.element;
    }

    setupAPIListeners() {
        // 监听音乐库更新
        this.addAPIEventListenerManaged('libraryUpdated', (tracks) => {
            this.tracks = tracks;
        });

        // 监听播放历史更新
        this.addAPIEventListenerManaged('trackChanged', (track) => {
            this.updatePlayHistory(track);
        });
    }

    loadPlayHistory() {
        const history = cacheManager.getLocalCache('musicbox-play-history')
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
            cacheManager.setLocalCache('musicbox-play-count-stats', playCountStats);
            console.log(`📊 StatisticsPage: 更新播放次数 - ${track.title}: ${playCountStats[trackKey]} 次`);
        } catch (error) {
            console.error('❌ StatisticsPage: 更新播放次数失败:', error);
        }
    }

    // 加载播放次数统计
    loadPlayCountStats() {
        try {
            return cacheManager.getLocalCache('musicbox-play-count-stats') || {};
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
        return Object.entries(playCountStats)
            .sort(([, a], [, b]) => b - a)
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
    }

    calculatePlayStats() {
        const playCountStats = this.loadPlayCountStats();
        const totalPlayedSongs = this.recentTracks.length;
        const totalPlayedDuration = this.recentTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
        const mostPlayedTracks = this.getMostPlayedTracks(playCountStats, 5);
        const totalPlayCount = Object.values(playCountStats).reduce((sum, count) => sum + count, 0);

        this.playStats = {
            totalTracks: this.tracks.length,
            totalDuration: this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
            favoriteArtist: this.getMostPlayedArtist(),
            uniqueArtists: this.getUniqueArtists().length,
            uniqueAlbums: this.getUniqueAlbums().length,
            totalPlayedSongs: totalPlayedSongs,
            totalPlayedDuration: totalPlayedDuration,
            mostPlayedTracks: mostPlayedTracks,
            totalPlayCount: totalPlayCount
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

    getMoodStats() {
        const moodCounts = {};
        const moodEmojis = {
            happy: '😊',
            calm: '😌',
            sad: '😢',
            excited: '🤩',
            relaxed: '😎',
            nostalgic: '🥺'
        };
        const moodNames = {
            happy: '开心',
            calm: '平静',
            sad: '忧伤',
            excited: '兴奋',
            relaxed: '放松',
            nostalgic: '怀念'
        };

        this.moodHistory.forEach(item => {
            moodCounts[item.mood] = (moodCounts[item.mood] || 0) + 1;
        });

        return Object.entries(moodCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([mood, count]) => ({
                mood,
                emoji: moodEmojis[mood] || '😊',
                name: moodNames[mood] || mood,
                count,
                percentage: ((count / this.moodHistory.length) * 100).toFixed(1)
            }));
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return `${days}天前`;
        if (days < 30) return `${Math.floor(days / 7)}周前`;
        if (days < 365) return `${Math.floor(days / 30)}个月前`;
        return `${Math.floor(days / 365)}年前`;
    }

    render() {
        if (!this.container) return;

        const moodStats = this.getMoodStats();
        const recentDiaries = this.diaryHistory.slice(-10).reverse();
        const mostPlayedTracks = this.playStats.mostPlayedTracks || [];

        this.container.innerHTML = `
            <div class="page-content statistics-page">
                <div class="page-header">
                    <h1 class="page-title">
                        <svg class="page-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z"/>
                        </svg>
                        音乐统计
                    </h1>
                    <p class="page-subtitle">你的音乐聆听数据与情感记录</p>
                </div>

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
                            <div class="stat-label">音乐库时长</div>
                        </div>
                    </div>
                </div>

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
                            <div class="stat-label">累计播放</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.formatDuration(this.playStats.totalPlayedDuration)}</div>
                            <div class="stat-label">聆听时长</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${this.playStats.favoriteArtist}</div>
                            <div class="stat-label">最爱艺术家</div>
                        </div>
                    </div>
                </div>

                ${mostPlayedTracks.length > 0 ? `
                <div class="stats-section">
                    <h2 class="section-title">
                        <svg class="title-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                        </svg>
                        最常播放
                    </h2>
                    <div class="most-played-list">
                        ${mostPlayedTracks.map((track, index) => `
                            <div class="most-played-item">
                                <div class="rank">${index + 1}</div>
                                <div class="track-info">
                                    <div class="track-title">${track.title}</div>
                                    <div class="track-artist">${track.artist}</div>
                                </div>
                                <div class="play-count">${track.playCount}次</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${this.moodHistory.length > 0 ? `
                <div class="stats-section">
                    <h2 class="section-title">
                        <svg class="title-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                        </svg>
                        聆听心情
                    </h2>
                    <div class="mood-stats-container">
                        <div class="mood-overview">
                            <div class="mood-total">共记录 <span>${this.moodHistory.length}</span> 次心情</div>
                        </div>
                        <div class="mood-distribution">
                            ${moodStats.map(stat => `
                                <div class="mood-stat-item">
                                    <div class="mood-emoji">${stat.emoji}</div>
                                    <div class="mood-info">
                                        <div class="mood-name">${stat.name}</div>
                                        <div class="mood-count">${stat.count}次 (${stat.percentage}%)</div>
                                    </div>
                                    <div class="mood-bar">
                                        <div class="mood-bar-fill" style="width: ${stat.percentage}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}

                ${this.diaryHistory.length > 0 ? `
                <div class="stats-section">
                    <h2 class="section-title">
                        <svg class="title-icon" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        音乐日记
                    </h2>
                    <div class="diary-list">
                        ${recentDiaries.map(diary => `
                            <div class="diary-item">
                                <div class="diary-header">
                                    <div class="diary-date">${this.formatDate(diary.timestamp)}</div>
                                    ${diary.currentTrack ? `
                                        <div class="diary-track">
                                            <svg viewBox="0 0 24 24" class="diary-track-icon">
                                                <path fill="currentColor" d="M12,3V13.55C11.41,13.21 10.73,13 10,13A4,4 0 0,0 6,17A4,4 0 0,0 10,21A4,4 0 0,0 14,17V7H18V3H12Z"/>
                                            </svg>
                                            ${diary.currentTrack}
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="diary-content">${diary.content}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }
}

export {StatisticsPage};
