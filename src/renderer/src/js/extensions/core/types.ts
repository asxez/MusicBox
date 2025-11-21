/**
 * 扩展系统的全局类型声明
 */

export interface IPCResult {
    success: boolean;
    error?: string;
    extensions?: ExtensionInfo[];
    extension?: ExtensionInfo;
}

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

declare global {
    interface Window {
        electronAPI: {
            extensions: {
                getInstalled(): Promise<IPCResult>;
                installFromFile(filePath: string): Promise<IPCResult>;
                uninstall(extensionId: string, keepData: boolean): Promise<IPCResult>;
                enable(extensionId: string): Promise<IPCResult>;
                disable(extensionId: string): Promise<IPCResult>;
                readExtensionFile(extensionId: string, filePath: string): Promise<IPCResult & { content?: string }>;
            };
            globalShortcuts: {
                register(shortcuts: Record<string, any>): Promise<void>;
                unregister(keybinding: string): Promise<void>;
            };

            // 系统 API
            getVersion(): Promise<string>;
            getPlatform(): Promise<string>;
            getAppPath(): Promise<string>;
            getUserDataPath(): Promise<string>;
            getTempPath(): Promise<string>;
            openExternal(url: string): Promise<void>;
            openPath(path: string): Promise<void>;

            // 窗口 API
            window: {
                maximize(): Promise<void>;
                minimize(): Promise<void>;
                close(): Promise<void>;
                isMaximized(): Promise<boolean>;
                getPosition(): Promise<[number, number]>;
                getSize(): Promise<[number, number]>;
                setSize(width: number, height: number): Promise<void>;
                onMaximizedChanged(callback: (isMaximized: boolean) => void): Promise<void>;
            };
        };
        createExtensionAPI?: (extensionId: string, context: any) => any;
    }
}

export {};
