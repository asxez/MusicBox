import {cacheManager} from "@js/shared/cache";
import {appConfirmationService} from "@js/features/appShell/service";
import type {Track} from "@api/types/library";

export interface RecentTrack extends Track {
    playTime?: number;
    cover?: string | null;
}

export type PlayCountStats = Record<string, number>;

export interface MostPlayedTrack {
    title: string;
    artist: string;
    album: string;
    playCount: number;
}

export interface PlayStats {
    totalTracks: number;
    totalDuration: number;
    favoriteArtist: string;
    uniqueArtists: number;
    uniqueAlbums: number;
    totalPlayedSongs: number;
    totalPlayedDuration: number;
    mostPlayedTracks: MostPlayedTrack[];
    totalPlayCount: number;
}

export class RecentPlaybackHistoryService {
    loadHistory(limit?: number): RecentTrack[] {
        try {
            const history = cacheManager.getLocalCache<RecentTrack[]>('musicbox-play-history');
            const tracks = Array.isArray(history) ? history : [];
            return typeof limit === 'number' ? tracks.slice(0, limit) : tracks;
        } catch (error) {
            console.error('加载播放历史失败:', error);
            return [];
        }
    }

    recordTrack(track: RecentTrack | null, limit = 100): RecentTrack[] {
        if (!track || !track.filePath) {
            return this.loadHistory();
        }

        let history = this.loadHistory();
        history = history.filter(item => item.filePath !== track.filePath);
        history.unshift({
            ...track,
            playTime: Date.now()
        });
        history = history.slice(0, limit);
        cacheManager.setLocalCache('musicbox-play-history', history);
        return history;
    }

    clearHistory(): RecentTrack[] {
        try {
            cacheManager.removeLocalCache('musicbox-play-history');
        } catch (error) {
            console.error('❌ RecentPlaybackHistoryService: 清空播放历史失败:', error);
        }
        return [];
    }

    removeHistoryItem(trackPath: string): RecentTrack[] {
        try {
            const history = this.loadHistory().filter(item => item.filePath !== trackPath);
            cacheManager.setLocalCache('musicbox-play-history', history);
            return history;
        } catch (error) {
            console.error('❌ RecentPlaybackHistoryService: 移除历史记录失败:', error);
            return this.loadHistory();
        }
    }

    updatePlayCount(track: Track | null): void {
        if (!track || !track.filePath) return;

        try {
            const playCountStats = this.loadPlayCountStats();
            const trackKey = this.getTrackKey(track);
            playCountStats[trackKey] = (playCountStats[trackKey] || 0) + 1;
            cacheManager.setLocalCache('musicbox-play-count-stats', playCountStats);
            console.log(`📊 RecentPlaybackHistoryService: 更新播放次数 - ${track.title}: ${playCountStats[trackKey]} 次`);
        } catch (error) {
            console.error('❌ RecentPlaybackHistoryService: 更新播放次数失败:', error);
        }
    }

    loadPlayCountStats(): PlayCountStats {
        try {
            return cacheManager.getLocalCache<PlayCountStats>('musicbox-play-count-stats') || {};
        } catch (error) {
            console.error('❌ RecentPlaybackHistoryService: 加载播放次数统计失败:', error);
            return {};
        }
    }

    calculatePlayStats(tracks: Track[], recentTracks: RecentTrack[]): PlayStats {
        const playCountStats = this.loadPlayCountStats();
        const totalPlayedSongs = recentTracks.length;
        const totalPlayedDuration = recentTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
        const mostPlayedTracks = this.getMostPlayedTracks(playCountStats, 5);
        const totalPlayCount = Object.values(playCountStats).reduce((sum, count) => sum + count, 0);

        return {
            totalTracks: tracks.length,
            totalDuration: tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
            favoriteArtist: this.getMostPlayedArtist(recentTracks),
            uniqueArtists: this.getUniqueArtists(tracks).length,
            uniqueAlbums: this.getUniqueAlbums(tracks).length,
            totalPlayedSongs,
            totalPlayedDuration,
            mostPlayedTracks,
            totalPlayCount
        };
    }

    getTrackKey(track: Track): string {
        return `${track.title || 'Unknown'}_${track.artist || 'Unknown'}_${track.album || 'Unknown'}`;
    }

    getMostPlayedTracks(playCountStats: PlayCountStats, limit = 10): MostPlayedTrack[] {
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

    getMostPlayedArtist(recentTracks: RecentTrack[]): string {
        const artistCounts: Record<string, number> = {};
        recentTracks.forEach(track => {
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

    getUniqueArtists(tracks: Track[]): string[] {
        const artists = new Set<string>();
        tracks.forEach(track => {
            if (track.artist) {
                artists.add(track.artist);
            }
        });
        return Array.from(artists);
    }

    getUniqueAlbums(tracks: Track[]): string[] {
        const albums = new Set<string>();
        tracks.forEach(track => {
            if (track.album) {
                albums.add(track.album);
            }
        });
        return Array.from(albums);
    }

    async confirmClearHistory(): Promise<boolean> {
        return await appConfirmationService.confirm({
            title: '清空播放历史',
            message: '确定要清空播放历史吗？此操作无法撤销。',
            confirmText: '清空',
            type: 'warning'
        });
    }

    async confirmRemoveHistoryItem(trackTitle: string): Promise<boolean> {
        return await appConfirmationService.confirm({
            title: '移除播放历史',
            message: `确定要从历史中移除 "${trackTitle}" 吗？`,
            confirmText: '移除',
            type: 'warning'
        });
    }
}

export const recentPlaybackHistoryService = new RecentPlaybackHistoryService();
