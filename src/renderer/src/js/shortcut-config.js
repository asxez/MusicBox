/**
 * 快捷键配置管理器
 * 负责管理局内快捷键和全局快捷键的配置
 */

class ShortcutConfig {
    constructor() {
        this.config = this.loadConfig();
        this.defaultConfig = this.getDefaultConfig();
    }

    /**
     * 获取默认快捷键配置
     */
    getDefaultConfig() {
        return {
            // 是否启用全局快捷键
            enableGlobalShortcuts: false,

            // 局内快捷键配置
            localShortcuts: {
                playPause: {
                    id: 'playPause',
                    name: '播放/暂停',
                    description: '切换音乐播放状态',
                    key: 'Space',
                    enabled: true
                },
                previousTrack: {
                    id: 'previousTrack',
                    name: '上一首',
                    description: '播放上一首歌曲',
                    key: 'Ctrl+ArrowLeft',
                    enabled: true
                },
                nextTrack: {
                    id: 'nextTrack',
                    name: '下一首',
                    description: '播放下一首歌曲',
                    key: 'Ctrl+ArrowRight',
                    enabled: true
                },
                volumeUp: {
                    id: 'volumeUp',
                    name: '音量增加',
                    description: '增加播放音量',
                    key: 'Ctrl+ArrowUp',
                    enabled: true
                },
                volumeDown: {
                    id: 'volumeDown',
                    name: '音量减少',
                    description: '减少播放音量',
                    key: 'Ctrl+ArrowDown',
                    enabled: true
                },
                search: {
                    id: 'search',
                    name: '搜索',
                    description: '聚焦到搜索框',
                    key: 'Ctrl+F',
                    enabled: true
                },
                toggleLyrics: {
                    id: 'toggleLyrics',
                    name: '显示/隐藏歌词',
                    description: '切换歌词页面显示状态',
                    key: 'Ctrl+L',
                    enabled: true
                },
                toggleFullscreen: {
                    id: 'toggleFullscreen',
                    name: '全屏切换',
                    description: '切换歌词页面全屏状态',
                    key: 'F11',
                    enabled: true
                },
                exitLyrics: {
                    id: 'exitLyrics',
                    name: '退出歌词页面',
                    description: '关闭歌词页面或退出全屏',
                    key: 'Escape',
                    enabled: true
                }
            },

            // 全局快捷键配置（在局内快捷键基础上加Alt修饰键）
            globalShortcuts: {
                playPause: {
                    id: 'playPause',
                    name: '播放/暂停',
                    description: '全局切换音乐播放状态',
                    key: 'Alt+Space',
                    enabled: true
                },
                previousTrack: {
                    id: 'previousTrack',
                    name: '上一首',
                    description: '全局播放上一首歌曲',
                    key: 'Alt+Ctrl+ArrowLeft',
                    enabled: true
                },
                nextTrack: {
                    id: 'nextTrack',
                    name: '下一首',
                    description: '全局播放下一首歌曲',
                    key: 'Alt+Ctrl+ArrowRight',
                    enabled: true
                },
                volumeUp: {
                    id: 'volumeUp',
                    name: '音量增加',
                    description: '全局增加播放音量',
                    key: 'Alt+Ctrl+ArrowUp',
                    enabled: true
                },
                volumeDown: {
                    id: 'volumeDown',
                    name: '音量减少',
                    description: '全局减少播放音量',
                    key: 'Alt+Ctrl+ArrowDown',
                    enabled: true
                },
                toggleLyrics: {
                    id: 'toggleLyrics',
                    name: '显示/隐藏歌词',
                    description: '全局切换歌词页面显示状态',
                    key: 'Alt+Ctrl+L',
                    enabled: true
                }
            }
        };
    }

    /**
     * 从本地存储加载配置
     */
    loadConfig() {
        try {
            // 等待cacheManager加载完成
            if (!window.cacheManager) {
                console.warn('CacheManager未加载，使用默认快捷键配置');
                return this.getDefaultConfig();
            }

            const saved = window.cacheManager.getLocalCache('musicbox-shortcuts');
            if (saved && typeof saved === 'object') {
                console.log('✅ 快捷键配置已从本地存储加载');
                return this.mergeWithDefaults(saved);
            } else {
                console.log('📝 未找到保存的快捷键配置，使用默认配置');
            }
        } catch (error) {
            console.warn('加载快捷键配置失败:', error);
        }
        return this.getDefaultConfig();
    }

    /**
     * 将保存的配置与默认配置合并
     */
    mergeWithDefaults(savedConfig) {
        const defaultConfig = this.getDefaultConfig();

        // 深度合并配置
        const merged = {
            enableGlobalShortcuts: savedConfig.enableGlobalShortcuts ?? defaultConfig.enableGlobalShortcuts,
            localShortcuts: {...defaultConfig.localShortcuts},
            globalShortcuts: {...defaultConfig.globalShortcuts}
        };

        // 合并局内快捷键
        if (savedConfig.localShortcuts) {
            Object.keys(defaultConfig.localShortcuts).forEach(key => {
                if (savedConfig.localShortcuts[key]) {
                    merged.localShortcuts[key] = {
                        ...defaultConfig.localShortcuts[key],
                        ...savedConfig.localShortcuts[key]
                    };
                }
            });
        }

        // 合并全局快捷键
        if (savedConfig.globalShortcuts) {
            Object.keys(defaultConfig.globalShortcuts).forEach(key => {
                if (savedConfig.globalShortcuts[key]) {
                    merged.globalShortcuts[key] = {
                        ...defaultConfig.globalShortcuts[key],
                        ...savedConfig.globalShortcuts[key]
                    };
                }
            });
        }

        return merged;
    }

    /**
     * 保存配置到本地存储
     */
    saveConfig() {
        try {
            if (!window.cacheManager) {
                console.error('❌ CacheManager未加载，无法保存快捷键配置');
                return false;
            }

            window.cacheManager.setLocalCache('musicbox-shortcuts', this.config);
            console.log('✅ 快捷键配置已保存到本地存储');

            // 验证保存是否成功
            const saved = window.cacheManager.getLocalCache('musicbox-shortcuts');
            if (saved) {
                console.log('✅ 快捷键配置保存验证成功');
                return true;
            } else {
                console.error('❌ 快捷键配置保存验证失败');
                return false;
            }
        } catch (error) {
            console.error('❌ 保存快捷键配置失败:', error);
            return false;
        }
    }

    /**
     * 获取当前配置
     */
    getConfig() {
        return this.config;
    }

    /**
     * 重新加载配置（在cacheManager加载完成后调用）
     */
    reloadConfig() {
        console.log('🔄 重新加载快捷键配置');
        this.config = this.loadConfig();
        return this.config;
    }

    /**
     * 初始化全局快捷键（在应用启动时调用）
     */
    async initializeGlobalShortcuts() {
        if (!window.electronAPI || !window.electronAPI.globalShortcuts) {
            console.warn('⚠️ 全局快捷键API不可用');
            return;
        }

        try {
            // 设置全局快捷键启用状态
            await window.electronAPI.globalShortcuts.setEnabled(this.config.enableGlobalShortcuts);

            if (this.config.enableGlobalShortcuts) {
                // 注册全局快捷键
                const globalShortcuts = this.getEnabledGlobalShortcuts();
                await window.electronAPI.globalShortcuts.register(globalShortcuts);
                console.log('🎹 全局快捷键初始化完成');
            }

            // 监听全局快捷键触发事件
            window.electronAPI.globalShortcuts.onTriggered((event, shortcutId) => {
                console.log(`🎹 全局快捷键触发: ${shortcutId}`);
                this.handleGlobalShortcutTriggered(shortcutId);
            });
        } catch (error) {
            console.error('❌ 初始化全局快捷键失败:', error);
        }
    }

    /**
     * 处理全局快捷键触发
     */
    handleGlobalShortcutTriggered(shortcutId) {
        // 触发自定义事件，让应用处理快捷键操作
        const event = new CustomEvent('globalShortcutTriggered', {
            detail: {shortcutId}
        });
        window.dispatchEvent(event);
    }

    /**
     * 更新快捷键配置
     */
    async updateShortcut(type, id, key) {
        if (type === 'local' && this.config.localShortcuts[id]) {
            this.config.localShortcuts[id].key = key;
        } else if (type === 'global' && this.config.globalShortcuts[id]) {
            this.config.globalShortcuts[id].key = key;

            // 如果是全局快捷键且全局快捷键已启用，重新注册
            if (this.config.enableGlobalShortcuts && window.electronAPI && window.electronAPI.globalShortcuts) {
                try {
                    const globalShortcuts = this.getEnabledGlobalShortcuts();
                    await window.electronAPI.globalShortcuts.register(globalShortcuts);
                    console.log('🎹 全局快捷键已更新');
                } catch (error) {
                    console.error('❌ 更新全局快捷键失败:', error);
                }
            }
        }
        return this.saveConfig();
    }

    /**
     * 启用/禁用全局快捷键
     */
    async setGlobalShortcutsEnabled(enabled) {
        this.config.enableGlobalShortcuts = enabled;

        // 通知主进程更新全局快捷键状态
        if (window.electronAPI && window.electronAPI.globalShortcuts) {
            try {
                await window.electronAPI.globalShortcuts.setEnabled(enabled);

                if (enabled) {
                    // 如果启用，注册当前的全局快捷键
                    const globalShortcuts = this.getEnabledGlobalShortcuts();
                    await window.electronAPI.globalShortcuts.register(globalShortcuts);
                } else {
                    // 如果禁用，取消注册所有全局快捷键
                    await window.electronAPI.globalShortcuts.unregister();
                }

                console.log(`🎹 全局快捷键${enabled ? '已启用' : '已禁用'}`);
            } catch (error) {
                console.error('❌ 设置全局快捷键状态失败:', error);
            }
        }

        return this.saveConfig();
    }

    /**
     * 启用/禁用特定快捷键
     */
    setShortcutEnabled(type, id, enabled) {
        if (type === 'local' && this.config.localShortcuts[id]) {
            this.config.localShortcuts[id].enabled = enabled;
        } else if (type === 'global' && this.config.globalShortcuts[id]) {
            this.config.globalShortcuts[id].enabled = enabled;
        }
        return this.saveConfig();
    }

    /**
     * 重置为默认配置
     */
    resetToDefaults() {
        this.config = this.getDefaultConfig();
        return this.saveConfig();
    }

    /**
     * 检查快捷键冲突
     */
    checkConflicts(type, id, newKey) {
        const conflicts = [];

        // 检查局内快捷键冲突
        Object.entries(this.config.localShortcuts).forEach(([key, shortcut]) => {
            if (key !== id && shortcut.key === newKey && shortcut.enabled) {
                conflicts.push({
                    type: 'local',
                    id: key,
                    name: shortcut.name,
                    key: shortcut.key
                });
            }
        });

        // 检查全局快捷键冲突
        Object.entries(this.config.globalShortcuts).forEach(([key, shortcut]) => {
            if (key !== id && shortcut.key === newKey && shortcut.enabled) {
                conflicts.push({
                    type: 'global',
                    id: key,
                    name: shortcut.name,
                    key: shortcut.key
                });
            }
        });

        return conflicts;
    }

    /**
     * 获取所有启用的局内快捷键
     */
    getEnabledLocalShortcuts() {
        const enabled = {};
        Object.entries(this.config.localShortcuts).forEach(([id, shortcut]) => {
            if (shortcut.enabled) {
                enabled[id] = shortcut;
            }
        });
        return enabled;
    }

    /**
     * 获取所有启用的全局快捷键
     */
    getEnabledGlobalShortcuts() {
        if (!this.config.enableGlobalShortcuts) {
            return {};
        }

        const enabled = {};
        Object.entries(this.config.globalShortcuts).forEach(([id, shortcut]) => {
            if (shortcut.enabled) {
                enabled[id] = shortcut;
            }
        });
        return enabled;
    }
}

window.shortcutConfig = new ShortcutConfig();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShortcutConfig;
}
