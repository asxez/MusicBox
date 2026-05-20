/**
 * Keybindings API - 快捷键 API
 * 提供快捷键注册、管理、执行等功能
 */

import {extensionsController} from '@/features/extensions';
import {Validator} from '@extensions/api/common/validation';
import {ErrorUtils, NotFoundError} from '@extensions/api/common/errors';
import {ExtensionContext, IDisposable, toDisposable} from '@extensions/core';
import {extensionHostService} from "@/features/extensions/service";
import {shortcutConfig} from "@utils/shortcuts/ShortcutConfig";
import '@extensions/core/types';
import {
    GlobalShortcutConfig,
    KeybindingInfo,
    KeybindingOptions,
    KeybindingsAPI,
    KeybindingScopeType,
    PublicKeybindingInfo
} from "@extensions/api/types/keybindings";

/**
 * 快捷键作用域枚举
 */
export const KeybindingScope = {
    /** 局部快捷键（仅在应用窗口激活时生效） */
    LOCAL: 'local',
    /** 全局快捷键（系统级，即使应用未激活也生效） */
    GLOBAL: 'global'
} as const;


/**
 * 快捷键上下文条件枚举
 */
export const KeybindingWhen = {
    /** 总是生效 */
    ALWAYS: 'always',
    /** 播放器正在播放时 */
    PLAYER_PLAYING: 'playerPlaying',
    /** 播放器暂停时 */
    PLAYER_PAUSED: 'playerPaused',
    /** 有歌曲加载时 */
    TRACK_LOADED: 'trackLoaded',
    /** 搜索框获得焦点时 */
    SEARCH_FOCUSED: 'searchFocused',
    /** 歌词页面显示时 */
    LYRICS_VISIBLE: 'lyricsVisible'
} as const;

/**
 * 全局快捷键注册表（局部快捷键）
 */
const localKeybindingsRegistry = new Map<string, KeybindingInfo>();

/**
 * 全局快捷键注册表（全局快捷键）
 */
const globalKeybindingsRegistry = new Map<string, KeybindingInfo>();

/**
 * 插件全局快捷键配置映射 (用于与系统快捷键合并)
 * Map<shortcutId, {id, name, description, key, enabled}>
 */
const extensionGlobalShortcutsConfig = new Map<string, GlobalShortcutConfig>();

/**
 * 快捷键监听器
 */
let keybindingListener: ((e: KeyboardEvent) => void) | null = null;

/**
 * 快捷键验证模式
 */
const KEYBINDING_PATTERN = /^(Ctrl\+|Alt\+|Shift\+|Meta\+|Cmd\+)*([\w\d]+|F\d+|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete)$/i;

/**
 * 创建快捷键 API
 * @param context - 扩展上下文
 * @returns 快捷键 API 实例
 */
export function createKeybindingsAPI(context: ExtensionContext): KeybindingsAPI {
    return {
        async registerKeybinding(
            keybinding: string,
            callback: () => void | Promise<void>,
            options: KeybindingOptions = {}
        ): Promise<IDisposable> {
            return registerKeybindingInternal(
                keybinding,
                callback,
                KeybindingScope.LOCAL,
                context,
                options
            )
        },

        async registerGlobalKeybinding(
            keybinding: string,
            callback: () => void | Promise<void>,
            options: KeybindingOptions = {}
        ): Promise<IDisposable> {
            return registerKeybindingInternal(
                keybinding,
                callback,
                KeybindingScope.GLOBAL,
                context,
                options
            )
        },

        async unregisterKeybinding(
            keybinding: string,
            scope: KeybindingScopeType = KeybindingScope.LOCAL
        ): Promise<void> {
            Validator.assertNonEmptyString(keybinding, 'keybinding');
            Validator.assertEnum(scope, Object.values(KeybindingScope), 'scope');

            return await ErrorUtils.wrapAsync(async () => {
                const registry = scope === KeybindingScope.GLOBAL
                    ? globalKeybindingsRegistry
                    : localKeybindingsRegistry;

                const normalizedKey = normalizeKeybinding(keybinding);
                const keybindingInfo = registry.get(normalizedKey);

                if (keybindingInfo) {
                    registry.delete(normalizedKey);
                    console.log(`🗑️ 快捷键已注销: ${keybinding} (${scope})`);

                    // 如果是全局快捷键，通知主进程注销
                    if (scope === KeybindingScope.GLOBAL) {
                        const shortcutId = Array.from(extensionGlobalShortcutsConfig.entries())
                            .find(([_id, config]) => config.key === normalizedKey)?.[0];

                        if (shortcutId) {
                            extensionGlobalShortcutsConfig.delete(shortcutId);
                        }

                        if (keybindingInfo.globalEventHandler) {
                            window.removeEventListener('globalShortcutTriggered', keybindingInfo.globalEventHandler as EventListener);
                        }
                        await syncGlobalShortcuts();
                    } else {
                        disposeLocalKeybindingListenerIfUnused();
                    }
                }
            }, 'keybindings.unregisterKeybinding');
        },

        getKeybindings(scope?: KeybindingScopeType): PublicKeybindingInfo[] {
            if (scope !== undefined) {
                Validator.assertEnum(scope, Object.values(KeybindingScope), 'scope');
            }

            return ErrorUtils.wrapSync(() => {
                const result: PublicKeybindingInfo[] = [];

                if (!scope || scope === KeybindingScope.LOCAL) {
                    localKeybindingsRegistry.forEach((info, key) => {
                        result.push({
                            keybinding: key,
                            scope: KeybindingScope.LOCAL,
                            commandId: info.commandId,
                            description: info.description,
                            when: info.when,
                            extensionId: info.extensionId
                        });
                    });
                }

                if (!scope || scope === KeybindingScope.GLOBAL) {
                    globalKeybindingsRegistry.forEach((info, key) => {
                        result.push({
                            keybinding: key,
                            scope: KeybindingScope.GLOBAL,
                            commandId: info.commandId,
                            description: info.description,
                            extensionId: info.extensionId
                        });
                    });
                }

                return result;
            }, 'keybindings.getKeybindings');
        },

        hasKeybinding(keybinding: string, scope: KeybindingScopeType = KeybindingScope.LOCAL): boolean {
            Validator.assertNonEmptyString(keybinding, 'keybinding');
            Validator.assertEnum(scope, Object.values(KeybindingScope), 'scope');

            return ErrorUtils.wrapSync(() => {
                const registry = scope === KeybindingScope.GLOBAL
                    ? globalKeybindingsRegistry
                    : localKeybindingsRegistry;

                const normalizedKey = normalizeKeybinding(keybinding);
                return registry.has(normalizedKey);
            }, 'keybindings.hasKeybinding');
        },

        getKeybindingInfo(keybinding: string, scope: KeybindingScopeType = KeybindingScope.LOCAL): PublicKeybindingInfo | null {
            Validator.assertNonEmptyString(keybinding, 'keybinding');
            Validator.assertEnum(scope, Object.values(KeybindingScope), 'scope');

            return ErrorUtils.wrapSync(() => {
                const registry = scope === KeybindingScope.GLOBAL
                    ? globalKeybindingsRegistry
                    : localKeybindingsRegistry;

                const normalizedKey = normalizeKeybinding(keybinding);
                const info = registry.get(normalizedKey);

                if (info) {
                    return {
                        keybinding: normalizedKey,
                        scope,
                        commandId: info.commandId,
                        description: info.description,
                        when: info.when,
                        extensionId: info.extensionId
                    };
                }

                return null;
            }, 'keybindings.getKeybindingInfo');
        },

        async triggerKeybinding(keybinding: string, scope: KeybindingScopeType = KeybindingScope.LOCAL): Promise<any> {
            Validator.assertNonEmptyString(keybinding, 'keybinding');
            Validator.assertEnum(scope, Object.values(KeybindingScope), 'scope');

            return ErrorUtils.wrapAsync(async () => {
                const registry = scope === KeybindingScope.GLOBAL
                    ? globalKeybindingsRegistry
                    : localKeybindingsRegistry;

                const normalizedKey = normalizeKeybinding(keybinding);
                const keybindingInfo = registry.get(normalizedKey);

                if (!keybindingInfo) {
                    throw new NotFoundError('快捷键', keybinding);
                }

                console.log(`🎯 触发快捷键: ${keybinding} (${scope})`);

                try {
                    const result = await keybindingInfo.callback();
                    console.log(`✅ 快捷键执行成功: ${keybinding}`);
                    return result;
                } catch (error) {
                    console.error(`❌ 快捷键执行失败: ${keybinding}`, error);
                    throw error;
                }
            }, 'keybindings.triggerKeybinding');
        }
    };
}

/**
 * 内部注册快捷键函数
 * @param keybinding - 快捷键组合
 * @param callback - 回调函数
 * @param scope - 作用域
 * @param context - 扩展上下文
 * @param options - 选项
 * @returns 可释放对象
 */
async function registerKeybindingInternal(
    keybinding: string,
    callback: () => void | Promise<void>,
    scope: KeybindingScopeType,
    context: ExtensionContext,
    options: KeybindingOptions = {}
): Promise<IDisposable> {
    Validator.assertNonEmptyString(keybinding, 'keybinding');
    Validator.assertFunction(callback, 'callback');
    Validator.assertObject(options, 'options');

    return await ErrorUtils.wrapAsync(async () => {
        // 验证快捷键格式
        const normalizedKey = normalizeKeybinding(keybinding);
        if (!KEYBINDING_PATTERN.test(normalizedKey)) {
            throw new Error(`无效的快捷键格式: ${keybinding}`);
        }

        const registry = scope === KeybindingScope.GLOBAL
            ? globalKeybindingsRegistry
            : localKeybindingsRegistry;

        // 检查是否已注册
        if (registry.has(normalizedKey)) {
            console.warn(`⚠️ 快捷键 ${normalizedKey} 已注册，将被覆盖`);
            const existingKeybindingInfo = registry.get(normalizedKey);
            if (existingKeybindingInfo?.globalEventHandler) {
                window.removeEventListener('globalShortcutTriggered', existingKeybindingInfo.globalEventHandler as EventListener);
            }
        }

        const keybindingInfo: KeybindingInfo = {
            keybinding: normalizedKey,
            callback,
            scope,
            commandId: options.commandId || null,
            description: options.description || '',
            when: options.when || KeybindingWhen.ALWAYS,
            extensionId: context.extension?.id || 'unknown'
        };

        registry.set(normalizedKey, keybindingInfo);
        console.log(`✅ 快捷键已注册: ${normalizedKey} (${scope})`);

        // 如果是全局快捷键，通知主进程注册
        if (scope === KeybindingScope.GLOBAL) {
            // 生成唯一的快捷键ID
            const shortcutId = options.id || `plugin_${context.extension?.id || 'unknown'}_${Date.now()}`;

            // 保存插件全局快捷键配置
            extensionGlobalShortcutsConfig.set(shortcutId, {
                id: shortcutId,
                name: options.name || options.description || '插件快捷键',
                description: options.description || options.name || '',
                key: normalizedKey,
                enabled: true
            });

            // 重新注册所有全局快捷键（系统 + 插件）
            await syncGlobalShortcuts();

            // 监听全局快捷键触发事件
            const eventHandler = (event: CustomEvent) => {
                if (event.detail.shortcutId === shortcutId) {
                    callback();
                }
            };
            window.addEventListener('globalShortcutTriggered', eventHandler as EventListener);

            // 保存事件处理器引用，以便后续清理
            keybindingInfo.globalEventHandler = eventHandler;
        }

        // 如果是第一个局部快捷键，初始化监听器
        if (scope === KeybindingScope.LOCAL && !keybindingListener) {
            initializeLocalKeybindingListener();
        }

        return toDisposable(async () => {
            registry.delete(normalizedKey);
            console.log(`🗑️ 快捷键已注销: ${normalizedKey} (${scope})`);

            // 如果是全局快捷键，通知主进程注销
            if (scope === KeybindingScope.GLOBAL) {
                // 查找并删除对应的插件全局快捷键配置
                const shortcutId = options.id || Array.from(extensionGlobalShortcutsConfig.entries())
                    .find(([_id, config]) => config.key === normalizedKey)?.[0];

                if (shortcutId) {
                    extensionGlobalShortcutsConfig.delete(shortcutId);

                    // 移除事件监听器
                    if (keybindingInfo.globalEventHandler) {
                        window.removeEventListener('globalShortcutTriggered', keybindingInfo.globalEventHandler as EventListener);
                    }

                    // 重新注册所有全局快捷键
                    await syncGlobalShortcuts();
                }
            } else {
                disposeLocalKeybindingListenerIfUnused();
            }
        });
    }, 'keybindings.registerKeybindingInternal');
}

/**
 * 同步全局快捷键到主进程
 * 合并系统快捷键和插件快捷键，一起注册
 */
async function syncGlobalShortcuts(): Promise<void> {
    try {
        // 获取系统快捷键配置
        const systemShortcuts = await getSystemGlobalShortcuts();

        // 合并系统快捷键和插件快捷键
        const allShortcuts: Record<string, GlobalShortcutConfig> = {...systemShortcuts};

        // 添加插件快捷键
        extensionGlobalShortcutsConfig.forEach((config, id) => {
            allShortcuts[id] = config;
        });

        // 注册所有快捷键
        await extensionsController.registerGlobalShortcuts(allShortcuts);
    } catch (error) {
        console.error('❌ 同步全局快捷键失败:', error);
    }
}

/**
 * 获取系统全局快捷键配置
 * @returns 系统快捷键配置
 */
async function getSystemGlobalShortcuts(): Promise<Record<string, GlobalShortcutConfig>> {
    if (typeof shortcutConfig.getEnabledGlobalShortcuts === 'function') {
        return shortcutConfig.getEnabledGlobalShortcuts();
    }

    console.warn('⚠️ 无法获取系统全局快捷键配置');
    return {};
}

/**
 * 标准化快捷键字符串
 * @param keybinding - 快捷键组合
 * @returns 标准化后的快捷键
 */
function normalizeKeybinding(keybinding: string): string {
    // 将快捷键标准化为统一格式
    const parts = keybinding.split('+').map(part => part.trim());
    const modifiers: string[] = [];
    let key = '';

    for (const part of parts) {
        const lower = part.toLowerCase();
        if (lower === 'ctrl' || lower === 'control') {
            modifiers.push('Ctrl');
        } else if (lower === 'alt') {
            modifiers.push('Alt');
        } else if (lower === 'shift') {
            modifiers.push('Shift');
        } else if (lower === 'meta' || lower === 'cmd' || lower === 'command') {
            modifiers.push('Meta');
        } else {
            // 主键
            key = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }
    }

    // 按固定顺序排列修饰键：Ctrl, Alt, Shift, Meta
    const order = ['Alt', 'Ctrl', 'Shift', 'Meta'];
    modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
}

/**
 * 初始化局部快捷键监听器
 */
function initializeLocalKeybindingListener(): void {
    if (keybindingListener) {
        return;
    }

    keybindingListener = (e: KeyboardEvent) => {
        // 如果焦点在输入框中，不处理快捷键
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        // 构建按下的快捷键字符串
        const modifiers: string[] = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.metaKey) modifiers.push('Meta');

        let key = e.key;
        // 特殊键处理
        if (key === ' ') key = 'Space';
        else if (key.startsWith('Arrow')) void 0; // ArrowUp, ArrowDown, ArrowRight, ArrowLeft, etc.
        else key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();

        const pressedKey = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
        const normalizedKey = normalizeKeybinding(pressedKey);

        // 查找匹配的快捷键
        const keybindingInfo = localKeybindingsRegistry.get(normalizedKey);

        if (keybindingInfo) {
            // 检查上下文条件
            if (shouldExecuteKeybinding(keybindingInfo)) {
                e.preventDefault();
                e.stopPropagation();

                console.log(`⌨️ 扩展快捷键触发: ${normalizedKey}`);

                // 执行回调
                try {
                    keybindingInfo.callback();
                } catch (error) {
                    console.error(`❌ 快捷键执行失败: ${normalizedKey}`, error);
                }
            }
        }
    };

    document.addEventListener('keydown', keybindingListener);
    console.log('✅ 局部快捷键监听器已初始化');
}

/**
 * 检查是否应该执行快捷键（基于上下文条件）
 * @param keybindingInfo - 快捷键信息
 * @returns 是否应该执行
 */
function shouldExecuteKeybinding(keybindingInfo: KeybindingInfo): boolean {
    const when = keybindingInfo.when || KeybindingWhen.ALWAYS;

    if (when === KeybindingWhen.ALWAYS) {
        return true;
    }

    const playbackContext = extensionHostService.getPlaybackContext();

    switch (when) {
        case KeybindingWhen.PLAYER_PLAYING:
            return playbackContext.isPlaying;
        case KeybindingWhen.PLAYER_PAUSED:
            return !playbackContext.isPlaying;
        case KeybindingWhen.TRACK_LOADED:
            return playbackContext.currentTrack !== null && playbackContext.currentTrack !== undefined;
        case KeybindingWhen.SEARCH_FOCUSED:
            return !!document.activeElement?.classList?.contains('search-input');
        case KeybindingWhen.LYRICS_VISIBLE:
            return (document.querySelector('.lyrics-panel') as HTMLElement)?.style?.display !== 'none';
        default:
            return true;
    }
}

/**
 * 清理快捷键监听器
 */
export function disposeKeybindingListener(): void {
    if (keybindingListener) {
        document.removeEventListener('keydown', keybindingListener);
        keybindingListener = null;
        console.log('🗑️ 局部快捷键监听器已清理');
    }
}

function disposeLocalKeybindingListenerIfUnused(): void {
    if (localKeybindingsRegistry.size === 0) {
        disposeKeybindingListener();
    }
}

/**
 * 导出注册表
 */
export {localKeybindingsRegistry, globalKeybindingsRegistry};
