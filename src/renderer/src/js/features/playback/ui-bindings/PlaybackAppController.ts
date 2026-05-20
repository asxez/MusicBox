import {cacheManager} from "@js/shared/cache";
import type {PlaybackStateSnapshot} from '@api/types/playback';
import type {MusicBoxSettings} from '@api/types/settings';
import type {Track} from '@api/types/track';

export interface PlaybackAppHost {
    currentView: string;
    library: Track[];
    filteredLibrary: Track[];
    showError(message: string): void;
}

interface PlaybackAppControllerOptions {
    app: PlaybackAppHost;
    integrations: PlaybackAppIntegrations;
}

interface PlaybackAppIntegrations {
    getLibraryTracks(): Promise<Track[]>;
    setPlaylist(tracks: Track[], startIndex?: number): Promise<boolean>;
    loadTrack(filePath: string): Promise<boolean>;
    play(): Promise<boolean>;
    setPosition(position: number): Promise<boolean>;
    setPlayMode(mode: PlaybackStateSnapshot['playMode']): boolean;
    getPlaybackSnapshot(): PlaybackStateSnapshot;
}

export class PlaybackAppController {
    private readonly app: PlaybackAppHost;
    private readonly integrations: PlaybackAppIntegrations;
    private playTrackLock: boolean;

    constructor({app, integrations}: PlaybackAppControllerOptions) {
        this.app = app;
        this.integrations = integrations;
        this.playTrackLock = false;
    }

    async handlePlayAllTracks(tracks: Track[]): Promise<void> {
        const app = this.app;

        if (!tracks || tracks.length === 0) return;

        try {
            await this.playTrackFromPlaylist(tracks[0], 0, tracks);
        } catch (error) {
            app.showError('播放失败，请重试');
        }
    }

    async handleTrackPlayed(track: Track, _index: number): Promise<void> {
        const app = this.app;

        console.log('🎵 从音乐库播放歌曲:', track.title, '当前视图:', app.currentView);

        const {playlist, index} = this.resolvePlaylistForTrack(track);
        if (playlist.length === 0) {
            console.warn('⚠️ 无可播放列表，无法播放:', track.title);
            return;
        }

        await this.playTrackFromPlaylist(track, index, playlist);
    }

    async playTrackFromPlaylist(track: Track, index: number, tracks?: Track[]): Promise<void> {
        if (this.playTrackLock) {
            console.log('🚫 App: 播放操作正在进行中，忽略重复调用');
            return;
        }

        this.playTrackLock = true;
        console.log(`🎵 App: 开始播放 ${track.title || track.filePath}，索引: ${index}`);

        try {
            const playlist = this.resolvePlaybackPlaylist(track, index, tracks);
            if (playlist.tracks.length > 0) {
                console.log('🔄 同步播放列表到API:', playlist.tracks.length, '首歌曲');

                const setPlaylistResult = await this.integrations.setPlaylist(playlist.tracks, playlist.index);

                if (setPlaylistResult) {
                    const loadResult = await this.integrations.loadTrack(track.filePath);
                    if (loadResult) {
                        await this.integrations.play();
                        console.log(`✅ App: 播放成功 ${track.title || track.filePath}`);
                    } else {
                        console.error('❌ App: 加载歌曲失败');
                    }
                } else {
                    console.error('❌ App: 设置播放列表失败');
                }
            }
        } catch (error) {
            console.error('❌ 播放列表播放错误:', error);
        } finally {
            setTimeout(() => {
                this.playTrackLock = false;
            }, 300);
        }
    }

    handleTrackIndexChanged(_index: number): void {
        // Queue highlighting is driven by PlaybackQueueSyncService.
    }

    async restorePlaybackState(): Promise<void> {
        try {
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
            const playbackState = cacheManager.getLocalCache('playback-state') as PlaybackStateSnapshot | null;

            if (settings.rememberPosition && playbackState) {
                const {currentTrack, position, playlist, currentIndex, playMode} = playbackState;

                if (playMode) {
                    this.integrations.setPlayMode(playMode);
                }

                if (playlist && playlist.length > 0) {
                    const validTracks: Track[] = [];
                    let validCurrentIndex = -1;

                    for (let i = 0; i < playlist.length; i++) {
                        const track = playlist[i];
                        if (track && track.filePath) {
                            validTracks.push(track);
                            if (i === currentIndex) {
                                validCurrentIndex = validTracks.length - 1;
                            }
                        }
                    }

                    if (validTracks.length > 0) {
                        await this.integrations.setPlaylist(validTracks, validCurrentIndex);

                        if (validCurrentIndex >= 0 && validTracks[validCurrentIndex]) {
                            const trackToLoad = validTracks[validCurrentIndex];
                            const loadResult = await this.integrations.loadTrack(trackToLoad.filePath);
                            if (loadResult) {
                                if (position > 0) {
                                    const setPositionResult = await this.integrations.setPosition(position);
                                    console.log('App: setPosition 结果:', setPositionResult);
                                }

                                if (settings.autoplay) {
                                    setTimeout(async () => {
                                        await this.integrations.play();
                                    }, 1000);
                                }
                            }
                        }
                    } else {
                        console.warn('⚠️ App: 播放列表中没有有效歌曲');
                        if (settings.autoplay) {
                            await this.autoplayFirstTrack();
                        }
                    }
                } else if (currentTrack) {
                    console.log('💾 App: 恢复单个歌曲（兼容模式）:', currentTrack.title);
                    const loadResult = await this.integrations.loadTrack(currentTrack.filePath);
                    if (loadResult) {
                        if (position > 0) {
                            await this.integrations.setPosition(position);
                        }
                        if (settings.autoplay) {
                            setTimeout(async () => {
                                await this.integrations.play();
                            }, 1000);
                        }
                    }
                } else {
                    console.warn('⚠️ App: 没有保存的播放信息');
                    if (settings.autoplay) {
                        await this.autoplayFirstTrack();
                    }
                }
            } else if (settings.autoplay) {
                console.log('▶️ App: 仅启用自动播放，播放第一首歌曲');
                await this.autoplayFirstTrack();
            } else {
                console.log('ℹ️ App: 未启用自动播放或记住播放位置');
            }
        } catch (error) {
            console.error('❌ App: 恢复播放状态失败:', error);
        }
    }

    async autoplayFirstTrack(): Promise<void> {
        setTimeout(async () => {
            const tracks = await this.integrations.getLibraryTracks();
            if (tracks && tracks.length > 0) {
                console.log('🎵 App: 加载第一首歌曲:', tracks[0].title);
                const loadResult = await this.integrations.loadTrack(tracks[0].filePath);
                console.log('📂 App: 加载结果:', loadResult);
                if (loadResult) {
                    await this.integrations.play();
                }
            } else {
                console.warn('⚠️ App: 音乐库为空，无法自动播放');
            }
        }, 1000);
    }

    async savePlaybackState(): Promise<void> {
        const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;

        if (settings.rememberPosition) {
            const playbackState: PlaybackStateSnapshot = this.integrations.getPlaybackSnapshot();
            cacheManager.setLocalCache('playback-state', playbackState);
        }
    }

    private resolvePlaylistForTrack(track: Track): {playlist: Track[]; index: number} {
        const app = this.app;

        if (app.currentView === 'library') {
            const currentLibrary = app.filteredLibrary && app.filteredLibrary.length > 0
                ? app.filteredLibrary
                : app.library;

            if (currentLibrary.length === 0) {
                return {playlist: [], index: -1};
            }

            const trackIndex = this.findTrackIndex(currentLibrary, track);
            const startIndex = trackIndex !== -1 ? trackIndex : 0;

            console.log(`🎵 设置播放列表: ${currentLibrary.length} 首歌曲，从第 ${startIndex + 1} 首开始播放`);
            return {playlist: currentLibrary, index: startIndex};
        }

        const currentPlaylist = this.integrations.getPlaybackSnapshot().playlist ?? [];
        if (currentPlaylist.length === 0) {
            console.log('🎵 播放列表为空，使用当前歌曲创建播放列表，当前视图:', app.currentView);
            return {playlist: [track], index: 0};
        }

        const existingIndex = this.findTrackIndex(currentPlaylist, track);
        if (existingIndex !== -1) {
            return {playlist: currentPlaylist, index: existingIndex};
        }

        return {
            playlist: [...currentPlaylist, track],
            index: currentPlaylist.length
        };
    }

    private resolvePlaybackPlaylist(track: Track, index: number, tracks?: Track[]): {tracks: Track[]; index: number} {
        const playlist = tracks && tracks.length > 0
            ? tracks
            : this.integrations.getPlaybackSnapshot().playlist;

        if (playlist.length === 0) {
            return {tracks: [track], index: 0};
        }

        if (index >= 0 && index < playlist.length) {
            return {tracks: playlist, index};
        }

        const trackIndex = this.findTrackIndex(playlist, track);
        return {
            tracks: playlist,
            index: trackIndex !== -1 ? trackIndex : 0
        };
    }

    private findTrackIndex(tracks: Track[], track: Track): number {
        return tracks.findIndex((candidate) => (
            candidate.filePath === track.filePath
            || (!!candidate.path && candidate.path === track.path)
        ));
    }
}
