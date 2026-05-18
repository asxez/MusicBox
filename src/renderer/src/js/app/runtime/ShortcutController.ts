import {shortcutRecorder} from "@utils/shortcuts/ShortcutRecorder";
import {shortcutConfig} from "@utils/shortcuts/ShortcutConfig";
import type {Track} from "@api/types/track";
import type {PlayerLike} from './AppRuntimeTypes';

interface ShortcutControllerOptions {
    app: ShortcutHost;
    integrations: ShortcutIntegrations;
    ui: ShortcutUI;
}

interface ShortcutDefinition {
    id: string;
    name: string;
    key: string;
    enabled?: boolean;
}

type ShortcutMap = Record<string, ShortcutDefinition>;

interface ShortcutHost {
    addManagedEventListener(
        element: EventTarget,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void;
    openDirectoryDialog(): Promise<void>;
    addMusicFiles(): Promise<void>;
}

interface ShortcutUI {
    getActivePlayer(): PlayerLike | null;
    focusSearchInput(): void;
    toggleLyricsPanel(track: Track | null): Promise<void>;
    exitLyricsPanel(): void;
    toggleLyricsFullscreen(): void;
}

interface ShortcutIntegrations {
    toggleCurrentPlayback(): Promise<boolean>;
    previousTrack(): Promise<boolean>;
    nextTrack(): Promise<boolean>;
    adjustVolume(delta: number): Promise<boolean>;
    seekForward(seconds: number): Promise<boolean>;
    seekBackward(seconds: number): Promise<boolean>;
    getCurrentTrackSnapshot(): Track | null;
}

export class ShortcutController {
    private readonly app: ShortcutHost;
    private readonly integrations: ShortcutIntegrations;
    private readonly ui: ShortcutUI;

    constructor({app, integrations, ui}: ShortcutControllerOptions) {
        this.app = app;
        this.integrations = integrations;
        this.ui = ui;
    }

    initKeyboardShortcuts(): void {
        let lastKeyTime = 0;
        const debounceDelay = 200;

        this.app.addManagedEventListener(document, 'keydown', async (event) => {
            const e = event as KeyboardEvent;
            const target = e.target as HTMLElement | null;
            if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
                return;
            }

            if (shortcutRecorder && shortcutRecorder.isRecording) {
                return;
            }

            const currentTime = Date.now();
            const pressedKey = this.generateKeyString(e);
            const shortcuts = this.getEnabledShortcuts();
            const matchedShortcut = this.findMatchingShortcut(pressedKey, shortcuts);

            if (matchedShortcut) {
                if (matchedShortcut.id === 'playPause') {
                    if (currentTime - lastKeyTime < debounceDelay) {
                        console.log('🚫 快捷键防抖：忽略重复的播放/暂停快捷键');
                        return;
                    }
                    lastKeyTime = currentTime;
                }

                e.preventDefault();
                e.stopPropagation();
                console.log(`⌨️ 统一快捷键管理器：处理快捷键 ${matchedShortcut.name} (${pressedKey})`);

                await this.executeShortcutAction(matchedShortcut.id);
                return;
            }

            await this.handleSystemShortcuts(e);
        });
    }

    generateKeyString(event: KeyboardEvent): string {
        const keys: string[] = [];

        if (event.ctrlKey) keys.push('Ctrl');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        if (event.metaKey) keys.push('Cmd');

        const mainKey = this.normalizeKey(event);
        if (mainKey) keys.push(mainKey);
        return keys.join('+');
    }

    normalizeKey(event: KeyboardEvent): string | null {
        const key = event.key;

        if (key === ' ') return 'Space';
        if (key === 'Escape') return 'Escape';
        if (key === 'Enter') return 'Enter';
        if (key === 'Tab') return 'Tab';
        if (key === 'Backspace') return 'Backspace';
        if (key === 'Delete') return 'Delete';

        if (key === 'ArrowUp') return 'ArrowUp';
        if (key === 'ArrowDown') return 'ArrowDown';
        if (key === 'ArrowLeft') return 'ArrowLeft';
        if (key === 'ArrowRight') return 'ArrowRight';

        if (key.startsWith('F') && key.length <= 3) return key;

        if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
            return key.toUpperCase();
        }

        return null;
    }

    getEnabledShortcuts(): ShortcutMap {
        return shortcutConfig.getEnabledLocalShortcuts() as ShortcutMap;
    }

    findMatchingShortcut(pressedKey: string, shortcuts: ShortcutMap): ShortcutDefinition | null {
        for (const [_id, shortcut] of Object.entries(shortcuts)) {
            if (shortcut.key === pressedKey) {
                return shortcut;
            }
        }
        return null;
    }

    getActivePlayer(): PlayerLike | null {
        return this.ui.getActivePlayer();
    }

    async executeShortcutAction(shortcutId: string): Promise<void> {
        switch (shortcutId) {
            case 'playPause': {
                await this.integrations.toggleCurrentPlayback();
                break;
            }

            case 'previousTrack':
                await this.integrations.previousTrack();
                break;

            case 'nextTrack':
                await this.integrations.nextTrack();
                break;

            case 'volumeUp': {
                await this.integrations.adjustVolume(0.01);
                break;
            }

            case 'volumeDown': {
                await this.integrations.adjustVolume(-0.01);
                break;
            }

            case 'search':
                this.ui.focusSearchInput();
                break;

            case 'seekForward':
                await this.integrations.seekForward(3);
                break;

            case 'seekBackward':
                await this.integrations.seekBackward(3);
                break;

            case 'toggleLyrics':
                await this.ui.toggleLyricsPanel(this.integrations.getCurrentTrackSnapshot());
                break;

            case 'exitLyrics':
                this.ui.exitLyricsPanel();
                break;

            case 'toggleFullscreen':
                this.ui.toggleLyricsFullscreen();
                break;

            default:
                console.warn(`未知的快捷键操作: ${shortcutId}`);
        }
    }

    async handleSystemShortcuts(e: KeyboardEvent): Promise<void> {
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'o') {
                e.preventDefault();
                if (e.shiftKey) {
                    await this.app.openDirectoryDialog();
                } else {
                    await this.app.addMusicFiles();
                }
            }
        }
    }

    async initGlobalShortcuts(): Promise<void> {
        await shortcutConfig.initializeGlobalShortcuts();

        this.app.addManagedEventListener(window, 'globalShortcutTriggered', (event) => {
            const {shortcutId} = (event as CustomEvent<{shortcutId: string}>).detail;
            this.executeShortcutAction(shortcutId);
        });
    }
}
