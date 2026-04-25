import {api} from "@api/api";
import {shortcutRecorder} from "@utils/shortcuts/ShortcutRecorder";
import {shortcutConfig} from "@utils/shortcuts/ShortcutConfig";
import type {RendererAppContext} from '@core/types/app';

interface ShortcutControllerOptions {
    app: RendererAppContext;
}

interface ShortcutDefinition {
    id: string;
    name: string;
    key: string;
    enabled?: boolean;
}

type ShortcutMap = Record<string, ShortcutDefinition>;

export class ShortcutController {
    private readonly app: RendererAppContext;

    constructor({app}: ShortcutControllerOptions) {
        this.app = app;
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

    getActivePlayer(): any | null {
        const components = this.app.components;

        if (components.lyrics && components.lyrics.isVisible) {
            return components.lyrics;
        }

        if (components.player) {
            return components.player;
        }

        console.warn('⚠️ 未找到任何播放器组件');
        return null;
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

    async executeShortcutAction(shortcutId: string): Promise<void> {
        const components = this.app.components;

        switch (shortcutId) {
            case 'playPause': {
                const player = this.getActivePlayer();
                if (player && typeof player.togglePlayPause === 'function') {
                    await player.togglePlayPause();
                } else {
                    console.warn('⚠️ 未找到活跃的播放器组件');
                }
                break;
            }

            case 'previousTrack':
                await api.previousTrack();
                break;

            case 'nextTrack':
                await api.nextTrack();
                break;

            case 'volumeUp': {
                const currentVolume = api.getVolume();
                await api.setVolume(Math.min(1, currentVolume + 0.01));
                break;
            }

            case 'volumeDown': {
                const volume = api.getVolume();
                await api.setVolume(Math.max(0, volume - 0.01));
                break;
            }

            case 'search':
                document.getElementById('search-input')?.focus();
                break;

            case 'seekForward':
                await api.seekForward(3);
                break;

            case 'seekBackward':
                await api.seekBackward(3);
                break;

            case 'toggleLyrics':
                if (components.lyrics) {
                    if (components.lyrics.isVisible) {
                        components.lyrics.hide();
                    } else {
                        const currentTrack = api.currentTrack;
                        if (currentTrack) {
                            await components.lyrics.show(currentTrack);
                        }
                    }
                }
                break;

            case 'exitLyrics':
                if (components.lyrics && components.lyrics.isVisible) {
                    if (components.lyrics.isFullscreen) {
                        components.lyrics.exitFullscreen();
                    } else {
                        components.lyrics.hide();
                    }
                }
                break;

            case 'toggleFullscreen':
                if (components.lyrics && components.lyrics.isVisible) {
                    components.lyrics.toggleFullscreen();
                }
                break;

            default:
                console.warn(`未知的快捷键操作: ${shortcutId}`);
        }
    }

    async handleSystemShortcuts(e: KeyboardEvent): Promise<void> {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'o':
                    e.preventDefault();
                    await this.app.addMusicFiles();
                    break;
                case 'O':
                    e.preventDefault();
                    await this.app.openDirectoryDialog();
                    break;
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
