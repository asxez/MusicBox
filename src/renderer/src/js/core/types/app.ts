import type {MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {PlayMode} from '@api/types/playback';
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

export interface RendererAppContext {
    components: ComponentMap;
    currentView: AppView;
    isInitialized: boolean;
    library: Track[];
    filteredLibrary: Track[];
    extensionService?: unknown;
    instantiationService?: unknown;
    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void;
    cleanup(): Promise<void>;
    initKeyboardShortcuts(): void;
    initGlobalShortcuts(): Promise<void>;
    showCreatePlaylistDialog(): void;
    setupFileLoading(): void;
    refreshLibrary(): Promise<void>;
    updateLibraryTrackDuration(filePath: string, duration: number): void;
    updateScanProgress(progress: ScanProgress): void;
    updateTrackList(source?: string): void;
    addMusicFiles(): Promise<void>;
    openDirectoryDialog(): Promise<void>;
    showScanProgress(): void;
    showSuccess(message: string): void;
    showError(message: string): void;
    showInfo(message: string): void;
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
