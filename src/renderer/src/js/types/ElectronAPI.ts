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
            fs: {};
            audio: {};
            path: {};
            library: {};
            desktopLyrics: {};
            lyrics: {};
        };
        createExtensionAPI?: (extensionId: string, context: any) => any;
    }
}
