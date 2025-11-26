// 全局快捷键相关 IPC

const {app} = require('electron');

// 模块内状态
let globalShortcutsEnabled = false;
const registeredShortcuts = new Map(); // id -> electronKey

// 防重复注册的守卫
let ipcHandlersBound = false;
let willQuitHandlerBound = false;
let cleanedOnExit = false;

/**
 * 转换快捷键格式
 * @param {string} shortcutKey
 * @returns {string}
 */
function convertToElectronShortcut(shortcutKey) {
    if (!shortcutKey) return '';
    return shortcutKey
        .replace(/Ctrl/g, 'CommandOrControl')
        .replace(/Cmd/g, 'Command')
        .replace(/ArrowUp/g, 'Up')
        .replace(/ArrowDown/g, 'Down')
        .replace(/ArrowLeft/g, 'Left')
        .replace(/ArrowRight/g, 'Right')
        .replace(/Space/g, 'Space');
}

/**
 * 取消注册所有全局快捷键
 * @param {{quiet?: boolean}} [opts]
 */
function unregisterAllGlobalShortcuts(opts = {}) {
    const {globalShortcut} = require('electron');

    const {quiet = false} = opts;
    if (!quiet) {
        console.log('🎹 取消注册所有全局快捷键');
    }
    globalShortcut.unregisterAll();
    registeredShortcuts.clear();
}

/**
 * 注册全局快捷键
 * @param {Record<string, {name: string, key: string, enabled: boolean}>} shortcuts
 */
function registerGlobalShortcuts(shortcuts) {
    const {globalShortcut} = require('electron');
    const {getMainWindow} = require('../core/window');

    console.log('🎹 注册全局快捷键');

    // 先清除所有已注册的快捷键
    unregisterAllGlobalShortcuts({quiet: true});

    if (!shortcuts || typeof shortcuts !== 'object') {
        console.warn('⚠️ 无效的快捷键配置');
        return;
    }

    Object.entries(shortcuts).forEach(([id, shortcut]) => {
        if (!shortcut.enabled || !shortcut.key) return;

        try {
            const electronKey = convertToElectronShortcut(shortcut.key);
            const success = globalShortcut.register(electronKey, () => {
                console.log(`🎹 全局快捷键触发: ${shortcut.name} (${electronKey})`);
                const win = getMainWindow();
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-shortcut-triggered', id);
                }
            });

            if (success) {
                registeredShortcuts.set(id, electronKey);
                console.log(`✅ 全局快捷键注册成功: ${shortcut.name} (${electronKey})`);
            } else {
                console.warn(`⚠️ 全局快捷键注册失败: ${shortcut.name} (${electronKey})`);
            }
        } catch (error) {
            console.error(`❌ 注册全局快捷键失败: ${shortcut.name}`, error);
        }
    });
    console.log(`🎹 已注册 ${registeredShortcuts.size} 个全局快捷键`);
}

/**
 * 注册全局快捷键相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 */
function registerGlobalShortcutsIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerGlobalShortcutsIpcHandlers: 缺少 ipcMain');
    if (ipcHandlersBound) return; // 防止重复绑定
    ipcHandlersBound = true;

    ipcMain.handle('globalShortcuts:register', async (event, shortcuts) => {
        try {
            if (!globalShortcutsEnabled) {
                console.log('🎹 全局快捷键已禁用，跳过注册');
                return false;
            }
            registerGlobalShortcuts(shortcuts);
            return true;
        } catch (error) {
            console.error('❌ 注册全局快捷键失败:', error);
            return false;
        }
    });

    ipcMain.handle('globalShortcuts:unregister', async () => {
        try {
            unregisterAllGlobalShortcuts();
            return true;
        } catch (error) {
            console.error('❌ 取消注册全局快捷键失败:', error);
            return false;
        }
    });

    ipcMain.handle('globalShortcuts:setEnabled', async (event, enabled) => {
        try {
            globalShortcutsEnabled = enabled;
            console.log(`🎹 全局快捷键${enabled ? '已启用' : '已禁用'}`);
            if (!enabled) unregisterAllGlobalShortcuts();
            return true;
        } catch (error) {
            console.error('❌ 设置全局快捷键状态失败:', error);
            return false;
        }
    });

    ipcMain.handle('globalShortcuts:isEnabled', async () => {
        return globalShortcutsEnabled;
    });

    // 应用退出时清理全局快捷键
    if (!willQuitHandlerBound) {
        willQuitHandlerBound = true;
        app.on('will-quit', () => {
            if (cleanedOnExit) return;
            cleanedOnExit = true;
            console.log('🎹 应用退出，清理全局快捷键');
            unregisterAllGlobalShortcuts();
        });
    }
}

module.exports = {
    registerGlobalShortcutsIpcHandlers,
};
