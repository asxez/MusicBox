import {lyricsAPI} from "@api/modules";

export class DesktopLyricsSync {
    constructor({getCurrentState}) {
        this.getCurrentState = getCurrentState;
    }

    async syncToDesktopLyrics(type, data) {
        try {
            switch (type) {
                case 'track':
                    await window.electronAPI.desktopLyrics.updateTrack(data);
                    if (data && data.lyrics) {
                        await window.electronAPI.desktopLyrics.updateLyrics(data.lyrics);
                    } else if (data && data.title && data.artist) {
                        await this.loadLyricsForDesktop(data);
                    }
                    break;
                case 'playbackState':
                    await window.electronAPI.desktopLyrics.updatePlaybackState(data);
                    break;
                case 'position':
                    await window.electronAPI.desktopLyrics.updatePosition(data);
                    break;
                case 'lyrics':
                    await window.electronAPI.desktopLyrics.updateLyrics(data);
                    break;
            }
        } catch (error) {
            console.error('❌ 桌面歌词同步失败:', error);
        }
    }

    async loadLyricsForDesktop(track) {
        try {
            const lyricsResult = await lyricsAPI.getLyrics(track.title, track.artist, track.album, track.filePath);
            if (lyricsResult.success) {
                let parsedLyrics;

                if (lyricsResult.format === 'ttml' && lyricsResult.content) {
                    parsedLyrics = lyricsAPI.parseTTML(lyricsResult.content);
                    console.log('🎵 loadLyricsForDesktop: 解析 TTML 格式');
                } else if (lyricsResult.lrc) {
                    parsedLyrics = lyricsAPI.parseLRC(lyricsResult.lrc);
                    console.log('🎵 loadLyricsForDesktop: 解析 LRC 格式');
                } else if (lyricsResult.content) {
                    parsedLyrics = lyricsAPI.parse(lyricsResult.content, lyricsResult.format);
                    console.log('🎵 loadLyricsForDesktop: 解析其他格式:', lyricsResult.format);
                }

                if (parsedLyrics && parsedLyrics.length > 0) {
                    const updateResult = await this.syncToDesktopLyrics('lyrics', parsedLyrics);
                    console.log('🎵 loadLyricsForDesktop: syncToDesktopLyrics 结果', updateResult);

                    track.lyrics = parsedLyrics;
                    if (lyricsResult.lrc) {
                        track.lrcText = lyricsResult.lrc;
                    } else if (lyricsResult.content) {
                        track.lyricsContent = lyricsResult.content;
                        track.lyricsFormat = lyricsResult.format;
                    }
                }
            }
        } catch (error) {
            console.error('❌ 为桌面歌词加载歌词失败:', error);
        }
    }

    async toggleDesktopLyrics() {
        try {
            const result = await window.electronAPI.desktopLyrics.toggle();
            if (result.success && result.visible) {
                await this.syncCurrentStateToDesktopLyrics();
                await window.electronAPI.window.setBackgroundThrottling(true);
            }
            await window.electronAPI.window.setBackgroundThrottling(false);
            return result;
        } catch (error) {
            console.error('❌ 切换桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async syncCurrentStateToDesktopLyrics() {
        try {
            const {currentTrack, isPlaying, position} = this.getCurrentState();

            if (currentTrack) {
                const _updateTrackResult = await window.electronAPI.desktopLyrics.updateTrack(currentTrack);

                if (currentTrack.lyrics && currentTrack.lyrics.length > 0) {
                    const updateLyricsResult = await window.electronAPI.desktopLyrics.updateLyrics(currentTrack.lyrics);
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

    async hideDesktopLyrics() {
        try {
            return await window.electronAPI.desktopLyrics.hide();
        } catch (error) {
            console.error('❌ 隐藏桌面歌词失败:', error);
            return {success: false, error: error.message};
        }
    }

    async isDesktopLyricsVisible() {
        try {
            return await window.electronAPI.desktopLyrics.isVisible();
        } catch (error) {
            console.error('❌ 检查桌面歌词状态失败:', error);
            return false;
        }
    }

    async updateDesktopLyricsSettings(settings) {
        try {
            return await window.electronAPI.desktopLyrics.updateSettings(settings);
        } catch (error) {
            console.error('❌ 更新桌面歌词设置失败:', error);
            return {success: false, error: error.message};
        }
    }
}
