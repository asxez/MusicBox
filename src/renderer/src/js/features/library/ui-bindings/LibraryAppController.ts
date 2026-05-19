import {cacheManager} from "@js/shared/cache";
import {localCoverManager} from "@js/features/mediaAssets/service/LocalCoverManager";
import type {MusicBoxAPIEvents} from "@api/types/events";
import type {Track} from "@api/types/track";
import {libraryDataService} from "../service/LibraryDataService";
import {libraryService} from "../service/LibraryService";

interface LibraryConfirmOptions {
    title: string;
    message: string;
    type?: 'default' | 'danger' | 'warning';
    confirmText?: string;
    cancelText?: string;
}

export interface LibraryAppHost {
    currentView: string;
    library: Track[];
    filteredLibrary: Track[];
    coversPreloadedByApp?: boolean;
    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void;
    confirm(options: LibraryConfirmOptions): Promise<boolean>;
    showSuccess(message: string): void;
    showError(message: string): void;
    showInfo(message: string): void;
    showCacheLoadingStatus(): void;
    hideCacheLoadingStatus(): void;
    showWelcomeScreen(): void;
    updateTrackList(source?: string): void;
    syncDesktopLyricsButtonState(): Promise<void>;
}

interface LibraryAppUI {
    setTrackListTracks(tracks: Track[]): void;
    updateQueuedTrack(filePath: string, updatedData: Partial<Track>): boolean;
    findQueueIndex(predicate: (track: Track, index: number) => boolean): number;
    removeQueueTrack(index: number): void;
    removeTrackFromPlaylistDetail(track: Track, index: number): Promise<boolean>;
    removeSelectedTracksFromPlaylistDetail(): Promise<boolean>;
    clearTrackListSelection(): void;
    updatePlayerTrackInfo(track: Track): Promise<void>;
    isPlaylistDetailVisible(): boolean;
    updatePlaylistDetailTrack(filePath: string, updatedData: Partial<Track>): boolean;
}

interface LibraryAppIntegrations {
    getCurrentPlaybackTrack(): Track | null;
}

interface LibraryAppControllerOptions {
    app: LibraryAppHost;
    integrations: LibraryAppIntegrations;
    ui: LibraryAppUI;
}

interface TrackInfoUpdateData {
    track: Track;
    updatedData: Partial<Track> & {
        cover?: unknown;
    };
}

export class LibraryAppController {
    private readonly app: LibraryAppHost;
    private readonly integrations: LibraryAppIntegrations;
    private readonly ui: LibraryAppUI;

    constructor({app, integrations, ui}: LibraryAppControllerOptions) {
        this.app = app;
        this.integrations = integrations;
        this.ui = ui;
    }

    async loadInitialData(): Promise<void> {
        const app = this.app;

        try {
            const hasCachedLibrary = await libraryDataService.hasCachedLibrary();
            if (hasCachedLibrary) {
                app.showCacheLoadingStatus();

                app.library = await libraryService.loadCachedTracks();
                if (app.library.length > 0) {
                    app.filteredLibrary = [...app.library];
                    if (app.currentView === 'library') {
                        app.updateTrackList('cache-load');
                    }
                    app.hideCacheLoadingStatus();

                    await this.preloadTrackCovers();
                    await this.validateCacheInBackground();
                    return;
                }
            }

            app.library = await libraryDataService.getTracks();
            if (app.library.length === 0) {
                app.showWelcomeScreen();
            } else {
                app.filteredLibrary = [...app.library];
                if (app.currentView === 'library') {
                    app.updateTrackList('initial-load');
                }

                await this.preloadTrackCovers();
            }

            await app.syncDesktopLyricsButtonState();
        } catch (error) {
            app.showError('加载音乐库失败');
        }
    }

    async preloadTrackCovers(): Promise<void> {
        const app = this.app;

        try {
            const settings = (cacheManager.getLocalCache('musicbox-settings') || {}) as Record<string, unknown>;
            const showTrackCovers = Object.prototype.hasOwnProperty.call(settings, 'showTrackCovers')
                ? settings.showTrackCovers
                : true;
            if (!showTrackCovers) {
                return;
            }

            if (app.coversPreloadedByApp) {
                return;
            }

            const tracksToPreload = app.library.slice(0, 6);
            await localCoverManager.preloadCovers(tracksToPreload);
            app.coversPreloadedByApp = true;
        } catch (error) {
            console.warn('⚠️ App: 封面预加载失败:', error);
        }
    }

    async validateCacheInBackground(): Promise<void> {
        const app = this.app;

        try {
            app.addManagedAPIEventListener('cacheValidationCompleted', (result: MusicBoxAPIEvents['cacheValidationCompleted']) => {
                if (result.invalid > 0) {
                    app.showInfo(`已清理 ${result.invalid} 个无效的音乐文件`);

                    if (result.tracks) {
                        app.library = result.tracks;
                        app.filteredLibrary = [...app.library];
                        app.updateTrackList('cache-validation');
                    }
                }
            });

            app.addManagedAPIEventListener('cacheValidationError', (error: MusicBoxAPIEvents['cacheValidationError']) => {
                console.warn('⚠️ 后台缓存验证失败:', error);
            });

            await libraryService.validateCache();
        } catch (error) {
            console.warn('⚠️ 后台缓存验证失败:', error);
        }
    }

    async refreshLibrary(tracks?: Track[]): Promise<void> {
        const app = this.app;

        try {
            app.library = Array.isArray(tracks)
                ? tracks
                : await libraryDataService.getTracks();
            app.filteredLibrary = [...app.library];
            app.updateTrackList('refresh');
        } catch (error) {
            console.error('❌ [App] refreshLibrary 失败:', error);
        }
    }

    updateTrackList(source = 'unknown'): void {
        const app = this.app;

        console.log('🔄 [App] updateTrackList 被调用，来源:', source, '当前视图:', app.currentView);

        if (source === 'duration-update' && app.currentView !== 'library') {
            console.log('📝 [App] 跳过播放时长更新触发的音乐列表更新，当前视图:', app.currentView);
            return;
        }

        this.ui.setTrackListTracks(app.filteredLibrary);
    }

    handleSearchResults(results: Track[]): void {
        this.app.filteredLibrary = results;
        this.updateTrackList('search-results');
    }

    handleSearchCleared(): void {
        const app = this.app;
        app.filteredLibrary = [...app.library];
        this.updateTrackList('search-cleared');
    }

    updateLibraryTrackDuration(filePath: string, duration: number): void {
        const app = this.app;
        const libraryTrack = app.library.find(track => track.filePath === filePath);
        if (libraryTrack) {
            libraryTrack.duration = duration;
        }

        const filteredTrack = app.filteredLibrary.find(track => track.filePath === filePath);
        if (filteredTrack) {
            filteredTrack.duration = duration;
        }

        this.ui.updateQueuedTrack(filePath, {duration});

        this.updateTrackList('duration-update');
    }

    async handleDeleteTrack(track: Track, index: number): Promise<void> {
        const app = this.app;

        if (app.currentView === 'playlist-detail' && await this.ui.removeTrackFromPlaylistDetail(track, index)) {
            return;
        }

        if (app.currentView === 'network-drive-detail') {
            app.showError('网络磁盘中的歌曲无法单独删除，请通过移除整个网络磁盘来删除');
            return;
        }

        const confirmed = await app.confirm({
            title: '删除歌曲',
            message: `确定要从音乐库中删除 "${track.title}" 吗？\n\n此操作将从音乐库和所有歌单中移除该歌曲，但不会删除本地文件。`,
            type: 'danger',
            confirmText: '删除'
        });

        if (!confirmed) {
            return;
        }

        try {
            const result = await libraryDataService.removeTrack(track.fileId as string);
            if (result.success) {
                const libraryIndex = app.library.findIndex(t => t.fileId === track.fileId);
                if (libraryIndex !== -1) {
                    app.library.splice(libraryIndex, 1);
                }

                const filteredIndex = app.filteredLibrary.findIndex(t => t.fileId === track.fileId);
                if (filteredIndex !== -1) {
                    app.filteredLibrary.splice(filteredIndex, 1);
                }

                const playlistIndex = this.ui.findQueueIndex((t) => t.fileId === track.fileId);
                if (playlistIndex !== -1) {
                    this.ui.removeQueueTrack(playlistIndex);
                }

                this.updateTrackList('track-deleted');
                libraryService.emitLibraryUpdated();
                app.showInfo(`已从音乐库删除 "${track.title}"`);
            } else {
                app.showError(result.error || '删除失败');
            }
        } catch (error) {
            console.error('❌ 删除歌曲失败:', error);
            app.showError('删除失败，请重试');
        }
    }

    async handleBatchDelete(selectedTracks: Set<number> | null | undefined, track: Track, index: number): Promise<void> {
        const app = this.app;

        if (!selectedTracks || selectedTracks.size === 0) {
            await this.handleDeleteTrack(track, index);
            return;
        }

        if (app.currentView === 'playlist-detail' && await this.ui.removeSelectedTracksFromPlaylistDetail()) {
            return;
        }

        const count = selectedTracks.size;
        const confirmed = await app.confirm({
            title: '批量删除',
            message: `确定要从音乐库中删除选中的 ${count} 首歌曲吗？\n\n此操作不会删除本地文件。`,
            type: 'danger',
            confirmText: '删除'
        });

        if (!confirmed) return;

        const indices = Array.from(selectedTracks).sort((a, b) => b - a);
        let successCount = 0;

        for (const i of indices) {
            const t = app.filteredLibrary[i];
            if (!t) continue;
            try {
                const result = await libraryDataService.removeTrack(t.fileId as string);
                if (result.success) {
                    successCount++;
                    const libIdx = app.library.findIndex(x => x.fileId === t.fileId);
                    if (libIdx !== -1) app.library.splice(libIdx, 1);
                    const filtIdx = app.filteredLibrary.findIndex(x => x.fileId === t.fileId);
                    if (filtIdx !== -1) app.filteredLibrary.splice(filtIdx, 1);
                }
            } catch (e) {
                console.error('❌ 批量删除失败:', t.title, e);
            }
        }

        this.ui.clearTrackListSelection();

        this.updateTrackList('track-deleted');
        libraryService.emitLibraryUpdated();
        app.showInfo(`已从音乐库删除 ${successCount} 首歌曲`);
    }

    async handleTrackInfoUpdated(data: TrackInfoUpdateData): Promise<void> {
        const app = this.app;
        const {track, updatedData} = data;

        if (updatedData.cover && typeof updatedData.cover !== 'string') {
            updatedData.cover = null;
        }

        try {
            const libraryTrack = app.library.find(t => t.filePath === track.filePath);
            if (libraryTrack) {
                Object.assign(libraryTrack, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre,
                    cover: updatedData.cover
                });
            }

            const filteredTrack = app.filteredLibrary.find(t => t.filePath === track.filePath);
            if (filteredTrack) {
                Object.assign(filteredTrack, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre,
                    cover: updatedData.cover
                });
            }

            this.ui.updateQueuedTrack(track.filePath, {
                title: updatedData.title,
                artist: updatedData.artist,
                album: updatedData.album,
                year: updatedData.year,
                genre: updatedData.genre,
                cover: updatedData.cover
            });

            const currentTrack = this.integrations.getCurrentPlaybackTrack();
            if (currentTrack && currentTrack.filePath === track.filePath) {
                Object.assign(currentTrack, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre,
                    cover: updatedData.cover
                });
                await this.ui.updatePlayerTrackInfo(currentTrack);
            }

            this.updateTrackList('track-info-updated');

            if (app.currentView === 'playlist-detail' && this.ui.isPlaylistDetailVisible()) {
                this.ui.updatePlaylistDetailTrack(track.filePath, {
                    title: updatedData.title,
                    artist: updatedData.artist,
                    album: updatedData.album,
                    year: updatedData.year,
                    genre: updatedData.genre
                });
            }
            app.showInfo(`歌曲信息已更新：${updatedData.title}`);
        } catch (error) {
            console.error('❌ 更新歌曲信息失败:', error);
            app.showError('更新歌曲信息失败，请重试');
        }
    }
}
