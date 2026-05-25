import type {Result, Unsubscribe} from './common';
import type {CacheStatistics, GetTracksOptions, Playlist, Track} from './library';
import type {LyricLine} from './lyrics';
import type {DesktopLyricsPlaybackState} from './playback';
import type {DesktopLyricsSettings, MusicBoxSettings, WasapiShareMode} from './settings';
import type {CacheValidationResult, ScanProgress} from './events';
import type {WindowBounds} from './window';

export interface ElectronAudioAPI {
    init(): Promise<boolean>;
    play(): Promise<boolean>;
    pause(): Promise<boolean>;
    stop(): Promise<boolean>;
    seek(position: number): Promise<boolean>;
    setVolume(volume: number): Promise<boolean>;
    loadTrack(filePath: string): Promise<boolean>;
    getCurrentTrack(): Promise<Track | null>;
    getPosition(): Promise<number>;
    getDuration(): Promise<number>;
    setPlaylist(tracks: Track[]): Promise<boolean>;
    nextTrack(): Promise<boolean>;
    previousTrack(): Promise<boolean>;
    onTrackChanged(callback: (event: unknown, track: Track | null) => void): Unsubscribe;
    onPlaybackStateChanged(callback: (event: unknown, state: string) => void): Unsubscribe;
    onPositionChanged(callback: (event: unknown, position: number) => void): Unsubscribe;
}

export interface ElectronNativeAudioAPI {
    initialize(shareMode?: WasapiShareMode): Promise<unknown>;
    loadTrack(filePath: string): Promise<unknown>;
    play(): Promise<unknown>;
    pause(): Promise<unknown>;
    stop(): Promise<unknown>;
    seek(position: number): Promise<unknown>;
    setVolume(volume: number): Promise<Result>;
    getPosition(): Promise<unknown>;
    getRenderStats(): Promise<unknown>;
    resetRenderStats(): Promise<unknown>;
    setEqualizerEnabled(enabled: boolean): Promise<Result>;
    isEqualizerEnabled(): Promise<Result>;
    setEqualizerPreamp(gain: number): Promise<Result>;
    getEqualizerPreamp(): Promise<Result<{preamp: number}>>;
    setEqualizerBandGain(band: number, gain: number): Promise<Result>;
    getEqualizerBandGain(band: number): Promise<Result<{gain: number}>>;
    setEqualizerBandQ(band: number, q: number): Promise<unknown>;
    getEqualizerBandQ(band: number): Promise<unknown>;
    resetEqualizer(): Promise<unknown>;
    applyEqualizerPreset(preset: unknown): Promise<unknown>;
    getEqualizerFrequencyResponse(): Promise<unknown>;
    setEqualizerMode(mode: string): Promise<unknown>;
    getEqualizerMode(): Promise<unknown>;
    parametricSetEnabled(enabled: boolean): Promise<unknown>;
    parametricIsEnabled(): Promise<unknown>;
    parametricSetPreamp(gain: number): Promise<unknown>;
    parametricGetPreamp(): Promise<unknown>;
    parametricAddBand(config: unknown): Promise<unknown>;
    parametricRemoveBand(bandId: unknown): Promise<unknown>;
    parametricUpdateBand(config: unknown): Promise<unknown>;
    parametricGetBands(): Promise<unknown>;
    parametricGetBand(bandId: unknown): Promise<unknown>;
    parametricReset(): Promise<unknown>;
    parametricClearBands(): Promise<unknown>;
    setShareMode(mode: WasapiShareMode): Promise<unknown>;
    getShareMode(): Promise<WasapiShareMode>;
    switchShareMode(mode: WasapiShareMode): Promise<boolean>;
    destroy(): Promise<unknown>;
}

export interface ElectronBenchmarkAPI {
    ping(payload?: unknown): Promise<unknown>;
    getProcessSnapshot(): Promise<unknown>;
    forceGc(): Promise<unknown>;
}

export interface PlaylistDetailResult {
    success: boolean;
    playlist?: Playlist;
    tracks?: Track[];
    error?: string;
}

export interface ElectronLibraryAPI {
    scanDirectory(path: string): Promise<boolean>;
    scanNetworkDrive(driveId: string | number, relativePath: string): Promise<boolean>;
    scanSingleFile(networkPath: string): Promise<unknown>;
    scanDirectoryForFiles(path: string): Promise<{success: boolean; files: unknown[]; error?: string}>;
    addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}>;
    getTracks(options?: GetTracksOptions): Promise<Track[]>;
    getPlaylists(): Promise<Playlist[]>;
    search(query: string): Promise<Track[]>;
    getTrackMetadata(filePath: string): Promise<Track | null>;
    getTrackPlaybackMetadata(filePath: string): Promise<Track | null>;
    updateTrackMetadata(trackId: string, metadata: Partial<Track>): Promise<unknown>;
    createPlaylist(name: string, description?: string): Promise<unknown>;
    getPlaylistDetail(playlistId: string): Promise<PlaylistDetailResult>;
    deletePlaylist(playlistId: string): Promise<unknown>;
    renamePlaylist(playlistId: string, newName: string): Promise<unknown>;
    addToPlaylist(playlistId: string, trackIds: string[]): Promise<Result>;
    removeFromPlaylist(playlistId: string, trackIds: string[]): Promise<Result>;
    cleanupPlaylists(): Promise<unknown>;
    loadCachedTracks(): Promise<Track[]>;
    validateCache(): Promise<CacheValidationResult>;
    getCacheStatistics(): Promise<CacheStatistics | null>;
    clearCache(): Promise<boolean>;
    removeTrack(trackFileId: string): Promise<Result>;
    getTracksByDrive(driveId: string): Promise<Track[]>;
    removeTracksByDrive(driveId: string): Promise<Result>;
    clearIgnoreList(): Promise<Result>;
    updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result>;
    getPlaylistCover(playlistId: string): Promise<{success: boolean; coverPath?: string; error?: string}>;
    removePlaylistCover(playlistId: string): Promise<Result>;
    onLibraryUpdated(callback: (event: unknown, data: Track[]) => void): Unsubscribe;
    onScanProgress(callback: (event: unknown, progress: ScanProgress) => void): Unsubscribe;
    onCacheValidationProgress(callback: (progress: ScanProgress) => void): Unsubscribe;
    onCoverUpdated(callback: (data: unknown) => void): Unsubscribe;
}

export interface ElectronDesktopLyricsAPI {
    create(): Promise<unknown>;
    show(): Promise<unknown>;
    hide(): Promise<Result>;
    close(): Promise<unknown>;
    toggle(): Promise<{success: boolean; visible?: boolean; error?: string}>;
    isVisible(): Promise<boolean>;
    updatePlaybackState(state: DesktopLyricsPlaybackState): Promise<unknown>;
    updateLyrics(lyricsData: LyricLine[] | string): Promise<unknown>;
    updatePosition(position: number): Promise<unknown>;
    updateTrack(trackInfo: Track | null): Promise<unknown>;
    updateSettings(settings: DesktopLyricsSettings | MusicBoxSettings): Promise<Result>;
    setPosition(x: number, y: number): Promise<unknown>;
    setSize(width: number, height: number): Promise<unknown>;
    setOpacity(opacity: number): Promise<unknown>;
    setAlwaysOnTop(flag: boolean): Promise<unknown>;
    setIgnoreMouseEvents(ignore: boolean, options?: {forward?: boolean}): Promise<unknown>;
    getPosition(): Promise<[number, number]>;
    getSize(): Promise<[number, number]>;
    centerOnScreen(): Promise<unknown>;
    onPlaybackStateChanged(callback: (state: DesktopLyricsPlaybackState) => void): Unsubscribe;
    onLyricsUpdated(callback: (lyricsData: LyricLine[] | string) => void): Unsubscribe;
    onPositionChanged(callback: (position: number) => void): Unsubscribe;
    onTrackChanged(callback: (trackInfo: Track | null) => void): Unsubscribe;
    onSettingsChanged(callback: (settings: DesktopLyricsSettings) => void): Unsubscribe;
}

export interface EmbeddedLyricsData {
    text: string;
    type?: string;
    format?: string;
    language?: string;
    description?: string;
    synchronized?: boolean;
    timestamps?: Array<{
        time: number;
        text: string;
    }>;
    [key: string]: unknown;
}

export interface ElectronLyricsAPI {
    readLocalFile(filePath: string): Promise<{success: boolean; content?: string; error?: string}>;
    searchLocalFiles(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        extension: string
    ): Promise<{success: boolean; filePath?: string; fileName?: string; error?: string}>;
    saveToLocal(
        lyricsDir: string,
        title: string,
        artist: string,
        album: string,
        content: string,
        format: string
    ): Promise<{success: boolean; filePath?: string; fileName?: string; error?: string}>;
    getEmbedded(filePath: string): Promise<{success: boolean; lyrics?: EmbeddedLyricsData; source?: string; error?: string}>;
}

export interface ElectronCoversAPI {
    checkLocalCover(
        coverDir: string,
        title: string,
        artist: string,
        album: string,
        isAlbum?: boolean
    ): Promise<{success: boolean; filePath?: string; fileName?: string; error?: string}>;
    saveCoverFile(
        coverDir: string,
        fileName: string,
        imageData: unknown,
        dataType: string
    ): Promise<{success: boolean; filePath?: string; fileName?: string; error?: string}>;
    readCoverImage(filePath: string): Promise<{success: boolean; data?: number[]; mimeType?: string; error?: string}>;
}

export interface ElectronEqualizerPresetsAPI {
    exportPreset(
        defaultName: string,
        content: string
    ): Promise<{success: boolean; filePath?: string; cancelled?: boolean; error?: string}>;
    importPreset(): Promise<{success: boolean; filePath?: string; content?: string; cancelled?: boolean; error?: string}>;
}

export interface ElectronMediaAPI {
    readAudioFile(filePath: string): Promise<ArrayBuffer>;
    createAudioStreamUrl(filePath: string): Promise<string>;
    selectImageData(maxSizeBytes: number): Promise<{
        success: boolean;
        canceled?: boolean;
        fileName?: string;
        filePath?: string;
        data?: number[];
        mimeType?: string;
        error?: string;
    }>;
}

export type NetworkDriveProtocol = 'smb' | 'webdav' | string;

export interface NetworkDriveConfig {
    id: string;
    type: NetworkDriveProtocol;
    displayName: string;
    username: string;
    password: string;
    host?: string;
    share?: string;
    domain?: string;
    url?: string;
    [key: string]: unknown;
}

export interface MountedNetworkDrive {
    id: string;
    type: NetworkDriveProtocol;
    connected?: boolean;
    displayName?: string;
    host?: string;
    share?: string;
    config: NetworkDriveConfig;
    [key: string]: unknown;
}

export interface NetworkDriveDirectoryItem {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    [key: string]: unknown;
}

export interface NetworkDriveDirectoryResult {
    success: boolean;
    structure?: NetworkDriveDirectoryItem[];
    error?: string;
}

export interface NetworkDriveStatus {
    connected?: boolean;
    [key: string]: unknown;
}

export interface ElectronNetworkDriveAPI {
    testConnection(config: NetworkDriveConfig): Promise<boolean>;
    mountSMB(config: NetworkDriveConfig): Promise<boolean>;
    mountWebDAV(config: NetworkDriveConfig): Promise<boolean>;
    getMountedDrives(): Promise<MountedNetworkDrive[]>;
    getStatus(driveId: string): Promise<NetworkDriveStatus | null>;
    getDirectoryStructure(driveId: string, path: string): Promise<NetworkDriveDirectoryResult>;
    refreshConnection(driveId: string): Promise<boolean>;
    refreshConnections(): Promise<boolean>;
    unmount(driveId: string): Promise<boolean>;
    onConnected(callback: (event: unknown, driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe;
    onDisconnected(callback: (event: unknown, driveId: string, config: NetworkDriveConfig) => void | Promise<void>): Unsubscribe;
    onError(callback: (event: unknown, driveId: string, error: string) => void): Unsubscribe;
}

export interface ElectronWindowAPI {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
    isMaximized(): Promise<boolean>;
    close(): Promise<void>;
    getPosition(): Promise<[number, number]>;
    setPosition(x: number, y: number): Promise<Result>;
    getSize(): Promise<[number, number]>;
    setSize(width: number, height: number): Promise<Result>;
    getBounds(): Promise<WindowBounds>;
    setBounds(bounds: WindowBounds): Promise<Result<WindowBounds>>;
    setBackgroundThrottling(allowed: boolean): Promise<void>;
    onMaximizedChanged(callback: (isMaximized: boolean) => void): Unsubscribe;
    setAlwaysOnTop(flag: boolean): Promise<boolean>;
    isAlwaysOnTop(): Promise<boolean>;
    setResizable(resizable: boolean): Promise<boolean>;
    setMaximizable(maximizable: boolean): Promise<boolean>;
    setMaximumSize(width: number, height: number): Promise<boolean>;
    setMiniModeWindowState(options: {
        enabled: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): Promise<Result<{
        size?: number[];
        minimumSize?: number[];
        maximumSize?: number[];
    }>>;
    setSkipTaskbar(skip: boolean): Promise<boolean>;
    setMinimumSize(width: number, height: number): Promise<boolean>;
}

export interface ElectronGlobalShortcutsAPI {
    register(shortcuts: unknown): Promise<void>;
    unregister(): Promise<boolean>;
    setEnabled(enabled: boolean): Promise<unknown>;
    isEnabled(): Promise<boolean>;
    onTriggered(callback: (...args: unknown[]) => void): Unsubscribe;
}

export type ExtensionStorageScope = 'global' | 'workspace';

export interface ElectronExtensionsAPI {
    selectPackage(): Promise<string | null>;
    installFromFile(filePath: string): Promise<{success: boolean; extension: unknown; error?: string}>;
    uninstall(extensionId: string, keepData: boolean): Promise<{success: boolean; error?: string}>;
    enable(extensionId: string): Promise<{success: boolean; error?: string}>;
    disable(extensionId: string): Promise<{success: boolean; error?: string}>;
    getInstalled(): Promise<{success: boolean; extensions: unknown[]; error?: string}>;
    scanUserExtensions(): Promise<{success: boolean; extensions: unknown[]; error?: string}>;
    readExtensionFile(extensionId: string, filePath: string): Promise<{success: boolean; content: string; error?: string}>;
    storageGetState(
        extensionId: string,
        scope: ExtensionStorageScope
    ): Promise<{success: boolean; data: Record<string, unknown>; error?: string}>;
    storageUpdate(
        extensionId: string,
        scope: ExtensionStorageScope,
        key: string,
        value: unknown
    ): Promise<{success: boolean; error?: string}>;
}
