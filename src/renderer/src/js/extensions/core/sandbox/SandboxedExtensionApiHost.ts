import {createExtensionAPI, type ExtensionAPI} from '@extensions/api';
import {DisposableStore, IDisposable, toDisposable} from '@extensions/core/Lifecycle';
import type {PermissionManager} from '@extensions/core/ExtensionPermissions';
import type {ExtensionContext} from '@extensions/core/ExtensionActivator';
import {
    isSerializedCallback,
    SerializedDisposable
} from './SandboxTypes';

interface SandboxedApiHostOptions {
    extensionId: string;
    context: ExtensionContext;
    permissionManager: PermissionManager | null;

    invokeRemoteCallback(callbackId: string, args: unknown[]): Promise<unknown>;
}

type Callable = (...args: unknown[]) => unknown;

const EXTERNAL_PLUGIN_BLOCKED_API = new Set<string>([
    'ui.registerSettingsPage',
    'ui.createStatusBarItem',
    'ui.showDialog',
    'ui.createWebviewPanel',
    'ui.createToggleSetting',
    'ui.createSelectSetting',
    'ui.createInputSetting',
    'ui.createColorPickerSetting',
    'ui.createButtonSetting',
    'tasks.createTask',
    'diagnostics.createDiagnosticCollection'
]);

const EXTERNAL_PLUGIN_ALLOWED_API = new Set<string>([
    'storage.get',
    'storage.update',
    'storage.delete',
    'storage.keys',
    'storage.getWorkspace',
    'storage.updateWorkspace',
    'storage.deleteWorkspace',
    'storage.workspaceKeys',
    'commands.registerCommand',
    'commands.executeCommand',
    'commands.getCommands',
    'commands.hasCommand',
    'commands.enableCommand',
    'commands.disableCommand',
    'commands.getCommandInfo',
    'events.on',
    'events.once',
    'events.emit',
    'events.off',
    'events.removeAllListeners',
    'player.play',
    'player.playTrack',
    'player.pause',
    'player.stop',
    'player.nextTrack',
    'player.previousTrack',
    'player.setVolume',
    'player.getVolume',
    'player.getState',
    'player.getCurrentTrack',
    'player.seek',
    'player.getPosition',
    'player.getDuration',
    'player.setPlaylist',
    'player.getPlaylist',
    'player.setPlayMode',
    'player.getPlayMode',
    'player.onTrackChanged',
    'player.onPlaybackStateChanged',
    'library.getAllTracks',
    'library.getTrackById',
    'library.searchTracks',
    'library.addTrack',
    'library.removeTrack',
    'library.updateTrack',
    'library.getAlbums',
    'library.getAlbumByName',
    'library.getArtists',
    'library.getArtistByName',
    'library.getPlaylists',
    'library.getPlaylistById',
    'library.createPlaylist',
    'library.updatePlaylist',
    'library.deletePlaylist',
    'settings.get',
    'settings.set',
    'settings.delete',
    'settings.has',
    'settings.keys',
    'settings.onDidChange',
    'navigation.navigateToView',
    'navigation.goBack',
    'navigation.goForward',
    'navigation.getCurrentView',
    'network.get',
    'network.post',
    'network.put',
    'network.delete',
    'system.getVersion',
    'system.getPlatform',
    'system.getOS',
    'system.getAppPath',
    'system.getUserDataPath',
    'system.getTempPath',
    'system.getLanguage',
    'system.getEnv',
    'system.showItemInFolder',
    'system.getClipboardText',
    'system.setClipboardText',
    'window.maximize',
    'window.minimize',
    'window.close',
    'window.isMaximized',
    'window.getPosition',
    'window.getSize',
    'window.setSize',
    'window.onMaximizedChanged',
    'keybindings.registerKeybinding',
    'keybindings.registerGlobalKeybinding',
    'keybindings.unregisterKeybinding',
    'keybindings.getKeybindings',
    'keybindings.hasKeybinding',
    'keybindings.getKeybindingInfo',
    'keybindings.triggerKeybinding',
    'ui.showNotification',
    'ui.showInformationMessage',
    'ui.showSuccessMessage',
    'ui.showWarningMessage',
    'ui.showErrorMessage',
    'ui.showConfirmDialog',
    'ui.showInputBox',
    'ui.getCurrentTheme',
    'ui.setTheme',
    'ui.toggleTheme',
    'ui.onThemeChanged',
    'ui.setCSSVariable',
    'ui.getCSSVariable',
    'ui.registerSettingsSection',
    'ui.registerSettingsPageSchema',
    'ui.registerFloatingPanel'
]);

export class SandboxedExtensionApiHost {
    private readonly api: ExtensionAPI;
    private readonly disposables = new Map<string, IDisposable>();
    private disposableIdSeed = 0;

    constructor(private readonly options: SandboxedApiHostOptions) {
        this.api = createExtensionAPI(options.context, {
            permissionManager: options.permissionManager,
            enableProxy: !!options.permissionManager,
            enableLogging: false
        });
    }

    async call(apiPath: string, args: unknown[]): Promise<unknown> {
        if (EXTERNAL_PLUGIN_BLOCKED_API.has(apiPath)) {
            throw new Error(`外部插件暂不支持 ${apiPath}，请使用显式 contribution 协议`);
        }

        if (apiPath === 'sandbox.dispose') {
            await this.disposeById(String(args[0]));
            return undefined;
        }

        if (!EXTERNAL_PLUGIN_ALLOWED_API.has(apiPath)) {
            throw new Error(`外部插件不能调用未授权 API: ${apiPath}`);
        }

        const fn = this.resolveApiFunction(apiPath);
        const deserializedArgs = args.map(arg => this.deserializeHostArgument(arg));
        const value = await fn(...deserializedArgs);
        return this.serializeHostReturnValue(value);
    }

    disposeAll(): void {
        for (const disposable of this.disposables.values()) {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn(`⚠️ SandboxedExtensionApiHost: 释放 ${this.options.extensionId} 资源失败`, error);
            }
        }

        this.disposables.clear();
    }

    private async disposeById(disposableId: string): Promise<void> {
        const disposable = this.disposables.get(disposableId);
        if (!disposable) {
            return;
        }

        this.disposables.delete(disposableId);
        await Promise.resolve(disposable.dispose());
    }

    private resolveApiFunction(apiPath: string): Callable {
        const parts = apiPath.split('.');
        if (!parts.every(part => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(part))) {
            throw new Error(`Invalid extension API path: ${apiPath}`);
        }

        let target: unknown = this.api;

        for (const part of parts) {
            if (!target || typeof target !== 'object' || !Object.prototype.hasOwnProperty.call(target, part)) {
                throw new Error(`Unknown extension API: ${apiPath}`);
            }

            target = (target as Record<string, unknown>)[part];
        }

        if (typeof target !== 'function') {
            throw new Error(`Extension API is not callable: ${apiPath}`);
        }

        const parent = this.resolveApiParent(parts);
        return (...args: unknown[]) => (target as Callable).apply(parent, args);
    }

    private resolveApiParent(parts: string[]): unknown {
        let target: unknown = this.api;

        for (const part of parts.slice(0, -1)) {
            if (!target || typeof target !== 'object' || !Object.prototype.hasOwnProperty.call(target, part)) {
                throw new Error(`Unknown extension API parent: ${parts.join('.')}`);
            }

            target = (target as Record<string, unknown>)[part];
        }

        return target;
    }

    private deserializeHostArgument(value: unknown): unknown {
        if (isSerializedCallback(value)) {
            return (...args: unknown[]) => this.options.invokeRemoteCallback(value.callbackId, args);
        }

        if (Array.isArray(value)) {
            return value.map(item => this.deserializeHostArgument(item));
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            result[key] = this.deserializeHostArgument(entry);
        }

        return result;
    }

    private serializeHostReturnValue(value: unknown): unknown {
        if (this.isDisposable(value)) {
            return this.storeDisposable(value);
        }

        if (Array.isArray(value)) {
            return value.map(item => this.serializeHostReturnValue(item));
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        if (value instanceof DisposableStore) {
            return this.storeDisposable(value);
        }

        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            if (typeof entry !== 'function') {
                result[key] = this.serializeHostReturnValue(entry);
            }
        }

        return result;
    }

    private storeDisposable(disposable: IDisposable | (() => void)): SerializedDisposable {
        const disposableId = `disposable_${Date.now()}_${++this.disposableIdSeed}`;
        const normalized = typeof disposable === 'function' ? toDisposable(disposable) : disposable;
        this.disposables.set(disposableId, normalized);
        return {
            __musicboxType: 'disposable',
            disposableId
        };
    }

    private isDisposable(value: unknown): value is IDisposable {
        return !!value && typeof value === 'object' && typeof (value as Partial<IDisposable>).dispose === 'function';
    }
}
