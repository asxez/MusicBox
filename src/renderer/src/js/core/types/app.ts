import type {MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
import type {Playlist} from '@api/types/playlist';
import type {Track} from '@api/types/track';

export type AppView =
    | 'home-page'
    | 'library'
    | 'recent'
    | 'artists'
    | 'albums'
    | 'statistics'
    | 'playlist-detail'
    | 'network-drive-detail'
    | string;

export interface ManagedDOMListener {
    element: EventTarget;
    event: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
}

export interface ManagedAPIListener<K extends keyof MusicBoxAPIEvents = keyof MusicBoxAPIEvents> {
    event: K;
    handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>;
}

export type ComponentMap = Record<string, any>;

export interface ConfirmOptions {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | string;
    confirmText?: string;
    cancelText?: string;
}

export interface RendererAppContext {
    components: ComponentMap;
    currentView: AppView;
    isInitialized: boolean;
    library: Track[];
    filteredLibrary: Track[];
    coversPreloadedByApp?: boolean;
    extensionService?: unknown;
    instantiationService?: unknown;
    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void;
    addManagedAPIEventListener<K extends keyof MusicBoxAPIEvents>(
        event: K,
        handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>
    ): void;
    cleanup(): Promise<void>;
    initKeyboardShortcuts(): void;
    initGlobalShortcuts(): Promise<void>;
    showCreatePlaylistDialog(): void;
    setupFileLoading(): void;
    initializeComponent(componentName: string): void;
    destroyComponent(componentName: string): void;
    loadInitialData?(): Promise<void>;
    preloadTrackCovers(): Promise<void>;
    refreshLibrary(): Promise<void>;
    handleSearchResults(results: Track[]): void;
    handleSearchCleared(): void;
    handleViewChange(view: AppView): Promise<void>;
    handlePlayAllTracks(tracks: Track[]): Promise<void>;
    handleTrackPlayed(track: Track, index: number): Promise<void>;
    handleTrackIndexChanged(index: number): void;
    handlePlaylistTrackSelected(track: Track, index: number): void;
    handlePlaylistTrackPlayed(track: Track, index: number): Promise<void>;
    handlePlaylistTrackRemoved(track: Track, index: number): Promise<void>;
    handlePlaylistCleared(): Promise<void>;
    addToPlaylist(track: Track): void;
    handleAddToCustomPlaylist(track: Track, index: number): Promise<void>;
    handleDeleteTrack(track: Track, index: number): Promise<void>;
    handleBatchDelete(selectedTracks: Set<number> | null | undefined, track: Track, index: number): Promise<void>;
    handleEditTrackInfo(track: Track, index: number): Promise<void>;
    handleTrackInfoUpdated(data: unknown): Promise<void>;
    handlePlaylistSelected(playlist: Playlist): Promise<void>;
    handleNetworkDriveSelected(drive: unknown): Promise<void>;
    handleDriveRemoved(drive?: unknown): Promise<void>;
    handlePlaylistCreated(playlist?: Playlist): Promise<void>;
    handleTrackAddedToPlaylist(playlist?: Playlist, track?: Track): Promise<void>;
    handlePlaylistUpdated(playlist?: Playlist): Promise<void>;
    handlePlaylistRenamed(playlist?: Playlist): Promise<void>;
    handleShowAddSongsDialog(playlist: Playlist): Promise<void>;
    handleTracksAddedToPlaylist(data?: unknown): Promise<void>;
    handlePlaylistCoverUpdated(playlist: Playlist): Promise<void>;
    updateLibraryTrackDuration(filePath: string, duration: number): void;
    updateScanProgress(progress: ScanProgress): void;
    updateTrackList(source?: string): void;
    addMusicFiles(): Promise<void>;
    openDirectoryDialog(): Promise<void>;
    showScanProgress(): void;
    showCacheLoadingStatus(): void;
    hideCacheLoadingStatus(): void;
    showWelcomeScreen(): void;
    showSuccess(message: string): void;
    showError(message: string): void;
    showInfo(message: string): void;
    confirm(options: ConfirmOptions): Promise<boolean>;
    syncDesktopLyricsButtonState(): Promise<void>;
    hideAllPages(): void;
    updateSidebarSelection(type: string, id?: string | null): void;
    playTrackFromPlaylist(track: Track, index: number): Promise<void>;
}

export interface PlayerLike {
    togglePlayPause?: () => Promise<void> | void;
    updatePlayModeDisplay?: (mode: PlayMode) => void;
}

export interface LyricsLike {
    isVisible?: boolean;
    isFullscreen?: boolean;
    show?: (track: Track | null) => Promise<void> | void;
    hide?: () => void;
    updateProgress?: (position: number, duration: number) => void;
    updatePlayButton?: (isPlaying: boolean) => void;
    exitFullscreen?: () => void;
    toggleFullscreen?: () => void;
}
