import {desktopLyricsGateway} from '@js/infrastructure/electron/DesktopLyricsGateway';
import {windowGateway} from '@js/infrastructure/electron/WindowGateway';
import {lyricsContentService} from '@js/features/mediaAssets/service';
import type {Result} from '@api/types/common';
import type {LyricLine} from '@api/types/lyrics';
import type {DesktopLyricsPlaybackState} from '@api/types/playback';
import type {DesktopLyricsSettings, MusicBoxSettings} from '@api/types/settings';
import type {Track} from '@api/types/track';

type DesktopLyricsSyncType = 'track' | 'playbackState' | 'position' | 'lyrics';

interface CurrentDesktopLyricsState {
    currentTrack: Track | null;
    isPlaying: boolean;
    position: number;
}

interface DesktopLyricsSyncOptions {
    getCurrentState: () => CurrentDesktopLyricsState;
}

export class DesktopLyricsSync {
    private readonly getCurrentState: () => CurrentDesktopLyricsState;

    constructor({getCurrentState}: DesktopLyricsSyncOptions) {
        this.getCurrentState = getCurrentState;
    }

    async syncToDesktopLyrics(
        type: DesktopLyricsSyncType,
        data: Track | DesktopLyricsPlaybackState | number | LyricLine[] | string | null
    ): Promise<void> {
        try {
            switch (type) {
                case 'track': {
                    const track = data as Track | null;
                    await desktopLyricsGateway.updateTrack(track);
                    if (track && track.lyrics) {
                        await desktopLyricsGateway.updateLyrics(track.lyrics);
                    } else if (track && track.title && track.artist) {
                        await this.loadLyricsForDesktop(track);
                    }
                    break;
                }
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

    async toggleDesktopLyrics(): Promise<{success: boolean; visible?: boolean; error?: string}> {
        try {
            const result = await desktopLyricsGateway.toggle();
            if (result.success && result.visible) {
                await this.syncCurrentStateToDesktopLyrics();
                await windowGateway.setBackgroundThrottling(true);
            }
            await windowGateway.setBackgroundThrottling(false);
            return result;
        } catch (error) {
            console.error('❌ 切换桌面歌词失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
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

    async hideDesktopLyrics(): Promise<Result> {
        try {
            return await desktopLyricsGateway.hide();
        } catch (error) {
            console.error('❌ 隐藏桌面歌词失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    async isDesktopLyricsVisible(): Promise<boolean> {
        try {
            return await desktopLyricsGateway.isVisible();
        } catch (error) {
            console.error('❌ 检查桌面歌词状态失败:', error);
            return false;
        }
    }

    async updateDesktopLyricsSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result> {
        try {
            return await desktopLyricsGateway.updateSettings(settings);
        } catch (error) {
            console.error('❌ 更新桌面歌词设置失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }
}
