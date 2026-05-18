/**
 * 扩展系统的全局类型声明
 */

export interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
    enabled?: boolean;
    isBuiltin?: boolean;
    activationEvents?: string[];
    extensionLocation?: string;
    main?: string;
    contributes?: any;
    extensionDependencies?: string[];
    enabledByDefault?: boolean;
}

/**
 * MusicBoxApp 类型定义 - 应用主类
 */
export interface MusicBoxApp {
    isInitialized: boolean;
    currentView: string;
    library: any[];
    filteredLibrary: any[];
    components: {
        navigation?: {
            navigateToView(viewId: string): void;
            [key: string]: any;
        };
        [key: string]: any;
    };

    // EventEmitter 方法
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    once(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(event?: string): void;

    // 应用方法
    loadAndPlayFile?(filePath: string): Promise<void>;
    [key: string]: any;
}

/**
 * Recommended app-ready host for extensions. Legacy appReady.detail.app and
 * appReady.detail.components are still emitted for older plugins.
 */
export interface MusicBoxPluginHost {
    readonly isInitialized: boolean;
    getCurrentView(): string;
    navigateToView(viewId: string): void;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    removeAllListeners(event?: string): void;
}

/**
 * MusicBoxAPI 类型定义 - 播放器 API
 */
export interface MusicBoxAPI {
    isInitialized: boolean;
    currentTrack: any | null;
    isPlaying: boolean;
    volume: number;
    position: number;
    duration: number;
    playlist: any[];
    currentIndex: number;
    playMode: string;

    // EventEmitter 方法
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;

    // 播放控制
    play(): Promise<boolean>;
    pause(): Promise<boolean>;
    stop(): Promise<boolean>;
    nextTrack(): Promise<boolean>;
    previousTrack(): Promise<boolean>;
    seek(time: number): Promise<boolean>;
    setVolume(volume: number): Promise<boolean>;
    setPlaylist(tracks: any[], startIndex?: number): Promise<boolean>;
    setPlayMode(mode: string): void;

    // 状态获取
    getCurrentTrack?(): any | null;
    getPosition?(): Promise<number>;
    getDuration?(): number;

    [key: string]: any;
}

export {};
