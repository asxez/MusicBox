// 全局快捷键控制器

import {app, globalShortcut} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';

interface ShortcutConfig {
    name: string;
    key: string;
    enabled: boolean;
}

function convertToElectronShortcut(key: string): string {
    return key
        .replace(/Ctrl/g, 'CommandOrControl')
        .replace(/Cmd/g, 'Command')
        .replace(/ArrowUp/g, 'Up')
        .replace(/ArrowDown/g, 'Down')
        .replace(/ArrowLeft/g, 'Left')
        .replace(/ArrowRight/g, 'Right')
        .replace(/Space/g, 'Space');
}

@Controller('globalShortcuts')
export class GlobalShortcutsController extends BaseController {
    private enabled = false;
    private registered = new Map<string, string>(); // id -> electronKey
    private willQuitBound = false;

    constructor(private windowManager: WindowManager) {
        super();
    }

    override register(): void {
        super.register();
        if (!this.willQuitBound) {
            this.willQuitBound = true;
            app.on('will-quit', () => this.unregisterAll());
        }
    }

    private unregisterAll(quiet = false): void {
        if (!quiet) console.log('🎹 取消注册所有全局快捷键');
        globalShortcut.unregisterAll();
        this.registered.clear();
    }

    @IpcHandle('globalShortcuts:register')
    registerShortcuts(shortcuts: Record<string, ShortcutConfig>): boolean {
        try {
            this.unregisterAll(true);
            if (!shortcuts || typeof shortcuts !== 'object') return false;

            for (const [id, shortcut] of Object.entries(shortcuts)) {
                if (!shortcut.enabled || !shortcut.key) continue;
                const electronKey = convertToElectronShortcut(shortcut.key);
                try {
                    let registered = false;
                    globalShortcut.register(electronKey, () => {
                        console.log(`🎹 全局快捷键触发: ${shortcut.name} (${electronKey})`);
                        this.windowManager.sendToMainWindow('global-shortcut-triggered', id);
                    });
                    registered = globalShortcut.isRegistered(electronKey);
                    if (registered) this.registered.set(id, electronKey);
                    else console.warn(`⚠️ 快捷键注册失败: ${shortcut.name} (${electronKey})`);
                } catch (error) {
                    console.error(`❌ 注册快捷键失败: ${shortcut.name}`, error);
                }
            }
            return true;
        } catch (error) {
            console.error('❌ 注册全局快捷键失败:', error);
            return false;
        }
    }

    @IpcHandle('globalShortcuts:unregister')
    unregisterAll2(): boolean {
        try {
            this.unregisterAll();
            return true;
        } catch (error) {
            console.error('❌ 取消注册全局快捷键失败:', error);
            return false;
        }
    }

    @IpcHandle('globalShortcuts:setEnabled')
    setEnabled(enabled: boolean): boolean {
        try {
            this.enabled = enabled;
            if (!enabled) this.unregisterAll();
            return true;
        } catch (error) {
            console.error('❌ 设置全局快捷键状态失败:', error);
            return false;
        }
    }

    @IpcHandle('globalShortcuts:isEnabled')
    isEnabled(): boolean {
        return this.enabled;
    }
}
