import {desktopLyricsGateway} from '@/infrastructure/electron/DesktopLyricsGateway';
import {lyricsContentService} from '@/features/mediaAssets/service/LyricsContentService';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {Track} from '@api/types/track';

export type DesktopLyricsSyncType = 'track' | 'playbackState' | 'position' | 'lyrics';

export interface CurrentDesktopLyricsState {
    currentTrack: Track | null;
    isPlaying: boolean;
    position: number;
}

export interface DesktopLyricsStateSyncOptions {
    getCurrentState: () => CurrentDesktopLyricsState;
}

export class DesktopLyricsStateSyncService {
    private readonly getCurrentState: () => CurrentDesktopLyricsState;

    constructor({getCurrentState}: DesktopLyricsStateSyncOptions) {
        this.getCurrentState = getCurrentState;
    }

    async syncToDesktopLyrics(
        type: DesktopLyricsSyncType,
        data: Track | DesktopLyricsPlaybackState | number | LyricLine[] | string | null
    ): Promise<void> {
        try {
            switch (type) {
                case 'track':
                    await this.syncTrack(data as Track | null);
                    break;
                case 'playbackState':
                    await desktopLyricsGateway.updatePlaybackState(data as DesktopLyricsPlaybackState);
                    break;
                case 'position':
                    await desktopLyricsGateway.updatePosition(data as number);
                    break;
                case 'lyrics':
                    await desktopLyricsGateway.updateLyrics(data as LyricLine[] | string);
                    break;
            }
        } catch (error) {
            console.error('❌ 桌面歌词同步失败:', error);
        }
    }

    async loadLyricsForDesktop(track: Track): Promise<void> {
        try {
            const result = await lyricsContentService.loadTrackLyrics(track);
            if (result.success && result.lyrics.length > 0) {
                await this.syncToDesktopLyrics('lyrics', result.lyrics);
                console.log(`🎵 loadLyricsForDesktop: 歌词已同步，来源=${result.source || 'unknown'}`);
            }
        } catch (error) {
            console.error('❌ 为桌面歌词加载歌词失败:', error);
        }
    }

    async syncCurrentStateToDesktopLyrics(): Promise<void> {
        try {
            const {currentTrack, isPlaying, position} = this.getCurrentState();

            if (currentTrack) {
                await desktopLyricsGateway.updateTrack(currentTrack);

                if (currentTrack.lyrics && currentTrack.lyrics.length > 0) {
                    const updateLyricsResult = await desktopLyricsGateway.updateLyrics(currentTrack.lyrics);
                    console.log('🔄 syncCurrentStateToDesktopLyrics: updateLyrics 结果', updateLyricsResult);
                } else if (currentTrack.title && currentTrack.artist) {
                    await this.loadLyricsForDesktop(currentTrack);
                } else {
                    console.log('🔄 syncCurrentStateToDesktopLyrics: 无法加载歌词，缺少 title 或 artist');
                }
            }

            await this.syncToDesktopLyrics('playbackState', {
                isPlaying,
                position
            });

            await this.syncToDesktopLyrics('position', position);
        } catch (error) {
            console.error('❌ 同步当前状态到桌面歌词失败:', error);
        }
    }

    private async syncTrack(track: Track | null): Promise<void> {
        await desktopLyricsGateway.updateTrack(track);
        if (track && track.lyrics) {
            await desktopLyricsGateway.updateLyrics(track.lyrics);
        } else if (track && track.title && track.artist) {
            await this.loadLyricsForDesktop(track);
        }
    }
}
