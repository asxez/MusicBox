import {ExtensionInfo} from "@extensions/core/types";


export interface IPCResult {
    success: boolean;
    error?: string;
    extensions?: ExtensionInfo[];
    extension?: ExtensionInfo;
}

declare global {
    interface Window {
        electronAPI: {
            dialog: {
                showOpenDialog(options: object): Promise<IPCResult>;
                saveFile(options: object): Promise<IPCResult>;
                openFile(options: object): Promise<IPCResult>;
            };

            fs: {
                fs: any;
                stat(filePath: string): Promise<IPCResult>;
                readFile(filePath: string, encoding: string): Promise<IPCResult>;
                writeFile(filePath: string, data: string, encoding: string): Promise<boolean>;
            };

            os: any;
            path: any;
            httpServer: {};
            audio: {};
            nativeAudio: {};
            library: {};
            settings: {};
            hardwareAcceleration: {};
            app: {};
            networkDrive: {};
            lyrics: {};
            covers: {};
            globalShortcuts: {
                register(shortcuts: Record<string, any>): Promise<void>;
                unregister(keybinding: string): Promise<void>;
            };

            // 窗口 API
            window: {
                maximize(): Promise<void>;
                minimize(): Promise<void>;
                close(): Promise<void>;
                isMaximized(): Promise<boolean>;
                getPosition(): Promise<[number, number]>;
                getSize(): Promise<[number, number]>;
                setSize(width: number, height: number): Promise<void>;
                setBackgroundThrottling(allowed: boolean): Promise<void>;
                onMaximizedChanged(callback: (isMaximized: boolean) => void): Promise<void>;
            };

            desktopLyrics: {};
            tray: {};
            memory: {};
            extensions: {
                getInstalled(): Promise<IPCResult>;
                installFromFile(filePath: string): Promise<IPCResult>;
                uninstall(extensionId: string, keepData: boolean): Promise<IPCResult>;
                enable(extensionId: string): Promise<IPCResult>;
                disable(extensionId: string): Promise<IPCResult>;
                readExtensionFile(extensionId: string, filePath: string): Promise<IPCResult & { content?: string }>;
            };

            userdata: {};

            // 系统 API
            getVersion(): Promise<string>;
            getPlatform(): Promise<string>;
            getUserDataPath(): Promise<string>;
            getAppPath(): Promise<string>;
            getTempPath(): Promise<string>;
            openUserDataFolder(): Promise<void>;
            getDefaultCoverCachePath(): Promise<string>;
            ensureDirectoryExists(dirPath: string): Promise<boolean>;
            openDevTools(): Promise<void>;
            openPath(path: string): Promise<void>;
            openExternal(url: string): Promise<void>;

            // 文件对话框
            openDirectory(): Promise<IPCResult>;
            selectFolder(): Promise<IPCResult>;
            openFiles(): Promise<IPCResult>;
            openImageFile(): Promise<IPCResult>;

            // 音乐文件操作
            readAudioFile(filePath: string): Promise<IPCResult>;

            // Native音频引擎事件监听
            onNativeAudioEvent(eventName: string, callback: () => {}): void;
        };
        createExtensionAPI?: (extensionId: string, context: any) => any;
    }
}
