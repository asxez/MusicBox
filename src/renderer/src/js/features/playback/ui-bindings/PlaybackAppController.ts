import {cacheManager} from "@services/CacheManager";
import type {PlaybackStateSnapshot} from '@api/types/playback';
import type {MusicBoxSettings} from '@api/types/settings';
import type {Track} from '@api/types/track';
import type {
    AppLibraryStatePort,
    AppNotificationPort,
    AppViewStatePort
} from "@js/app/runtime/AppRuntimeTypes";
import {playbackController} from "../PlaybackController";

interface PlaybackAppHost extends AppLibraryStatePort, AppNotificationPort, AppViewStatePort {}

interface PlaybackAppUI {
    hasQueue(): boolean;
    getQueueTracks(): Track[];
    isQueueEmpty(): boolean;
    syncQueueTracks(tracks: Track[], currentIndex?: number): void;
    setQueueCurrentTrack(index: number): void;
    findQueueIndex(predicate: (track: Track, index: number) => boolean): number;
    addQueueTrack(track: Track): number;
}

interface PlaybackAppControllerOptions {
    app: PlaybackAppHost;
    integrations: PlaybackAppIntegrations;
    ui: PlaybackAppUI;
}

interface PlaybackAppIntegrations {
    getLibraryTracks(): Promise<Track[]>;
}

export class PlaybackAppController {
    private readonly app: PlaybackAppHost;
    private readonly integrations: PlaybackAppIntegrations;
    private readonly ui: PlaybackAppUI;
    private playTrackLock: boolean;

    constructor({app, integrations, ui}: PlaybackAppControllerOptions) {
        this.app = app;
        this.integrations = integrations;
        this.ui = ui;
        this.playTrackLock = false;
    }

    async handlePlayAllTracks(tracks: Track[]): Promise<void> {
        const app = this.app;

        if (!tracks || tracks.length === 0) return;

        try {
            await playbackController.setPlaylist(tracks, 0);
            this.ui.syncQueueTracks(tracks, 0);
            await this.playTrackFromPlaylist(tracks[0], 0);
        } catch (error) {
            app.showError('播放失败，请重试');
        }
    }

    async handleTrackPlayed(track: Track, _index: number): Promise<void> {
        const app = this.app;

        console.log('🎵 从音乐库播放歌曲:', track.title, '当前视图:', app.currentView);

        if (this.ui.hasQueue()) {
            if (app.currentView === 'library') {
                const currentLibrary = app.filteredLibrary && app.filteredLibrary.length > 0
                    ? app.filteredLibrary
                    : app.library;

                if (currentLibrary.length > 0) {
                    const trackIndex = currentLibrary.findIndex(t => t.filePath === track.filePath);
                    const startIndex = trackIndex !== -1 ? trackIndex : 0;

                    console.log(`🎵 设置播放列表: ${currentLibrary.length} 首歌曲，从第 ${startIndex + 1} 首开始播放`);

                    this.ui.syncQueueTracks(currentLibrary, startIndex);
                    await this.playTrackFromPlaylist(track, startIndex);
                } else {
                    console.warn('⚠️ 音乐库为空，无法播放');
                }
            } else {
                if (this.ui.isQueueEmpty()) {
                    console.log('🎵 播放列表为空，添加当前歌曲，当前视图:', app.currentView);
                    this.ui.syncQueueTracks([track], 0);
                    console.log('🔍 setTracks 完成，当前视图:', app.currentView);
                    await this.playTrackFromPlaylist(track, 0);
                } else {
                    const existingIndex = this.ui.findQueueIndex((t) =>
                        t.filePath === track.filePath
                    );
                    if (existingIndex === -1) {
                        const newIndex = this.ui.addQueueTrack(track);
                        await this.playTrackFromPlaylist(track, newIndex);
                    } else {
                        await this.playTrackFromPlaylist(track, existingIndex);
                    }
                }
            }
        } else {
            console.warn('播放列表组件不存在，使用传统播放方式');
            await playbackController.setPlaylist([track], 0);
        }
    }

    async playTrackFromPlaylist(track: Track, index: number): Promise<void> {
        if (this.playTrackLock) {
            console.log('🚫 App: 播放操作正在进行中，忽略重复调用');
            return;
        }

        this.playTrackLock = true;
        console.log(`🎵 App: 开始播放 ${track.title || track.filePath}，索引: ${index}`);

        try {
            const queueTracks = this.ui.getQueueTracks();
            if (queueTracks.length > 0) {
                console.log('🔄 同步播放列表到API:', queueTracks.length, '首歌曲');

                const setPlaylistResult = await playbackController.setPlaylist(queueTracks, index);

                if (setPlaylistResult) {
                    this.ui.setQueueCurrentTrack(index);

                    const loadResult = await playbackController.loadTrack(track.filePath);
                    if (loadResult) {
                        await playbackController.play();
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

    handleTrackIndexChanged(index: number): void {
        const queueLength = this.ui.getQueueTracks().length;

        if (this.ui.hasQueue()) {
            if (index >= 0 && index < queueLength) {
                this.ui.setQueueCurrentTrack(index);
            } else {
                console.warn('⚠️ 索引超出播放列表范围:', index, '/', queueLength);
            }
        }
    }

    async restorePlaybackState(): Promise<void> {
        try {
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;
            const playbackState = cacheManager.getLocalCache('playback-state') as PlaybackStateSnapshot | null;

            if (settings.rememberPosition && playbackState) {
                const {currentTrack, position, playlist, currentIndex, playMode} = playbackState;

                if (playMode) {
                    playbackController.setPlayMode(playMode);
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
                        await playbackController.setPlaylist(validTracks, validCurrentIndex);

                        this.ui.syncQueueTracks(validTracks, validCurrentIndex);

                        if (validCurrentIndex >= 0 && validTracks[validCurrentIndex]) {
                            const trackToLoad = validTracks[validCurrentIndex];
                            const loadResult = await playbackController.loadTrack(trackToLoad.filePath);
                            if (loadResult) {
                                if (position > 0) {
                                    const setPositionResult = await playbackController.setPosition(position);
                                    console.log('App: setPosition 结果:', setPositionResult);
                                }

                                if (settings.autoplay) {
                                    setTimeout(async () => {
                                        await playbackController.play();
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
                    const loadResult = await playbackController.loadTrack(currentTrack.filePath);
                    if (loadResult) {
                        if (position > 0) {
                            await playbackController.setPosition(position);
                        }
                        if (settings.autoplay) {
                            setTimeout(async () => {
                                await playbackController.play();
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
                const loadResult = await playbackController.loadTrack(tracks[0].filePath);
                console.log('📂 App: 加载结果:', loadResult);
                if (loadResult) {
                    await playbackController.play();
                }
            } else {
                console.warn('⚠️ App: 音乐库为空，无法自动播放');
            }
        }, 1000);
    }

    async savePlaybackState(): Promise<void> {
        const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as MusicBoxSettings;

        if (settings.rememberPosition) {
            const playbackState: PlaybackStateSnapshot = playbackController.getPlaybackSnapshot();
            cacheManager.setLocalCache('playback-state', playbackState);
        }
    }
}
